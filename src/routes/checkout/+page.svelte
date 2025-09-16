<script lang="ts">
	import { onMount } from 'svelte';
	import { cart as cartStore } from '$lib/stores/cart';
	import { ensureCart, getCart } from '$lib/cart';
	import { Button } from '$lib/components/ui/button';
	import { get } from 'svelte/store';
	import { getCurrentCustomer } from '$lib/auth';
	import { listAddresses } from '$lib/customer-api';
	import { getStoreClient } from '$lib/medusa';
	import { showToast } from '$lib/stores/toast';
	import { US_STATES } from '$lib/us';
	import type { HttpTypes } from '@medusajs/types';

	let email: string = $state('');
	let shipping = $state({
		first_name: '',
		last_name: '',
		address_1: '',
		address_2: '',
		city: '',
		country_code: 'US',
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
		country_code: 'US',
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

	// Saved addresses for logged-in customers
	let savedAddresses: HttpTypes.StoreCustomerAddress[] = $state([]);
	let selectedShippingAddressId: string | 'new' = $state('new');
	let selectedBillingAddressId: string | 'new' = $state('new');

	// Reactive statement to sync billing address when billingSameAsShipping is true
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
			country_code: a.country_code ?? 'US',
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
			country_code: a.country_code ?? 'US',
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
		// If billing is same as shipping, also apply to billing
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
			// Prefer listAddress for robustness
			const resp = await listAddresses().catch(() => null);
			savedAddresses = ((resp as any)?.addresses ??
				(me as any).shipping_addresses ??
				[]) as HttpTypes.StoreCustomerAddress[];
			if (savedAddresses.length > 0) {
				// Select default shipping address
				const defaultShipping = savedAddresses.find((addr: any) => addr?.is_default_shipping);
				if (defaultShipping) {
					selectedShippingAddressId = defaultShipping.id!;
					applyAddressToShipping(defaultShipping);
				} else {
					selectedShippingAddressId = savedAddresses[0]?.id ?? 'new';
					applyAddressToShipping(savedAddresses[0]);
				}

				// Select default billing address
				const defaultBilling = savedAddresses.find((addr: any) => addr?.is_default_billing);
				if (defaultBilling && !billingSameAsShipping) {
					selectedBillingAddressId = defaultBilling.id!;
					applyAddressToBilling(defaultBilling);
				} else if (billingSameAsShipping) {
					selectedBillingAddressId = selectedShippingAddressId;
				}

				// If default shipping is selected, no need to show save-to-account toggle
				const isDefaultShippingSelected = !!(
					savedAddresses.find((x) => x.id === selectedShippingAddressId) as any
				)?.is_default_shipping;
				saveAddress = !isDefaultShippingSelected;
			}
		}
	});

	async function submitCheckout() {
		errorMsg = null;
		loading = true;
		overlay = true;
		const sdk = getStoreClient() as any;
		try {
			const c = get(cartStore);
			if (!c?.id) return;

			if (!email || !email.includes('@')) {
				errorMsg = 'Please enter a valid email.';
				showToast('Enter a valid email', { type: 'error' });
				loading = false;
				return;
			}

			// Guest email association
			await sdk.store.cart.update(c.id, { email });
			showToast('Contact email saved', { type: 'success' });

			// Shipping address
			await sdk.store.cart.update(c.id, { shipping_address: shipping });
			showToast('Shipping address added', { type: 'success' });

			// Billing address
			if (!billingSameAsShipping) {
				await sdk.store.cart.update(c.id, { billing_address: billing });
			} else {
				await sdk.store.cart.update(c.id, { billing_address: shipping });
			}
			showToast('Billing address set', { type: 'success' });

			// Initialize payment sessions and select first available
			await sdk.store.cart.createPaymentSessions(c.id);
			const { cart: fresh } = await sdk.store.cart.retrieve(c.id);
			const providers = (fresh as any)?.payment_sessions?.map((p: any) => p.provider_id) ?? [];
			const provider = providers[0];
			if (provider) {
				await sdk.store.cart.setPaymentSession(c.id, provider);
				showToast('Payment ready', { type: 'success' });
			}

			const meResp = await sdk.store.customer.retrieve().catch(() => null);
			if (saveAddress && meResp?.customer) {
				await sdk.store.customer
					.createAddress({
						...shipping,
						is_default_shipping: false,
						is_default_billing: false
					})
					.catch(() => {});
				showToast('Address saved to account', { type: 'success' });
			}

			const { cart } = await sdk.store.cart.complete(c.id);
			if ((cart as any)?.completed_at) {
				showToast('Order placed successfully', { type: 'success' });
				try {
					// @ts-ignore - optional peer for visual flair only
					const party = await import('canvas-confetti').then((m: any) => m.default || m);
					party({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
				} catch {}
				window.location.href = '/';
			} else {
				errorMsg = 'Could not complete checkout.';
				showToast('Could not complete checkout', { type: 'error' });
			}
		} catch (e) {
			errorMsg = 'Checkout failed.';
			showToast('Checkout failed', { type: 'error' });
		} finally {
			loading = false;
			overlay = false;
		}
	}
</script>

<section class="w-full py-10">
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
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<div class="truncate font-medium">
											{(a as any).address_name || `${a.first_name} ${a.last_name}`}
										</div>
										{#if (a as any).is_default_shipping}
											<span
												class="badge rounded-full badge-sm px-2.5 py-0.5 text-primary-content shadow badge-primary"
												>Default Shipping</span
											>
										{/if}
										{#if (a as any).is_default_billing}
											<span
												class="badge rounded-full badge-sm px-2.5 py-0.5 text-secondary-content shadow badge-secondary"
												>Default Billing</span
											>
										{/if}
									</div>
									{#if (a as any).company}
										<div class="truncate text-sm opacity-70">{(a as any).company}</div>
									{/if}
									<div class="truncate text-sm opacity-70">{a.first_name} {a.last_name}</div>
									<div class="truncate text-sm opacity-70">
										{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}
									</div>
									<div class="truncate text-sm opacity-70">
										{a.province}, {a.postal_code}, {a.country_code}
									</div>
									{#if (a as any).phone}
										<div class="truncate text-sm opacity-70">{(a as any).phone}</div>
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
									<div class="min-w-0">
										<div class="flex items-center gap-2">
											<div class="truncate font-medium">
												{(a as any).address_name || `${a.first_name} ${a.last_name}`}
											</div>
											{#if (a as any).is_default_shipping}
												<span
													class="badge rounded-full badge-sm px-2.5 py-0.5 text-primary-content shadow badge-primary"
													>Default Shipping</span
												>
											{/if}
											{#if (a as any).is_default_billing}
												<span
													class="badge rounded-full badge-sm px-2.5 py-0.5 text-secondary-content shadow badge-secondary"
													>Default Billing</span
												>
											{/if}
										</div>
										{#if (a as any).company}
											<div class="truncate text-sm opacity-70">{(a as any).company}</div>
										{/if}
										<div class="truncate text-sm opacity-70">{a.first_name} {a.last_name}</div>
										<div class="truncate text-sm opacity-70">
											{a.address_1}{#if a.address_2}, {a.address_2}{/if}, {a.city}
										</div>
										<div class="truncate text-sm opacity-70">
											{a.province}, {a.postal_code}, {a.country_code}
										</div>
										{#if (a as any).phone}
											<div class="truncate text-sm opacity-70">{(a as any).phone}</div>
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
						bind:value={shipping.country_code}
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
							<input type="checkbox" class="checkbox checkbox-primary" bind:checked={saveAddress} />
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
							bind:value={billing.country_code}
							disabled
						/>
						<input
							class="input-bordered input border-base-300 input-primary"
							placeholder="Phone"
							bind:value={billing.phone}
						/>
					</div>
				{/if}

				<div class="pt-2">
					<Button
						class={'btn w-full btn-primary ' + (loading ? 'loading' : '')}
						disabled={loading}
						onclick={submitCheckout}>Place order</Button
					>
				</div>
			</div>
		</div>
	</div>
</section>

{#if overlay}
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
	</div>
{/if}
