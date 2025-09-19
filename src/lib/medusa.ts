import Medusa from '@medusajs/js-sdk';
import type { HttpTypes } from '@medusajs/types';
import { ORDER_LOOKUP_FIELDS, ORDER_DETAIL_FIELDS } from './order-fields';
import { env as publicEnv } from '$env/dynamic/public';
import { MeiliSearch } from "meilisearch";

export function logApiError(operation: string, error: any) {
	const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
	console.error(`Medusa API Error (${operation}):`, errorMessage);
}

let storeClient: Medusa | null = null;

export function getStoreClient(): Medusa | null {
	const baseUrl = publicEnv.PUBLIC_MEDUSA_BACKEND_URL;
	const publishableKey = publicEnv.PUBLIC_MEDUSA_PUBLISHABLE_KEY;
	// Require a valid http(s) URL and a key
	if (
		typeof baseUrl !== 'string' ||
		baseUrl.trim() === '' ||
		!/^https?:\/\//.test(baseUrl) ||
		typeof publishableKey !== 'string' ||
		publishableKey.trim() === ''
	) {
		return null;
	}
	if (!storeClient) {
		try {
			storeClient = new Medusa({
				baseUrl,
				publishableKey,
				auth: {
					type: 'jwt'
				}
			});
		} catch (err) {
			console.warn('Failed to initialize Medusa store client:', (err as any)?.message ?? err);
			storeClient = null;
		}
	}
	return storeClient;
}

let meiliClient: MeiliSearch | null = null;

function getMeiliClient(): MeiliSearch | null {
	const host = publicEnv.PUBLIC_MEILISEARCH_URL;
	if (typeof host !== 'string' || host.trim() === '' || !/^https?:\/\//.test(host)) {
		return null;
	}
	if (!meiliClient) {
		try {
			meiliClient = new MeiliSearch({
				host,
				apiKey: publicEnv.PUBLIC_MEILISEARCH_API_KEY,
				timeout: 10000,
			});
		} catch (err) {
			console.warn('Failed to initialize MeiliSearch:', (err as any)?.message ?? err);
			meiliClient = null;
		}
	}
	return meiliClient;
}

let cachedRegion: { id: string; name: string; currency_code: string } | null = null;

export async function listRegions(): Promise<HttpTypes.StoreRegion[]> {
	const client = getStoreClient();
	if (!client) return [];
	try {
		const { regions } = await client.store.region.list();
		return regions ?? [];
	} catch (error) {
		logApiError('listRegions', error);
		return [];
	}
}

export async function resolveDefaultRegion(): Promise<HttpTypes.StoreRegion | null> {
	if (cachedRegion) return cachedRegion;
	try {
		const target = (publicEnv.PUBLIC_DEFAULT_REGION || '').toLowerCase();
		const currencyMap: Record<string, string> = {
			us: 'usd',
			eu: 'eur',
			uk: 'gbp',
			in: 'inr',
			ca: 'cad',
			au: 'aud'
		};
		const normalized = currencyMap[target] ?? target;
		const regions = await listRegions();
		const found = regions.find(
			(r: HttpTypes.StoreRegion) =>
				r.id === target ||
				r.name?.toLowerCase() === normalized ||
				r.currency_code?.toLowerCase() === normalized
		);
		if (found) {
			cachedRegion = { id: found.id, name: found.name, currency_code: found.currency_code };
			return cachedRegion;
		}
	} catch (error) {
		logApiError('resolveDefaultRegion', error);
	}
	return null;
}

export async function listAllCollections(): Promise<HttpTypes.StoreCollection[]> {
	const all: HttpTypes.StoreCollection[] = [];
	let offset = 0;
	const limit = 50;

	const store = getStoreClient();
	if (!store) return [];

	const client = store.store.collection;

	try {
		while (true) {
			const { collections = [], count = 0 } = await client.list({
				offset,
				limit,
				// ensure metadata present for emoji/thumbnail
				fields: '+metadata'
			});
			if (collections.length) all.push(...collections);
			if (!collections.length || all.length >= count) break;
			offset += limit;
		}
		return all.map((c) => ({
			...c,
			emoji: (c as any).metadata?.emoji
		}));
	} catch (error) {
		logApiError('listAllCollections', error);
		return [];
	}
}

