import type { HttpTypes } from '@medusajs/types';
import { getStoreClient, logApiError } from '$lib/medusa';
import { customer } from '$lib/stores/customer';
import { cart } from '$lib/stores/cart';
import { get } from 'svelte/store';
import { showToast } from '$lib/stores/toast';

export type RegisterPayload = {
	first_name?: string;
	last_name?: string;
	email: string;
	password: string;
};

export async function getCurrentCustomer(): Promise<HttpTypes.StoreCustomer | null> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return null;
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

export async function login(email: string, password: string): Promise<HttpTypes.StoreCustomer | null> {
	try {
		const sdk = getStoreClient();
		if (!sdk) return null;
		const res = await (sdk as any).auth.login('customer', 'emailpass', { email, password });
		if (typeof res !== 'string') {
			return null;
		}
		// For session auth, SDK sets cookie automatically.
		const me = await getCurrentCustomer();
		// Transfer guest cart to customer if exists
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
	const sdk = getStoreClient();
	if (!sdk) return null;
	try {
		await (sdk as any).auth.register('customer', 'emailpass', { email, password });
	} catch (error: any) {
		// If identity exists, attempt login path
		const statusText = error?.statusText ?? error?.response?.statusText;
		const message = error?.message ?? error?.response?.data?.message;
		if (!(statusText === 'Unauthorized' && message === 'Identity with email already exists')) {
			logApiError('register', error);
			showToast('Registration failed', { type: 'error' });
			return null;
		}
		const tok = await (sdk as any).auth.login('customer', 'emailpass', { email, password }).catch(() => null);
		if (!tok || typeof tok !== 'string') return null;
	}
	try {
		await sdk.store.customer.create({ email, first_name, last_name });
		// ensure authenticated by logging in again; cookie will be set by SDK in session mode
		await (sdk as any).auth.login('customer', 'emailpass', { email, password }).catch(() => {});
		return await getCurrentCustomer();
	} catch (error) {
		logApiError('register.createCustomer', error);
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

export async function resetPassword(email: string, password: string, token: string): Promise<boolean> {
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

export async function updateProfile(update: Partial<Pick<HttpTypes.StoreCustomer, 'first_name' | 'last_name' | 'email' | 'phone'>>): Promise<HttpTypes.StoreCustomer | null> {
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


