<script lang="ts">
	import { Motion, useMotionValue, useMotionTemplate } from 'svelte-motion';
	import { cn, formatCalculatedPrice } from '$lib/utils';
	import { addLine, updateLine, removeLine, getCart } from '$lib/cart';
	import { cart } from '$lib/stores/cart';
	import { ShoppingCart } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	type CalculatedPrice = { calculated_amount?: number; amount?: number; currency_code?: string } | null;

	let {
		title = null,
		price = '',
		image = '',
		badge = null,
		href = '#',
		variantId = null,
		createdAt = null,
		gradientSize = 280,
		gradientColor = 'rgba(134,120,249,0.45)',
		gradientOpacity = 0.55,
		class: className = ''
	}: {
		title?: string | null;
		price?: string | CalculatedPrice;
		image?: string;
		badge?: string | null;
		href?: string;
		variantId?: string | null;
		createdAt?: string | null;
		gradientSize?: number;
		gradientColor?: string;
		gradientOpacity?: number;
		class?: string;
	} = $props();

	let gradSize = useMotionValue(gradientSize);
	let gradColor = useMotionValue(gradientColor);
	let mouseX = useMotionValue(-gradientSize);
	let mouseY = useMotionValue(-gradientSize);
	let bg = useMotionTemplate`radial-gradient(${gradSize}px circle at ${mouseX}px ${mouseY}px, ${gradColor}, transparent 100%)`;

	function handleMouseMove(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
		mouseX.set(e.clientX - rect.left);
		mouseY.set(e.clientY - rect.top);
	}
	function handleMouseLeave() {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	}

	function formatPrice(p: string | CalculatedPrice): string {
		if (typeof p === 'string') return p;
		return formatCalculatedPrice(p);
	}

	const isNew = $derived(() => {
		if (!createdAt) return false;
		const created = new Date(createdAt).getTime();
		if (Number.isNaN(created)) return false;
		const now = Date.now();
		const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
		return now - created <= fifteenDaysMs;
	});

	// Reactive quantity getter that updates when cart changes - fixed for proper reactivity
	let currentQty = $derived(() => {
		if (!$cart?.items || !variantId) return 0;
		const item = $cart.items.find((i: any) => i?.variant_id === variantId);
		return item?.quantity ?? 0;
	})

	// Loading state for better UX and preventing double-clicks
	let isUpdating = $state(false);

	async function onAddToCart() {
		if (!variantId || isUpdating) return;
		
		isUpdating = true;
		try {
			await addLine(variantId, 1);
			await getCart();
			const m = await import('$lib/stores/toast');
			m.showToast('Added to cart', { type: 'success' });
		} catch (error) {
			console.error('Failed to add to cart:', error);
			const m = await import('$lib/stores/toast');
			m.showToast('Failed to add to cart', { type: 'error' });
		} finally {
			isUpdating = false;
		}
	}

	async function onInc() {
		if (!variantId || !$cart?.items || isUpdating) return;
		
		const item = $cart.items.find((i: any) => i?.variant_id === variantId);
		if (!item) return;

		isUpdating = true;
		try {
			await updateLine(item.id, (item.quantity ?? 0) + 1);
			await getCart();
		} catch (error) {
			console.error('Failed to update cart:', error);
		} finally {
			isUpdating = false;
		}
	}

	async function onDec() {
		if (!variantId || !$cart?.items || isUpdating) return;
		
		const item = $cart.items.find((i: any) => i?.variant_id === variantId);
		if (!item) return;

		isUpdating = true;
		try {
			if ((item.quantity ?? 0) > 1) {
				await updateLine(item.id, item.quantity - 1);
			} else {
				await removeLine(item.id);
			}
			await getCart();
		} catch (error) {
			console.error('Failed to update cart:', error);
		} finally {
			isUpdating = false;
		}
	}

	const displayTitle = title ?? 'Untitled';
</script>

<div role="group" onmousemove={handleMouseMove} onmouseleave={handleMouseLeave} class={cn('relative card group bg-base-100 border border-base-300/60 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 ring-1 ring-black/5 hover:border-primary/40', className)}>
	<a href={href} class="block relative aspect-[4/3] overflow-hidden">
		<img src={image} alt={displayTitle} loading="lazy" decoding="async" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
		{#if (badge ?? isNew())}
			<span class="badge badge-primary badge-sm text-primary-content absolute left-2 top-2 px-2.5 py-0.5 rounded-full shadow">NEW</span>
		{/if}
	</a>
	<div class="p-4 space-y-2">
		<a href={href} class="block font-semibold leading-tight hover:underline line-clamp-2">{displayTitle}</a>
		<div class="flex items-center justify-between">
			<span class="font-bold text-lg">{formatPrice(price)}</span>
			{#if currentQty() > 0}
				<div class="join h-8 rounded-full overflow-hidden border border-base-300">
					<Button variant="ghost" size="sm" class="join-item" onclick={onDec} aria-label="Decrease quantity">-</Button>
					<input class="join-item w-12 text-center bg-transparent border-0 pointer-events-none" value={currentQty()} readonly aria-live="polite" aria-label="Quantity" />
					<Button variant="ghost" size="sm" class="join-item" onclick={onInc} aria-label="Increase quantity">+</Button>
				</div>
			{:else}
				<button class="btn btn-sm btn-primary rounded-full shadow-md hover:shadow-lg" onclick={onAddToCart} disabled={!variantId}>
					<ShoppingCart class="size-4" />
					Add to cart
				</button>
			{/if}
		</div>
	</div>
	<!-- MagicCard-style radial glow overlay -->
	<Motion style={{ background: bg, opacity: gradientOpacity }} let:motion>
		<div use:motion class="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-[opacity,box-shadow] duration-300 group-hover:opacity-100 shadow-[0_0_0_rgba(0,0,0,0)] group-hover:shadow-[0_0_60px_rgba(134,120,249,0.35)]"></div>
	</Motion>
</div>
