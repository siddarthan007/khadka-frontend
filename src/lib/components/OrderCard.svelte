<script lang="ts">
	import { Accordion, DropdownMenu } from 'bits-ui';
	import { Button } from '$lib/components/ui/button';
	import { formatCurrency } from '$lib/utils';
	import { getStoreClient } from '$lib/medusa';
	import { showToast } from '$lib/stores/toast';
	import type { HttpTypes } from '@medusajs/types';
	import { goto } from '$app/navigation';

	// Props (runes mode)
	let {
		order,
		customerEmail = null,
		canCancel,
		onCancel,
		hydrate,
		reorder
	}: {
		order: any;
		customerEmail?: string | null;
		canCancel: (order: any) => boolean;
		onCancel: (id: string) => Promise<void>;
		hydrate: (id: string) => Promise<void>;
		reorder: (id: string) => Promise<void>;
	} = $props();

	// Modal state
	let showCancelConfirm = $state(false);

	// Hydrate on mount if needed
	$effect(() => {
		if (order && !order.__hydrated_full) {
			hydrate(order.id);
		}
	});

	function humanizeOrderStatus(status: string) {
		const map: Record<string, string> = {
			pending: 'Order Placed',
			completed: 'Completed',
			cancelled: 'Canceled',
			canceled: 'Canceled'
		};
		return (
			map[status] || (status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
		);
	}
	function humanizePaymentStatus(status: string) {
		const map: Record<string, string> = {
			not_paid: 'Payment Pending',
			awaiting: 'Payment Processing',
			authorized: 'Payment Authorized',
			captured: 'Payment Received',
			partially_captured: 'Partially Captured',
			refunded: 'Refunded'
		};
		return map[status] || humanizeOrderStatus(status);
	}
	function humanizeFulfillmentStatus(status: string) {
		const map: Record<string, string> = {
			not_fulfilled: 'Not Fulfilled',
			partially_fulfilled: 'Partially Fulfilled',
			fulfilled: 'Fulfilled',
			partially_shipped: 'Partially Shipped',
			shipped: 'Shipped',
			partially_delivered: 'Partially Delivered',
			delivered: 'Delivered'
		};
		return map[status] || humanizeOrderStatus(status);
	}

	// Theming-aware badge using Tailwind + DaisyUI tokens; ensures readable contrast
	function statusBadge(status: string) {
		const base =
			'inline-flex items-center rounded-md text-[11px] font-medium tracking-wide whitespace-nowrap px-2.5 py-1 border shadow-sm';
		const neutral = base + ' bg-base-200 text-base-content/80 border-base-300';
		if (!status) return neutral;
		const s = status.toLowerCase();
		if (['completed', 'delivered', 'fulfilled', 'shipped', 'captured', 'authorized'].includes(s))
			return base + ' bg-success text-success-content border-success';
		if (['pending', 'awaiting', 'not_paid'].includes(s))
			return base + ' bg-warning text-warning-content border-warning';
		if (['canceled', 'cancelled'].includes(s))
			return base + ' bg-error text-error-content border-error';
		if (['refunded', 'partially_refunded'].includes(s))
			return base + ' bg-info text-info-content border-info';
		if (['partially_shipped', 'partially_fulfilled', 'partially_delivered'].includes(s))
			return base + ' bg-base-300 text-base-content border-base-300';
		return neutral;
	}

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
		} catch {
			return 'Invalid';
		}
	}

	// Step-wise progress model replacing linear bar
	const progressSteps = [
		{ key: 'placed', label: 'Order Placed', reached: (o: any) => !!o.id },
		{
			key: 'payment',
			label: 'Payment Received',
			reached: (o: any) => ['authorized', 'captured'].includes(o.payment_status)
		},
		{
			key: 'fulfilled',
			label: 'Fulfilled / Shipped',
			reached: (o: any) =>
				['fulfilled', 'shipped', 'partially_shipped', 'partially_fulfilled'].includes(
					o.fulfillment_status
				) || ['delivered', 'completed'].includes(o.fulfillment_status) || o.status === 'completed'
		},
		{
			key: 'delivered',
			label: 'Delivered',
			reached: (o: any) =>
				['delivered', 'completed'].includes(o.fulfillment_status) || o.status === 'completed'
		},
		{
			key: 'cancelled',
			label: 'Cancelled',
			reached: (o: any) => o.status === 'cancelled' || o.status === 'canceled'
		}
	];

	// Filter progress steps based on order status
	const filteredProgressSteps = $derived(
		order.status === 'cancelled' || order.status === 'canceled'
			? progressSteps.filter(step => step.key === 'cancelled' || step.reached(order))
			: progressSteps.filter(step => step.key !== 'cancelled')
	);

	function stepTimestamp(order: any, stepKey: string) {
		try {
			if (stepKey === 'placed') return formatOrderDate(order.created_at);
			if (stepKey === 'payment')
				return order.payments?.[0]?.captured_at
					? formatOrderDate(order.payments[0].captured_at)
					: null;
			if (stepKey === 'fulfilled') {
				const f = order.fulfillments?.find((ff: any) => ff.shipped_at || ff.fulfilled_at);
				return f?.shipped_at
					? formatOrderDate(f.shipped_at)
					: f?.fulfilled_at
						? formatOrderDate(f.fulfilled_at)
						: null;
			}
			if (stepKey === 'delivered') {
				const d = order.fulfillments?.find((ff: any) => ff.delivered_at);
				return d?.delivered_at ? formatOrderDate(d.delivered_at) : null;
			}
			if (stepKey === 'cancelled') {
				return formatOrderDate(order.updated_at);
			}
		} catch {
			return null;
		}
		return null;
	}

	function shareLink() {
		// Prefer token (order.id) deep link if looks like an internal id
		const base = '/orders/lookup';
		if (order?.id && /^order_/.test(order.id))
			return `${base}?token=${encodeURIComponent(order.id)}`;
		if (order?.display_id && customerEmail)
			return `${base}?order=${encodeURIComponent(order.display_id)}&email=${encodeURIComponent(customerEmail)}`;
		return base;
	}

	async function copyShare() {
		try {
			await navigator.clipboard.writeText(window.location.origin + shareLink());
			showToast('Tracking link copied', { title: 'Link copied', type: 'success' });
		} catch {
			showToast('Unable to copy link', { title: 'Copy failed', type: 'error' });
		}
	}

	// Build a single, deduplicated list of promotion codes from both order.promotions and item adjustments
	const promoBadges = $derived.by(() => {
		const codeMap = new Map<string, string>(); // normalizedCode -> displayCode
		const fallbackIds: string[] = []; // for promotions without a code

		const addCode = (raw: unknown) => {
			if (!raw) return;
			const display = String(raw).trim();
			if (!display) return;
			const norm = display.toLowerCase();
			if (!codeMap.has(norm)) codeMap.set(norm, display);
		};

		try {
			// From order.promotions
			(order?.promotions || []).forEach((p: any) => {
				const code = p?.code ?? p?.promo_code ?? '';
				if (code) addCode(code);
				else if (p?.id) {
					// Keep a stable fallback so we don't lose unknown promos; won't collide with codes
					const id = String(p.id);
					if (!fallbackIds.includes(id)) fallbackIds.push(id);
				}
			});

			// From line-item adjustments
			(order?.items || []).forEach((item: any) => {
				(item?.adjustments || []).forEach((adj: any) => addCode(adj?.code));
			});
		} catch {
			// no-op
		}

		return [...codeMap.values(), ...fallbackIds];
	});
