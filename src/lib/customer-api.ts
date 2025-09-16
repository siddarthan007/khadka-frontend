import { getStoreClient } from '$lib/medusa';
import type { HttpTypes } from '@medusajs/types';

export type CreateAddressInput = HttpTypes.StoreCreateCustomerAddress;
export type UpdateAddressInput = HttpTypes.StoreUpdateCustomerAddress;

export type CreateOrUpdateAddressResponse = HttpTypes.StoreCustomerResponse;
export type DeleteAddressResponse = HttpTypes.StoreCustomerAddressDeleteResponse;

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
	return await sdk.store.customer.listAddress(q);
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
