import type { HttpTypes } from '@medusajs/types';
import { getStoreClient, logApiError } from '$lib/medusa';
import { customer } from '$lib/stores/customer';
import { cart } from '$lib/stores/cart';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';
import { normalizeUSPhone } from '$lib/us';

/**
 * Auth module notes:
 *
 * Password reset flow:
 * - Request reset email: requestPasswordReset(email) wraps sdk.auth.resetPassword('customer', 'emailpass', { identifier: email })
 *   which triggers Medusa to email a reset link containing token and email.
 * - Complete reset: resetPassword(email, password, token) wraps sdk.auth.updateProvider('customer', 'emailpass', { email, password }, token)
 *   to set the new password using the one-time token.
 * - UI pages:
 *   - /password-reset requests a reset email.
 *   - /reset-password reads ?token=...&email=... from the URL to submit the new password.
 *
 * OAuth (Google) overview:
 * - Start endpoint: GET /oauth/google/start – builds the Medusa authorize URL and sets CSRF state cookie.
 * - Callback endpoint: GET /oauth/google/callback – validates state and redirects to the intended page.
 * - Session is managed by the Medusa store session cookie (session auth); after redirect you can call getCurrentCustomer().
 *
 * Placeholders:
 * - If we later want client helpers in this module, prefer thin wrappers around those routes, e.g.:
 *   startGoogleOAuth(returnTo = '/account') → window.location = `/oauth/google/start?return_to=${encodeURIComponent(returnTo)}`
 *   After callback, call getCurrentCustomer() to sync the customer store.
 */
export type RegisterPayload = {
	first_name?: string;
	last_name?: string;
	email: string;
	password: string;
	phone?: string;
};

export async function getCurrentCustomer(): Promise<HttpTypes.StoreCustomer | null> {
	try {
		const sdk = getStoreClient();
		if (!sdk) {
			console.warn('Medusa SDK not available');
			return null;
		}
		const { customer: me } = await sdk.store.customer.retrieve();
		customer.set(me ?? null);
		customer.set(me ?? null);
		return me ?? null;
	} catch (error: any) {
		const status = error?.response?.status ?? error?.status;
		const statusText = error?.response?.statusText ?? error?.statusText;
		if (status === 401 || statusText === 'Unauthorized') {
			customer.set(null);
			return null;
		}
		logApiError('getCurrentCustomer', error);
		return null;
	}
}

export async function login(
	email: string,
	password: string
): Promise<HttpTypes.StoreCustomer | null> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return null;
		const res = await (sdk as any).auth.login('customer', 'emailpass', { email, password });
		if (typeof res !== 'string') {
			return null;
		}
		const me = await getCurrentCustomer();
		// After login, try to claim recent guest orders for this email
		try {
			if (me?.email && me?.id) {
				const claimed = await sweepClaimGuestOrders(me.email, me.id);
				if (claimed > 0) {
					showToast(`Attached ${claimed} order${claimed > 1 ? 's' : ''} to your account`, {
						type: 'success'
					});
				}
			}
		} catch {}
		try {
			const c = get(cart);
			if (c?.id) {
				await (sdk as any).store.cart.transferCart(c.id).catch(() => {});
			}
		} catch {}
		if (me) showToast('Signed in successfully', { type: 'success' });
		return me;
	} catch (error) {
		logApiError('login', error);
		showToast('Failed to sign in', { type: 'error' });
		return null;
	}
}

