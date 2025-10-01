// src/hooks.server.ts
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

/**
 * Security headers middleware - Minimal essential security
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Only set essential security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');

  return response;
};

/**
 * Configuration middleware
 */
const configMiddleware: Handle = async ({ event, resolve }) => {
  event.locals.config = {
    // public
    medusaBackendUrl: publicEnv.PUBLIC_MEDUSA_BACKEND_URL!,
    medusaPublishableKey: publicEnv.PUBLIC_MEDUSA_PUBLISHABLE_KEY!,
    baseUrl: publicEnv.PUBLIC_BASE_URL!,
    defaultRegion: publicEnv.PUBLIC_DEFAULT_REGION!,
    stripeKey: publicEnv.PUBLIC_STRIPE_KEY!,
    meilisearchUrl: publicEnv.PUBLIC_MEILISEARCH_URL!,
    meilisearchApiKey: publicEnv.PUBLIC_MEILISEARCH_API_KEY!,
    recaptchaSiteKey: publicEnv.PUBLIC_RECAPTCHA_SITE_KEY!,
    googleAnalyticsId: publicEnv.PUBLIC_GOOGLE_ANALYTICS_ID!,

    // private
    revalidateSecret: privateEnv.REVALIDATE_SECRET!,
    medusaStoreId: privateEnv.MEDUSA_STORE_ID!,
    medusaAdminApiKey: privateEnv.MEDUSA_ADMIN_API_KEY!,
    recaptchaSecretKey: privateEnv.RECAPTCHA_SECRET_KEY!,
  };

  return resolve(event);
};

// Compose all handles in sequence
export const handle = sequence(securityHeaders, configMiddleware);
