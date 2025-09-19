import type { HttpTypes } from '@medusajs/types';
import { getStoreClient, logApiError, getOAuthCustomer } from '$lib/medusa';
import { customer } from '$lib/stores/customer';
import { cart } from '$lib/stores/cart';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';
import { normalizeUSPhone } from '$lib/us';
import { decodeToken } from 'react-jwt';

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
 * OAuth (Google) simplified overview:
 * We leverage Medusa JS SDK auth endpoints directly from the browser:
 * startGoogleOAuth(): sdk.auth.login('customer','google', { callbackUrl }) returns either a redirect location
 * (object with location) or a token string if the user is already authenticated with the provider.
 * handleGoogleOAuthCallback(): sdk.auth.callback('customer','google', queryParams) returns a JWT. We decode
 * it with react-jwt's decodeToken to check if actor/customer needs creation (actor_id === ''). If so we create
 * the customer then refresh the token via sdk.auth.refresh(). Finally we call getCurrentCustomer().
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
		} catch { }
		try {
			const c = get(cart);
			if (c?.id) {
				await (sdk as any).store.cart.transferCart(c.id).catch(() => { });
			}
		} catch { }
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
		await sdk.store.customer.create({ email, first_name, last_name, phone });
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
		} catch { }
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

// --- Google OAuth (simplified) ---
// Starts Google OAuth and redirects user to provider if needed.
export async function startGoogleOAuth(returnTo: string = '/account'): Promise<void> {
	const sdk = getStoreClient() as any;
	if (!sdk || typeof window === 'undefined') return;

	try {
		const callbackUrl = new URL('/oauth/google/callback', window.location.origin).toString();

		localStorage.setItem('oauth_intended_path', returnTo);

		const res = await sdk.auth.login('customer', 'google', { callbackUrl: callbackUrl });

		if (res && typeof res === 'object' && 'location' in res && res.location) {
			window.location.href = res.location as string;
		} else {
			showToast('Unable to start Google authentication. Please try again.', { type: 'error' });
		}
	} catch (error) {
		logApiError('startGoogleOAuth', error);
		showToast('Failed to start Google sign-in.', { type: 'error' });
	}
}

export async function handleGoogleOAuthCallback(searchParams: URLSearchParams): Promise<boolean> {
	const sdk = getStoreClient() as any;
	if (!sdk) return false;

	try {
		const query = Object.fromEntries(searchParams.entries());
		// Debug: Log full query parameters from the callback
		console.log('[OAuth] Callback query params:', query);

		if (query.error) {
			showToast(`Authentication failed: ${query.error_description || query.error}`, { type: 'error' });
			return false;
		}
		if (!query.code) {
			showToast('Authentication failed: Missing authorization code.', { type: 'error' });
			return false;
		}

		let token: string = '';
		try {
			token = await sdk.auth.callback('customer', 'google', query);
		} catch (err) {
			logApiError('googleOAuthCallback', err);
			showToast('Authentication failed while exchanging code. Check backend logs.', { type: 'error' });
			return false;
		}

		if (typeof token !== 'string') {
			showToast('Authentication failed: Invalid token response from server.', { type: 'error' });
			return false;
		}

		type DecodedToken = { actor_id?: string; auth_identity_id?: string; email?: string; given_name?: string; family_name?: string; name?: string; };
		const decoded = decodeToken<DecodedToken>(token);

		const needsCustomer = !decoded?.actor_id;

		type OAuthProfile = {
            user_metadata?: {
                email?: string;
                family_name?: string;
                given_name?: string;
                name?: string;
                picture?: string;
            };
        };
		let oauthProfile: OAuthProfile | null = null;
        try {
            oauthProfile = await getOAuthCustomer(token, decoded?.auth_identity_id || '');
        } catch (e) {
            console.warn('[OAuth] getOAuthCustomer failed, using decoded token metadata.');
        }

		if (needsCustomer) {
			const md = oauthProfile?.user_metadata ?? {};
            const email = md.email?.toLowerCase()?.trim() || decoded?.email?.toLowerCase()?.trim();
			if (!email) {
				showToast('Authentication failed: Provider did not return an email.', { type: 'error' });
				return false;
			}

			const first_name =
                md.given_name ??
                decoded?.given_name ??
                (md.name ? md.name.split(' ')[0] : undefined);

            const last_name =
                md.family_name ??
                decoded?.family_name ??
                (md.name ? md.name.split(' ').slice(1).join(' ') : undefined);

			try {
				await sdk.store.customer.create(
					{ email, first_name, last_name },
					{},
					{ Authorization: `Bearer ${token}` }
				);
			} catch (createErr: any) {
				const msg = createErr?.response?.data?.message || createErr?.message;
				if (!msg || !/already exists/i.test(msg)) {
					logApiError('googleOAuthCreateCustomer', createErr);
					showToast('Failed to create your account.', { type: 'error' });
					return false;
				}
			}

			// Refresh token so the identity is bound to the created customer
			try {
				await sdk.auth.refresh();
			} catch (refreshErr) {
				logApiError('googleOAuthRefreshToken', refreshErr);
				showToast('Failed to refresh authentication after account creation.', { type: 'error' });
				return false;
			}
		}

		await getCurrentCustomer();
		try {
			const c = get(cart);
			if (c?.id) await sdk.store.cart.transferCart(c.id).catch(() => { });
		} catch { }

		showToast('Signed in with Google', { type: 'success' });
		return true;

	} catch (error) {
		logApiError('handleGoogleOAuthCallback', error);
		showToast('An unexpected error occurred during Google sign-in.', { type: 'error' });
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
			await sdk.auth.refresh();

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