export async function register(payload: RegisterPayload): Promise<HttpTypes.StoreCustomer | null> {
	const { email, password, first_name, last_name } = payload;
	const phone = normalizeUSPhone(payload.phone || '');
	const sdk = getStoreClient();
	if (!sdk) return null;

	let token: string | null = null;
	try {
		token = await (sdk as any).auth.register('customer', 'emailpass', { email, password });
		if (typeof token !== 'string' || !token) {
			throw new Error('Registration failed to return a valid token');
		}
	} catch (error: any) {
		const statusText = error?.statusText ?? error?.response?.statusText;
		const message = error?.message ?? error?.response?.data?.message;
		if (statusText === 'Unauthorized' && message === 'Identity with email already exists') {
			return await login(email, password);
		}
		logApiError('auth.register', error);
		showToast('Registration failed', { type: 'error' });
		return null;
	}

	try {
		await sdk.store.customer.create(
			{ email, first_name, last_name, phone },
			{},
			{ Authorization: `Bearer ${token}` }
		);
		const me = await login(email, password);
		// Claim guest orders post-register
		try {
			if (me?.email && me?.id) {
				const claimed = await sweepClaimGuestOrders(me.email, me.id);
				if (claimed > 0) {
					showToast(`Attached ${claimed} order${claimed > 1 ? 's' : ''} to your account`, {
						type: 'success'
					});
				}
			}
		} catch {}
		return me;
	} catch (error) {
		logApiError('register.createCustomerOrLogin', error);
		showToast('Account creation failed', { type: 'error' });
		return null;
	}
}

export async function logout(): Promise<void> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return;
		await (sdk as any).auth.logout();
		customer.set(null);
		showToast('Signed out', { type: 'success' });
	} catch (error) {
		logApiError('logout', error);
		showToast('Failed to sign out', { type: 'error' });
	}
}

export async function requestPasswordReset(email: string): Promise<boolean> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return false;
		await (sdk as any).auth.resetPassword('customer', 'emailpass', { identifier: email });
		showToast('If the email exists, reset instructions were sent', { type: 'success' });
		return true;
	} catch (error) {
		logApiError('requestPasswordReset', error);
		showToast('Unable to request password reset', { type: 'error' });
		return false;
	}
}

export async function resetPassword(
	email: string,
	password: string,
	token: string
): Promise<boolean> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return false;
		await (sdk as any).auth.updateProvider('customer', 'emailpass', { email, password }, token);
		showToast('Password has been reset', { type: 'success' });
		return true;
	} catch (error) {
		logApiError('resetPassword', error);
		showToast('Failed to reset password', { type: 'error' });
		return false;
	}
}

export async function loginWithGoogle(): Promise<{
	success: boolean;
	location?: string;
	customer?: HttpTypes.StoreCustomer;
}> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return { success: false };

		const result = await (sdk as any).auth.login('customer', 'google', {});

		if (typeof result === 'object' && result.location) {
			// redirect to Google for authentication
			return { success: true, location: result.location };
		}

		if (typeof result !== 'string') {
			// result failed
			return { success: false };
		}

		// all subsequent requests are authenticated
		const { customer } = await sdk.store.customer.retrieve();
		return { success: true, customer };
	} catch (error) {
		logApiError('loginWithGoogle', error);
		return { success: false };
	}
}

export async function registerWithGoogle(): Promise<{
	success: boolean;
	location?: string;
	customer?: HttpTypes.StoreCustomer;
}> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return { success: false };

		const result = await (sdk as any).auth.login('customer', 'google', {});

		if (typeof result === 'object' && result.location) {
			// redirect to Google for authentication
			return { success: true, location: result.location };
		}

		if (typeof result !== 'string') {
			// result failed
			return { success: false };
		}

		// all subsequent requests are authenticated
		const { customer } = await sdk.store.customer.retrieve();
		return { success: true, customer };
	} catch (error) {
		logApiError('registerWithGoogle', error);
		return { success: false };
	}
}

// Starts Google OAuth using official SDK and redirects the browser.
export async function startGoogleOAuth(returnTo: string = '/account'): Promise<void> {
	const sdk = getStoreClient() as any;
	if (!sdk || typeof window === 'undefined') return;
	try {
		const origin = window.location.origin;
		const callback = new URL('/oauth/google/callback', origin);
		callback.searchParams.set('return_to', returnTo);
		const res = await sdk.auth.login('customer', 'google', { callbackUrl: callback.toString() });
		if (res && typeof res === 'object' && 'location' in res && res.location) {
			window.location.href = res.location as string;
			return;
		}
		if (typeof res === 'string' && res) {
			await getCurrentCustomer();
			window.location.href = returnTo;
			return;
		}
	} catch (error) {
		logApiError('startGoogleOAuth', error);
	}
}

