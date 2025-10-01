import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';
import type { HttpTypes } from '@medusajs/types';
import { logger } from '$lib/logger';

/**
 * Google Analytics 4 Integration
 */

// TypeScript interfaces using Medusa types
export type AnalyticsCartItem = HttpTypes.StoreCartLineItem;
export type AnalyticsCart = HttpTypes.StoreCart;

export interface GA4Item {
	item_id: string;
	item_name: string;
	item_variant?: string;
	price: number;
	quantity: number;
	item_category?: string;
	item_brand?: string;
}

declare global {
	interface Window {
		dataLayer: any[];
		gtag: (...args: any[]) => void;
	}
}

const GA_ID = publicEnv.PUBLIC_GOOGLE_ANALYTICS_ID || '';
let isInitialized = false;

/**
 * Initialize Google Analytics
 */
export function initGoogleAnalytics(): void {
	if (!browser) return;

	if (!GA_ID) {
		logger.warn('[GA4] Google Analytics ID not configured');
		return;
	}

	if (isInitialized) {
		logger.log('[GA4] Already initialized');
		return;
	}

	// Load gtag.js script
	const script = document.createElement('script');
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
	script.async = true;
	script.onerror = () => {
		logger.error('[GA4] Failed to load gtag.js script');
		isInitialized = false;
	};
	document.head.appendChild(script);

	script.onload = () => {
		if (!window.gtag) {
			window.dataLayer = window.dataLayer || [];
			window.gtag = function () { window.dataLayer.push(arguments); };
		}
		window.gtag('js', new Date());
		window.gtag('config', GA_ID, { send_page_view: false });
		isInitialized = true;
		logger.log('[GA4] Initialized successfully:', GA_ID);
	};
}

/**
 * Track page view
 * 
 * NOTE: For SvelteKit SPA navigation, use this with afterNavigate:
 * 
 * import { afterNavigate } from '$app/navigation';
 * afterNavigate((nav) => {
 *   trackPageView(nav.to?.url.pathname, document.title);
 * });
 */
export function trackPageView(url: string, title?: string): void {
	if (!browser) return;

	if (!isInitialized || !window.gtag) {
		logger.warn('[GA4] Cannot track page view - not initialized');
		return;
	}

	window.gtag('event', 'page_view', {
		page_path: url,
		page_title: title || document.title
	});

	logger.log('[GA4] Page view tracked:', url);
}

/**
 * Track custom event
 */
export function trackEvent(
	eventName: string,
	eventParams?: Record<string, any>
): void {
	if (!browser) return;

	if (!isInitialized || !window.gtag) {
		logger.warn('[GA4] Cannot track event - not initialized:', eventName);
		return;
	}

	window.gtag('event', eventName, eventParams);
	logger.log('[GA4] Event tracked:', eventName, eventParams);
}

/**
 * E-commerce event tracking
 */

export function trackViewItem(item: {
	id: string;
	name: string;
	price: number;
	currency?: string;
	category?: string;
	brand?: string;
}): void {
	trackEvent('view_item', {
		currency: item.currency || 'USD',
		value: item.price,
		items: [
			{
				item_id: item.id,
				item_name: item.name,
				price: item.price,
				item_category: item.category || '',
				item_brand: item.brand || ''
			}
		]
	});
}

export function trackAddToCart(item: {
	id: string;
	name: string;
	price: number;
	quantity: number;
	currency?: string;
	category?: string;
}): void {
	trackEvent('add_to_cart', {
		currency: item.currency || 'USD',
		value: item.price * item.quantity,
		items: [
			{
				item_id: item.id,
				item_name: item.name,
				price: item.price,
				quantity: item.quantity,
				item_category: item.category || ''
			}
		]
	});
}

export function trackRemoveFromCart(item: {
	id: string;
	name: string;
	price: number;
	quantity: number;
	currency?: string;
}): void {
	trackEvent('remove_from_cart', {
		currency: item.currency || 'USD',
		value: item.price * item.quantity,
		items: [
			{
				item_id: item.id,
				item_name: item.name,
				price: item.price,
				quantity: item.quantity
			}
		]
	});
}

export function trackViewCart(value: number, currency: string = 'USD', items: any[]): void {
	trackEvent('view_cart', {
		currency,
		value,
		items
	});
}

export function trackBeginCheckout(value: number, currency: string = 'USD', items: any[]): void {
	trackEvent('begin_checkout', {
		currency,
		value,
		items
	});
}

