<script lang="ts">
	import { onMount } from 'svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { cart as cartStore } from '$lib/stores/cart';
	import { ensureCart, getCart, clearCart } from '$lib/cart';
	import { Button } from '$lib/components/ui/button';
	import { get } from 'svelte/store';
	import { getCurrentCustomer } from '$lib/auth';
	import { listAddresses } from '$lib/customer-api';
	import { getStoreClient } from '$lib/medusa';
	import { showToast } from '$lib/stores/toast';
	import { US_STATES } from '$lib/us';
	import { isValidEmail, sanitizeInput } from '$lib/security';
	import type { HttpTypes } from '@medusajs/types';
	import { env as publicEnv } from '$env/dynamic/public';
	import { loadStripe } from '@stripe/stripe-js';
	import StripePaymentElement from '$lib/components/StripePaymentElement.svelte';
	import { Motion, AnimateSharedLayout } from 'svelte-motion';
	import { formatCurrency } from '$lib/utils';
	import { logger } from '$lib/logger';
	import {
		trackBeginCheckout,
		trackAddShippingInfo,
		trackAddPaymentInfo,
		trackPurchase,
		formatCartItemsForAnalytics,
		calculateCartValue
	} from '$lib/utils/analytics';

	let email: string = $state('');
	let shipping = $state({
		first_name: '',
		last_name: '',
		address_1: '',
		address_2: '',
		city: '',
		country_code: 'us',
		province: '',
		postal_code: '',
		phone: '',
		company: '',
		address_name: ''
	});
	let billingSameAsShipping: boolean = $state(true);
	let billing = $state({
		first_name: '',
		last_name: '',
		address_1: '',
		address_2: '',
		city: '',
		country_code: 'us',
		province: '',
		postal_code: '',
		phone: '',
		company: '',
		address_name: ''
	});
	let loading: boolean = $state(false);
	let saveAddress: boolean = $state(true);
	let errorMsg: string | null = $state(null);
	let overlay: boolean = $state(false);

	// Shipping options
	let shippingOptions: HttpTypes.StoreCartShippingOption[] = $state([]);
	let shippingOptionsLoading: boolean = $state(false);
	let selectedShippingOptionId: string | null = $state(null);

	// Payment
	let stripePromise: Promise<any> | null = $state(null); // holds the promise from loadStripe
	let stripeInstance: any = $state(null); // resolved Stripe instance
	let elements: any = $state(null);
	let paymentElementRef: any = $state(null);
	let ready: boolean = $state(false);
	let paymentClientSecret: string | null = $state(null);
	let paymentLoading: boolean = $state(false);
	let paymentError: string | null = $state(null);
	let paymentReady: boolean = $state(false);

	// Stepper
	let step: 'address' | 'shipping' | 'payment' = $state('address');

	// Saved addresses
	let savedAddresses: HttpTypes.StoreCustomerAddress[] = $state([]);
	let selectedShippingAddressId: string | 'new' = $state('new');
	let selectedBillingAddressId: string | 'new' = $state('new');

	// Sync billing address when same as shipping
	$effect(() => {
		if (billingSameAsShipping) {
			billing = { ...shipping };
			selectedBillingAddressId = selectedShippingAddressId;
		}
	});

	function applyAddressToShipping(a: Partial<HttpTypes.StoreCustomerAddress> | undefined | null) {
		if (!a) return;
		shipping = {
			first_name: a.first_name ?? '',
			last_name: a.last_name ?? '',
			address_1: a.address_1 ?? '',
			address_2: a.address_2 ?? '',
			city: a.city ?? '',
			country_code: (a.country_code ?? 'us').toLowerCase(),
			province: a.province ?? '',
			postal_code: a.postal_code ?? '',
			phone: (a as any).phone ?? '',
			company: (a as any).company ?? '',
			address_name: (a as any).address_name ?? ''
		};
	}

	function applyAddressToBilling(a: Partial<HttpTypes.StoreCustomerAddress> | undefined | null) {
		if (!a) return;
		billing = {
			first_name: a.first_name ?? '',
			last_name: a.last_name ?? '',
			address_1: a.address_1 ?? '',
			address_2: a.address_2 ?? '',
			city: a.city ?? '',
			country_code: (a.country_code ?? 'us').toLowerCase(),
			province: a.province ?? '',
			postal_code: a.postal_code ?? '',
			phone: (a as any).phone ?? '',
			company: (a as any).company ?? '',
			address_name: (a as any).address_name ?? ''
		};
	}

	function onSelectShippingAddress(id: string | 'new') {
		selectedShippingAddressId = id;
		if (id === 'new') return;
		const sel = savedAddresses.find((x) => x.id === id);
		applyAddressToShipping(sel);
		if (billingSameAsShipping) {
			applyAddressToBilling(sel);
			selectedBillingAddressId = id;
		}
		const isDefaultSelected = !!(sel as any)?.is_default_shipping;
		saveAddress = !isDefaultSelected;
	}

	function onSelectBillingAddress(id: string | 'new') {
		selectedBillingAddressId = id;
		if (id === 'new') return;
		const sel = savedAddresses.find((x) => x.id === id);
		applyAddressToBilling(sel);
	}

	onMount(async () => {
		await ensureCart();
		await getCart();
		const me = await getCurrentCustomer();
		if (me) {
			email = me.email ?? '';
			const resp = await listAddresses().catch(() => null);
			savedAddresses = ((resp as any)?.addresses ??
				(me as any).shipping_addresses ??
				[]) as HttpTypes.StoreCustomerAddress[];
			if (savedAddresses.length > 0) {
				const defaultShipping = savedAddresses.find((addr: any) => addr?.is_default_shipping);
				if (defaultShipping) {
					selectedShippingAddressId = defaultShipping.id!;
					applyAddressToShipping(defaultShipping);
				} else {
					selectedShippingAddressId = savedAddresses[0]?.id ?? 'new';
					applyAddressToShipping(savedAddresses[0]);
				}

				const defaultBilling = savedAddresses.find((addr: any) => addr?.is_default_billing);
				if (defaultBilling && !billingSameAsShipping) {
					selectedBillingAddressId = defaultBilling.id!;
					applyAddressToBilling(defaultBilling);
				} else if (billingSameAsShipping) {
					selectedBillingAddressId = selectedShippingAddressId;
				}

				const isDefaultShippingSelected = !!(
					savedAddresses.find((x) => x.id === selectedShippingAddressId) as any
				)?.is_default_shipping;
				saveAddress = !isDefaultShippingSelected;
			}
		}

		// Track begin_checkout event
		const c = get(cartStore);
		if (c && c.items && c.items.length > 0) {
			try {
				const items = formatCartItemsForAnalytics(c.items as any[]);
				const value = calculateCartValue(c);
				trackBeginCheckout(value, c.currency_code?.toUpperCase() || 'USD', items);
			} catch (e) {
				logger.warn('Analytics tracking failed:', e);
			}
		}
	});

	async function continueToShipping() {
		const ok = await saveAddressesToCart();
		if (!ok) return;
		await fetchShippingOptions();
		step = 'shipping';
	}

	async function fetchShippingOptions() {
		shippingOptionsLoading = true;
		try {
			const sdk = getStoreClient() as any;
			const c = get(cartStore);
			if (!c?.id) return;

			const { shipping_options } = await sdk.store.fulfillment.listCartOptions({
				cart_id: c.id
			});
			shippingOptions = shipping_options || [];
		} catch (err: any) {
			logger.error('Failed to fetch shipping options:', err);
			showToast('Failed to load shipping options', { type: 'error' });
			shippingOptions = [];
		} finally {
			shippingOptionsLoading = false;
		}
	}

	async function continueToPayment() {
		const applied = await applyShippingMethod();
		if (!applied) return;
		
		// Track add_shipping_info event
		try {
			const c = get(cartStore);
			if (c && c.items && c.items.length > 0) {
				const items = formatCartItemsForAnalytics(c.items as any[]);
				const value = calculateCartValue(c);
				const selectedOption = shippingOptions.find(opt => opt.id === selectedShippingOptionId);
				trackAddShippingInfo(
					value,
					c.currency_code?.toUpperCase() || 'USD',
					items,
					selectedOption?.name || 'Standard Shipping'
				);
			}
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
		}
		
		step = 'payment';
		const ok = await setupPayment();
		if (!ok && paymentError) showToast(paymentError, { type: 'error' });
		
		// Track add_payment_info event
		if (ok) {
			try {
				const c = get(cartStore);
				if (c && c.items && c.items.length > 0) {
					const items = formatCartItemsForAnalytics(c.items as any[]);
					const value = calculateCartValue(c);
					trackAddPaymentInfo(value, c.currency_code?.toUpperCase() || 'USD', items, 'card');
				}
			} catch (e) {
				logger.warn('Analytics tracking failed:', e);
			}
		}
	}

	async function applyShippingMethod() {
		if (!selectedShippingOptionId) {
			showToast('Please select a shipping method', { type: 'error' });
			return false;
		}

		try {
			const sdk = getStoreClient() as any;
			const c = get(cartStore);
			if (!c?.id) return false;

			await sdk.store.cart.addShippingMethod(c.id, {
				option_id: selectedShippingOptionId
			});

			await getCart();
			return true;
		} catch (err: any) {
			logger.error('Failed to apply shipping method:', err);
			showToast('Failed to apply shipping method', { type: 'error' });
			return false;
		}
	}

	async function saveAddressesToCart() {
		const sdk = getStoreClient() as any;
		const c = get(cartStore);
		if (!c?.id) return false;
		if (!email || !email.includes('@')) {
			errorMsg = 'Please enter a valid email.';
			showToast('Enter a valid email', { type: 'error' });
			return false;
		}
		try {
			await sdk.store.cart.update(c.id, { email });
			const stripAddr = (a: any) => {
				const { address_name, company, ...rest } = a || {};
				return rest;
			};
			await sdk.store.cart.update(c.id, {
				shipping_address: stripAddr(shipping),
				billing_address: billingSameAsShipping ? stripAddr(shipping) : stripAddr(billing)
			});
			return true;
		} catch (err: any) {
			errorMsg = err?.message || 'Failed to save addresses';
			showToast(errorMsg!, { type: 'error' });
			return false;
		}
	}

	// Setup payment session per Medusa docs: https://docs.medusajs.com/resources/commerce-modules/payment/stripe
	async function setupPayment() {
		paymentLoading = true;
		paymentError = null;
		try {
			const sdk = getStoreClient() as any;
			let c = get(cartStore);
			if (!c?.id) {
				await ensureCart();
				await getCart();
				c = get(cartStore);
			}
			if (!c?.id) {
				paymentError = 'Cart not initialized';
				return false;
			}
			if ((c.total || 0) <= 0) {
				paymentReady = false;
				return true;
			}
			const pk = publicEnv.PUBLIC_STRIPE_KEY;
			if (!pk) {
				paymentError = 'Stripe publishable key missing';
				return false;
			}
			if (!stripePromise) {
				stripePromise = loadStripe(pk);
				stripePromise
					.then((inst) => {
						stripeInstance = inst;
					})
					.catch((e) => logger.error('[checkout] loadStripe failed', e));
			}

			let providerId: string | null = null;
			const listParams: any = {};
			if ((c as any).region_id) listParams.region_id = (c as any).region_id;
			const { payment_providers = [] } = await sdk.store.payment.listPaymentProviders(listParams);
			providerId =
				(payment_providers.find((p: any) => (p.id || '').toLowerCase().includes('stripe')) || {})
					.id || null;

			if (!providerId) {
				paymentError = 'Stripe provider unavailable';
				return false;
			}

			if (!c.total || c.total <= 0) {
				paymentError = 'Cart total must be greater than 0 for payment';
				return false;
			}

			if (!c.items || c.items.length === 0) {
				paymentError = 'Cart must have at least one item for payment';
				return false;
			}

			// Initiate payment session (creates payment_collection if missing)
			let initiateResp: any = null;
			try {
				initiateResp = await sdk.store.payment.initiatePaymentSession(c, {
					provider_id: providerId,
					data: { setup_future_usage: 'off_session' }
				});
			} catch (e: any) {
				logger.error('[checkout] initiatePaymentSession failed', {
					cartId: c.id,
					providerId,
					message: e?.message,
					stack: e?.stack
				});
				paymentError = 'Failed to initiate Stripe payment session';
				return false;
			}

			// Try to locate payment collection from initiate response directly first
			let paymentCollection =
				initiateResp?.payment_collection || initiateResp?.cart?.payment_collection;
			if (!paymentCollection) {
				// Retrieve cart with broader fields including nested sessions
				const fieldStr = 'id,*payment_collection,*payment_collection.payment_sessions';
				const { cart: refreshedA } = await sdk.store.cart.retrieve(c.id, { fields: fieldStr });
				paymentCollection = (refreshedA as any)?.payment_collection;
				// If still missing, wait briefly and retry once (handles eventual consistency)
				if (!paymentCollection) {
					await new Promise((r) => setTimeout(r, 400));
					const { cart: refreshedB } = await sdk.store.cart.retrieve(c.id, { fields: fieldStr });
					paymentCollection = (refreshedB as any)?.payment_collection;
				}
			}

			if (!paymentCollection) {
				logger.error('[checkout] payment_collection still missing after initiation', {
					cartId: c.id,
					providerId,
					initiateKeys: Object.keys(initiateResp || {})
				});
				paymentError =
					'Stripe payment session not created - backend did not return payment collection';
				return false;
			}

			const sessions = paymentCollection?.payment_sessions || [];
			const stripeSession = sessions.find((s: any) =>
				(s.provider_id || '').toLowerCase().includes('stripe')
			);
			if (!stripeSession) {
				logger.error('[checkout] no stripe session in payment_collection', {
					cartId: c.id,
					providerId,
					paymentCollectionId: paymentCollection?.id,
					sessionProviders: sessions.map((s: any) => s.provider_id)
				});
				paymentError = 'Stripe payment session not created - check backend configuration';
				return false;
			}

			paymentClientSecret =
				stripeSession?.data?.client_secret ||
				stripeSession?.data?.clientSecret ||
				stripeSession?.data?.payment_intent?.client_secret ||
				stripeSession?.data?.paymentIntent?.client_secret ||
				stripeSession?.data?.pi?.client_secret ||
				stripeSession?.data?.intent?.client_secret ||
				null;

			if (!paymentClientSecret) {
				logger.error('[checkout] stripe session missing client secret', {
					stripeSessionId: stripeSession?.id,
					stripeSessionDataKeys: Object.keys(stripeSession?.data || {})
				});
				paymentError = 'Client secret missing - check Stripe configuration on backend';
				return false;
			}
			paymentReady = true;
			return true;
		} catch (err: any) {
			paymentError = err?.message || 'Payment initialization failed';
			return false;
		} finally {
			paymentLoading = false;
		}
	}

	async function submitCheckout() {
		errorMsg = null;
		loading = true;
		overlay = true;
		const sdk = getStoreClient() as any;
		try {
			const c = get(cartStore);
			if (!c?.id) return;

			if ((c.total || 0) <= 0) {
				const { cart } = await sdk.store.cart.complete(c.id);
				if ((cart as any)?.completed_at) {
					showToast('Order placed successfully', { type: 'success' });
					// Clear cart after successful order placement
					try { await clearCart(); } catch (e) { logger.warn('Failed to clear cart:', e); }
					window.location.href = '/checkout/success';
				} else {
					errorMsg = 'Failed to complete free order. Please contact support.';
					showToast(errorMsg as string, { type: 'error' });
				}
				return;
			}

			const ok = await saveAddressesToCart();
			if (!ok) return;

			if (!selectedShippingOptionId) {
				await fetchShippingOptions();
			}
			if (selectedShippingOptionId) {
				await applyShippingMethod();
			}

			if ((c.total || 0) > 0 && !paymentReady) {
				const okPayment = await setupPayment();
				if (!okPayment) throw new Error(paymentError || 'Payment not ready');
			}

			if ((c.total || 0) > 0 && !paymentClientSecret) throw new Error('Payment not initialized');

			const stripeInstance = await stripePromise;
			if ((c.total || 0) > 0 && !stripeInstance) throw new Error('Stripe not ready');
			// Wait briefly for element mount if necessary
			if ((c.total || 0) > 0) {
				let attempts = 0;
				while (attempts < 10 && (!elements || !ready)) {
					await new Promise((r) => setTimeout(r, 100));
					attempts++;
				}
				if (!elements || !ready) {
					throw new Error('Stripe payment element not mounted');
				}
			}

			const returnUrl = `${publicEnv.PUBLIC_BASE_URL || window.location.origin}/checkout/success`;

			if ((c.total || 0) > 0) {
				const { error: submitError } = await elements.submit();
				if (submitError) {
					paymentError = submitError.message || 'Failed to submit payment details';
					throw new Error(paymentError!);
				}
			}

			if ((c.total || 0) > 0) {
				const { error } = await stripeInstance.confirmPayment({
					elements,
					confirmParams: { return_url: returnUrl },
					redirect: 'if_required'
				});
				if (error) {
					logger.error('[checkout] confirmPayment error', {
						code: error.type,
						message: error.message,
						cartId: c.id
					});
					paymentError = error.message || 'Payment confirmation failed.';
					throw new Error(paymentError!);
				}
			}

			const meResp = await sdk.store.customer.retrieve().catch(() => null);
			if (saveAddress && meResp?.customer) {
				const stripAddr = (a: any) => {
					const { address_name, company, ...rest } = a || {};
					return { ...rest };
				};
				await sdk.store.customer
					.createAddress({
						...stripAddr(shipping),
						is_default_shipping: false,
						is_default_billing: false
					})
					.catch(() => {});
				showToast('Address saved to account', { type: 'success' });
			}

			// Complete cart -> may return { type: 'order', order } or { type: 'cart', cart, error }
			let completion: any = null;
			try {
				completion = await sdk.store.cart.complete(c.id);
			} catch (e: any) {
				logger.error('[checkout] cart.complete threw', e?.message, e);
				throw new Error(e?.message || 'Failed to finalize order after payment');
			}

			if (completion?.type === 'order' && completion.order) {
				showToast('Order placed successfully', { type: 'success' });
				
				// Track purchase event
				try {
					const order = completion.order;
					const items = formatCartItemsForAnalytics(order.items || c.items || []);
					const value = calculateCartValue(order);
					const shipping = order.shipping_total || 0;
					const tax = order.tax_total || 0;
					trackPurchase(
						order.id,
						value,
						order.currency_code?.toUpperCase() || c.currency_code?.toUpperCase() || 'USD',
						items,
						shipping,
						tax
					);
				} catch (e) {
					logger.warn('Analytics tracking failed:', e);
				}
				
				// Optionally store order id for success page usage
				try {
					localStorage.setItem('last_order_id', completion.order.id);
				} catch {}
				
				// Clear cart after successful order
				try { await clearCart(); } catch (e) { logger.warn('Failed to clear cart:', e); }
				
				window.location.href = '/checkout/success';
				return;
			}

			// Fallback: sometimes completion can return a cart if something prevented order creation
			if (completion?.type === 'cart') {
				const compCart = completion.cart;
				const backendError = completion.error || compCart?.metadata?.completion_error;
				logger.error('[checkout] completion returned cart (not order)', {
					cartId: compCart?.id,
					backendError,
					paymentCollection: compCart?.payment_collection?.id,
					paymentSessions: compCart?.payment_collection?.payment_sessions?.map((s: any) => ({
						id: s.id,
						status: s.status,
						provider: s.provider_id
					}))
				});
				// If payment session authorized but not completed, attempt a short poll for order creation
				let polledOrder: any = null;
				if (
					compCart?.payment_collection?.payment_sessions?.some((s: any) =>
						['authorized', 'pending'].includes(s.status)
					)
				) {
					for (let i = 0; i < 5; i++) {
						await new Promise((r) => setTimeout(r, 400));
						try {
							const refreshed = await sdk.store.cart.retrieve(compCart.id, { fields: 'id' });
							// There's no direct way to fetch order by cart here without separate lookup; break if completed_at set
							if ((refreshed as any)?.cart?.completed_at) {
								polledOrder = refreshed.cart;
								break;
							}
						} catch {}
					}
				}
				if (polledOrder?.completed_at) {
					showToast('Order placed successfully', { type: 'success' });
					// Clear cart after successful order placement
					try { await clearCart(); } catch (e) { logger.warn('Failed to clear cart:', e); }
					window.location.href = '/checkout/success';
					return;
				}
				errorMsg =
					backendError ||
					'Payment succeeded but order could not be finalized. Please contact support.';
				showToast(errorMsg as string, { type: 'error' });
				return;
			}

			// Unknown shape
			logger.error('[checkout] unexpected completion response', completion);
			throw new Error('Unexpected checkout completion response');
		} catch (e) {
			errorMsg = paymentError || (e as any)?.message || 'Checkout failed.';
			showToast(errorMsg as string, { type: 'error' });
	} finally {
		loading = false;
		overlay = false;
	}
}
</script>