// Completes Google OAuth on the callback page.
export async function completeGoogleOAuth(searchParams: URLSearchParams): Promise<boolean> {
	try {
		const sdk = getStoreClient() as any;
		if (!sdk) {
			console.error('Medusa SDK not available for OAuth callback');
			return false;
		}

		// Extract query parameters
		const query: Record<string, string> = {};
		for (const [k, v] of searchParams.entries()) {
			query[k] = v;
		}

		console.log('OAuth callback params:', {
			hasCode: !!query.code,
			hasState: !!query.state,
			hasError: !!query.error,
			error: query.error,
			scope: query.scope
		});

		// Check for OAuth errors
		if (query.error) {
			console.error('OAuth provider error:', query.error, query.error_description);
			showToast(`Authentication failed: ${query.error_description || query.error}`, { type: 'error' });
			return false;
		}

		// Validate required parameters
		if (!query.code) {
			console.error('Missing authorization code in OAuth callback');
			showToast('Authentication failed: Missing authorization code', { type: 'error' });
			return false;
		}

		// Since the callback is coming directly from Google to frontend,
		// we need to exchange the authorization code for a session on the backend
		// Instead of calling sdk.auth.callback (which is for backend use),
		// we'll make a request to our server-side callback endpoint
		console.log('Exchanging authorization code for session...');

		try {
			// Call our server-side callback endpoint to complete OAuth
			const callbackUrl = new URL('/oauth/google/callback', window.location.origin);
			for (const [key, value] of Object.entries(query)) {
				callbackUrl.searchParams.set(key, value);
			}

			const response = await fetch(callbackUrl.toString(), {
				method: 'GET',
				credentials: 'include' // Include cookies for session handling
			});

			if (!response.ok) {
				throw new Error(`Server callback failed: ${response.status} ${response.statusText}`);
			}

			// The server-side callback should redirect to the destination
			// But since we're calling it via fetch, we need to handle the redirect manually
			const redirectUrl = response.headers.get('location');
			if (redirectUrl) {
				console.log('Server callback successful, redirecting to:', redirectUrl);
				window.location.href = redirectUrl;
				return true;
			}

			console.log('Server callback successful, fetching customer data...');
			await getCurrentCustomer();

			// After login, try to claim recent guest orders for this email
			try {
				const me = get(customer);
				if (me?.email && me?.id) {
					console.log('Attempting to claim guest orders for:', me.email);
					const claimed = await sweepClaimGuestOrders(me.email, me.id);
					if (claimed > 0) {
						showToast(`Attached ${claimed} order${claimed > 1 ? 's' : ''} to your account`, {
							type: 'success'
						});
					}
				}
			} catch (claimError) {
				console.warn('Failed to claim guest orders:', claimError);
			}

			try {
				const c = get(cart);
				if (c?.id) {
					console.log('Transferring cart for authenticated user');
					await (sdk as any).store.cart.transferCart(c.id).catch((cartError: any) => {
						console.warn('Failed to transfer cart:', cartError);
					});
				}
			} catch (cartError) {
				console.warn('Cart transfer error:', cartError);
			}

			showToast('Successfully signed in with Google', { type: 'success' });
			return true;

		} catch (serverError: any) {
			console.error('Server callback error:', serverError);

			// If server callback fails, try the original approach as fallback
			console.log('Falling back to direct SDK callback...');
			try {
				const res = await sdk.auth.callback('customer', 'google', query);
				console.log('Direct SDK callback result:', res);

				if (res) {
					console.log('Direct SDK callback successful, fetching customer data...');
					await getCurrentCustomer();
					showToast('Successfully signed in with Google', { type: 'success' });
					return true;
				}
			} catch (directError: any) {
				console.error('Direct SDK callback also failed:', directError);
				throw serverError; // Throw the original error
			}
		}

		console.error('OAuth callback returned falsy result');
		showToast('Authentication failed: Invalid response from server', { type: 'error' });
		return false;
	} catch (error: any) {
		console.error('OAuth callback error:', error);

		// Handle specific error types
		if (error?.response?.status === 401) {
			showToast('Authentication failed: Invalid or expired authorization code', { type: 'error' });
		} else if (error?.response?.status === 400) {
			showToast('Authentication failed: Invalid request parameters', { type: 'error' });
		} else if (error?.message) {
			showToast(`Authentication failed: ${error.message}`, { type: 'error' });
		} else {
			showToast('Authentication failed: Please try again', { type: 'error' });
		}

		logApiError('completeGoogleOAuth', error);
		return false;
	}
}

