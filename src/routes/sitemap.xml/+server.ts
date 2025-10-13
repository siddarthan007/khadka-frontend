import type { RequestHandler } from "@sveltejs/kit";
import { listBasicProducts } from "$lib/medusa";
import { listAllProductCategories, listAllCollections } from "$lib/medusa";
import { logger } from "$lib/logger";

const STATIC_PATHS = [
  "/",
  "/products",
  "/collections",
  "/categories",
  "/about",
  "/privacy",
  "/tos",
];

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  setHeaders({
    'cache-control': 'public, max-age=3600, s-maxage=7200', // 1 hour browser, 2 hours CDN
  });

  const origin = url.origin;
  const lastmod = new Date().toISOString();

  // Fetch dynamic content for sitemap
  const dynamicUrls: string[] = [];

  try {
    // Add product pages
    const { products } = await listBasicProducts(1000, 0); // Get up to 1000 products
    products.forEach((product: any) => {
      if (product.handle) {
        dynamicUrls.push(`/products/${product.handle}`);
      }
    });

    // Add category pages
    const categories = await listAllProductCategories();
    categories.forEach((category: any) => {
      if (category.handle) {
        dynamicUrls.push(`/categories/${category.handle}`);
      }
    });

    // Add collection pages
    const collections = await listAllCollections();
    collections.forEach((collection: any) => {
      if (collection.handle) {
        dynamicUrls.push(`/collections/${collection.handle}`);
      }
    });
  } catch (error) {
    logger.error("Error generating dynamic sitemap URLs:", error);
    // Continue with static paths only
  }

  const allPaths = [...STATIC_PATHS, ...dynamicUrls];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPaths
  .map((p) => {
    const priority =
      p === "/"
        ? "1.0"
        : p.startsWith("/products/")
          ? "0.8"
          : p.startsWith("/categories/") || p.startsWith("/collections/")
            ? "0.7"
            : "0.6";
    const changefreq =
      p === "/" ? "daily" : p.startsWith("/products/") ? "weekly" : "monthly";
    return `  <url><loc>${origin}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
