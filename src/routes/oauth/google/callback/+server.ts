import type { RequestHandler } from '@sveltejs/kit';

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

	// From Medusa backend redirect
	const returnedState = url.searchParams.get('state') || null;
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

	// Success: the Medusa backend should have already set the session cookie
	// for its own origin during its redirect response. We now route the user
	// to their intended destination.
	clearCookie('oauth_state');

	const destination = storedReturnTo || '/account';

	// Clear return_to after reading
	clearCookie('oauth_return_to');

	// Optionally include a hint that OAuth succeeded
	const hint = destination.includes('?') ? '&' : '?';
	return redirect(`${destination}${hint}auth=success&provider=google`);
};
