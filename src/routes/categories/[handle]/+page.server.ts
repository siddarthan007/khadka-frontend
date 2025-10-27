import type { PageServerLoad } from "./$types";
import type { HttpTypes } from "@medusajs/types";
import {
  getProductCategoryByHandle,
  listAllProductCategories,
  listProductsByCategoryIds,
} from "$lib/medusa";

function buildSubTree(
  all: HttpTypes.StoreProductCategory[],
  parentId: string,
): any[] {
  const nodes = all.filter((c) => c.parent_category_id === parentId);
  return nodes.map((n) => ({
    ...n,
    children: buildSubTree(all, n.id),
  }));
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=180, s-maxage=300',
  });

  const handle = params.handle;
  const category = await getProductCategoryByHandle(handle);
  if (!category) {
    return { category: null, products: [], subcategories: [], total: 0 };
  }
  const allCats = await listAllProductCategories();
  const subcategories = buildSubTree(allCats, category.id);

  // products for "All products" (this category + all descendants)
  const collectIds = (node: any): string[] => [
    node.id,
    ...(node.children?.flatMap(collectIds) ?? []),
  ];
  const allIds = [category.id, ...subcategories.flatMap(collectIds)];
  const { products, count } = await listProductsByCategoryIds(allIds, {
    limit: 15,
    offset: 0,
    fields: "title,handle,thumbnail,variants.id,*variants.calculated_price",
  });

  // counts for sidebar per subcategory (shallow)
  const subCounts: Record<string, number> = {};
  for (const sc of subcategories) {
    const ids = collectIds(sc);
    const res = await listProductsByCategoryIds(ids, { limit: 1, offset: 0 });
    subCounts[sc.id] = res.count;
  }

  return {
    category,
    subcategories,
    allIds,
    products,
    total: count,
    subCounts,
  };
};
