// src/hooks.server.ts
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { getAdminClient } from "$lib/server/medusa";
import { logger } from "$lib/logger";

let cachedStoreMetadata: Record<string, any> | null = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Security headers middleware - Essential security headers
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy - Adjust as needed for your resources
  const csp = [
    "default-src 'self'",
    "script-src 'self' https://www.google.com https://www.gstatic.com https://js.stripe.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://js.stripe.com https://www.google.com https://checkout.stripe.com https://accounts.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ].join('; ');  
  
  // Permissions Policy
  response.headers.set('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(self)'
  );

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

  // Fetch store metadata with caching
  if (!cachedStoreMetadata || Date.now() - lastFetch > CACHE_TTL) {
    const admin = getAdminClient();
    if (admin) {
      try {
        const { store } = await admin.admin.store.retrieve(
          privateEnv.MEDUSA_STORE_ID!,
          { fields: "id,metadata" },
        );
        cachedStoreMetadata = store.metadata || {};
        lastFetch = Date.now();
      } catch (error) {
        logger.error("Failed to fetch store metadata:", error);
        cachedStoreMetadata = {};
      }
    } else {
      cachedStoreMetadata = {};
    }
  }
  event.locals.storeMetadata = cachedStoreMetadata;

  return resolve(event);
};

// Compose all handles in sequence
export const handle = sequence(securityHeaders, configMiddleware);
