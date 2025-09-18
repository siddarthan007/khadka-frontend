import { getStoreClient, queryOrderById } from '$lib/medusa';
import type { HttpTypes } from '@medusajs/types';
import { ORDER_BASE_FIELDS, ORDER_DETAIL_FIELDS, ORDER_RETRIEVE_FIELDS, ORDER_LOOKUP_FIELDS, buildOrderFields } from '$lib/order-fields';

export type ListOrdersResponse = HttpTypes.StoreOrderListResponse;
export type OrderResponse = HttpTypes.StoreOrderResponse;

export type CreateAddressInput = HttpTypes.StoreCreateCustomerAddress;
export type UpdateAddressInput = HttpTypes.StoreUpdateCustomerAddress;

export type CreateOrUpdateAddressResponse = HttpTypes.StoreCustomerResponse;
export type DeleteAddressResponse = CreateOrUpdateAddressResponse;

export async function addAddress(
  address: CreateAddressInput
): Promise<CreateOrUpdateAddressResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  return await sdk.store.customer.createAddress(address);
}

export async function updateAddress(
  addressId: string,
  address: UpdateAddressInput
): Promise<CreateOrUpdateAddressResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  return await sdk.store.customer.updateAddress(addressId, address);
}

export async function deleteAddress(addressId: string): Promise<DeleteAddressResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  return await sdk.store.customer.deleteAddress(addressId);
}

export async function listAddresses(
  query?: Record<string, any>
): Promise<HttpTypes.StoreCustomerAddressListResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  const defaultFields =
    'id,first_name,last_name,address_1,address_2,city,province,postal_code,country_code,phone,metadata,address_name,company,is_default_shipping,is_default_billing';
  const q = { fields: defaultFields, ...(query || {}) };
  if (sdk.store.customer.listAddress) {
    return await sdk.store.customer.listAddress(q);
  }
  const me = await sdk.store.customer.retrieve().catch(() => null);
  const addrs = (me as any)?.customer?.shipping_addresses ?? [];
  return { addresses: addrs, count: addrs.length } as any;
}

export async function retrieveAddress(
  addressId: string,
  query?: Record<string, any>
): Promise<HttpTypes.StoreCustomerAddressResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  const defaultFields =
    'id,first_name,last_name,address_1,address_2,city,province,postal_code,country_code,phone,metadata,address_name,company,is_default_shipping,is_default_billing';
  const q = { fields: defaultFields, ...(query || {}) };
  return await sdk.store.customer.retrieveAddress(addressId, q);
}

export async function listOrders(query?: Record<string, any>): Promise<ListOrdersResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;

  let params: any = { fields: ORDER_BASE_FIELDS, limit: 50, ...(query || {}) };
  let list: any;
  try {
    list = await sdk.store.order.list(params);
  } catch (err: any) {
    let body: string | undefined;
    if (err?.response) {
      try { body = await err.response.text(); } catch {}
    }
    console.warn('[orders] list with items+statuses failed, retrying core only', err?.message, body);
    params = { fields: 'id,status,payment_status,fulfillment_status,display_id,created_at,updated_at,total,currency_code', limit: 50, ...(query || {}) };
    list = await sdk.store.order.list(params).catch(async (e: any) => {
      let b: string | undefined;
      if (e?.response) { try { b = await e.response.text(); } catch {} }
      console.error('[orders] core list failed', e?.message, b);
      throw e;
    });
  }

  if (list?.orders?.length && !query?.skipHydrate) {
    const toHydrate = list.orders.slice(0, 10);
    const detailFields = ORDER_DETAIL_FIELDS;
    await Promise.allSettled( 
      toHydrate.map(async (o: any) => {
        try {
          const full = await sdk.store.order.retrieve(o.id, { fields: detailFields });
          Object.assign(o, (full as any).order || {});
        } catch (e) {
          // swallow; keep partial order
        }
      })
    );
  }
  return list;
}

export async function retrieveOrder(orderId: string, query?: Record<string, any>): Promise<OrderResponse | void> {
  const sdk = getStoreClient() as any;
  if (!sdk) return;
  // First attempt: retrieve order with full fields using Medusa SDK
  const queried = await queryOrderById(orderId);
  if (queried) return { order: queried } as any;
  // Fallback REST retrieve with simplified constant field list
  return await sdk.store.order.retrieve(orderId, { fields: ORDER_RETRIEVE_FIELDS, ...(query || {}) });
}