import type { PageServerLoad } from './$types';
import {
	getProductByHandle,
	listProductsByCategoryIds,
	listProductsByCollectionId
} from '$lib/medusa';

export const load: PageServerLoad = async ({ params }) => {
	const handle = params.handle;
	const product = await getProductByHandle(handle);

	let recByCategory: any[] = [];
	let recByCollection: any[] = [];

	try {
		if (product?.categories?.length) {
			const primaryCatIds = product.categories.map((c: any) => c.id);
			const { products } = await listProductsByCategoryIds(primaryCatIds, {
				limit: 8,
				offset: 0,
				fields: 'title,handle,thumbnail,*images,variants.id,*variants.calculated_price'
			});
			recByCategory = (products ?? []).filter((p: any) => p.handle !== handle);
		}
	} catch {}

	try {
		if (product?.collection?.id) {
			const { products } = await listProductsByCollectionId(product.collection.id, {
				limit: 8,
				offset: 0,
				fields: 'title,handle,thumbnail,*images,variants.id,*variants.calculated_price'
			});
			recByCollection = (products ?? []).filter((p: any) => p.handle !== handle);
		}
	} catch {}

	return { product, recByCategory, recByCollection };
};
