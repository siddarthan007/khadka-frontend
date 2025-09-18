import type { RequestHandler } from '@sveltejs/kit';
import { getStoreClient } from '$lib/medusa';

export const GET: RequestHandler = async (event) => {
	try {
		const url = new URL(event.request.url);
		const returnTo = url.searchParams.get('return_to') || '/account';
		const baseUrl = event.locals?.config?.baseUrl;
		if (!baseUrl) return new Response('Missing base URL', { status: 500 });

		const sdk = getStoreClient() as any;
		if (!sdk) return new Response('SDK not initialized', { status: 500 });

		const callback = new URL('/oauth/google/callback', baseUrl);
		callback.searchParams.set('return_to', returnTo);

		// Persist return_to for server callback to read and redirect
		const isSecure = url.protocol === 'https:';
		event.cookies.set('oauth_return_to', returnTo, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: isSecure,
			maxAge: 30 * 60
		});

		const res = await sdk.auth.login('customer', 'google', { callbackUrl: callback.toString() });
		if (res && typeof res === 'object' && 'location' in res && res.location) {
			return new Response(null, { status: 302, headers: { Location: res.location as string } });
		}
		return new Response('Unexpected auth response', { status: 500 });
	} catch (e: any) {
		return new Response('OAuth start failed', { status: 500 });
	}
};
