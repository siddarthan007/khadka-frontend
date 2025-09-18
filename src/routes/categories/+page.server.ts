import type { PageServerLoad } from './$types';
import type { HttpTypes } from '@medusajs/types';
import { getHierarchicalProductCategories } from '$lib/medusa';

export const load: PageServerLoad = async () => {
	const tree = await getHierarchicalProductCategories();
	// flatten top-level categories for grid, keep full tree for potential future use
	const topLevel: Array<{
		name: string;
		handle: string;
		thumbnail?: string | null;
		count?: number;
	}> = tree.map((c) => ({
		name: c.name!,
		handle: c.handle!,
		thumbnail: (c as any).metadata?.thumbnail ?? null
	}));
	return {
		tree,
		topLevel
	};
};
