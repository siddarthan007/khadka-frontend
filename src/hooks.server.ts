// src/hooks.server.ts
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

/**
 * Security headers middleware
 */
const securityHeaders: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  const isDev = process.env.NODE_ENV === 'development';
  const isHttps = event.url.protocol === 'https:';

  // Content Security Policy - Relaxed for development, strict for production
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://api.stripe.com https://*.google-analytics.com https://maps.googleapis.com " + (publicEnv.PUBLIC_MEDUSA_BACKEND_URL || ''),
    "frame-src 'self' https://js.stripe.com https://www.google.com/recaptcha/ https://recaptcha.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  // Only upgrade insecure requests in production with HTTPS
  if (!isDev && isHttps) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  // Additional security headers (relaxed for development)
  if (!isDev) {
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  } else {
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
  }
  
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS - Enforce HTTPS (only in production with HTTPS)
  if (!isDev && isHttps) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

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

    // private
    revalidateSecret: privateEnv.REVALIDATE_SECRET!,
    medusaStoreId: privateEnv.MEDUSA_STORE_ID!,
    medusaAdminApiKey: privateEnv.MEDUSA_ADMIN_API_KEY!,
  };

  return resolve(event);
};

// Compose all handles in sequence
export const handle = sequence(securityHeaders, configMiddleware);
