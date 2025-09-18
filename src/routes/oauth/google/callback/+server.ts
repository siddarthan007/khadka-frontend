import type { RequestHandler } from '@sveltejs/kit';
import { getServerStoreClient } from '$lib/server/medusa';

function redirect(location: string) {
	return new Response(null, {
		status: 302,
		headers: { Location: location }
	});
}

function isHttps(url: URL) {
	return url.protocol === 'https:';
}

function sanitizeReturnTo(val: string | null | undefined) {
	if (!val) return null;
	try {
		// Only allow same-site relative paths
		const decoded = decodeURIComponent(val);
		if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
	} catch {
		// ignore malformed URI
	}
	return null;
}

export const GET: RequestHandler = async (event) => {
	const url = new URL(event.request.url);

	// Values set during /oauth/google/start
	const storedState = event.cookies.get('oauth_state') || null;
	const storedReturnTo = sanitizeReturnTo(event.cookies.get('oauth_return_to'));

	// From Google OAuth redirect
	const returnedState = url.searchParams.get('state') || null;
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const errorDescription =
		url.searchParams.get('error_description') || url.searchParams.get('message');

	// Always clear one-time cookies
	const secure = isHttps(url);
	const clearCookie = (name: string) =>
		event.cookies.set(name, '', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: 0
		});

	// Handle provider error
	if (error) {
		clearCookie('oauth_state');
		clearCookie('oauth_return_to');

		const msg = encodeURIComponent(errorDescription || error || 'oauth_error');
		return redirect(`/login?auth=oauth_error&message=${msg}`);
	}

	// CSRF/state validation
	if (!storedState || !returnedState || storedState !== returnedState) {
		clearCookie('oauth_state');
		clearCookie('oauth_return_to');
		return redirect('/login?auth=state_mismatch');
	}

	// If we have an authorization code, try to complete OAuth
	if (code) {
		try {
			console.log('Server-side OAuth callback: Processing authorization code');
			const sdk = getServerStoreClient() as any;
			if (!sdk) {
				console.error('Medusa server SDK not available in server callback');
				return redirect('/login?auth=sdk_error');
			}

			// Extract all query parameters for the OAuth callback
			const query: Record<string, string> = {};
			for (const [k, v] of url.searchParams.entries()) {
				query[k] = v;
			}

			// Complete OAuth on the server-side
			const result = await sdk.auth.callback('customer', 'google', query);
			console.log('Server-side OAuth callback result:', result);

			if (result) {
				console.log('Server-side OAuth successful');
				// Clear state cookies
				clearCookie('oauth_state');
				clearCookie('oauth_return_to');

				const destination = storedReturnTo || '/account';
				const hint = destination.includes('?') ? '&' : '?';
				return redirect(`${destination}${hint}auth=success&provider=google`);
			} else {
				console.error('Server-side OAuth callback returned falsy result');
				clearCookie('oauth_state');
				clearCookie('oauth_return_to');
				return redirect('/login?auth=callback_failed');
			}
		} catch (callbackError: any) {
			console.error('Server-side OAuth callback error:', callbackError);
			clearCookie('oauth_state');
			clearCookie('oauth_return_to');

			const errorMsg = encodeURIComponent(callbackError?.message || 'oauth_callback_error');
			return redirect(`/login?auth=oauth_error&message=${errorMsg}`);
		}
	}

	// If no authorization code, redirect to login
	clearCookie('oauth_state');
	clearCookie('oauth_return_to');
	return redirect('/login?auth=no_code');
};
