// Centralized explicit Medusa order field selections (avoid wildcards that trigger 500s)
// Adjust here to add/remove properties across list/hydrate/lookup flows.

// Keep minimal root scalars always included
const ROOT_SCALARS = [
	'id',
	'status',
	'payment_status',
	'fulfillment_status',
	'display_id',
	'email',
	'currency_code',
	'total',
	'subtotal',
	'tax_total',
	'discount_total',
	'shipping_total',
	'created_at',
	'updated_at',
	'refunded_total'
];

// Relation names (let backend decide internal shape). Avoid deep dotted paths that caused 500s.
const RELATIONS_MIN = ['items'];
const RELATIONS_FULL = [
	'items',
	'shipping_address',
	'billing_address',
	'payments',
	'payment_collections',
	'promotions',
    'refunds'
];

const ADDRESS_DETAIL_FIELDS = [
    'shipping_address.first_name', 'shipping_address.last_name', 'shipping_address.address_1',
    'shipping_address.address_2', 'shipping_address.city', 'shipping_address.province',
    'shipping_address.postal_code', 'shipping_address.country_code', 'shipping_address.phone',
    'shipping_address.company',
    'billing_address.first_name', 'billing_address.last_name', 'billing_address.address_1',
    'billing_address.address_2', 'billing_address.city', 'billing_address.province',
    'billing_address.postal_code', 'billing_address.country_code', 'billing_address.phone',
    'billing_address.company'
];

export const ORDER_BASE_FIELDS = [...ROOT_SCALARS, ...RELATIONS_MIN].join(',');
export const ORDER_DETAIL_FIELDS = [...ROOT_SCALARS, ...RELATIONS_FULL, ...ADDRESS_DETAIL_FIELDS].join(',');

export const ORDER_RETRIEVE_FIELDS = ORDER_DETAIL_FIELDS; // Use full fields for single order retrieval
export const ORDER_LOOKUP_FIELDS = ORDER_DETAIL_FIELDS; // same scope for guest lookup

// Utility if you ever need to build a subset dynamically.
export function buildOrderFields(overrides: { add?: string[]; remove?: string[] } = {}) {
	const base = ORDER_DETAIL_FIELDS.split(',');
	const set = new Set(base);
	overrides.remove?.forEach((r) => set.delete(r));
	overrides.add?.forEach((a) => set.add(a));
	return Array.from(set).join(',');
}
