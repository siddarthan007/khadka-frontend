// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
    interface Locals {
      config: {
        // public vars
        medusaBackendUrl: string;
        medusaPublishableKey: string;
        baseUrl: string;
        defaultRegion: string;
        stripeKey: string;
        meilisearchUrl: string;
        meilisearchApiKey: string;
        recaptchaSiteKey: string;
        googleAnalyticsId: string;

        // private vars
        revalidateSecret: string;
        medusaStoreId: string;
        medusaAdminApiKey: string;
        recaptchaSecretKey: string;
      };
      storeMetadata: Record<string, any>;
    }
  }
}

export {};
