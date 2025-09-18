import type { PageServerLoad } from './$types';

// Server-side: clear helper cookies but do not redirect.
// Client page will call sdk.auth.callback and redirect accordingly.
export const load: PageServerLoad = async ({ url, cookies }) => {
	const isSecure = url.protocol === 'https:';
	cookies.set('oauth_return_to', '', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isSecure,
		maxAge: 0
	});
	return {};
};
