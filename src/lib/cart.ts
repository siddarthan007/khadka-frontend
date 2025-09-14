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
