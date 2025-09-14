import type { PageServerLoad } from './$types';
import { listAllCollections, getCollectionByHandle } from '$lib/medusa';

export const load: PageServerLoad = async () => {
	const collections = await listAllCollections();
	const items = collections.map((c) => ({
		name: c.title ?? c.handle,
		handle: c.handle,
		thumbnail: (c as any).metadata?.thumbnail ?? null,
		emoji: (c as any).metadata?.emoji ?? null,
	}));
	return {
		collections: items
	};
};
