import Medusa from '@medusajs/js-sdk';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { HttpTypes } from '@medusajs/types';
import { MeiliSearch } from "meilisearch";

function logApiError(operation: string, error: any) {
	const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
	console.error(`Medusa API Error (${operation}):`, errorMessage);
}

export const adminMedusa = new Medusa({
	baseUrl: publicEnv.PUBLIC_MEDUSA_BACKEND_URL!,
	apiKey: privateEnv.MEDUSA_ADMIN_API_KEY!
});

let meilisearchClient: MeiliSearch | null = null;

export function getMeilisearchClient(): MeiliSearch | null {
	const host = publicEnv.PUBLIC_MEILISEARCH_URL;
	if (typeof host !== 'string' || host.trim() === '' || !/^https?:\/\//.test(host)) {
		return null;
	}
	if (!meilisearchClient) {
		try {
			meilisearchClient = new MeiliSearch({
				host,
				apiKey: publicEnv.PUBLIC_MEILISEARCH_API_KEY,
				timeout: 10000,
			});
		} catch (err) {
			console.warn('Failed to initialize MeiliSearch (server):', (err as any)?.message ?? err);
			meilisearchClient = null;
		}
	}
	return meilisearchClient;
}

export async function getStoreInfo(): Promise<HttpTypes.AdminStore | null> {
	if (adminMedusa) {
		try {
			const { store } = await adminMedusa.admin.store.retrieve(privateEnv.MEDUSA_STORE_ID!);
			return store;
		} catch (error) {
			logApiError('getStoreInfo', error);
		}
	}
	return null;
}

export async function getHeroSlides(): Promise<any[] | null> {
	try {
		if (!adminMedusa) return [];
		const raw: Response = await adminMedusa.client.fetch("/admin/slides", { method: "GET" });
		const data = raw && typeof raw.json === "function" ? await raw.json() : raw;
		const slides = Array.isArray(data) ? data : (data?.slides ?? []);
		return slides.map((s: any) => ({
			image: s.image,
			badge: s.badge,
			title: s.title,
			accent: s.accent,
			subtitle: s.subtitle,
			ctaPrimary: s.cta_primary_label
				? { label: s.cta_primary_label, href: s.cta_primary_href }
				: undefined,
			ctaSecondary: s.cta_secondary_label
				? { label: s.cta_secondary_label, href: s.cta_secondary_href }
				: undefined,
			contentPosition: s.content_position,
			textAlign: s.text_align,
		}));
	} catch (error) {
		logApiError('getHeroSlides', error);
		return [];
	}
}

export async function searchProductsMeili(query: string, limit: number = 10) {
	try {
		const client = getMeilisearchClient();
		if (!client) {
			console.warn(
				"MeiliSearch not configured",
			);
			return [];
		}
		const index = client.index("products");
		const res = await index.search(query, {
			limit,
			attributesToRetrieve: ["*"],
			attributesToHighlight: ["title", "description", "thumbnail"],
		});
		return res.hits ?? [];
	} catch (error) {
		logApiError("MeiliSearch error", error);
		return [];
	}
}

export async function searchCategoriesMeili(query: string, limit: number = 10) {
	try {
		const client = getMeilisearchClient();
		if (!client) {
			console.warn("MeiliSearch not configured");
			return [];
		}
		const index = client.index("categories");
		const res = await index.search(query, {
			limit,
			attributesToRetrieve: ["*"],
			attributesToHighlight: ["name", "description", "metadata"],
		});
		return res.hits ?? [];
	} catch (error) {
		logApiError("MeiliSearch error", error);
		return [];
	}
}