</script>

<Accordion.Item
	value={order.id}
	class="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
>
	<Accordion.Header>
		<Accordion.Trigger
			class="flex w-full flex-col gap-3 p-3 text-left md:flex-row md:items-center md:gap-6 md:p-4"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<span class="pr-2 font-mono text-sm leading-none font-semibold break-all sm:text-base"
						>#{order.display_id || order.id}</span
					>
					<span class={statusBadge(order.status)}>{humanizeOrderStatus(order.status)}</span>
					{#if order.payment_status && order.payment_status !== order.status}
						<span class={statusBadge(order.payment_status)}
							>{humanizePaymentStatus(order.payment_status)}</span
						>
					{/if}
					{#if order.fulfillment_status && !['delivered', 'completed'].includes(order.status)}
						<span class={statusBadge(order.fulfillment_status)}
							>{humanizeFulfillmentStatus(order.fulfillment_status)}</span
						>
					{/if}
				</div>
				<div class="flex flex-col gap-1 text-xs text-base-content/70 sm:flex-row sm:gap-4">
					<div class="flex items-center gap-1">
						<span class="opacity-60">Placed:</span><span>{formatOrderDate(order.created_at)}</span>
					</div>
					<div class="flex items-center gap-1">
						<span class="opacity-60">Items:</span><span>{order.items?.length || 0}</span>
					</div>
					<!-- Show total only while collapsed (CSS: hide when expanded using data-state attribute) -->
					<div
						class="flex items-center gap-1 data-[state=open]:hidden md:ml-auto"
						data-total-trigger
					>
						<span class="opacity-60">Total:</span>
						<span class="text-sm font-semibold text-base-content sm:text-base"
							>{formatCurrency(
								order.status === 'cancelled' || order.status === 'canceled'
									? (order.subtotal || 0) - (order.discount_total || 0)
									: order.total,
								order.currency_code
							)}</span
						>
					</div>
				</div>
			</div>
		</Accordion.Trigger>
	</Accordion.Header>
	<Accordion.Content class="bg-base-50/40 border-t border-base-300 p-3 md:p-4">
		<div class="flex flex-col gap-4 md:gap-6">
			<!-- Step Progress -->
			{#if order.status !== 'cancelled'}
				<div class="space-y-3">
					<div class="text-xs font-semibold tracking-wide text-base-content/60 uppercase">
						Progress
					</div>
					<ol class="relative ml-2 flex flex-col gap-4 border-l border-base-300/70">
						{#each filteredProgressSteps as step}
							{#if step.reached(order)}
								<li class="relative pl-4">
									<span
										class="absolute top-1.5 -left-[7px] h-3 w-3 rounded-full {step.key === 'cancelled' ? 'bg-error ring-error/20' : 'bg-primary ring-primary/20'} ring-2"
									></span>
									<div class="text-sm font-medium {step.key === 'cancelled' ? 'text-error' : ''}">{step.label}</div>
									{#if stepTimestamp(order, step.key)}
										<div class="mt-0.5 text-[10px] opacity-60">
											{stepTimestamp(order, step.key)}
										</div>
									{/if}
								</li>
							{:else}
								<li class="relative pl-4 opacity-40">
									<span class="absolute top-1.5 -left-[7px] h-3 w-3 rounded-full bg-base-300"
									></span>
									<div class="text-sm">{step.label}</div>
								</li>
							{/if}
						{/each}
					</ol>
				</div>
			{/if}

			<!-- Items -->
			{#if order.items?.length}
				<div>
					<div class="mb-2 text-sm font-semibold tracking-wide text-base-content/70">Items</div>
					<ul class="divide-y divide-base-300 rounded-lg border border-base-300 bg-base-100/50">
						{#each order.items as item (item.id)}
							<li class="grid grid-cols-12 gap-2 p-2 text-sm md:gap-3 md:p-3">
								<div class="col-span-8 min-w-0 md:col-span-7">
									<div class="truncate font-medium text-sm md:text-base">
										{item.title}
										{#if item.variant?.title}
											<span class="ml-1 text-xs font-normal text-base-content/60"
												>({item.variant.title})</span
											>
										{/if}
									</div>
								</div>
								<div class="col-span-2 self-center text-center text-xs opacity-70 md:text-sm">
									x{item.quantity}
								</div>
								<div class="col-span-2 text-right font-medium text-sm md:col-span-3 md:text-base">
									{formatCurrency(item.quantity * item.unit_price, order.currency_code)}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Summary (Total relocated when expanded) -->
			<div class="space-y-2 md:space-y-1">
				<div class="text-sm font-semibold tracking-wide text-base-content/70">Summary</div>
				<div class="flex flex-col gap-0.5 text-sm md:text-base">
					<div class="flex justify-between">
						<span class="opacity-70">Shipping</span>
						<span class="text-success"
							>+ {formatCurrency(order.shipping_total ?? 0, order.currency_code)}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Tax</span>
						<span class="text-success"
							>+ {formatCurrency(order.tax_total ?? 0, order.currency_code)}</span
						>
					</div>
					<div class="flex justify-between">
						<span class="opacity-70">Subtotal</span>
						<span class="text-base-content"
							>{formatCurrency(order.subtotal ?? order.total, order.currency_code)}</span
						>
					</div>
					{#if order.discount_total}
						<div class="flex justify-between">
							<span class="opacity-70">Discounts</span>
							<span class="text-error"
								>- {formatCurrency(order.discount_total, order.currency_code)}</span
							>
						</div>
					{/if}
					<div
						class="mt-1 flex justify-between border-t border-base-300/70 pt-1 font-medium text-base-content"
					>
						<span>Total</span>
						<span>{formatCurrency(
							order.status === 'cancelled' || order.status === 'canceled'
								? (order.subtotal || 0) - (order.discount_total || 0)
								: order.total,
							order.currency_code
						)}</span>
					</div>
				</div>
			</div>

			<!-- Shipping Address -->
			{#if order.shipping_address}
				<div class="space-y-1">
					<div class="text-sm font-semibold tracking-wide text-base-content/70">
						Shipping Address
					</div>
					<div class="rounded-md border border-base-300 bg-base-100/50 p-3 text-xs leading-relaxed">
						<div>{order.shipping_address.first_name || ''} {order.shipping_address.last_name || ''}</div>
						{#if order.shipping_address.company}<div>{order.shipping_address.company}</div>{/if}
						<div>{order.shipping_address.address_1 || ''}</div>
						{#if order.shipping_address.address_2}<div>{order.shipping_address.address_2}</div>{/if}
						<div>
							{#if order.shipping_address.city && order.shipping_address.province}
								{order.shipping_address.city}, {order.shipping_address.province}
							{:else if order.shipping_address.city}
								{order.shipping_address.city}
							{:else if order.shipping_address.province}
								{order.shipping_address.province}
							{/if}
							{#if order.shipping_address.postal_code}
								{order.shipping_address.postal_code}
							{/if}
						</div>
						<div>{order.shipping_address.country_code?.toUpperCase() || ''}</div>
						{#if order.shipping_address.phone}<div class="opacity-70">
								{order.shipping_address.phone}
							</div>{/if}
					</div>
				</div>
			{/if}

			<!-- Promotions -->
			{#if promoBadges.length}
				<div class="space-y-1">
					<div class="text-sm font-semibold tracking-wide text-base-content/70">Promotions</div>
					<ul class="flex flex-wrap gap-2 text-xs">
						{#each promoBadges as code (code)}
							<li
								class="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-1 font-medium text-primary"
							>
								{code}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Payment Methods -->
			{#if order.payments?.length || order.payment_collections?.length}
				<div class="space-y-1">
					<div class="text-sm font-semibold tracking-wide text-base-content/70">Payment</div>
					<ul class="flex flex-col gap-1 text-xs">
						{#each order.payments || [] as p (p.id)}
							<li
								class="flex flex-wrap items-center gap-2 rounded border border-base-300 bg-base-100/50 px-2 py-1"
							>
								<span class="font-medium"
									>{(p.provider_id || p.provider || 'payment').replace(/_/g, ' ')}</span
								>
								{#if p.metadata?.card_brand || p.data?.card_brand}
									<span class="opacity-70"
										>{p.metadata?.card_brand ||
											p.data?.card_brand}{#if p.metadata?.card_last4 || p.data?.card_last4}
											• **** {p.metadata?.card_last4 || p.data?.card_last4}{/if}</span
									>
								{/if}
								<span
									class="rounded bg-base-200 px-1.5 py-0.5 text-[10px] tracking-wide uppercase {p.captured_at
										? 'text-success'
										: 'text-warning'}">{p.captured_at ? 'Captured' : 'Pending'}</span
								>
							</li>
						{/each}
						{#each order.payment_collections || [] as pc (pc.id)}
							<li
								class="flex flex-wrap items-center gap-2 rounded border border-base-300 bg-base-100/50 px-2 py-1"
							>
								<span class="font-medium">Stripe</span>
								<span class="opacity-70">{formatCurrency(pc.amount, order.currency_code)}</span>
								<span
									class="rounded bg-base-200 px-1.5 py-0.5 text-[10px] tracking-wide uppercase {pc.status === 'refunded' || pc.status === 'canceled'
										? 'text-error'
										: pc.completed_at ? 'text-success' : 'text-warning'}">
									{pc.status === 'refunded' || pc.status === 'canceled' ? 'Refunded' : pc.completed_at ? 'Completed' : 'Pending'}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}


			<!-- Refunds -->
			{#if order.refunds?.length || order.refunded_total > 0 || (order.status === 'cancelled' && order.total === 0)}
				<div class="space-y-1">
					<div class="text-sm font-semibold tracking-wide text-base-content/70">Refunds</div>
					{#each order.refunds || [] as r}
						<div class="text-xs">
							{formatCurrency(r.amount, order.currency_code)} — {r.reason || 'Refund'}
						</div>
					{/each}
					{#if order.refunded_total > 0}
						<div class="text-xs opacity-70">
							Total refunded: {formatCurrency(order.refunded_total, order.currency_code)}
						</div>
					{:else if order.status === 'cancelled' && order.total === 0}
						<div class="text-xs opacity-70">
							Order cancelled - full refund processed
						</div>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex flex-col gap-2 border-t border-base-300/70 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
				{#if canCancel(order)}
					<button class="btn btn-outline btn-xs btn-error w-full sm:w-auto" onclick={() => showCancelConfirm = true}
						>Cancel</button
					>
				{/if}
				<button class="btn btn-outline btn-xs btn-primary w-full sm:w-auto" onclick={() => reorder(order.id)}
					>Reorder</button
				>
				<button class="btn btn-outline btn-xs w-full sm:w-auto" type="button" onclick={copyShare}>Share Link</button>
				<a
					class="btn btn-outline btn-xs w-full sm:w-auto"
					href={'/orders/lookup?order=' +
						encodeURIComponent(order.display_id || order.id) +
						'&email=' +
						encodeURIComponent(customerEmail || '')}>View Details</a
				>
			</div>
		</div>
	</Accordion.Content>
</Accordion.Item>

{#if showCancelConfirm}
	<dialog class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Cancel Order</h3>
			<p class="py-4">
				Are you sure you want to cancel order #{order.display_id || order.id}?
				<br><br>
				<span class="text-error font-medium">This action cannot be undone.</span>
			</p>
			<div class="modal-action">
				<button class="btn" onclick={() => showCancelConfirm = false}>Keep Order</button>
				<button
					class="btn btn-error"
					onclick={async () => {
						showCancelConfirm = false;
						await onCancel(order.id);
					}}
				>
					Cancel Order
				</button>
			</div>
		</div>
		<div 
			class="modal-backdrop" 
			role="button"
			tabindex="0"
			onclick={() => showCancelConfirm = false}
			onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { showCancelConfirm = false; e.preventDefault(); } }}
		></div>
	</dialog>
{/if}
