import type { RequestEvent } from "@sveltejs/kit";

export const prerender = true;
export const csr = false;

export const load = (event: RequestEvent) => {
  return {
    storeMetadata: event.locals.storeMetadata,
  };
};