export function trackAddShippingInfo(
	value: number,
	currency: string = 'USD',
	items: any[],
	shippingTier?: string
): void {
	trackEvent('add_shipping_info', {
		currency,
		value,
		items,
		shipping_tier: shippingTier
	});
}

export function trackAddPaymentInfo(
	value: number,
	currency: string = 'USD',
	items: any[],
	paymentType?: string
): void {
	trackEvent('add_payment_info', {
		currency,
		value,
		items,
		payment_type: paymentType
	});
}

export function trackPurchase(
	transactionId: string,
	value: number,
	currency: string = 'USD',
	items: any[],
	shipping?: number,
	tax?: number
): void {
	trackEvent('purchase', {
		transaction_id: transactionId,
		value,
		currency,
		shipping: shipping || 0,
		tax: tax || 0,
		items
	});
}

export function trackSearch(searchTerm: string, resultsCount?: number): void {
	trackEvent('search', {
		search_term: searchTerm,
		...(resultsCount !== undefined && { results_count: resultsCount })
	});
}

/**
 * User interaction tracking
 */

export function trackSignUp(method: string = 'email'): void {
	trackEvent('sign_up', { method });
}

export function trackLogin(method: string = 'email'): void {
	trackEvent('login', { method });
}

export function trackShare(contentType: string, itemId: string): void {
	trackEvent('share', {
		content_type: contentType,
		item_id: itemId
	});
}

/**
 * Track link clicks with source information
 */
export function trackLinkClick(linkUrl: string, linkText: string, source?: string): void {
	trackEvent('link_click', {
		link_url: linkUrl,
		link_text: linkText,
		...(source && { source })
	});
}

/**
 * Track view_item_list (product listing pages)
 */
export function trackViewItemList(items: GA4Item[], listName: string, listId?: string): void {
	trackEvent('view_item_list', {
		item_list_name: listName,
		...(listId && { item_list_id: listId }),
		items
	});
}

/**
 * Track select_item (clicking on product from list)
 */
export function trackSelectItem(item: GA4Item, listName: string, index?: number): void {
	trackEvent('select_item', {
		item_list_name: listName,
		...(index !== undefined && { index }),
		items: [item]
	});
}

/**
 * Set user properties
 */
export function setUserProperties(props: Record<string, any>): void {
	if (!browser || !window.gtag) return;

	window.gtag('set', 'user_properties', props);
}

/**
 * Set user ID
 */
export function setUserId(userId: string): void {
	if (!browser || !window.gtag) return;

	window.gtag('config', GA_ID, {
		user_id: userId
	});
}

/**
 * Helper to format cart items for GA4 e-commerce events
 * 
 * NOTE: Prices are already in dollars (Medusa calculated_price is in major units).
 */
export function formatCartItemsForAnalytics(cartItems: AnalyticsCartItem[]): GA4Item[] {
	return cartItems.map((item) => ({
		item_id: item.variant?.id || item.variant_id || 'unknown',
		item_name: item.title || item.variant?.title || 'Unknown Product',
		item_variant: item.variant?.title || '',
		price: item.unit_price || 0,
		quantity: item.quantity || 1,
		item_category: item.product?.collection?.title || (item.product?.categories?.[0] as any)?.name || '',
		item_brand: '' // Can be added if product has brand field
	}));
}

/**
 * Helper to format order items for GA4 e-commerce events
 * 
 * NOTE: Prices are already in dollars (Medusa calculated_price is in major units).
 * Order items have a different structure than cart items, so we need a separate formatter.
 */
export function formatOrderItemsForAnalytics(orderItems: HttpTypes.StoreOrderLineItem[]): GA4Item[] {
	return orderItems.map((item) => ({
		item_id: item.variant?.id || item.variant_id || 'unknown',
		item_name: item.title || item.variant?.product?.title || 'Unknown Product',
		item_variant: item.variant?.title || '',
		price: item.unit_price || 0,
		quantity: item.quantity || 1,
		item_category: '', // Order items don't include full product data
		item_brand: '' // Can be added if product has brand field
	}));
}

/**
 * Helper to calculate cart total value in dollars
 * 
 * NOTE: Prices are already in dollars (Medusa calculated_price is in major units).
 */
export function calculateCartValue(cart: AnalyticsCart | null | undefined): number {
	if (!cart) return 0;
	const total = cart.total || cart.subtotal || 0;
	return total;
}

/**
 * Check if Google Analytics is initialized
 */
export function isGA4Initialized(): boolean {
	return isInitialized && !!window.gtag;
}