// Attempts to claim recent guest orders by display_id guesses for a given email.
// Strategy: probe a small range of recent display ids around a passed hint (optional).
// If backend exposes a safer index, replace this with that call.
export async function sweepClaimGuestOrders(
	email: string,
	customerId: string,
	hints: Array<string | number> = []
): Promise<number> {
	let claimed = 0;
	try {
		const tryIds: Array<string | number> = [];
		for (const h of hints) tryIds.push(h);
		// Reduced attempts to minimize 404 noise - only try if we have hints
		if (hints.length === 0) {
			return 0;
		}

		const seen = new Set<string>();
		for (const key of tryIds) {
			const k = String(key);
			if (seen.has(k)) continue;
			seen.add(k);
			try {
				const res = await fetch('/api/orders/claim', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ display_id: k, email, customer_id: customerId })
				});
				if (res.ok) {
					claimed++;
				} else if (res.status !== 404) {
					// Log non-404 errors (404 is expected for most guesses)
					console.warn(`Order claim failed for ${k}: ${res.status} ${res.statusText}`);
				}
			} catch (error) {
				// Silently continue - these are expected to fail most of the time
			}
		}
	} catch (error) {
		console.error('Error in sweepClaimGuestOrders:', error);
	}
	return claimed;
}
export async function updateProfile(
	update: Partial<Pick<HttpTypes.StoreCustomer, 'first_name' | 'last_name' | 'email' | 'phone'>>
): Promise<HttpTypes.StoreCustomer | null> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return null;
		const resp = await (sdk as any).store.customer.update(update);
		const me = (resp as any).customer ?? null;
		if (me) customer.set(me);
		if (me) showToast('Profile updated', { type: 'success' });
		return me;
	} catch (error) {
		logApiError('updateProfile', error);
		showToast('Failed to update profile', { type: 'error' });
		return null;
	}
}

/**
 * Debug function to check authentication status and session health
 */
export async function checkAuthStatus(): Promise<{
	isAuthenticated: boolean;
	customerEmail?: string;
	sdkAvailable: boolean;
	sessionValid: boolean;
	errors?: string[];
}> {
	const errors: string[] = [];
	let isAuthenticated = false;
	let customerEmail: string | undefined;
	let sessionValid = false;

	const sdk = getStoreClient();
	const sdkAvailable = !!sdk;

	if (!sdkAvailable) {
		errors.push('Medusa SDK not initialized - check environment variables');
	} else {
		try {
			const { customer: me } = await sdk.store.customer.retrieve();
			if (me) {
				isAuthenticated = true;
				customerEmail = me.email;
				sessionValid = true;
			}
		} catch (error: any) {
			const status = error?.response?.status ?? error?.status;
			if (status === 401) {
				errors.push('Authentication token expired or invalid');
			} else {
				errors.push(`Customer retrieval failed: ${error?.message || 'Unknown error'}`);
			}
		}
	}

	return {
		isAuthenticated,
		customerEmail,
		sdkAvailable,
		sessionValid,
		errors: errors.length > 0 ? errors : undefined
	};
}