export async function getCollectionByHandle(handle: string): Promise<HttpTypes.StoreCollection | null> {
	const store = getStoreClient();
	if (!store) return null;
	try {
		const client = store.store.collection;
		const { collections } = await client.list({ handle, limit: 1, fields: '+metadata' });
		return collections[0] ?? null;
	} catch (error: any) {
		if (error?.response?.status === 404) return null;
		logApiError('getCollectionByHandle', error);
		return null;
	}
}

export async function searchProducts(query: string, limit: number = 10) {
	try {
		const client = getMeiliClient();
		if (!client) {
			console.warn('MeiliSearch client not initialized');
			return [];
		}
		const index = client.index('products');
		const results = await index.search(query, {
			limit,
			attributesToRetrieve: ["*"],
			attributesToHighlight: ["title", "description", "thumbnail"],
		});
		return results.hits;
	} catch (error) {
		console.error('MeiliSearch error:', error);
		return [];
	}
}

export async function searchCategories(query: string, limit: number = 10) {
	try {
		const client = getMeiliClient();
		if (!client) {
			console.warn('MeiliSearch client not initialized');
			return [];
		}
		const index = client.index('categories');
		const results = await index.search(query, {
			limit,
			attributesToRetrieve: ["*"],
			attributesToHighlight: ["name", "description", "metadata"],
		});
		return results.hits;
	} catch (error) {
		console.error('MeiliSearch error:', error);
		return [];
	}
}


// Product Categories

export type CategoryNode = HttpTypes.StoreProductCategory & { children?: CategoryNode[] };

export async function listAllProductCategories(): Promise<HttpTypes.StoreProductCategory[]> {
	const all: HttpTypes.StoreProductCategory[] = [];
	let offset = 0;
	const limit = 50;

	try {
		const store = getStoreClient();
		if (!store) return all;
		while (true) {
			const { product_categories = [], count = 0 } = await (store as any).store.category.list({
				offset,
				limit,
				fields: '+metadata'
			});
			if (product_categories.length) all.push(...product_categories);
			if (!product_categories.length || all.length >= count) break;
			offset += limit;
		}
		return all;
	} catch (error) {
		logApiError('listAllProductCategories', error);
		return [];
	}
}

export async function getProductCategoryByHandle(handle: string): Promise<HttpTypes.StoreProductCategory | null> {
	try {
		const store = getStoreClient();
		if (!store) return null;
		const { product_categories = [] } = await (store as any).store.category.list({
			handle,
			limit: 1,
			fields: '+metadata'
		});
		if (product_categories[0]) return product_categories[0];
		const all = await listAllProductCategories();
		return all.find((c) => c.handle === handle) ?? null;
	} catch (error: any) {
		if (error?.response?.status === 404) return null;
		logApiError('getProductCategoryByHandle', error);
		return null;
	}
}

export async function getHierarchicalProductCategories(): Promise<CategoryNode[]> {
	try {
		const flat = await listAllProductCategories();
		const map = new Map<string, CategoryNode>();
		flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
		const roots: CategoryNode[] = [];
		for (const c of map.values()) {
			const parentId = (c as HttpTypes.StoreProductCategory).parent_category_id as string | null | undefined;
			if (parentId && map.has(parentId)) {
				map.get(parentId)!.children!.push(c);
			} else {
				roots.push(c);
			}
		}
		const byRank = (a: CategoryNode, b: CategoryNode) => {
			const ra = (a as any).rank ?? 0;
			const rb = (b as any).rank ?? 0;
			if (ra !== rb) return ra - rb;
			return (a.name || '').localeCompare(b.name || '');
		};
		const sortTree = (nodes: CategoryNode[]) => {
			nodes.sort(byRank);
			nodes.forEach((n) => n.children && sortTree(n.children));
		};
		sortTree(roots);
		return roots;
	} catch (error) {
		logApiError('getHierarchicalProductCategories', error);
		return [];
	}
}

