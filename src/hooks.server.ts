// src/hooks.server.ts
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.config = {
		// public
		medusaBackendUrl: publicEnv.PUBLIC_MEDUSA_BACKEND_URL!,
		medusaPublishableKey: publicEnv.PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
		baseUrl: publicEnv.PUBLIC_BASE_URL!,
		defaultRegion: publicEnv.PUBLIC_DEFAULT_REGION!,
		stripeKey: publicEnv.PUBLIC_STRIPE_KEY!,
		meilisearchUrl: publicEnv.PUBLIC_MEILISEARCH_URL!,
		meilisearchApiKey: publicEnv.PUBLIC_MEILISEARCH_API_KEY!,

		// private
		revalidateSecret: privateEnv.REVALIDATE_SECRET!,
		medusaStoreId: privateEnv.MEDUSA_STORE_ID!,
		medusaAdminApiKey: privateEnv.MEDUSA_ADMIN_API_KEY!
	};

	return resolve(event);
};
