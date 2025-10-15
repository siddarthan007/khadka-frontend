import type { RequestHandler } from "@sveltejs/kit";
import { getAdminClient } from "$lib/server/medusa";

type ClaimBody = {
  order_id?: string;
  display_id?: string | number;
  email: string;
  customer_id?: string;
};

function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  try {
    const body = (await request.json()) as ClaimBody;
    const admin = getAdminClient();
    if (!admin) return bad("Admin client not configured", 500);

    const { order_id, display_id, email, customer_id } = body || {};
    if (!order_id && !display_id) return bad("order_id or display_id required");
    if (!email) return bad("email required");
    if (!customer_id) return bad("customer_id required");

    // Rate limit order claim attempts to prevent enumeration attacks
    const clientIp = getClientAddress();
    const { checkRateLimit } = await import("$lib/security");
    const rateLimit = checkRateLimit(`order_claim:${clientIp}`, 10, 60000); // 10 attempts per minute
    if (!rateLimit.allowed) {
      return bad("Too many claim attempts. Please try again later.", 429);
    }

    // Validate email format
    const { isValidEmail } = await import("$lib/security");
    if (!isValidEmail(email)) {
      return bad("Invalid email format", 400);
    }

    // Resolve order
    let order: any = null;
    if (order_id) {
      const resp: any = await admin.admin.order.retrieve(order_id);
      order = resp?.order ?? resp;
    } else {
      const list: any = await (admin as any).admin.order.list({
        q: String(display_id),
        limit: 1,
      });
      const arr = list?.orders ?? [];
      order = arr[0] ?? null;
    }
    if (!order?.id) return bad("Order not found", 404);

    // Verify same email and guest order
    const orderEmail =
      order.email || order.shipping_address?.email || order.customer?.email;
    if (
      !orderEmail ||
      String(orderEmail).toLowerCase().trim() !== String(email).toLowerCase().trim()
    ) {
      return bad("Email does not match order", 403);
    }
    if (order.customer_id && order.customer_id !== customer_id) {
      return bad("Order already belongs to another customer", 409);
    }

    // Verify order is actually a guest order (no customer_id)
    if (order.customer_id) {
      return bad("Order already has a customer", 409);
    }

    // Update order to associate with the customer
    const updatedResp: any = await (admin as any).admin.order.update(order.id, {
      customer_id,
    });
    const updated = updatedResp?.order ?? updatedResp;

    return new Response(JSON.stringify({ order: updated }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    const msg =
      e?.response?.data?.message || e?.message || "Order claim failed";
    return bad(msg, 500);
  }
};
