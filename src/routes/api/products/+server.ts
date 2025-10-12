import type { RequestHandler } from "@sveltejs/kit";
import { listProducts } from "$lib/medusa";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
  "HUF",
  "IDR",
  "LAK",
  "TWD",
]);

function toMajorUnits(
  amountUnknownUnits: number,
  currencyCode?: string,
): number {
  const code = (currencyCode || "USD").toUpperCase();
  const amt = Number(amountUnknownUnits ?? 0);
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return amt;
  if (!Number.isInteger(amt)) return amt; // already major
  if (amt >= 100) return amt / 100; // minor to major
  return amt; // small integers assumed major
}

function productMinPriceMajor(p: any): number | null {
  const cps = (p?.variants ?? [])
    .map((v: any) => v?.calculated_price)
    .filter(Boolean);
  if (!cps.length) return null;
  return cps.reduce((min: number, cp: any) => {
    const amtMinor = Number(
      cp?.calculated_amount ?? cp?.amount ?? cp?.unit_price ?? 0,
    );
    const code = cp?.currency_code ?? cp?.currency ?? "USD";
    const major = toMajorUnits(amtMinor, code);
    return min === -1 ? major : Math.min(min, major);
  }, -1);
}

export const GET: RequestHandler = async ({ url }) => {
  let limitRaw = Number(url.searchParams.get("limit") ?? "20");
  if (!Number.isFinite(limitRaw) || limitRaw <= 0) limitRaw = 20;
  let limit = limitRaw;
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  const q = url.searchParams.get("q") ?? undefined;
  const categoryId = url.searchParams.getAll("category_id");
  const collectionId = url.searchParams.getAll("collection_id");
  const priceMin = url.searchParams.get("price_min");
  const priceMax = url.searchParams.get("price_max");
  const fields = url.searchParams.get("fields") ?? undefined;

  const hasPriceFilter = priceMin != null || priceMax != null;
  if (hasPriceFilter && limit < 200) {
    // Fetch a larger page to make local price filtering effective
    limit = 200;
  }
  const params: any = { limit, offset };
  if (q) params.q = q;
  if (categoryId.length) params.category_id = categoryId;
  if (collectionId.length) params.collection_id = collectionId;
  if (fields) params.fields = fields;

  const { products, count } = await listProducts(params);

  // debug removed

  let filtered = products ?? [];
  // Apply price filtering locally using MAJOR units to match UI range values
  if (hasPriceFilter) {
    const minMajor = priceMin != null ? Number(priceMin) : null;
    const maxMajor = priceMax != null ? Number(priceMax) : null;
    filtered = filtered.filter((p) => {
      const mp = productMinPriceMajor(p);
      if (mp === null) return false;
      if (minMajor != null && mp < minMajor) return false;
      if (maxMajor != null && mp > maxMajor) return false;
      return true;
    });
  }

  const responseBody = {
    products: filtered,
    count,
    filtered_count: filtered.length,
    has_price_filter: hasPriceFilter,
    limit,
    offset,
    next_offset: offset + limit,
    has_more: offset + limit < count,
  };

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
