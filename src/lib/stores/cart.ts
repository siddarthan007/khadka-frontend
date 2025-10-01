import { persistentStore } from "$lib/persistent-store";
import type { HttpTypes } from "@medusajs/types";

const CART_ID_KEY = "medusa_cart_id";

export const cart = persistentStore<HttpTypes.StoreCart | null>(
  CART_ID_KEY,
  null,
);
