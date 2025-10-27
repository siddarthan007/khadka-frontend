import type { PageServerLoad } from "./$types";
import { getHeroSlides } from "$lib/server/medusa";
import { listBasicProducts } from "$lib/medusa";

export const load: PageServerLoad = async ({ parent }) => {
  const slides = (await getHeroSlides()) ?? [];
  const parentData = (await parent()) as {
    storeMetadata: Record<string, any>;
    collectionItems?: Array<{ title: string; handle: string; emoji?: string }>;
  };
  const collectionItems = parentData?.collectionItems ?? [];
  
  // Load initial 15 products with pagination info
  const { products: initialProducts, count: initialCount } =
    await listBasicProducts(15, 0);

  return {
    slides: slides.length > 0 ? slides : [],
    collectionItems,
    initialProducts,
    initialCount,
    storeMetadata: parentData.storeMetadata,
  };
};
