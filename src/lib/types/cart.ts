/**
 * Cart-related TypeScript type definitions
 * Improves type safety across cart operations
 */

export interface CartItem {
  id: string;
  variant_id: string;
  product_id?: string;
  title?: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  total?: number;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total?: number;
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  region_id?: string;
  currency_code?: string;
  metadata?: Record<string, any>;
}

export interface CalculatedPrice {
  calculated_amount?: number;
  amount?: number;
  currency_code?: string;
}

export interface ProductVariant {
  id: string;
  product_id?: string;
  title?: string;
  sku?: string;
  inventory_quantity?: number;
  prices?: Array<{
    amount?: number;
    currency_code?: string;
    calculated_price?: CalculatedPrice;
  }>;
  options?: Array<{
    id?: string;
    option_id?: string;
    value?: string;
  }>;
  metadata?: {
    thumbnail?: string;
    [key: string]: any;
  };
}

export interface Product {
  id: string;
  title: string;
  handle?: string;
  description?: string;
  thumbnail?: string;
  images?: Array<{ url?: string; alt?: string }>;
  variants?: ProductVariant[];
  options?: Array<{
    id: string;
    title?: string;
    values?: Array<{ value: string }>;
  }>;
  created_at?: string;
  metadata?: Record<string, any>;
}

export type CartOperation = 'add' | 'update' | 'remove';

export interface CartOperationResult {
  success: boolean;
  error?: string;
}
