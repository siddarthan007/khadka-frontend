<script lang="ts">
	import { Accordion, DropdownMenu } from "bits-ui";
	import { Motion, useMotionValue, useMotionTemplate } from "svelte-motion";
	import { Button } from "$lib/components/ui/button";
	import { cn, formatCurrency } from "$lib/utils";
	import { sanitizeInput, escapeHtml } from "$lib/security";
	import { logger } from "$lib/logger";
	import {
		trackEvent,
		trackShare,
		formatCartItemsForAnalytics,
	} from "$lib/utils/analytics";
	import { showToast } from "$lib/stores/toast";
	import type { HttpTypes } from "@medusajs/types";
	import { goto } from "$app/navigation";
	import { onDestroy } from "svelte";

	// Props (runes mode)
	let {
		order,
		customerEmail = null,
		canCancel,
		onCancel,
		hydrate,
		reorder,
		gradientSize = 300,
		gradientColor = "rgba(134,120,249,0.25)",
		gradientOpacity = 0.4,
	}: {
		order: any;
		customerEmail?: string | null;
		canCancel: (order: any) => boolean;
		onCancel: (id: string) => Promise<void>;
		hydrate: (id: string) => Promise<void>;
		reorder: (id: string) => Promise<void>;
		gradientSize?: number;
		gradientColor?: string;
		gradientOpacity?: number;
	} = $props();

	// Modal state
	let showCancelConfirm = $state(false);
	let isExpanded = $state(false);

	// Motion values for gradient hover effect (matching ProductCard pattern)
	let gradSize = useMotionValue(gradientSize);
	let gradColor = useMotionValue(gradientColor);
	let mouseX = useMotionValue(-gradientSize);
	let mouseY = useMotionValue(-gradientSize);
	let bg = useMotionTemplate`radial-gradient(${gradSize}px circle at ${mouseX}px ${mouseY}px, ${gradColor}, transparent 100%)`;

	function handleMouseMove(e: MouseEvent) {
		const rect = (
			e.currentTarget as HTMLDivElement
		).getBoundingClientRect();
		mouseX.set(e.clientX - rect.left);
		mouseY.set(e.clientY - rect.top);
	}

	function handleMouseLeave() {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	}

	// Cleanup motion values on destroy to prevent memory leaks
	onDestroy(() => {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	});

	// Hydrate on mount if needed
	$effect(() => {
		if (order && !order.__hydrated_full) {
			hydrate(order.id);
		}
	});

	// Track accordion state changes for analytics
	$effect(() => {
		if (isExpanded) {
			trackEvent("order_card_expanded", {
				order_id: order.id,
				order_status: order.status,
				order_total: order.total,
			});
		}
	});

	// Calculate total for cancelled orders manually
	const calculatedTotal = $derived.by(() => {
		if (order.status === "cancelled" || order.status === "canceled") {
			// For cancelled orders, manually calculate from components
			const subtotal = order.subtotal || 0;
			const shipping = order.shipping_total || 0;
			const tax = order.tax_total || 0;
			const discount = order.discount_total || 0;
			return subtotal + shipping + tax - discount;
		}
		// For active orders, use the order.total from backend
		return order.total || 0;
	});

	function humanizeOrderStatus(status: string) {
		const map: Record<string, string> = {
			pending: "Order Placed",
			completed: "Completed",
			cancelled: "Canceled",
			canceled: "Canceled",
		};
		return (
			map[status] ||
			(status || "")
				.replace(/_/g, " ")
				.replace(/\b\w/g, (c) => c.toUpperCase())
		);
	}
	function humanizePaymentStatus(status: string) {
		const map: Record<string, string> = {
			not_paid: "Payment Pending",
			awaiting: "Payment Processing",
			authorized: "Payment Authorized",
			captured: "Payment Received",
			partially_captured: "Partially Captured",
			refunded: "Refunded",
		};
		return map[status] || humanizeOrderStatus(status);
	}
	function humanizeFulfillmentStatus(status: string) {
		const map: Record<string, string> = {
			not_fulfilled: "Not Fulfilled",
			partially_fulfilled: "Partially Fulfilled",
			fulfilled: "Fulfilled",
			partially_shipped: "Partially Shipped",
			shipped: "Shipped",
			partially_delivered: "Partially Delivered",
			delivered: "Delivered",
		};
		return map[status] || humanizeOrderStatus(status);
	}

	// Theming-aware badge using DaisyUI badge classes with solid colors that adapt to theme
	function statusBadge(status: string) {
		const base =
			"badge badge-sm font-semibold tracking-wide whitespace-nowrap shadow-md px-3 py-2";
		const neutral = base + " badge-neutral text-neutral-content";
		if (!status) return neutral;
		const s = status.toLowerCase();
		if (
			[
				"completed",
				"delivered",
				"fulfilled",
				"shipped",
				"captured",
				"authorized",
			].includes(s)
		)
			return base + " badge-success text-success-content";
		if (["pending", "awaiting", "not_paid"].includes(s))
			return base + " badge-warning text-warning-content";
		if (["canceled", "cancelled"].includes(s))
			return base + " badge-error text-error-content";
		if (["refunded", "partially_refunded"].includes(s))
			return base + " badge-info text-info-content";
		if (
			[
				"partially_shipped",
				"partially_fulfilled",
				"partially_delivered",
			].includes(s)
		)
			return base + " badge-primary text-primary-content";
		return neutral;
	}

	function formatOrderDate(date: string | Date) {
		if (!date) return "Unknown";
		try {
			return new Date(date).toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
			});
		} catch {
			return "Invalid";
		}
	}

	// Step-wise progress model replacing linear bar
	const progressSteps = [
		{ key: "placed", label: "Order Placed", reached: (o: any) => !!o.id },
		{
			key: "payment",
			label: "Payment Received",
			reached: (o: any) =>
				["authorized", "captured"].includes(o.payment_status),
		},
		{
			key: "fulfilled",
			label: "Fulfilled / Shipped",
			reached: (o: any) =>
				[
					"fulfilled",
					"shipped",
					"partially_shipped",
					"partially_fulfilled",
				].includes(o.fulfillment_status) ||
				["delivered", "completed"].includes(o.fulfillment_status) ||
				o.status === "completed",
		},
		{
			key: "delivered",
			label: "Delivered",
			reached: (o: any) =>
				["delivered", "completed"].includes(o.fulfillment_status) ||
				o.status === "completed",
		},
		{
			key: "cancelled",
			label: "Cancelled",
			reached: (o: any) =>
				o.status === "cancelled" || o.status === "canceled",
		},
	];

	// Filter progress steps based on order status
	const filteredProgressSteps = $derived(
		order.status === "cancelled" || order.status === "canceled"
			? progressSteps.filter(
					(step) => step.key === "cancelled" || step.reached(order),
				)
			: progressSteps.filter((step) => step.key !== "cancelled"),
	);

	function stepTimestamp(order: any, stepKey: string) {
		try {
			if (stepKey === "placed") return formatOrderDate(order.created_at);
			if (stepKey === "payment")
				return order.payments?.[0]?.captured_at
					? formatOrderDate(order.payments[0].captured_at)
					: null;
			if (stepKey === "fulfilled") {
				const f = order.fulfillments?.find(
					(ff: any) => ff.shipped_at || ff.fulfilled_at,
				);
				return f?.shipped_at
					? formatOrderDate(f.shipped_at)
					: f?.fulfilled_at
						? formatOrderDate(f.fulfilled_at)
						: null;
			}
			if (stepKey === "delivered") {
				const d = order.fulfillments?.find(
					(ff: any) => ff.delivered_at,
				);
				return d?.delivered_at ? formatOrderDate(d.delivered_at) : null;
			}
			if (stepKey === "cancelled") {
				return formatOrderDate(order.updated_at);
			}
		} catch {
			return null;
		}
		return null;
	}

	function shareLink() {
		// Prefer token (order.id) deep link if looks like an internal id
		const base = "/orders/lookup";
		if (order?.id && /^order_/.test(order.id))
			return `${base}?token=${encodeURIComponent(order.id)}`;
		if (order?.display_id && customerEmail)
			return `${base}?order=${encodeURIComponent(order.display_id)}&email=${encodeURIComponent(customerEmail)}`;
		return base;
	}

	async function copyShare() {
		try {
			const link = window.location.origin + shareLink();
			await navigator.clipboard.writeText(link);
			showToast("Tracking link copied", {
				title: "Link copied",
				type: "success",
			});

			// Track share action for analytics
			trackShare("order", order.id);
			trackEvent("order_link_shared", {
				order_id: order.id,
				order_status: order.status,
				share_method: "clipboard",
			});
		} catch (err) {
			logger.error("Failed to copy link:", err);
			showToast("Unable to copy link", {
				title: "Copy failed",
				type: "error",
			});
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
			// Sanitize the code for security
			const sanitized = sanitizeInput(display);
			if (!sanitized) return;
			const norm = sanitized.toLowerCase();
			if (!codeMap.has(norm)) codeMap.set(norm, sanitized);
		};

		try {
			// From order.promotions
			(order?.promotions || []).forEach((p: any) => {
				const code = p?.code ?? p?.promo_code ?? "";
				if (code) addCode(code);
				else if (p?.id) {
					// Keep a stable fallback so we don't lose unknown promos; won't collide with codes
					const id = String(p.id);
					if (!fallbackIds.includes(id)) fallbackIds.push(id);
				}
			});

			// From line-item adjustments
			(order?.items || []).forEach((item: any) => {
				(item?.adjustments || []).forEach((adj: any) =>
					addCode(adj?.code),
				);
			});
		} catch {
			// no-op
		}

		return [...codeMap.values(), ...fallbackIds];
	});
