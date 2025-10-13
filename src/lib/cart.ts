import { getStoreClient, resolveDefaultRegion } from "./medusa";
import { cart } from "$lib/stores/cart";
import type { HttpTypes } from "@medusajs/types";
import { get } from "svelte/store";
import {
  trackAddToCart,
  trackRemoveFromCart,
  formatCartItemsForAnalytics,
  calculateCartValue
} from "$lib/utils/analytics";
import { logger } from "$lib/logger";

function normalizeLineItems(targetCart: any) {
  if (!Array.isArray(targetCart?.items)) return;
  for (const li of targetCart.items as any[]) {
    if (!li.variant) {
      li.variant = {
        id: li.variant_id,
        title: li.variant_title,
        product_id: li.product_id,
        metadata: {
          ...(li?.variant?.metadata ?? {}),
          thumbnail: li.thumbnail,
        },
      };
    } else if (!li.variant?.metadata) {
      li.variant.metadata = {
        ...(li?.variant?.metadata ?? {}),
        thumbnail: li.thumbnail,
      };
    }
  }
}

function getCartItemCount(targetCart: any): number {
  if (!Array.isArray(targetCart?.items)) return 0;
  return (targetCart.items as any[]).reduce(
    (sum, li: any) => sum + (li?.quantity ?? 0),
    0,
  );
}

function hasResidualCheckoutState(targetCart: any): boolean {
  if (!targetCart) return false;
  const shippingTotal = targetCart.shipping_total ?? 0;
  const shippingTax = targetCart.shipping_tax_total ?? 0;
  const total = targetCart.total ?? 0;
  const hasShippingMethods = Array.isArray(targetCart.shipping_methods)
    ? targetCart.shipping_methods.length > 0
    : false;
  const hasShippingAddress = Boolean(targetCart.shipping_address);
  const hasPaymentSessions = Boolean(
    targetCart?.payment_collection?.payment_sessions?.length,
  );
  return (
    shippingTotal > 0 ||
    shippingTax > 0 ||
    total > 0 ||
    hasShippingMethods ||
    hasShippingAddress ||
    hasPaymentSessions
  );
}

async function maybeResetEmptyCart(
  targetCart: HttpTypes.StoreCart | null,
  storeClient: any,
  source: string,
): Promise<HttpTypes.StoreCart | null> {
  if (!targetCart) return targetCart;
  if (!storeClient) return targetCart;

  if (getCartItemCount(targetCart) >= 1) {
    return targetCart;
  }

  if (!hasResidualCheckoutState(targetCart)) {
    return targetCart;
  }

  try {
    const payload = (targetCart as any)?.region_id
      ? { region_id: (targetCart as any).region_id }
      : {};
    const { cart: freshCart } = await storeClient.store.cart.create(payload);
    logger.log("[cart] regenerated empty cart", {
      source,
      previousCartId: (targetCart as any)?.id,
      region: (targetCart as any)?.region_id ?? "default",
    });
    return freshCart;
  } catch (error) {
    logger.error("[cart] failed to regenerate empty cart", {
      source,
      error: (error as any)?.message ?? error,
    });
    return targetCart;
  }
}

export async function ensureCart(): Promise<string> {
  const existingCart = get(cart);
  if (existingCart?.id) {
    return existingCart.id;
  }

  const region = await resolveDefaultRegion().catch(() => null);
  const store = getStoreClient();
  if (!store) throw new Error("Store client not configured");
  const { cart: newCart } = await store.store.cart.create(
    region?.id ? { region_id: region.id } : {},
  );

  cart.set(newCart);
  return newCart.id;
}

export async function getCart(): Promise<HttpTypes.StoreCart | null> {
  const existingCart = get(cart);
  if (!existingCart?.id) return null;
  const store = getStoreClient();
  if (!store) return null;
  // Use official SDK method only
  const resp = await (store as any).store.cart.retrieve(existingCart.id);
  let freshCart: any = (resp as any)?.cart ?? resp;

  freshCart = await maybeResetEmptyCart(freshCart, store, "getCart");

  if (freshCart) {
    try {
      normalizeLineItems(freshCart);
    } catch {}
  }

  cart.set(freshCart);
  return freshCart;
}

export async function addLine(
  variantId: string,
  quantity = 1,
): Promise<HttpTypes.StoreCart> {
  const cartId = await ensureCart();
  const store = getStoreClient();
  if (!store) throw new Error("Store client not configured");

  // Merge same-variant lines by incrementing quantity if present
  const existing = get(cart);
  const existingItem = (existing as any)?.items?.find(
    (li: any) => li?.variant_id === variantId,
  );
  if (existingItem) {
    const { cart: updatedCart } = await store.store.cart.updateLineItem(
      cartId,
      existingItem.id,
      {
        quantity: (existingItem.quantity ?? 0) + quantity,
      },
    );
    cart.set(updatedCart);
    
    // Track add to cart event
    try {
      trackAddToCart({
        id: existingItem.variant_id || existingItem.id,
        name: existingItem.title || existingItem.variant?.title || 'Product',
        price: existingItem.unit_price || 0,
        quantity,
        currency: updatedCart.currency_code?.toUpperCase() || 'USD',
        category: existingItem.product?.collection?.title
      });
    } catch (e) {
      logger.warn('Analytics tracking failed:', e);
    }
    
    return updatedCart;
  }

  const { cart: updatedCart } = await store.store.cart.createLineItem(cartId, {
    variant_id: variantId,
    quantity,
  });
  cart.set(updatedCart);
  
  // Track add to cart event for new item
  try {
    const addedItem = (updatedCart as any)?.items?.find(
      (li: any) => li?.variant_id === variantId,
    );
    if (addedItem) {
      trackAddToCart({
        id: addedItem.variant_id || addedItem.id,
        name: addedItem.title || addedItem.variant?.title || 'Product',
        price: addedItem.unit_price || 0,
        quantity,
        currency: updatedCart.currency_code?.toUpperCase() || 'USD',
        category: addedItem.product?.collection?.title
      });
    }
  } catch (e) {
    logger.warn('Analytics tracking failed:', e);
  }
  
  return updatedCart;
}

