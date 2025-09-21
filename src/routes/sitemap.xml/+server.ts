import type { RequestHandler } from '@sveltejs/kit';

// Minimal sitemap for core routes. Extend with product/category/collection handles if available on server.
const STATIC_PATHS = [
  '/',
  '/products',
  '/collections',
  '/categories',
  '/about',
  '/privacy',
  '/tos'
];

export const GET: RequestHandler = async ({ url }) => {
  const origin = url.origin;
  const lastmod = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PATHS.map((p) => `  <url><loc>${origin}${p}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`).join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