</script>

<Accordion.Item
	value={order.id}
	class="group relative overflow-hidden rounded-2xl border-2 border-base-300/50 bg-base-100 shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-0.5"
	onmousemove={handleMouseMove}
	onmouseleave={handleMouseLeave}
>
	<Accordion.Header>
		<Accordion.Trigger
			class="flex w-full flex-col gap-3 p-3 text-left md:flex-row md:items-center md:gap-6 md:p-4 relative"
			onclick={() => (isExpanded = !isExpanded)}
		>
			<div class="flex min-w-0 flex-1 flex-col gap-2 relative z-10">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="pr-2 font-mono text-sm leading-none font-semibold break-all sm:text-base text-base-content"
						>#{order.display_id || order.id}</span
					>
					<span class={statusBadge(order.status)}
						>{humanizeOrderStatus(order.status)}</span
					>
					{#if order.payment_status && order.payment_status !== order.status}
						<span class={statusBadge(order.payment_status)}
							>{humanizePaymentStatus(order.payment_status)}</span
						>
					{/if}
					{#if order.fulfillment_status && !["delivered", "completed"].includes(order.status)}
						<span class={statusBadge(order.fulfillment_status)}
							>{humanizeFulfillmentStatus(
								order.fulfillment_status,
							)}</span
						>
					{/if}
				</div>
				<div
					class="flex flex-col gap-1 text-xs text-base-content/70 sm:flex-row sm:gap-4"
				>
					<div class="flex items-center gap-1">
						<span class="opacity-60">Placed:</span><span
							>{formatOrderDate(order.created_at)}</span
						>
					</div>
					<div class="flex items-center gap-1">
						<span class="opacity-60">Items:</span><span
							>{order.items?.length || 0}</span
						>
					</div>
					<!-- Show total only while collapsed (CSS: hide when expanded using data-state attribute) -->
					<div
						class="flex items-center gap-1 data-[state=open]:hidden md:ml-auto"
						data-total-trigger
					>
						<span class="opacity-60">Total:</span>
						<span
							class="text-sm font-semibold text-primary sm:text-base"
							>{formatCurrency(
								calculatedTotal,
								order.currency_code,
							)}</span
						>
					</div>
				</div>
			</div>
		</Accordion.Trigger>
	</Accordion.Header>
	<Accordion.Content
		class="bg-base-50/40 border-t border-base-300/70 p-3 md:p-4"
	>
		<div class="flex flex-col gap-4 md:gap-6">
			<!-- Step Progress with improved animations -->
			<div class="space-y-3">
				<div
					class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
				>
					Progress
				</div>
				<ol
					class="relative ml-2 flex flex-col gap-4 border-l-2 border-base-300/70"
				>
					{#each filteredProgressSteps as step, idx}
						{#if step.reached(order)}
							<li
								class="relative pl-4 transition-all duration-300"
							>
								<span
									class="absolute top-1.5 -left-[9px] h-4 w-4 rounded-full {step.key ===
									'cancelled'
										? 'bg-error ring-error/20'
										: 'bg-primary ring-primary/20'} ring-4 transition-all duration-300 animate-pulse-slow"
								></span>
								<div
									class="text-sm font-medium {step.key ===
									'cancelled'
										? 'text-error'
										: 'text-primary'} transition-colors duration-300"
								>
									{step.label}
								</div>
								{#if stepTimestamp(order, step.key)}
									<div
										class="mt-0.5 text-[10px] opacity-60 transition-opacity duration-300"
									>
										{stepTimestamp(order, step.key)}
									</div>
								{/if}
							</li>
						{:else}
							<li
								class="relative pl-4 opacity-40 transition-all duration-300"
							>
								<span
									class="absolute top-1.5 -left-[9px] h-4 w-4 rounded-full bg-base-300 transition-all duration-300"
								></span>
								<div
									class="text-sm transition-colors duration-300"
								>
									{step.label}
								</div>
							</li>
						{/if}
					{/each}
				</ol>
			</div>

			<!-- Items with improved styling -->
			{#if order.items?.length}
				<div class="space-y-2">
					<div
						class="mb-2 text-sm font-semibold tracking-wide text-base-content/70"
					>
						Items
					</div>
					<ul
						class="divide-y divide-base-300/70 rounded-xl border-2 border-base-300/50 bg-base-100 shadow-sm"
					>
						{#each order.items as item (item.id)}
							<li
								class="grid grid-cols-12 gap-2 p-2 text-sm md:gap-3 md:p-3 transition-colors hover:bg-base-200/30"
							>
								<div class="col-span-8 min-w-0 md:col-span-7">
									<div
										class="truncate font-medium text-sm md:text-base"
									>
										{escapeHtml(item.title)}
										{#if item.variant?.title}
											<span
												class="ml-1 text-xs font-normal text-base-content/60"
												>({escapeHtml(
													item.variant.title,
												)})</span
											>
										{/if}
									</div>
								</div>
								<div
									class="col-span-2 self-center text-center text-xs opacity-70 md:text-sm"
								>
									x{item.quantity}
								</div>
								<div
									class="col-span-2 text-right font-semibold text-sm text-primary md:col-span-3 md:text-base"
								>
									{formatCurrency(
										item.quantity * item.unit_price,
										order.currency_code,
									)}
								</div>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Summary with improved layout -->
			<div class="space-y-2 md:space-y-1">
				<div
					class="text-sm font-semibold tracking-wide text-base-content/70"
				>
					Summary
				</div>
				<div
					class="rounded-xl border-2 border-base-300/50 bg-base-100 p-3 shadow-sm"
				>
					<div class="flex flex-col gap-1.5 text-sm md:text-base">
						<div class="flex justify-between items-center">
							<span class="opacity-70">Subtotal</span>
							<span class="font-medium text-base-content"
								>{formatCurrency(
									order.subtotal ?? order.total,
									order.currency_code,
								)}</span
							>
						</div>
						<div class="flex justify-between items-center">
							<span class="opacity-70">Shipping</span>
							<span class="text-success font-medium"
								>+ {formatCurrency(
									order.shipping_total ?? 0,
									order.currency_code,
								)}</span
							>
						</div>
						<div class="flex justify-between items-center">
							<span class="opacity-70">Tax</span>
							<span class="text-success font-medium"
								>+ {formatCurrency(
									order.tax_total ?? 0,
									order.currency_code,
								)}</span
							>
						</div>
						{#if order.discount_total}
							<div class="flex justify-between items-center">
								<span class="opacity-70">Discounts</span>
								<span class="text-error font-medium"
									>- {formatCurrency(
										order.discount_total,
										order.currency_code,
									)}</span
								>
							</div>
						{/if}
						<div class="h-px bg-base-300/70 my-1"></div>
						<div
							class="flex justify-between items-center font-bold text-base md:text-lg text-primary"
						>
							<span>Total</span>
							<span
								>{formatCurrency(
									calculatedTotal,
									order.currency_code,
								)}</span
							>
						</div>
					</div>
				</div>
			</div>

			<!-- Shipping Address with improved styling -->
			{#if order.shipping_address}
				<div class="space-y-2">
					<div
						class="text-sm font-semibold tracking-wide text-base-content/70"
					>
						Shipping Address
					</div>
					<div
						class="rounded-xl border-2 border-base-300/50 bg-base-100 p-3 text-xs leading-relaxed shadow-sm"
					>
						<div class="font-medium text-base-content">
							{escapeHtml(
								order.shipping_address.first_name || "",
							)}
							{escapeHtml(order.shipping_address.last_name || "")}
						</div>
						{#if order.shipping_address.company}<div
								class="text-base-content/80"
							>
								{escapeHtml(order.shipping_address.company)}
							</div>{/if}
						<div class="mt-1 text-base-content/80">
							{escapeHtml(order.shipping_address.address_1 || "")}
						</div>
						{#if order.shipping_address.address_2}<div
								class="text-base-content/80"
							>
								{escapeHtml(order.shipping_address.address_2)}
							</div>{/if}
						<div class="text-base-content/80">
							{#if order.shipping_address.city && order.shipping_address.province}
								{escapeHtml(order.shipping_address.city)}, {escapeHtml(
									order.shipping_address.province,
								)}
							{:else if order.shipping_address.city}
								{escapeHtml(order.shipping_address.city)}
							{:else if order.shipping_address.province}
								{escapeHtml(order.shipping_address.province)}
							{/if}
							{#if order.shipping_address.postal_code}
								{escapeHtml(order.shipping_address.postal_code)}
							{/if}
						</div>
						<div class="font-medium text-base-content/80">
							{escapeHtml(
								order.shipping_address.country_code?.toUpperCase() ||
									"",
							)}
						</div>
						{#if order.shipping_address.phone}<div
								class="mt-1 text-base-content/70"
							>
								📞 {escapeHtml(order.shipping_address.phone)}
							</div>{/if}
					</div>
				</div>
			{/if}

			<!-- Promotions with enhanced badges -->
			{#if promoBadges.length}
				<div class="space-y-2">
					<div
						class="text-sm font-semibold tracking-wide text-base-content/70"
					>
						Promotions
					</div>
					<ul class="flex flex-wrap gap-2 text-xs">
						{#each promoBadges as code (code)}
							<li
								class="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-1.5 font-semibold text-primary shadow-sm transition-all hover:bg-primary/15 hover:shadow-md"
							>
								<svg
									class="h-3 w-3"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/>
								</svg>
								{code}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Payment Methods with improved UI -->
			{#if order.payments?.length || order.payment_collections?.length}
				<div class="space-y-2">
					<div
						class="text-sm font-semibold tracking-wide text-base-content/70"
					>
						Payment
					</div>
					<ul class="flex flex-col gap-2 text-xs">
						{#each order.payments || [] as p (p.id)}
							<li
								class="flex flex-wrap items-center gap-2 rounded-xl border-2 border-base-300/50 bg-base-100 px-3 py-2 shadow-sm transition-all hover:shadow-md"
							>
								<span class="font-semibold text-base-content"
									>{escapeHtml(
										(
											p.provider_id ||
											p.provider ||
											"payment"
										).replace(/_/g, " "),
									)}</span
								>
								{#if p.metadata?.card_brand || p.data?.card_brand}
									<span class="opacity-70"
										>{escapeHtml(
											p.metadata?.card_brand ||
												p.data?.card_brand,
										)}{#if p.metadata?.card_last4 || p.data?.card_last4}
											• **** {p.metadata?.card_last4 ||
												p.data?.card_last4}{/if}</span
									>
								{/if}
								<span
									class="ml-auto rounded-lg bg-base-200 px-2 py-1 text-[10px] font-bold tracking-wide uppercase {p.captured_at
										? 'text-success'
										: 'text-warning'}"
									>{p.captured_at
										? "Captured"
										: "Pending"}</span
								>
							</li>
						{/each}
						{#each order.payment_collections || [] as pc (pc.id)}
							<li
								class="flex flex-wrap items-center gap-2 rounded-xl border-2 border-base-300/50 bg-base-100 px-3 py-2 shadow-sm transition-all hover:shadow-md"
							>
								<span class="font-semibold text-base-content"
									>Stripe</span
								>
								<span class="opacity-70"
									>{formatCurrency(
										pc.amount,
										order.currency_code,
									)}</span
								>
								<span
									class="ml-auto rounded-lg bg-base-200 px-2 py-1 text-[10px] font-bold tracking-wide uppercase {pc.status ===
										'refunded' || pc.status === 'canceled'
										? 'text-error'
										: pc.completed_at
											? 'text-success'
											: 'text-warning'}"
								>
									{pc.status === "refunded" ||
									pc.status === "canceled"
										? "Refunded"
										: pc.completed_at
											? "Completed"
											: "Pending"}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Refunds with improved styling -->
			{#if order.refunds?.length || order.refunded_total > 0 || (order.status === "cancelled" && order.total === 0)}
				<div class="space-y-2">
					<div
						class="text-sm font-semibold tracking-wide text-base-content/70"
					>
						Refunds
					</div>
					<div
						class="rounded-xl border-2 border-error/30 bg-error/5 p-3 text-xs space-y-1"
					>
						{#each order.refunds || [] as r}
							<div class="flex justify-between items-center">
								<span class="text-base-content/80"
									>{escapeHtml(r.reason || "Refund")}</span
								>
								<span class="font-semibold text-error"
									>{formatCurrency(
										r.amount,
										order.currency_code,
									)}</span
								>
							</div>
						{/each}
						{#if order.refunded_total > 0}
							<div
								class="flex justify-between items-center pt-1 border-t border-error/20"
							>
								<span class="font-medium text-base-content"
									>Total refunded:</span
								>
								<span class="font-bold text-error"
									>{formatCurrency(
										order.refunded_total,
										order.currency_code,
									)}</span
								>
							</div>
						{:else if order.status === "cancelled" && order.total === 0}
							<div class="text-center font-medium text-error">
								Order cancelled - full refund processed
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Actions with improved button styling -->
			<div
				class="flex flex-col gap-2 border-t-2 border-base-300/70 pt-3 sm:flex-row sm:flex-wrap sm:items-center"
			>
				{#if canCancel(order)}
					<button
						class="btn btn-outline btn-sm btn-error w-full sm:w-auto transition-all hover:scale-105 hover:shadow-lg"
						onclick={() => {
							showCancelConfirm = true;
							trackEvent("order_cancel_initiated", {
								order_id: order.id,
							});
						}}
					>
						<svg
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
						Cancel Order
					</button>
				{/if}
				<button
					class="btn btn-outline btn-sm btn-primary w-full sm:w-auto transition-all hover:scale-105 hover:shadow-lg"
					onclick={() => {
						reorder(order.id);
						trackEvent("order_reorder_clicked", {
							order_id: order.id,
							item_count: order.items?.length || 0,
						});
					}}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Reorder
				</button>
				<button
					class="btn btn-outline btn-sm w-full sm:w-auto transition-all hover:scale-105 hover:shadow-lg"
					type="button"
					onclick={copyShare}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
						/>
					</svg>
					Share Link
				</button>
				<a
					class="btn btn-outline btn-sm w-full sm:w-auto transition-all hover:scale-105 hover:shadow-lg"
					href={"/orders/lookup?order=" +
						encodeURIComponent(order.display_id || order.id) +
						"&email=" +
						encodeURIComponent(customerEmail || "")}
					onclick={() => {
						trackEvent("order_details_viewed", {
							order_id: order.id,
							order_status: order.status,
						});
					}}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
						/>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
						/>
					</svg>
					View Details
				</a>
			</div>
		</div>
	</Accordion.Content>
</Accordion.Item>

{#if showCancelConfirm}
	<dialog class="modal modal-open">
		<div class="modal-box rounded-2xl border-2 border-error/30 shadow-2xl">
			<h3 class="text-lg font-bold text-error flex items-center gap-2">
				<svg
					class="h-6 w-6"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				Cancel Order
			</h3>
			<p class="py-4 text-base-content/80">
				Are you sure you want to cancel order <strong
					class="font-mono text-primary"
					>#{order.display_id || order.id}</strong
				>?
				<br /><br />
				<span class="text-error font-semibold flex items-center gap-1">
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
					This action cannot be undone.
				</span>
			</p>
			<div class="modal-action gap-2">
				<button
					class="btn btn-outline transition-all hover:scale-105"
					onclick={() => {
						showCancelConfirm = false;
						trackEvent("order_cancel_dismissed", {
							order_id: order.id,
						});
					}}
				>
					Keep Order
				</button>
				<button
					class="btn btn-error transition-all hover:scale-105 hover:shadow-lg"
					onclick={async () => {
						showCancelConfirm = false;
						trackEvent("order_cancel_confirmed", {
							order_id: order.id,
							order_total: order.total,
						});
						await onCancel(order.id);
					}}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
					Cancel Order
				</button>
			</div>
		</div>
		<div
			class="modal-backdrop bg-black/40 backdrop-blur-sm"
			role="button"
			tabindex="0"
			onclick={() => {
				showCancelConfirm = false;
				trackEvent("order_cancel_dismissed", { order_id: order.id });
			}}
			onkeydown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					showCancelConfirm = false;
					trackEvent("order_cancel_dismissed", {
						order_id: order.id,
					});
					e.preventDefault();
				}
			}}
		></div>
	</dialog>
{/if}

<style>
	/* Custom slow pulse animation for progress indicators */
	@keyframes pulse-slow {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.05);
		}
	}

	.animate-pulse-slow {
		animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	/* Smooth accordion transitions */
	:global([data-accordion-content]) {
		overflow: hidden;
		transition: height 400ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	/* Hover effects for interactive elements */
	button:active,
	a:active {
		transform: scale(0.98);
	}
</style>
