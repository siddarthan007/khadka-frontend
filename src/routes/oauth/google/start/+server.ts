import type { RequestHandler } from "@sveltejs/kit";
import { getServerStoreClient } from "$lib/server/medusa";
import { randomBytes } from "crypto";
import { logger } from "$lib/logger";

export const GET: RequestHandler = async (event) => {
  try {
    const url = new URL(event.request.url);
    const returnTo = url.searchParams.get("returnTo") || "/account";
    const baseUrl = event.locals?.config?.baseUrl;
    if (!baseUrl) return new Response("Missing base URL", { status: 500 });

    const sdk = getServerStoreClient() as any;
    if (!sdk) return new Response("SDK not initialized", { status: 500 });

    const callback = new URL("/oauth/google/callback", baseUrl);
    const state = randomBytes(32).toString("hex");
    const isSecure = url.protocol === "https:";
    event.cookies.set("oauth_state", state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: 10 * 60,
    });

    event.cookies.set("oauth_return_to", returnTo, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: isSecure,
      maxAge: 30 * 60,
    });

    const res = await sdk.auth.login("customer", "google", {
      callbackUrl: callback.toString(),
      state: state,
    });
    if (res && typeof res === "object" && "location" in res && res.location) {
      return new Response(null, {
        status: 302,
        headers: { Location: res.location as string },
      });
    }
    return new Response("Unexpected auth response", { status: 500 });
  } catch (e: any) {
    logger.error("OAuth start error:", e);
    return new Response("OAuth start failed", { status: 500 });
  }
};
