import Medusa from '@medusajs/js-sdk';
import type { HttpTypes } from '@medusajs/types';
import { env as publicEnv } from '$env/dynamic/public';
import { MeiliSearch } from "meilisearch";

function logApiError(operation: string, error: any) {
	const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
	console.error(`Medusa API Error (${operation}):`, errorMessage);
}

export const medusa = new Medusa({
	baseUrl: publicEnv.PUBLIC_MEDUSA_BACKEND_URL!,
	publishableKey: publicEnv.PUBLIC_MEDUSA_PUBLISHABLE_KEY!
});

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
	if (!medusa) return [];
	try {
		const { regions } = await medusa.store.region.list();
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
	
	const client = medusa.store.collection;
	if (!client) return [];

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
	if (!medusa) return null;
	try {
		const client = medusa.store.collection;
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
		while (true) {
			const resp = await (medusa as any).client.fetch(`/store/product-categories`, {
				method: 'GET',
				query: { offset, limit, fields: '+metadata' }
			});
			const categories: HttpTypes.StoreProductCategory[] = (resp as any).product_categories
				?? (resp as any).productCategories
				?? (resp as any).categories
				?? [];
			const count: number | undefined = (resp as any).count;
			if (!categories.length) break;
			all.push(...categories);
			if (typeof count === 'number' && all.length >= count) break;
			if (categories.length < limit) break;
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
		const resp = await (medusa as any).client.fetch(`/store/product-categories`, {
			method: 'GET',
			query: { handle, limit: 1, fields: '+metadata' }
		});
		const categories: HttpTypes.StoreProductCategory[] = (resp as any).product_categories ?? [];
		if (categories[0]) return categories[0];
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
		const { products } = await medusa.store.product.list(query as any);
		if (products?.[0]) return products[0];
	} catch (error: any) {
		try {
			const resp = await (medusa as any).client.fetch(`/store/products`, { method: 'GET', query });
			const products: HttpTypes.StoreProduct[] = (resp as any).products ?? [];
			if (products[0]) return products[0];
		} catch (fallbackErr) {
			if ((fallbackErr as any)?.response?.status === 404) return null;
			logApiError('getProductByHandle', fallbackErr);
			return null;
		}
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
		const resp = await medusa.store.product.list(query);
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
		const resp = await medusa.store.product.list(query);
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