<SEO
	title="Checkout - Khadka Foods"
	description="Complete your order securely at Khadka Foods. Fast checkout with multiple payment options."
	keywords={['checkout', 'payment', 'order', 'Khadka Foods']}
	canonical="https://khadkafoods.com/checkout"
/><section class="w-full py-10">
	<div class="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
		{#if overlay}
			<div
				class="fixed inset-0 z-[70] flex items-center justify-center bg-black/20 backdrop-blur-sm"
			>
				<div class="loading loading-lg loading-spinner text-primary"></div>
			</div>
		{/if}
		<h1 class="mb-6 text-3xl font-bold tracking-tight">Checkout</h1>

		{#if errorMsg}
			<div class="mb-4 alert alert-error"><span>{errorMsg}</span></div>
		{/if}

		<div class="card border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body space-y-4">
				<!-- Stepper nav -->
				<AnimateSharedLayout>
					<div
						class="relative flex items-center gap-2 rounded-full border border-base-300 bg-base-200/50 p-1"
					>
						<button
							class="relative rounded-full px-3 py-1.5 text-sm"
							onclick={() => (step = 'address')}
						>
							{#if step === 'address'}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100"
									></div>
								</Motion>
							{/if}
							<span class="relative z-10">Address</span>
						</button>
						<button
							class="relative rounded-full px-3 py-1.5 text-sm"
							onclick={() => (step = 'shipping')}
							disabled={!shippingOptions.length}
						>
							{#if step === 'shipping'}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100"
									></div>
								</Motion>
							{/if}
							<span class="relative z-10">Shipping</span>
						</button>
						<button
							class="relative rounded-full px-3 py-1.5 text-sm"
							onclick={() => (step = 'payment')}
							disabled={(get(cartStore)?.total || 0) > 0 && !paymentReady}
						>
							{#if step === 'payment'}
								<Motion layoutId="checkout-step" let:motion>
									<div
										use:motion
										class="absolute inset-0 rounded-full border border-base-300 bg-base-100"
									></div>
								</Motion>
							{/if}
							<span class="relative z-10">Payment</span>
						</button>
					</div>
				</AnimateSharedLayout>

				{#if step === 'address'}
					<h2 class="card-title">Contact</h2>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Email</span></div>
						<input
							class="input-bordered input w-full border-base-300 input-primary"
							type="email"
							bind:value={email}
							placeholder="you@example.com"
						/>
					</label>

					{#if savedAddresses.length > 0}
						<h2 class="mt-2 card-title">Select shipping address</h2>
						<div class="grid gap-2">
							{#each savedAddresses as a (a.id)}
								<label
									class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
								>
									<input
										type="radio"
										class="radio mt-1 radio-primary"
										name="shipping-address-select"
										checked={selectedShippingAddressId === a.id}
										onchange={() => onSelectShippingAddress(a.id!)}
									/>
									<div class="min-w-0 flex-1 overflow-hidden">
										<div class="font-medium break-words">
											{(a as any).address_name || `${a.first_name} ${a.last_name}`}
										</div>
										<div class="flex flex-wrap items-center gap-1.5 mt-1">
											{#if (a as any).is_default_shipping}
												<span
													class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-primary-content shadow badge-primary whitespace-nowrap"
													>Default Shipping</span
												>
											{/if}
											{#if (a as any).is_default_billing}
												<span
													class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-secondary-content shadow badge-secondary whitespace-nowrap"
													>Default Billing</span
												>
											{/if}
										</div>
										{#if (a as any).company}
											<div class="text-sm opacity-70 break-words mt-1">{(a as any).company}</div>
										{/if}
										<div class="text-sm opacity-70 break-words">{a.first_name} {a.last_name}</div>
										<div class="text-sm opacity-70 break-words">
											{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}
										</div>
										<div class="text-sm opacity-70 break-words">
											{a.province}, {a.postal_code}, {a.country_code}
										</div>
										{#if (a as any).phone}
											<div class="text-sm opacity-70 break-words">{(a as any).phone}</div>
										{/if}
									</div>
								</label>
							{/each}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-base-300 p-3 hover:border-primary/50"
							>
								<input
									type="radio"
									class="radio radio-primary"
									name="shipping-address-select"
									checked={selectedShippingAddressId === 'new'}
									onchange={() => onSelectShippingAddress('new')}
								/>
								<div class="opacity-80">Use a new shipping address</div>
							</label>
						</div>

						{#if !billingSameAsShipping}
							<h2 class="mt-2 card-title">Select billing address</h2>
							<div class="grid gap-2">
								{#each savedAddresses as a (a.id)}
									<label
										class="flex cursor-pointer items-start gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
									>
										<input
											type="radio"
											class="radio mt-1 radio-primary"
											name="billing-address-select"
											checked={selectedBillingAddressId === a.id}
											onchange={() => onSelectBillingAddress(a.id!)}
										/>
										<div class="min-w-0 flex-1 overflow-hidden">
											<div class="font-medium break-words">
												{(a as any).address_name || `${a.first_name} ${a.last_name}`}
											</div>
											<div class="flex flex-wrap items-center gap-1.5 mt-1">
												{#if (a as any).is_default_shipping}
													<span
														class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-primary-content shadow badge-primary whitespace-nowrap"
														>Default Shipping</span
													>
												{/if}
												{#if (a as any).is_default_billing}
													<span
														class="badge rounded-full badge-sm px-2 py-0.5 text-[10px] text-secondary-content shadow badge-secondary whitespace-nowrap"
														>Default Billing</span
													>
												{/if}
											</div>
											{#if (a as any).company}
												<div class="text-sm opacity-70 break-words mt-1">{(a as any).company}</div>
											{/if}
											<div class="text-sm opacity-70 break-words">{a.first_name} {a.last_name}</div>
											<div class="text-sm opacity-70 break-words">
												{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}
											</div>
											<div class="text-sm opacity-70 break-words">
												{a.province}, {a.postal_code}, {a.country_code}
											</div>
											{#if (a as any).phone}
												<div class="text-sm opacity-70 break-words">{(a as any).phone}</div>
											{/if}
										</div>
									</label>
								{/each}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-base-300 p-3 hover:border-primary/50"
								>
									<input
										type="radio"
										class="radio radio-primary"
										name="billing-address-select"
										checked={selectedBillingAddressId === 'new'}
										onchange={() => onSelectBillingAddress('new')}
									/>
									<div class="opacity-80">Use a new billing address</div>
								</label>
							</div>
						{/if}
					{/if}

					<h2 class="mt-2 card-title">Shipping address</h2>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						placeholder="Address name (optional)"
						bind:value={shipping.address_name}
					/>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="First name"
							bind:value={shipping.first_name}
						/>
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="Last name"
							bind:value={shipping.last_name}
						/>
					</div>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						placeholder="Company (optional)"
						bind:value={shipping.company}
					/>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						placeholder="Address 1"
						bind:value={shipping.address_1}
					/>
					<input
						class="input-bordered input w-full border-base-300 input-primary"
						placeholder="Address 2"
						bind:value={shipping.address_2}
					/>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="City"
							bind:value={shipping.city}
						/>
						<select class="select-bordered select" bind:value={shipping.province}>
							<option value="" disabled>Select state</option>
							{#each US_STATES as s}
								<option value={s.code}>{s.name}</option>
							{/each}
						</select>
					</div>
					<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="Postal code"
							bind:value={shipping.postal_code}
						/>
						<input
							class="input-bordered input bg-base-200/60 opacity-100 input-primary dark:bg-base-300/20 dark:text-base-content/80"
							placeholder="US"
							value={(shipping.country_code || 'us').toUpperCase()}
							disabled
						/>
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="Phone"
							bind:value={shipping.phone}
						/>
					</div>

					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input
								type="checkbox"
								class="checkbox checkbox-primary"
								bind:checked={billingSameAsShipping}
								onchange={() => {
									if (billingSameAsShipping) {
										applyAddressToBilling(shipping);
									}
								}}
							/>
							<span class="label-text">Billing address same as shipping</span>
						</label>
					</div>

					{#if !(selectedShippingAddressId !== 'new' && (savedAddresses.find((x) => x.id === selectedShippingAddressId) as any)?.is_default_shipping)}
						<div class="form-control">
							<label class="label cursor-pointer justify-start gap-3">
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									bind:checked={saveAddress}
								/>
								<span class="label-text">Save this address to my account</span>
							</label>
						</div>
					{/if}

					{#if !billingSameAsShipping}
						<h2 class="mt-2 card-title">Billing address</h2>
						<input
							class="input-bordered input w-full border-base-300 input-primary"
							placeholder="Address name (optional)"
							bind:value={billing.address_name}
						/>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							<input
								class="input-bordered input border-base-300 input-primary"
								placeholder="First name"
								bind:value={billing.first_name}
							/>
							<input
								class="input-bordered input border-base-300 input-primary"
								placeholder="Last name"
								bind:value={billing.last_name}
							/>
						</div>
						<input
							class="input-bordered input w-full border-base-300 input-primary"
							placeholder="Company (optional)"
							bind:value={billing.company}
						/>
						<input
							class="input-bordered input w-full border-base-300 input-primary"
							placeholder="Address 1"
							bind:value={billing.address_1}
						/>
						<input
							class="input-bordered input w-full border-base-300 input-primary"
							placeholder="Address 2"
							bind:value={billing.address_2}
						/>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							<input
								class="input-bordered input border-base-300 input-primary"
								placeholder="City"
								bind:value={billing.city}
							/>
							<select class="select-bordered select" bind:value={billing.province}>
								<option value="" disabled>Select state</option>
								{#each US_STATES as s}
									<option value={s.code}>{s.name}</option>
								{/each}
							</select>
						</div>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
							<input
								class="input-bordered input border-base-300 input-primary"
								placeholder="Postal code"
								bind:value={billing.postal_code}
							/>
							<input
								class="input-bordered input bg-base-200/60 opacity-100 input-primary dark:bg-base-300/20 dark:text-base-content/80"
								placeholder="US"
								value={(billing.country_code || 'us').toUpperCase()}
								disabled
							/>
							<input
								class="input-bordered input border-base-300 input-primary"
								placeholder="Phone"
								bind:value={billing.phone}
							/>
						</div>
					{/if}

					<!-- Address step actions -->
					<div class="flex justify-end pt-2">
						<Button class="btn btn-primary" onclick={continueToShipping}
							>Continue to shipping</Button
						>
					</div>
				{/if}

				{#if step === 'shipping'}
					<h2 class="mt-2 card-title">Shipping method</h2>
					{#if shippingOptionsLoading}
						<div class="loading loading-md loading-spinner text-primary"></div>
					{:else if shippingOptions.length > 0}
						<div class="mt-2 grid gap-2">
							{#each shippingOptions as opt (opt.id)}
								<label
									class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-3 hover:border-primary/50"
								>
									<input
										type="radio"
										class="radio radio-primary"
										name="shipping-option"
										checked={selectedShippingOptionId === opt.id}
										onchange={() => (selectedShippingOptionId = opt.id!)}
									/>
									<div class="flex w-full items-center justify-between">
										<div>
											<div class="font-medium">{opt.name}</div>
											<div class="text-xs opacity-70">{opt.provider_id}</div>
										</div>
										<div class="text-right text-sm">
											{#if opt.price_type === 'calculated'}
												<span class="opacity-80">Calculated at next step</span>
											{:else if (opt.amount ?? 0) <= 0}
												<span class="font-medium text-success">+ Free</span>
											{:else}
												<span class="font-medium text-success"
													>+ {formatCurrency(
														opt.amount ?? 0,
														get(cartStore)?.currency_code || 'USD'
													)}</span
												>
											{/if}
										</div>
									</div>
								</label>
							{/each}
						</div>
						<div class="flex justify-between pt-2">
							<Button class="btn" onclick={() => (step = 'address')}>Back</Button>
							<Button
								class="btn btn-primary"
								onclick={continueToPayment}
								disabled={!selectedShippingOptionId}>Continue to payment</Button
							>
						</div>
					{:else}
						<div class="text-sm opacity-70">No shipping options for this address.</div>
						<div class="pt-2">
							<Button class="btn" onclick={() => (step = 'address')}>Back</Button>
						</div>
					{/if}
				{/if}

				{#if step === 'payment'}
					<h2 class="mt-2 card-title">Payment</h2>
					{#if paymentError}
						<div class="alert alert-error"><span>{paymentError}</span></div>
					{/if}
					{#if paymentLoading}
						<div class="flex items-center justify-center p-8">
							<div class="loading loading-md loading-spinner text-primary"></div>
							<span class="ml-2">Initializing payment...</span>
						</div>
					{:else if (get(cartStore)?.total || 0) <= 0}
						<div class="alert alert-info"><span>No payment required for this order.</span></div>
					{:else if paymentClientSecret && paymentReady}
						<div class="min-h-20 rounded-lg border border-base-300 p-3">
							{#if stripeInstance}
						<StripePaymentElement
							stripe={stripeInstance}
							clientSecret={paymentClientSecret}
							bind:elements
							bind:paymentElementRef
							bind:ready
							onchange={() => {
								/* could track completion state */
							}}
						/>
							{:else}
								<div class="flex items-center gap-2 text-sm opacity-70">
									<span class="loading loading-sm loading-spinner"></span> Loading Stripe...
								</div>
							{/if}
						</div>
					{:else}
						<div class="alert alert-warning">
							<span>Payment not ready. You can retry submission.</span>
						</div>
					{/if}
					<div class="flex justify-between pt-2">
						<Button class="btn" onclick={() => (step = 'shipping')}>Back</Button>
						<Button
							class={'btn btn-primary ' + (loading ? 'loading' : '')}
							disabled={loading || ((get(cartStore)?.total || 0) > 0 && !paymentReady)}
							onclick={submitCheckout}
						>
							Place order
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if overlay}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
	</div>
{/if}