// Products

function withRegion<T extends Record<string, any>>(obj: T): Promise<T> | T {
	return obj;
}

const DEFAULT_PRODUCT_FIELDS = 'id,handle,title,subtitle,description,created_at,thumbnail,*images,*variants.calculated_price,*variants.options,+variants.inventory_quantity,+variants.metadata,+variants.sku,*options,*options.values,*collection,*categories,*tags,+metadata';

export async function getProductByHandle(handle: string, fields: string = DEFAULT_PRODUCT_FIELDS): Promise<HttpTypes.StoreProduct | null> {
	const region = await resolveDefaultRegion().catch(() => null);
	const query: Record<string, any> = { handle, limit: 1, fields };
	// Relations expanded via * in fields
	if (region?.id) query.region_id = region.id;
	try {
		const store = getStoreClient();
		if (!store) return null;
		const { products } = await store.store.product.list(query as any);
		if (products?.[0]) return products[0];
	} catch (error: any) {
		if (error?.response?.status === 404) return null;
		logApiError('getProductByHandle', error);
		return null;
	}
	return null;
}

export type ListProductsResult = {
	products: HttpTypes.StoreProduct[];
	count: number;
	limit: number;
	offset: number;
};

type ListProductsBaseOpts = {
	limit?: number;
	offset?: number;
	fields?: string;
	q?: string;
};

export async function listProducts(params: Record<string, any> & ListProductsBaseOpts = {}): Promise<ListProductsResult> {
	try {
		const region = await resolveDefaultRegion();
		const { limit = 12, offset = 0, fields = DEFAULT_PRODUCT_FIELDS, q, ...rest } = params;
		const query: any = { limit, offset, fields, ...rest };
		if (q) query.q = q;
		if (region?.id) query.region_id = region.id;
		const store = getStoreClient();
		if (!store) return { products: [], count: 0, limit: params.limit ?? 12, offset: params.offset ?? 0 };
		const resp = await store.store.product.list(query);
		return {
			products: (resp as any).products ?? [],
			count: (resp as any).count ?? ((resp as any).products?.length ?? 0),
			limit: (resp as any).limit ?? limit,
			offset: (resp as any).offset ?? offset
		};
	} catch (error) {
		logApiError('listProducts', error);
		return { products: [], count: 0, limit: params.limit ?? 12, offset: params.offset ?? 0 };
	}
}

export async function listBasicProducts(limit = 20, offset = 0): Promise<ListProductsResult> {
	try {
		const region = await resolveDefaultRegion();
		const fields = 'id,handle,title,created_at,thumbnail,*images,variants.id,*variants.calculated_price';
		const query: any = { limit, offset, fields };
		if (region?.id) query.region_id = region.id;
		const store = getStoreClient();
		if (!store) return { products: [], count: 0, limit, offset };
		const resp = await store.store.product.list(query);
		return {
			products: (resp as any).products ?? [],
			count: (resp as any).count ?? ((resp as any).products?.length ?? 0),
			limit: (resp as any).limit ?? limit,
			offset: (resp as any).offset ?? offset
		};
	} catch (error) {
		logApiError('listBasicProducts', error);
		return { products: [], count: 0, limit, offset };
	}
}

export async function listProductsByCollectionId(collectionId: string | string[], opts: ListProductsBaseOpts = {}): Promise<ListProductsResult> {
	const collectionFilter = Array.isArray(collectionId) ? collectionId : [collectionId];
	return listProducts({ collection_id: collectionFilter, ...opts });
}

export async function listProductsByCollectionHandle(handle: string, opts: ListProductsBaseOpts = {}): Promise<ListProductsResult> {
	try {
		const collection = await getCollectionByHandle(handle);
		if (!collection?.id) return { products: [], count: 0, limit: opts.limit ?? 12, offset: opts.offset ?? 0 };
		return await listProductsByCollectionId(collection.id, opts);
	} catch (error) {
		logApiError('listProductsByCollectionHandle', error);
		return { products: [], count: 0, limit: opts.limit ?? 12, offset: opts.offset ?? 0 };
	}
}

