import type { RequestHandler } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// This server endpoint intentionally does not perform the OAuth code exchange.
// We validate state minimally and then render the +page.svelte that completes
// the callback on the client using sdk.auth.callback to avoid double-callbacks.

function isHttps(url: URL) {
	return url.protocol === 'https:';
}

function sanitizeReturnTo(val: string | null | undefined) {
	if (!val) return null;
	try {
		const decoded = decodeURIComponent(val);
		if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
	} catch {}
	return null;
}

export const GET: RequestHandler = async (event) => {
	const url = new URL(event.request.url);

	const storedState = event.cookies.get('oauth_state') || null;
	const storedReturnTo = sanitizeReturnTo(event.cookies.get('oauth_return_to')) || '/account';

	const returnedState = url.searchParams.get('state') || null;
	const error = url.searchParams.get('error');
	const errorDescription =
		url.searchParams.get('error_description') || url.searchParams.get('message');

	const secure = isHttps(url);
	const clearCookie = (name: string) =>
		event.cookies.set(name, '', {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure,
			maxAge: 0
		});

	// If error from provider, just clear cookies and let +page show error UI via query.
	if (error) {
		clearCookie('oauth_state');
		clearCookie('oauth_return_to');
		return new Response(null, { status: 200 });
	}

	// If state mismatch, clear cookies and render page (which will show failure on client)
	if (!storedState || !returnedState || storedState !== returnedState) {
		clearCookie('oauth_state');
		clearCookie('oauth_return_to');
		return new Response(null, { status: 200 });
	}

	// Valid state; leave handling to client page. Do not exchange code here.
	// We purposely avoid redirecting so the client page can read URL params.
	return new Response(null, { status: 200, headers: { "x-return-to": storedReturnTo } });
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
