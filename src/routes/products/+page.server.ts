import type { PageServerLoad } from "./$types";
import {
  listProducts,
  getHierarchicalProductCategories,
  listAllCollections,
} from "$lib/medusa";

export const load: PageServerLoad = async ({ url }) => {
  const q = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = 24;
  const offset = (page - 1) * limit;
  const { products, count } = await listProducts({ q, limit, offset });
  const categories = await getHierarchicalProductCategories();
  const collections = await listAllCollections();
  return {
    products,
    count,
    limit,
    offset,
    page,
    q,
    categories,
    collections,
  };
};
