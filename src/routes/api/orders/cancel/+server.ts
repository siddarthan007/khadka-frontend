import type { RequestHandler } from '@sveltejs/kit';
import { getAdminClient } from '$lib/server/medusa';

type CancelBody = {
	order_id?: string;
	display_id?: string | number;
	email?: string;
};

function bad(msg: string, status = 400) {
	return new Response(JSON.stringify({ error: msg }), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as CancelBody;
		const admin = getAdminClient();
		if (!admin) return bad('Admin client not configured', 500);

		const { order_id, display_id, email } = body || {};
		if (!order_id && !display_id) return bad('order_id or display_id required');
		if (!email) return bad('email required');

		// Resolve order by id or display_id
		let order: any = null;
		if (order_id) {
			const resp: any = await admin.admin.order.retrieve(order_id, {
				fields: 'id,email,status,payment_status,fulfillment_status,shipping_address.email,customer.email'
			});
			order = resp?.order ?? resp;
		} else {
			const list: any = await (admin as any).admin.order.list({ q: String(display_id), limit: 1 });
			const arr = list?.orders ?? [];
			order = arr[0] ?? null;
		}
		if (!order?.id) return bad('Order not found', 404);

		// Verify email matches
		const orderEmail = order.email || order.shipping_address?.email || order.customer?.email;
		if (!orderEmail || String(orderEmail).toLowerCase() !== String(email).toLowerCase()) {
			return bad('Email does not match order', 403);
		}

		// Check status is cancellable
		if (order.status === 'cancelled' || order.status === 'completed') {
			return bad('Order cannot be cancelled');
		}

		const result: any = await admin.admin.order.cancel(order.id);
		const updated = result?.order ?? result;

		return new Response(JSON.stringify({ order: updated }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e: any) {
		const msg = e?.response?.data?.message || e?.message || 'Order cancel failed';
		return bad(msg, 500);
	}
};
