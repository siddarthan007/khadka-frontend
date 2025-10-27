import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { listBasicProducts } from "$lib/medusa";

export const GET: RequestHandler = async ({ url }) => {
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const limit = parseInt(url.searchParams.get("limit") || "15");

  try {
    const result = await listBasicProducts(limit, offset);

    return json({
      success: true,
      products: result.products,
      count: result.count,
      hasMore: offset + limit < result.count,
      nextOffset: offset + limit,
    });
  } catch (error) {
    console.error("Error loading more products:", error);
    return json(
      {
        success: false,
        error: "Failed to load products",
        products: [],
        count: 0,
        hasMore: false,
      },
      { status: 500 }
    );
  }
};