export async function updateLine(
  lineId: string,
  quantity: number,
): Promise<HttpTypes.StoreCart> {
  const cartId = await ensureCart();
  const store = getStoreClient();
  if (!store) throw new Error("Store client not configured");
  const { cart: updatedCart } = await store.store.cart.updateLineItem(
    cartId,
    lineId,
    {
      quantity,
    },
  );
  const normalized = await maybeResetEmptyCart(
    updatedCart,
    store,
    "updateLine",
  );
  const finalCart = (normalized ?? updatedCart) as HttpTypes.StoreCart;
  try {
    normalizeLineItems(finalCart);
  } catch {}
  cart.set(finalCart);
  return finalCart;
}

export async function removeLine(
  lineId: string,
): Promise<HttpTypes.StoreCart | null> {
  const cartId = await ensureCart();
  const store = getStoreClient();
  if (!store) return await getCart();
  
  // Get item details before removing for analytics
  const existing = get(cart);
  const removedItem = (existing as any)?.items?.find((li: any) => li?.id === lineId);
  
  await store.store.cart.deleteLineItem(cartId, lineId);
  const updatedCart = await getCart();
  
  // Track remove from cart event
  if (removedItem && existing) {
    try {
      trackRemoveFromCart({
        id: removedItem.variant_id || removedItem.id,
        name: removedItem.title || removedItem.variant?.title || 'Product',
        price: removedItem.unit_price || 0,
        quantity: removedItem.quantity || 1,
        currency: existing.currency_code?.toUpperCase() || 'USD'
      });
    } catch (e) {
      logger.warn('Analytics tracking failed:', e);
    }
  }
  
  return updatedCart;
}

export async function clearCart(): Promise<HttpTypes.StoreCart | null> {
  const existing = get(cart);
  if (!existing?.id) return null;
  const cartId = existing.id;
  const store = getStoreClient();
  if (!store) return await getCart();

  const hasPayments = !!(existing as any)?.payment_collection?.payment_sessions
    ?.length;
  const items: any[] = (existing as any).items ?? [];

  // If payment sessions exist, safer to start a fresh cart than deleting lines (backend may block due to sessions)
  if (hasPayments) {
    try {
      const regionId = (existing as any).region_id;
      const { cart: newCart } = await (store as any).store.cart.create(
        regionId ? { region_id: regionId } : {},
      );
      cart.set(newCart);
      return newCart;
    } catch (e) {
      logger.error(
        "[cart] failed to create new cart for clearCart with payments",
        e,
      );
    }
  }

  let anyFailure = false;
  for (const li of items) {
    try {
      await (store as any).store.cart.deleteLineItem(cartId, li.id);
    } catch (e) {
      anyFailure = true;
      logger.warn(
        "[cart] deleteLineItem failed, will fallback to new cart",
        li.id,
        (e as any)?.message,
      );
      break;
    }
  }

  if (anyFailure) {
    try {
      const regionId = (existing as any).region_id;
      const { cart: newCart } = await (store as any).store.cart.create(
        regionId ? { region_id: regionId } : {},
      );
      cart.set(newCart);
      return newCart;
    } catch (e) {
      logger.error("[cart] fallback new cart creation failed", e);
    }
  }

  return await getCart();
}

// Coupons / Promotions
export async function applyCoupon(
  code: string,
): Promise<HttpTypes.StoreCart | null> {
  const coupon = (code || "").trim();
  if (!coupon) return await getCart();
  const existing = get(cart);
  const cartId = existing?.id ?? (await ensureCart());
  const store = getStoreClient();
  if (!store) return await getCart();
  try {
    const res = await fetch(
      `/api/cart/promotions?cart_id=${encodeURIComponent(cartId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ promo_codes: [coupon] }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const updated = await getCart();
    try {
      const m = await import("$lib/stores/toast");
      m.showToast("Coupon applied", { type: "success" });
    } catch {}
    return updated;
  } catch (err) {
    try {
      const m = await import("$lib/stores/toast");
      m.showToast("Coupon not valid", { type: "error" });
    } catch {}
    return await getCart();
  }
}

export async function removeCoupon(
  code: string,
): Promise<HttpTypes.StoreCart | null> {
  const coupon = (code || "").trim();
  if (!coupon) return await getCart();
  const existing = get(cart);
  const cartId = existing?.id ?? (await ensureCart());
  const store = getStoreClient();
  if (!store) return await getCart();
  try {
    const res = await fetch(
      `/api/cart/promotions?cart_id=${encodeURIComponent(cartId)}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ promo_codes: [coupon] }),
      },
    );
    if (!res.ok) throw new Error(await res.text());
    const updated = await getCart();
    try {
      const m = await import("$lib/stores/toast");
      m.showToast("Coupon removed", { type: "success" });
    } catch {}
    return updated;
  } catch (err) {
    try {
      const m = await import("$lib/stores/toast");
      m.showToast("Failed to remove coupon", { type: "error" });
    } catch {}
    return await getCart();
  }
}
