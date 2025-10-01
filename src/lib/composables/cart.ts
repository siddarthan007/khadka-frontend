/**
 * Shared cart utilities and composables
 * Reduces code duplication across components
 */

import { addLine, updateLine, removeLine } from '$lib/cart';
import { cart } from '$lib/stores/cart';
import { get } from 'svelte/store';
import type { CartItem } from '$lib/types/cart';
import { logger } from '$lib/logger';

/**
 * Get the current quantity of a variant in the cart
 */
export function getCartItemQuantity(variantId: string): number {
  const $cart = get(cart);
  if (!$cart?.items) return 0;
  const item = $cart.items.find((i: any) => i?.variant_id === variantId);
  return item?.quantity ?? 0;
}

/**
 * Get a cart item by variant ID
 */
export function getCartItem(variantId: string): any | null {
  const $cart = get(cart);
  if (!$cart?.items) return null;
  return $cart.items.find((i: any) => i?.variant_id === variantId) ?? null;
}

/**
 * Shared cart operation handlers with consistent error handling and toast notifications
 */
export function createCartHandlers(variantId: string | null) {
  let isUpdating = $state(false);

  async function handleAddToCart() {
    if (!variantId || isUpdating) return false;
    
    isUpdating = true;
    try {
      await addLine(variantId, 1);
      // Cart store updates automatically - no manual getCart() needed
      
      const { showToast } = await import('$lib/stores/toast');
      showToast('Added to cart', { type: 'success' });
      return true;
    } catch (err) {
      logger.error('Failed to add to cart:', err);
      const { showToast } = await import('$lib/stores/toast');
      showToast('Failed to add to cart', { type: 'error' });
      return false;
    } finally {
      isUpdating = false;
    }
  }

  async function handleIncrement(lineItemId: string, currentQuantity: number) {
    if (isUpdating) return false;

    isUpdating = true;
    try {
      await updateLine(lineItemId, currentQuantity + 1);
      // Cart store updates automatically
      return true;
    } catch (err) {
      logger.error('Failed to update quantity:', err);
      const { showToast } = await import('$lib/stores/toast');
      showToast('Failed to update quantity', { type: 'error' });
      return false;
    } finally {
      isUpdating = false;
    }
  }

  async function handleDecrement(lineItemId: string, currentQuantity: number) {
    if (isUpdating) return false;

    isUpdating = true;
    try {
      if (currentQuantity === 1) {
        await removeLine(lineItemId);
      } else {
        await updateLine(lineItemId, currentQuantity - 1);
      }
      // Cart store updates automatically
      return true;
    } catch (err) {
      logger.error('Failed to update quantity:', err);
      const { showToast } = await import('$lib/stores/toast');
      showToast('Failed to update quantity', { type: 'error' });
      return false;
    } finally {
      isUpdating = false;
    }
  }

  async function handleRemove(lineItemId: string) {
    if (isUpdating) return false;

    isUpdating = true;
    try {
      await removeLine(lineItemId);
      // Cart store updates automatically
      return true;
    } catch (err) {
      logger.error('Failed to remove item:', err);
      const { showToast } = await import('$lib/stores/toast');
      showToast('Failed to remove item', { type: 'error' });
      return false;
    } finally {
      isUpdating = false;
    }
  }

  return {
    get isUpdating() { return isUpdating; },
    handleAddToCart,
    handleIncrement,
    handleDecrement,
    handleRemove
  };
}

/**
 * Calculate cart summary totals
 */
export function calculateCartSummary(cartData: any) {
  const items = cartData?.items ?? [];
  const itemCount = items.reduce((sum: number, item: any) => sum + (item?.quantity ?? 0), 0);
  const subtotal = cartData?.subtotal ?? 0;
  const tax = cartData?.tax_total ?? 0;
  const shipping = cartData?.shipping_total ?? 0;
  const discount = cartData?.discount_total ?? 0;
  const total = cartData?.total ?? 0;

  return {
    itemCount,
    subtotal,
    tax,
    shipping,
    discount,
    total,
    hasItems: itemCount > 0
  };
}
