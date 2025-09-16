import type { PageServerLoad } from './$types';
import { getCollectionByHandle, listProductsByCollectionId } from '$lib/medusa';

export const load: PageServerLoad = async ({ params }) => {
	const handle = params.handle

	const collection = await getCollectionByHandle(handle)
	if (!collection) return { collection: null, products: [], total: 0 }
	const { products, count } = await listProductsByCollectionId(collection.id, { limit: 24, offset: 0, fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price' })
	return {
		collection,
		products,
		total: count
	}
}
