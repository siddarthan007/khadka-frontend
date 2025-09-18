import { persistentStore } from '$lib/persistent-store';
import type { HttpTypes } from '@medusajs/types';

const CUSTOMER_KEY = 'medusa_customer';

export const customer = persistentStore<HttpTypes.StoreCustomer | null>(CUSTOMER_KEY, null);
