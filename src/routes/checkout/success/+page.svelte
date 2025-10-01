<script lang="ts">
  import { onMount } from 'svelte';
  import { getCart, clearCart } from '$lib/cart';
  import { Button } from '$lib/components/ui/button';
  import { listOrders } from '$lib/customer-api';
  import { formatCurrency } from '$lib/utils';
  import type { HttpTypes } from '@medusajs/types';
  import { goto } from '$app/navigation';
  import SEO from '$lib/components/SEO.svelte';
  import { logger } from '$lib/logger';
  import { trackPurchase, formatOrderItemsForAnalytics } from '$lib/utils/analytics';

  let message: string = $state('Thanks! If your payment was successful, your order details are below.');
  let latestOrder: HttpTypes.StoreOrder | null = $state(null);
  let redirectStatus: string | null = $state(null);

  onMount(async () => {
    // Stripe may append redirect_status; handle failure explicitly
    try {
      const params = new URLSearchParams(window.location.search);
      redirectStatus = params.get('redirect_status');
      if (redirectStatus === 'failed') {
        await goto('/checkout/failed');
        return;
      }
    } catch {}

    // Refresh cart (cart may be consumed into order)
    try { await getCart(); } catch {}

    // Clear the cart after successful order placement
    try { await clearCart(); } catch (e) { logger.warn('Failed to clear cart:', e); }

    // Try loading the latest order for logged-in users
    try {
      const resp = (await listOrders?.({ limit: 1, order: '-created_at' })) as any;
      const orders = resp?.orders ?? [];
      latestOrder = orders?.[0] ?? null;
      
      // Track purchase event for analytics
      if (latestOrder) {
        try {
          const items = formatOrderItemsForAnalytics(latestOrder.items || []);
          trackPurchase(
            latestOrder.id,
            latestOrder.total || 0,
            latestOrder.currency_code?.toUpperCase() || 'USD',
            items,
            latestOrder.shipping_total || 0,
            latestOrder.tax_total || 0
          );
        } catch (err) {
          logger.warn('Analytics tracking failed:', err);
        }
      }
    } catch {}

    // Optional confetti
    try {
      // @ts-ignore optional peer
      const party = await import('canvas-confetti').then((m: any) => m.default || m);
      party({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch {}
  });
</script>

<SEO
  title="Order Confirmed • Khadka Foods"
  description="Thank you for your order! Your payment has been processed successfully."
  canonical="https://khadkafoods.com/checkout/success"
  ogType="website"
/>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="w-full py-16">
  <div class="container mx-auto max-w-lg px-4 text-center">
    <h1 class="text-3xl font-bold">Payment received</h1>
    <p class="mt-2 opacity-80">{message}</p>
    {#if latestOrder}
      <div class="mt-4 text-left rounded-lg border border-base-300 bg-base-100 p-4">
        <div class="flex items-center justify-between">
          <div class="font-semibold">Order #{(latestOrder as any).display_id ?? (latestOrder as any).id}</div>
          <div class="text-sm opacity-70">{new Date(String((latestOrder as any).created_at)).toLocaleString?.() ?? ''}</div>
        </div>
  <div class="mt-1 text-sm opacity-80">Total: {formatCurrency((latestOrder as any).total, (latestOrder as any).currency_code)}</div>
  <a class="btn btn-link btn-sm px-0" href="/account?page=orders">View in My Orders</a>
      </div>
    {:else}
      <div class="mt-4 text-sm opacity-70">Tip: If you checked out as guest, you can track using your email and order number.
        <div><a class="link" href="/orders/lookup">Track an order</a></div>
      </div>
    {/if}
  <div class="mt-6 flex items-center justify-center gap-2">
      <a href="/" class="btn btn-primary">Continue shopping</a>
  <a href="/account?page=orders" class="btn">View orders</a>
    </div>
  </div>
</section>
