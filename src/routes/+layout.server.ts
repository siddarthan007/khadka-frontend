import { adminMedusa } from '$lib/server/medusa';
import type { HttpTypes } from '@medusajs/types';
import { getHierarchicalProductCategories } from '$lib/medusa';

async function listAllCollectionsWithMetadata(): Promise<HttpTypes.AdminCollection[]> {
	const all: HttpTypes.AdminCollection[] = [];
	let offset = 0;
	const limit = 50;
	const client = adminMedusa.admin.productCollection;

	try {
		while (true) {
			const { collections, count } = await client.list({ offset, limit });
			if (collections.length) {
				all.push(...collections);
			}
			offset += limit;
			if (collections.length === 0 || all.length >= count) {
				break;
			}
		}
		return all;
	} catch (error) {
		console.error('Failed to fetch collections with metadata:', error);
		return [];
	}
}

export async function load() {
	const collections = await listAllCollectionsWithMetadata();
	const collectionItems = collections
		.map((c) => ({
			title: c.title ?? c.handle,
			handle: c.handle,
			emoji: c.metadata?.emoji
		}));

	// categories for homepage section (top-level only)
	let categoryItems: Array<{ name: string; handle: string; thumbnail?: string | null }> = [];
	try {
		const cats = await getHierarchicalProductCategories();
		categoryItems = cats.map((c) => ({
			name: c.name!,
			handle: c.handle!,
			thumbnail: (c as any).metadata?.thumbnail ?? null
		}));
	} catch {}

	return {
		collectionItems,
		categoryItems
	};
}