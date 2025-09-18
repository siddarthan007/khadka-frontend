import type { HttpTypes } from '@medusajs/types';
import { getStoreClient, logApiError } from '$lib/medusa';
import { customer } from '$lib/stores/customer';
import { cart } from '$lib/stores/cart';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';
import { normalizeUSPhone } from '$lib/us';
import { jwtDecode } from 'jwt-decode';

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
 * it with jwt-decode (lightweight) to check if actor/customer needs creation (actor_id === ''). If so we create
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

// --- Google OAuth (simplified) ---
// Starts Google OAuth and redirects user to provider if needed.
export async function startGoogleOAuth(returnTo: string = '/account'): Promise<void> {
    if (typeof window !== 'undefined') {
        localStorage.setItem('oauth_intended_path', returnTo);
    }
	
	const sdk = getStoreClient() as any;
    if (!sdk || typeof window === 'undefined') return;
    try {
        const origin = window.location.origin;

        const callback = new URL('/oauth/google/callback', origin).toString();
        const res = await sdk.auth.login('customer', 'google', { callbackUrl: callback });
        if (res && typeof res === 'object' && 'location' in res && res.location) {
            window.location.href = res.location as string; // Redirect to Google
            return;
        }
        if (typeof res === 'string') {
            // Already have a token (user previously authorized) -> just hydrate customer
            await getCurrentCustomer();
            window.location.href = returnTo;
            return;
        }
        showToast('Unable to start Google authentication', { type: 'error' });
    } catch (error) {
        logApiError('startGoogleOAuth', error);
        showToast('Failed to start Google sign-in', { type: 'error' });
    }
}

// Handle callback page: exchange code for token, optionally create customer, refresh token, hydrate store.
export async function handleGoogleOAuthCallback(searchParams: URLSearchParams): Promise<boolean> {
  const sdk = getStoreClient() as any;
  if (!sdk) return false;

  try {
    const query: Record<string, string> = {};
    for (const [k, v] of searchParams.entries()) query[k] = v;

    if (query.error) {
      showToast(`Authentication failed: ${query.error_description || query.error}`, { type: 'error' });
      return false;
    }
    if (!query.code) {
      showToast('Authentication failed: Missing authorization code', { type: 'error' });
      return false;
    }

    // 1. Exchange code for token
    let token: string = '';
    try {
      token = await sdk.auth.callback('customer', 'google', query);
    } catch (err) {
      logApiError('googleOAuthCallback', err);
      showToast('Authentication failed while exchanging code', { type: 'error' });
      return false;
    }
    if (typeof token !== 'string') {
      showToast('Authentication failed: Invalid token response', { type: 'error' });
      return false;
    }

    // 2. Decode token
    type Decoded = { actor_id?: string; email?: string; given_name?: string; family_name?: string; name?: string };
    let decoded: Decoded | null = null;
    try {
      decoded = jwtDecode<Decoded>(token);
    } catch {}

    // 3. Ensure customer exists
    if (!decoded?.actor_id) {
      const email = decoded?.email?.toLowerCase()?.trim();
      const first_name = decoded?.given_name || decoded?.name?.split(' ')[0];
      const last_name =
        decoded?.family_name ||
        (decoded?.name && decoded.name.split(' ').slice(1).join(' ')) ||
        undefined;

      if (!email) {
        showToast('Authentication failed: Provider did not return an email', { type: 'error' });
        return false;
      }

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
          showToast('Failed to finalize account creation', { type: 'error' });
          return false;
        }
      }
    }

    // 4. Refresh token OR retry login
    let refreshed = false;
    try {
      await sdk.auth.refresh();
      refreshed = true;
    } catch (refreshErr) {
      logApiError('googleOAuthRefresh', refreshErr);
    }

    // If refresh still useless, force login again to rebuild session
    if (!refreshed || !decoded?.actor_id) {
      try {
        await sdk.auth.login('customer', 'google', { callbackUrl: window.location.origin + '/oauth/google/callback' });
      } catch (loginErr) {
        logApiError('googleOAuthReLogin', loginErr);
        showToast('Session could not be established', { type: 'error' });
        return false;
      }
    }

    // 5. Hydrate customer + cart
    await getCurrentCustomer();
    try {
      const c = get(cart);
      if (c?.id) await sdk.store.cart.transferCart(c.id).catch(() => {});
    } catch {}

    // 6. Redirect
    showToast('Signed in with Google', { type: 'success' });
    const intendedPath =
      (typeof window !== 'undefined' ? localStorage.getItem('oauth_intended_path') : null) ||
      '/account';
    if (typeof window !== 'undefined') {
      localStorage.removeItem('oauth_intended_path');
      window.location.href = intendedPath;
    }
    return true;
  } catch (error) {
    logApiError('handleGoogleOAuthCallback', error);
    showToast('Google sign-in failed', { type: 'error' });
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
