import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Google Analytics 4 Integration
 */

declare global {
	interface Window {
		dataLayer: any[];
		gtag: (...args: any[]) => void;
	}
}

const GA_ID = publicEnv.PUBLIC_GOOGLE_ANALYTICS_ID || publicEnv.PUBLIC_GA_MEASUREMENT_ID || '';

/**
 * Initialize Google Analytics
 */
export function initGoogleAnalytics(): void {
	if (!browser) return;
	
	if (!GA_ID) {
		// Google Analytics not configured - skip initialization (silent in dev)
		return;
	}

	// Load gtag.js script
	const script = document.createElement('script');
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
	script.async = true;
	document.head.appendChild(script);

	// Initialize dataLayer
	window.dataLayer = window.dataLayer || [];
	window.gtag = function () {
		window.dataLayer.push(arguments);
	};
	window.gtag('js', new Date());
	window.gtag('config', GA_ID, {
		send_page_view: false // We'll manually send page views
	});
}

/**
 * Track page view
 */
export function trackPageView(url: string, title?: string): void {
	if (!browser || !window.gtag) return;

	window.gtag('event', 'page_view', {
		page_path: url,
		page_title: title || document.title
	});
}

/**
 * Track custom event
 */
export function trackEvent(
	eventName: string,
	eventParams?: Record<string, any>
): void {
	if (!browser || !window.gtag) return;

	window.gtag('event', eventName, eventParams);
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
				item_category: item.category,
				item_brand: item.brand
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
				item_category: item.category
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
 */
export function formatCartItemsForAnalytics(cartItems: any[]): any[] {
	return cartItems.map((item) => ({
		item_id: item.variant?.id || item.variant_id,
		item_name: item.title || item.variant?.title || 'Unknown Product',
		item_variant: item.variant?.title,
		price: (item.unit_price || 0) / 100, // Convert cents to dollars
		quantity: item.quantity || 1,
		item_category: item.product?.collection?.title || item.product?.categories?.[0]?.name
	}));
}

/**
 * Helper to calculate cart total value in dollars
 */
export function calculateCartValue(cart: any): number {
	if (!cart) return 0;
	const total = cart.total || cart.subtotal || 0;
	return total / 100; // Convert cents to dollars
}