export async function listProductsByCategoryIds(categoryIds: string | string[], opts: ListProductsBaseOpts = {}): Promise<ListProductsResult> {
	const catFilter = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
	return listProducts({ category_id: catFilter, ...opts });
}

export async function listProductsByCategoryHandles(handles: string | string[], opts: ListProductsBaseOpts = {}): Promise<ListProductsResult> {
	try {
		const wanted = Array.isArray(handles) ? handles : [handles];
		const all = await listAllProductCategories();
		const ids = all.filter((c) => wanted.includes(c.handle!)).map((c) => c.id);
		if (!ids.length) return { products: [], count: 0, limit: opts.limit ?? 12, offset: opts.offset ?? 0 };
		return await listProductsByCategoryIds(ids, opts);
	} catch (error) {
		logApiError('listProductsByCategoryHandles', error);
		return { products: [], count: 0, limit: opts.limit ?? 12, offset: opts.offset ?? 0 };
	}
}

export async function listProductsByCollectionAndCategories(
	collectionId: string | string[],
	categoryIds: string | string[],
	opts: ListProductsBaseOpts = {}
): Promise<ListProductsResult> {
	const collectionFilter = Array.isArray(collectionId) ? collectionId : [collectionId];
	const categoryFilter = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
	return listProducts({ collection_id: collectionFilter, category_id: categoryFilter, ...opts });
}

// Orders (guest lookup helpers)
// The JS SDK no longer exposes store.order.lookup in our environment. We emulate a lookup by:
// 1. If token is provided and looks like an order id (order_*) try direct retrieve.
// 2. If display_id + email provided: list first 50 orders filtered by email then match display_id.
// 3. Fallback: try retrieve(display_id) if it resembles an id.
export async function lookupOrder(params: { token?: string; display_id?: string | number; email?: string }): Promise<HttpTypes.StoreOrder | null> {
	try {
		const store = getStoreClient() as any;
		if (!store) return null;
		const { token, display_id, email } = params;

		const fullFields = ORDER_LOOKUP_FIELDS;

		// Direct retrieve if token looks like order id
		if (token && /^order_/.test(token)) {
			try {
				const full = await store.store.order.retrieve(token, { fields: fullFields });
				return (full as any)?.order ?? null;
			} catch { }
		}

		// Display ID + email path: list orders for email then match display_id
		if (display_id && email) {
			try {
				const listResp = await store.store.order.list({ fields: 'id,display_id,email,status,payment_status,fulfillment_status,total,currency_code,created_at', limit: 50 });
				const match = (listResp as any)?.orders?.find((o: any) => String(o.display_id) === String(display_id) && o.email?.toLowerCase() === email.toLowerCase());
				if (match) {
					try {
						const full = await store.store.order.retrieve(match.id, { fields: fullFields });
						return (full as any)?.order ?? match;
					} catch { return match; }
				}
			} catch (e) {
				logApiError('lookupOrder.list', e);
			}
		}

		// Last resort: try treating display_id as id
		if (display_id && /^order_/.test(String(display_id))) {
			try {
				const full = await store.store.order.retrieve(String(display_id), { fields: fullFields });
				return (full as any)?.order ?? null;
			} catch { }
		}
	} catch (error) {
		logApiError('lookupOrder', error);
	}
	return null;
}

export async function getOAuthCustomer(token: string, identity: string) {
	try {
		const store = getStoreClient();
		if (!store) return null;
		const resp = await store.client.fetch(`/store/google/auth?auth_identity_id=${identity}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			}
		});
		return resp;
	} catch (e) {
		logApiError('getOAuthCustomer', e);
		return null;
	}
}

// Query system order fetch using Medusa SDK REST API
export async function queryOrderById(orderId: string) {
	try {
		const store = getStoreClient();
		if (!store) return null;

		const { order } = await store.store.order.retrieve(orderId, {
			fields: ORDER_DETAIL_FIELDS
		});

		return order ?? null;
	} catch (e) {
		logApiError('queryOrderById', e);
		return null;
	}
}

