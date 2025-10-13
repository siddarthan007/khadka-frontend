import type { PageServerLoad } from "./$types";
import { listAllCollections, getCollectionByHandle } from "$lib/medusa";

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=300, s-maxage=600', // 5 min browser, 10 min CDN
  });

  const collections = await listAllCollections();
  const items = collections.map((c) => ({
    name: c.title ?? c.handle,
    handle: c.handle,
    thumbnail: (c as any).metadata?.thumbnail ?? null,
    emoji: (c as any).metadata?.emoji ?? null,
  }));
  return {
    collections: items,
  };
};
