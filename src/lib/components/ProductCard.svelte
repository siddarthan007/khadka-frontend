<script lang="ts">
  import { Motion, useMotionValue, useMotionTemplate } from "svelte-motion";
  import { cn, formatCalculatedPrice } from "$lib/utils";
  import { addLine, updateLine, removeLine } from "$lib/cart";
  import { cart } from "$lib/stores/cart";
  import { ShoppingCart, Eye } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import { logger } from "$lib/logger";
  import OptimizedImage from "$lib/components/OptimizedImage.svelte";
  import { trackAddToCart, trackRemoveFromCart, trackSelectItem } from "$lib/utils/analytics";

  type CalculatedPrice = {
    calculated_amount?: number;
    amount?: number;
    currency_code?: string;
  } | null;

  let {
    title = null,
    price = "",
    image = "",
    badge = null,
    href = "#",
    variantId = null,
    createdAt = null,
    gradientSize = 280,
    gradientColor = "rgba(134,120,249,0.45)",
    gradientOpacity = 0.55,
    class: className = "",
    onQuickView = undefined,
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
    onQuickView?: (() => void) | undefined;
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

  // Cleanup motion values on component destroy to prevent memory leaks
  onDestroy(() => {
    // Motion values don't have explicit destroy method, but we can help GC
    // by setting them to initial values
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  });

  function formatPrice(p: string | CalculatedPrice): string {
    if (typeof p === "string") return p;
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
  });

  // Loading state for better UX and preventing double-clicks
  let isUpdating = $state(false);

  async function onAddToCart() {
    if (!variantId || isUpdating) return;

    isUpdating = true;
    try {
      await addLine(variantId, 1);
      
      // Track add_to_cart event
      try {
        const priceValue = typeof price === 'string' ? 0 : (price?.calculated_amount || price?.amount || 0);
        trackAddToCart({
          id: variantId,
          name: title || 'Unknown Product',
          price: priceValue,
          quantity: 1,
          currency: typeof price === 'string' ? 'USD' : (price?.currency_code?.toUpperCase() || 'USD')
        });
      } catch (e) {
        logger.warn('Analytics tracking failed:', e);
      }
      
      const m = await import('$lib/stores/toast');
      m.showToast('Added to cart', { type: 'success' });
    } catch (error) {
      logger.error('Failed to add to cart:', error);
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
    } catch (error) {
      logger.error("Failed to update cart:", error);
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
        
        // Track remove_from_cart event when quantity reaches 0
        try {
          trackRemoveFromCart({
            id: variantId,
            name: title || 'Unknown Product',
            price: item.unit_price || 0,
            quantity: 1,
            currency: $cart?.currency_code?.toUpperCase() || 'USD'
          });
        } catch (e) {
          logger.warn('Analytics tracking failed:', e);
        }
      }
    } catch (error) {
      logger.error("Failed to update cart:", error);
    } finally {
      isUpdating = false;
    }
  }

  const displayTitle = title ?? "Untitled";
</script>

<div
  role="group"
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  class={cn(
    "group card relative overflow-hidden rounded-2xl border-2 border-base-300/50 bg-base-100 shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1",
    className,
  )}
>
	<a {href} class="relative block aspect-square overflow-hidden bg-base-200">
		<OptimizedImage
			src={image}
			alt={displayTitle}
			width={400}
			height={400}
			loading="lazy"
			class="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
		/>
		{#if badge ?? isNew()}
			<span
				class="absolute top-2 right-2 badge badge-primary rounded-full badge-sm px-3 py-1.5 text-xs font-bold text-primary-content shadow-lg animate-pulse"
			>NEW</span
			>
		{/if}
	</a>
	<div class="space-y-3 p-3 sm:p-4">
		<a {href} class="line-clamp-2 block leading-tight font-bold hover:text-primary transition-colors text-sm sm:text-base"
			>{displayTitle}</a
		>
		<span class="text-lg font-extrabold text-primary block">{formatPrice(price)}</span>
		<div class="flex flex-col gap-2">
      {#if currentQty() > 0}
        <div class="stepper join h-9 sm:h-10 w-full">
					<button
						type="button"
      class="stepper-button join-item flex-1 basis-[2.5rem] text-lg font-bold"
						onclick={onDec}
						disabled={isUpdating}
						aria-label="Decrease quantity"
					>
						<span class="leading-none">−</span>
					</button>
					<input
						type="text"
      class="stepper-input join-item flex-[1.15] basis-[2.75rem] text-sm sm:text-base font-bold pointer-events-none"
						value={currentQty()}
						readonly
						aria-live="polite"
						aria-label="Quantity"
					/>
					<button
						type="button"
      class="stepper-button join-item flex-1 basis-[2.5rem] text-lg font-bold"
						onclick={onInc}
						disabled={isUpdating}
						aria-label="Increase quantity"
					>
						<span class="leading-none">+</span>
					</button>
				</div>
			{:else}
				<div class="flex gap-2">
					<button
						type="button"
						class="btn rounded-xl shadow-md btn-primary hover:shadow-lg flex-1 h-10 min-h-[2.5rem] px-3 text-xs sm:text-sm font-bold flex items-center gap-1.5 justify-center transition-all duration-300 disabled:opacity-50"
						onclick={onAddToCart}
						disabled={!variantId || isUpdating}
					>
						{#if isUpdating}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<ShoppingCart class="size-3.5 sm:size-4 shrink-0" />
							<span class="truncate">Add</span>
						{/if}
					</button>
					{#if onQuickView}
						<button
							type="button"
							class="btn btn-square btn-outline btn-primary h-10 w-10 min-h-[2.5rem] rounded-xl hover:bg-primary hover:text-primary-content hover:border-primary transition-all duration-300"
							onclick={(e) => {
								e.preventDefault();
								onQuickView?.();
							}}
							aria-label="Quick view"
						>
							<Eye class="size-4" />
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	<!-- MagicCard-style radial glow overlay -->
	<Motion style={{ background: bg, opacity: gradientOpacity }} let:motion>
		<div
			use:motion
			class="pointer-events-none absolute -inset-px rounded-2xl opacity-0 shadow-[0_0_0_rgba(0,0,0,0)] transition-[opacity,box-shadow] duration-300 group-hover:opacity-100 group-hover:shadow-[0_0_60px_rgba(134,120,249,0.35)]"
		></div>
	</Motion>
</div>
