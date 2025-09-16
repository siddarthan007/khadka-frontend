import { getStoreClient, resolveDefaultRegion } from './medusa';
import { cart } from '$lib/stores/cart';
import type { HttpTypes } from '@medusajs/types';
import { get } from 'svelte/store';

export async function ensureCart(): Promise<string> {
	const existingCart = get(cart);
	if (existingCart?.id) {
		return existingCart.id;
	}

	const region = await resolveDefaultRegion().catch(() => null);
	const store = getStoreClient();
	if (!store) throw new Error('Store client not configured');
	const { cart: newCart } = await store.store.cart.create(
		region?.id ? { region_id: region.id } : {}
	);

	cart.set(newCart);
	return newCart.id;
}

export async function getCart(): Promise<HttpTypes.StoreCart | null> {
	const existingCart = get(cart);
	if (!existingCart?.id) return null;
	const store = getStoreClient();
	if (!store) return null;
	const { cart: freshCart } = await store.store.cart.retrieve(existingCart.id);
	cart.set(freshCart);
	return freshCart;
}

export async function addLine(variantId: string, quantity = 1): Promise<HttpTypes.StoreCart> {
	const cartId = await ensureCart();
	const store = getStoreClient();
	if (!store) throw new Error('Store client not configured');

	// Merge same-variant lines by incrementing quantity if present
	const existing = get(cart);
	const existingItem = (existing as any)?.items?.find((li: any) => li?.variant_id === variantId);
	if (existingItem) {
		const { cart: updatedCart } = await store.store.cart.updateLineItem(cartId, existingItem.id, {
			quantity: (existingItem.quantity ?? 0) + quantity
		});
		cart.set(updatedCart);
		return updatedCart;
	}

	const { cart: updatedCart } = await store.store.cart.createLineItem(cartId, {
		variant_id: variantId,
		quantity
	});
	cart.set(updatedCart);
	return updatedCart;
}

export async function updateLine(lineId: string, quantity: number): Promise<HttpTypes.StoreCart> {
	const cartId = await ensureCart();
	const store = getStoreClient();
	if (!store) throw new Error('Store client not configured');
	const { cart: updatedCart } = await store.store.cart.updateLineItem(cartId, lineId, {
		quantity
	});
	cart.set(updatedCart);
	return updatedCart;
}

export async function removeLine(lineId: string): Promise<HttpTypes.StoreCart | null> {
	const cartId = await ensureCart();
	const store = getStoreClient();
	if (!store) return await getCart();
	await store.store.cart.deleteLineItem(cartId, lineId);
	cart.set(await getCart());
	return await getCart();
}

export async function clearCart(): Promise<HttpTypes.StoreCart | null> {
	const existing = get(cart);
	if (!existing?.id) return null;
	const cartId = existing.id;
	const items = (existing as any).items ?? [];
	await Promise.all(
		items.map((li: any) => {
			const store = getStoreClient();
			if (!store) return Promise.resolve(null);
			return store.store.cart.deleteLineItem(cartId, li.id).catch(() => null);
		})
	);
	return await getCart();
}

// Coupons / Promotions
export async function applyCoupon(code: string): Promise<HttpTypes.StoreCart | null> {
	const coupon = (code || '').trim();
	if (!coupon) return await getCart();
	const existing = get(cart);
	const cartId = existing?.id ?? (await ensureCart());
	const store = getStoreClient();
	if (!store) return await getCart();
	try {
		await (store as any).client.fetch(`/store/carts/${cartId}/promotions`, {
			method: 'POST',
			body: { promo_codes: [coupon] }
		});
		const updated = await getCart();
		try { const m = await import('$lib/stores/toast'); m.showToast('Coupon applied', { type: 'success' }); } catch { }
		return updated;
	} catch (err) {
		console.warn('Failed to apply coupon', err);
		try { const m = await import('$lib/stores/toast'); m.showToast('Coupon not found', { type: 'error' }); } catch { }
		return await getCart();
	}
}

export async function removeCoupon(code: string): Promise<HttpTypes.StoreCart | null> {
	const coupon = (code || '').trim();
	if (!coupon) return await getCart();
	const existing = get(cart);
	const cartId = existing?.id ?? (await ensureCart());
	const store = getStoreClient();
	if (!store) return await getCart();
	try {
		await (store as any).client.fetch(`/store/carts/${cartId}/promotions`, {
			method: 'DELETE',
			body: { promo_codes: [coupon] }
		});
		const updated = await getCart();
		try { const m = await import('$lib/stores/toast'); m.showToast('Coupon removed', { type: 'success' }); } catch { }
		return updated;
	} catch (err) {
		console.warn('Failed to remove coupon', err);
		return await getCart();
	}
}