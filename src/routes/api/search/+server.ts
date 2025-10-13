import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { searchProductsMeili, searchCategoriesMeili } from "$lib/server/medusa";
import { checkRateLimit, sanitizeSearchQuery } from "$lib/security";

export const GET: RequestHandler = async ({ url, getClientAddress, setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=60, s-maxage=120', // 1 min browser, 2 min CDN
  });

  // Rate limiting
  const clientIp = getClientAddress();
  if (!checkRateLimit(clientIp, 100)) {
    return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  const rawQuery = url.searchParams.get("q")?.trim() ?? "";
  const q = sanitizeSearchQuery(rawQuery);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam ?? 6) || 6, 1), 20);

  if (!q) {
    return json({ products: [], categories: [] });
  }

  const [products, categories] = await Promise.all([
    searchProductsMeili(q, limit),
    searchCategoriesMeili(q, limit),
  ]);

  const productResults = (products ?? []).map((p: any) => ({
    id: p.id ?? p._id ?? p.objectID,
    title: p.title ?? p.name ?? "Untitled",
    handle: p.handle ?? p.slug ?? p.id,
    thumbnail: p.thumbnail ?? p.image ?? p.images?.[0]?.url ?? null,
  }));

  const categoryResults = (categories ?? []).map((c: any) => ({
    id: c.id ?? c.objectID,
    name: c.name ?? c.title ?? "Category",
    handle: c.handle ?? c.slug ?? c.id,
    thumbnail: c.metadata?.thumbnail ?? c.thumbnail ?? null,
  }));

  return json({ products: productResults, categories: categoryResults });
};
