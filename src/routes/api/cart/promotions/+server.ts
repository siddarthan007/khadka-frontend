import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { getServerStoreClient } from "$lib/server/medusa";

// Forward the shopper session cookies to Medusa store API through the JS SDK
async function updatePromotions(method: "POST" | "DELETE", request: Request) {
  const sdk = getServerStoreClient() as any;
  if (!sdk) return json({ error: "Store not configured" }, { status: 500 });

  const url = new URL(request.url);
  const cartId = url.searchParams.get("cart_id");
  if (!cartId) return json({ error: "Missing cart_id" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as {
    promo_codes?: string[];
  };
  const promo_codes = Array.isArray(body.promo_codes) ? body.promo_codes : [];
  if (!promo_codes.length)
    return json({ error: "Missing promo_codes" }, { status: 400 });

  try {
    // Use client.fetch since promotions are not exposed as high-level store SDK methods
    await (sdk as any).client.fetch(`/store/carts/${cartId}/promotions`, {
      method,
      body: { promo_codes },
    });
    const { cart } = await sdk.store.cart.retrieve(cartId);
    return json({ cart });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    const message =
      e?.response?.data?.message || e?.message || "Failed to update promotions";
    return json({ error: message }, { status });
  }
}

export const POST: RequestHandler = async ({ request }) => {
  return updatePromotions("POST", request);
};

export const DELETE: RequestHandler = async ({ request }) => {
  return updatePromotions("DELETE", request);
};
