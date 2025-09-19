<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import { getStoreClient, logApiError, lookupOrder } from '$lib/medusa';
	import OrderCard from '$lib/components/OrderCard.svelte';
	import { Accordion } from 'bits-ui';
	import { showToast } from '$lib/stores/toast';
	import { customer } from '$lib/stores/customer';
	import { Info, X } from "@lucide/svelte";
	import { createDialog, melt } from '@melt-ui/svelte';

	let email: string = $state('');
	let orderNo: string = $state('');
	let token: string = $state('');
	let loading: boolean = $state(false);
	let errorMsg: string | null = $state(null);
	let order: any = $state(null);
	// Guard auto-lookups to avoid loops and thrash
	let lastLookupKey: string = $state('');
	let tokenFromUrl: boolean = $state(false); // Track if token came from URL params

	// Melt UI Dialog setup for cancel confirmation
	const {
		elements: { trigger, portalled, overlay, content, title, description, close },
		states: { open }
	} = createDialog({
		preventScroll: true
	});

	// Store which order is being cancelled
	let orderToCancel: string | null = $state(null);

	// Reset state when user starts typing in any field
	function resetLookupState() {
		if (order) {
			order = null;
			errorMsg = null;
			lastLookupKey = '';
		}
		// Mark that token is now from manual input, not URL
		tokenFromUrl = false;
	}
	// Stubs for OrderCard props in public view
	function canCancel(order: any) {
		// Allow cancellation for guest orders if not already cancelled/completed
		if (
			order.status === 'cancelled' ||
			order.status === 'canceled' ||
			order.status === 'completed'
		) {
			return false;
		}
		const fs = order.fulfillment_status;
		if (['shipped', 'delivered', 'fulfilled'].includes(fs)) return false;
		if (
			order.fulfillments?.some(
				(f: any) => f.shipped_at || ['shipped', 'delivered'].includes(f.status)
			)
		)
			return false;
		return true;
	}
	async function hydrate(_id: string) {
		/* already full from lookup */
	}
		async function reorder() {
			if (!order) return;
			try {
				const store = getStoreClient() as any;
				if (!store) return;
				const { ensureCart, addLine } = await import('$lib/cart');
				await ensureCart();
				for (const i of order.items || []) {
					if (!i?.variant_id || !i?.quantity) continue;
					try { await addLine(i.variant_id, i.quantity); } catch {}
				}
				goto('/cart');
				showToast('Order items added to cart', { type: 'success' });
			} catch (e) {
				showToast('Failed to reorder items', { type: 'error' });
			}
		}
	async function cancelOrder(orderId: string) {
		if (!order) return;
		
		// Open the confirmation dialog
		orderToCancel = orderId;
		open.set(true);
	}

	async function confirmCancelOrder() {
		if (!order || !orderToCancel) return;
		
		// Close the dialog first
		open.set(false);
		loading = true;

		try {
			const res = await fetch('/api/orders/cancel', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ order_id: orderToCancel, email: order.email || email })
			});
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			showToast('Order canceled', { type: 'success' });
			// Reload the order data
			order = data.order;
		} catch (e: any) {
			logApiError('order.cancel.api', e);
			errorMsg = (e?.message || 'Unable to cancel order') as string;
			showToast(errorMsg, { type: 'error' });
		} finally {
			loading = false;
			orderToCancel = null;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending':
				return 'badge-warning bg-warning text-warning-content';
			case 'completed':
				return 'badge-success bg-success text-success-content';
			case 'cancelled':
			case 'canceled':
				return 'badge-error bg-error text-error-content';
			case 'requires_action':
				return 'badge-info bg-info text-info-content';
			case 'captured':
			case 'authorized':
			case 'partially_captured':
				return 'badge-success bg-success text-success-content';
			case 'delivered':
			case 'fulfilled':
			case 'shipped':
				return 'badge-success bg-success text-success-content';
			case 'not_paid':
			case 'awaiting':
				return 'badge-warning bg-warning text-warning-content';
			case 'refunded':
			case 'partially_refunded':
				return 'badge-info bg-info text-info-content';
			default:
				return 'badge-neutral bg-neutral text-neutral-content';
		}
	}

	function humanizeOrderStatus(status: string) {
		const map: Record<string, string> = {
			pending: 'Order Placed',
			completed: 'Order Completed',
			cancelled: 'Order Canceled',
			canceled: 'Order Canceled',
			requires_action: 'Action Required'
		};
		return (
			map[status] || (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
		);
	}

	function humanizeFulfillmentStatus(status: string) {
		const map: Record<string, string> = {
			not_fulfilled: 'Not Processed',
			partially_fulfilled: 'Partially Processed',
			fulfilled: 'Ready to Ship',
			partially_shipped: 'Partially Shipped',
			shipped: 'Shipped',
			partially_delivered: 'Partially Delivered',
			delivered: 'Delivered',
			partially_returned: 'Partially Returned',
			returned: 'Returned',
			canceled: 'Fulfillment Canceled'
		};
		return map[status] || humanizeOrderStatus(status);
	}

	function humanizePaymentStatus(status: string) {
		const map: Record<string, string> = {
			not_paid: 'Payment Pending',
			awaiting: 'Payment Processing',
			authorized: 'Payment Authorized',
			partially_authorized: 'Payment Partially Authorized',
			captured: 'Payment Received',
			partially_captured: 'Payment Partially Received',
			partially_refunded: 'Payment Partially Refunded',
			refunded: 'Payment Refunded',
			canceled: 'Payment Canceled',
			requires_action: 'Payment Action Required'
		};
		return map[status] || humanizeOrderStatus(status);
	}

	function canCancelOrder(order: any) {
		// Cannot cancel if already cancelled, completed, or shipped/fulfilled
		if (order.status === 'cancelled' || order.status === 'completed') {
			return false;
		}

		// Cannot cancel if fulfillment status indicates it's been shipped or delivered
		const fulfillmentStatus = order.fulfillment_status;
		if (
			fulfillmentStatus === 'shipped' ||
			fulfillmentStatus === 'delivered' ||
			fulfillmentStatus === 'fulfilled'
		) {
			return false;
		}

		// Check if any fulfillments have been shipped
		if (
			order.fulfillments?.some(
				(f: any) => f.shipped_at || f.status === 'shipped' || f.status === 'delivered'
			)
		) {
			return false;
		}

		return true;
	}
	// stray duplicated switch fragment removed

	function formatOrderDate(date: string | Date) {
		if (!date) return 'Unknown';
		try {
			return new Date(date).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		} catch (e) {
			console.warn('Invalid date format:', date);
			return 'Invalid Date';
		}
	}

	function getShippedDate(order: any) {
		if (!order?.fulfillments?.length) return null;
		const shippedFulfillment = order.fulfillments.find((f: any) => f.shipped_at);
		return shippedFulfillment?.shipped_at || null;
	}

	function getDeliveredDate(order: any) {
		if (!order?.fulfillments?.length) return null;
		const deliveredFulfillment = order.fulfillments.find((f: any) => f.delivered_at);
		return deliveredFulfillment?.delivered_at || null;
	}

	// Removed local step timeline rendering (handled inside OrderCard component)

	onMount(() => {
		if (typeof document !== 'undefined') {
			document.title = 'Track your order • KhadkaFoods';
		}

		// Auto-populate from URL parameters
		const urlParams = new URLSearchParams($page.url.search);
		const orderParam = urlParams.get('order');
		const emailParam = urlParams.get('email');
		const tokenParam = urlParams.get('token');

		if ($customer) {
			// Authenticated user: populate all available parameters
			if (orderParam) {
				orderNo = orderParam;
			}
			if (emailParam) {
				email = emailParam;
			}
			if (tokenParam) {
				token = tokenParam;
			}
		} else {
			// Guest user: only populate token parameter
			if (tokenParam) {
				token = tokenParam;
				tokenFromUrl = true; // Mark that token came from URL
			}
			// Clear other parameters for guest users
			email = '';
			orderNo = '';
		}

		// Clear any previous error messages since we have parameters
		if (($customer && (orderParam || emailParam || tokenParam)) || (!$customer && tokenParam)) {
			errorMsg = null;
		}
	});

	// Auto-lookup based on URL parameters and authentication status
	$effect(() => {
		const isAuthed = $customer;
		const hasToken = !!token && token.length > 2;
		const hasEmailOrder = !!email && !!orderNo;

		// Early exit conditions to prevent unnecessary processing
		if (loading || order) return;

		let key = '';
		let shouldAutoLookup = false;

		if (isAuthed) {
			// Authenticated users: auto-lookup for any valid input
			if (hasToken) {
				key = `t:${token}`;
				shouldAutoLookup = true;
			} else if (hasEmailOrder) {
				key = `eo:${email}|${orderNo}`;
				shouldAutoLookup = true;
			}
		} else {
			// Guest users: only auto-lookup if token came from URL parameters
			if (hasToken && tokenFromUrl) {
				key = `t:${token}`;
				shouldAutoLookup = true;
			}
		}

		// Do not trigger if not enough data or shouldn't auto-lookup
		if (!key || !shouldAutoLookup) return;

		// Prevent repeat lookups for the same key (avoids infinite loops)
		if (key === lastLookupKey) return;

		lastLookupKey = key;
		lookup();
	});



	async function lookup() {
		errorMsg = null;
		order = null;

		// Different validation based on authentication status
		if ($customer) {
			// Authenticated user: allow token-only OR (email + orderNo) OR (email + token)
			if (!token && (!email || !orderNo)) {
				errorMsg = 'Provide token or email + order number';
				return;
			}
		} else {
			// Guest user: only allow token lookup
			if (!token) {
				errorMsg = 'Please provide your order token';
				return;
			}
		}

		loading = true;
		try {
			let found = null;

			if ($customer) {
				// Authenticated user: try multiple lookup methods
				if (orderNo && email) {
					found = await lookupOrder({ display_id: orderNo, email });
				}
				if (!found && token) {
					found = await lookupOrder({ token, email: email || undefined });
				}
				if (!found && orderNo && !email) {
					found = await lookupOrder({ token: orderNo });
				}
			} else {
				// Guest user: only token lookup
				found = await lookupOrder({ token });
			}

			order = found;
			if (!order) errorMsg = 'Order not found. Check details and try again.';
		} catch (e) {
			logApiError('order.lookup', e);
			errorMsg = 'Unable to find order';
		} finally {
			loading = false;
		}
	}

	async function cancel() {
		if (!order?.id) return;
		
		// Open the confirmation dialog
		orderToCancel = order.id;
		open.set(true);
	}



	// duplicate reorder & fmt removed; OrderCard formats its own amounts

	function shareLink() {
		const base = '/orders/lookup';
		if (order?.id && /^order_/.test(order.id))
			return `${base}?token=${encodeURIComponent(order.id)}`;
		if (order?.display_id && order?.email)
			return `${base}?order=${encodeURIComponent(order.display_id)}&email=${encodeURIComponent(order.email)}`;
		return base;
	}

	async function copyShare() {
		try {
			await navigator.clipboard.writeText(window.location.origin + shareLink());
			showToast('Share link copied', { type: 'success' });
		} catch {
			showToast('Failed to copy link', { type: 'error' });
		}
	}
</script>

<svelte:head>
	<title>Track Your Order • KhadkaFoods - Order Lookup</title>
	<meta
		name="description"
		content="Track your KhadkaFoods order status. Enter your order details to view order status, shipping information, and delivery updates."
	/>
	<meta
		name="keywords"
		content="track order, order status, order lookup, shipping status, delivery tracking, order history"
	/>
	<meta name="robots" content="noindex, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Track Your Order • KhadkaFoods - Order Lookup" />
	<meta
		property="og:description"
		content="Track your KhadkaFoods order status. Enter your order details to view order status."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/orders/lookup" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Track Your Order • KhadkaFoods - Order Lookup" />
	<meta
		name="twitter:description"
		content="Track your KhadkaFoods order status. Enter your order details."
	/>
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/orders/lookup" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
		<h1 class="mb-6 text-3xl font-bold">Track your order</h1>

		<div class="card border border-base-300 bg-base-100 shadow-xl">
			<form
				class="card-body space-y-3"
				onsubmit={(e) => {
					e.preventDefault();
					lookup();
				}}
			>
				{#if errorMsg}
					<div class="alert alert-error"><span>{errorMsg}</span></div>
				{/if}

				{#if $customer}
					<!-- Authenticated user -->
					<div class="space-y-6">
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
							<label class="form-control">
								<span class="label-text mb-1 font-medium text-gray-700">Email</span>
								<input
									class="input-bordered input w-full rounded-xl input-primary focus:ring-2 focus:ring-primary"
									type="email"
									bind:value={email}
									required
								/>
							</label>

							<label class="form-control">
								<span class="label-text mb-1 font-medium text-gray-700">Order Number</span>
								<input
									class="input-bordered input w-full rounded-xl input-primary focus:ring-2 focus:ring-primary"
									type="text"
									bind:value={orderNo}
									placeholder="e.g. 1024"
								/>
							</label>
						</div>

						<div class="text-sm text-gray-500">
							Or, if you received an order token link, paste the token below:
						</div>

						<label class="form-control">
							<span class="label-text mb-1 font-medium text-gray-700">Order Token (optional)</span>
							<input
								class="input-bordered input w-full rounded-xl input-primary focus:ring-2 focus:ring-primary"
								type="text"
								bind:value={token}
								placeholder="Paste your order token"
							/>
						</label>
					</div>
				{:else}
					<!-- Guest user -->
					<div class="space-y-6">
						<div class="alert flex items-center gap-2 rounded-xl alert-info p-4 text-sm shadow-md">
							<Info class="h-5 w-5 shrink-0 text-blue-500" />
							<span>
								To track your order, please use the <strong>order token</strong> from your confirmation
								email or order details.
							</span>
						</div>

						<label class="form-control">
							<span class="label-text mb-1 font-medium text-gray-700">Order Token</span>
							<input
								class="input-bordered input w-full rounded-xl input-primary focus:ring-2 focus:ring-primary"
								type="text"
								bind:value={token}
								placeholder="Paste your order token here"
								oninput={resetLookupState}
								required
							/>
						</label>
					</div>
				{/if}

				<Button
					class={'btn btn-primary ' + (loading ? 'loading' : '')}
					disabled={loading}
					type="submit">Find order</Button
				>
			</form>
		</div>

		{#if loading && !order}
			<div
				class="mt-6 animate-pulse space-y-4 rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
			>
				<div class="h-4 w-40 rounded bg-base-300"></div>
				<div class="flex gap-2">
					<div class="h-6 w-24 rounded bg-base-300"></div>
					<div class="h-6 w-28 rounded bg-base-300"></div>
					<div class="h-6 w-20 rounded bg-base-300"></div>
				</div>
				<div class="h-32 w-full rounded bg-base-200/70"></div>
				<div class="h-24 w-full rounded bg-base-200/60"></div>
			</div>
		{/if}

		{#if order}
			<div class="mt-6">
				<Accordion.Root type="multiple" class="flex flex-col gap-4">
					<OrderCard
						{order}
						customerEmail={order.email}
						{canCancel}
						onCancel={cancelOrder}
						{hydrate}
						{reorder}
					/>
				</Accordion.Root>
			</div>
		{/if}
	</div>

	<!-- Cancel Order Confirmation Dialog -->
	{#if $open}
		<div use:melt={$portalled}>
			<!-- Backdrop -->
			<div
				use:melt={$overlay}
				class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
			></div>

			<!-- Dialog Content -->
			<div
				use:melt={$content}
				class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xl animate-in zoom-in-95 fade-in duration-200 mx-4 sm:max-w-lg sm:p-6"
			>
				<!-- Header -->
				<div class="flex items-center justify-between mb-3 sm:mb-4">
					<h3 use:melt={$title} class="text-lg sm:text-xl font-bold text-base-content">
						Cancel Order
					</h3>
					<button
						use:melt={$close}
						class="btn btn-ghost btn-sm btn-circle"
						aria-label="Close dialog"
						onclick={() => {
							orderToCancel = null;
						}}
					>
						<X class="w-4 h-4" />
					</button>
				</div>

				<!-- Description -->
				<p use:melt={$description} class="text-sm text-base-content/70 mb-4 sm:mb-6">
					Are you sure you want to cancel this order? This action cannot be undone and the order will be permanently cancelled.
				</p>

				<!-- Action Buttons -->
				<div class="flex gap-3 justify-end">
					<button
						class="btn btn-ghost px-4 py-2"
						onclick={() => {
							open.set(false);
							orderToCancel = null;
						}}
					>
						Keep Order
					</button>

					<button
						class="btn btn-error px-4 py-2"
						onclick={confirmCancelOrder}
						disabled={loading}
					>
						{loading ? 'Cancelling...' : 'Cancel Order'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</section>
