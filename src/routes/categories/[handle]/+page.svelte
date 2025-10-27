<script lang="ts">
	import ProductCard from "$lib/components/ProductCard.svelte";
	import SEO from "$lib/components/SEO.svelte";
	import {
		generateBreadcrumbStructuredData,
		generateCollectionPageStructuredData,
		generateItemListStructuredData,
		generateOptimizedTitle,
		generateOptimizedDescription,
	} from "$lib/seo";
	import { cn } from "$lib/utils";
	import { onMount } from "svelte";
	import { page } from "$app/state";
	import { goto } from "$app/navigation";
	import { tick } from "svelte";
	import { logger } from "$lib/logger";
	import { trackViewItemList } from "$lib/utils/analytics";
	let {
		data,
	}: {
		data?: {
			category: any;
			subcategories: any[];
			products: any[];
			total: number;
			subCounts: Record<string, number>;
		};
	} = $props();
	const category = data?.category;
	const subcategories = data?.subcategories ?? [];
	const initialProducts = data?.products ?? [];
	const initialTotal = data?.total ?? 0;
	let products = $state(initialProducts);
	let total = $state(initialTotal);
	const subCounts = data?.subCounts ?? {};
	// allIds is provided by the loader but optional
	const allIds: string[] = (data as any)?.allIds ?? [];

	// sidebar selection: 'all' | subcat.id
	let selected: string = $state("all");
	let loading = $state(false);
	let loadingMore = $state(false);
	let visible = $state([...initialProducts]);
	let hasMore = $state(initialProducts.length < initialTotal);
	let offset = $state(initialProducts.length);
	let currentIds = $state(allIds);
	let currentCount = $state(initialTotal);
	const pageLimit = 15; // Changed to 15 for consistency with home page

	function mergeUniqueProducts(existing: any[], additions: any[]) {
		const seen = new Set(existing.map((item) => item.id));
		const merged = [...existing];
		let added = 0;
		for (const product of additions) {
			if (!product?.id || seen.has(product.id)) continue;
			merged.push(product);
			seen.add(product.id);
			added += 1;
		}
		return { merged, added };
	}

	const baseUrl = "https://khadkafoods.com";
	const breadcrumbs = [
		{ name: "Home", url: baseUrl },
		{ name: "Categories", url: `${baseUrl}/categories` },
		{
			name: category?.name || "Category",
			url: `${baseUrl}/categories/${category?.handle || ""}`,
		},
	];

	// Enhanced structured data
	const structuredData = [
		generateBreadcrumbStructuredData(breadcrumbs),
		generateCollectionPageStructuredData({
			name: category?.name || "Category",
			description:
				category?.description ||
				`Explore our ${category?.name} category with premium quality products.`,
			url: `${baseUrl}/categories/${category?.handle}`,
			hasPart: initialProducts.slice(0, 10).map((p) => ({
				url: `${baseUrl}/products/${p.handle}`,
				name: p.title,
			})),
		}),
		generateItemListStructuredData({
			name: `${category?.name} Products`,
			items: initialProducts.slice(0, 20).map((p, index) => ({
				position: index + 1,
				name: p.title,
				url: `${baseUrl}/products/${p.handle}`,
				image: p.thumbnail || p.images?.[0]?.url,
			})),
		}),
	];

	// Generate optimized SEO content
	const seoTitle = category?.name
		? generateOptimizedTitle(category.name, undefined, "category")
		: "Category | Khadka Foods";

	const seoDescription = category?.name
		? generateOptimizedDescription(category.name, {
				type: "category",
				usps: [
					"Premium Quality",
					"Wide Selection",
					"Fast Delivery",
					"Best Prices",
				],
			})
		: "Browse our category of premium products at Khadka Foods.";

	onMount(() => {
		const qs = new URLSearchParams(page.url.search);
		const sub = qs.get("sub");
		if (sub && sub !== "all") {
			selected = sub;
			loadFor(sub);
		}

		// Track view_item_list event for category page
		try {
			const items = products.map((p: any, index: number) => ({
				item_id: p.variants?.[0]?.id || p.id,
				item_name: p.title || "Unknown Product",
				price:
					p.variants?.[0]?.calculated_price?.calculated_amount || 0,
				quantity: 1,
				item_category: category?.name || "",
				index,
			}));
			trackViewItemList(
				items,
				`Category: ${category?.name || "Unknown"}`,
				category?.id,
			);
		} catch (e) {
			logger.warn("Analytics tracking failed:", e);
		}
	});

	function findNodeById(nodes: any[], id: string): any | null {
		for (const n of nodes) {
			if (n.id === id) return n;
			const found = findNodeById(n.children ?? [], id);
			if (found) return found;
		}
		return null;
	}

	function collectIds(node: any): string[] {
		return [node.id, ...(node.children?.flatMap(collectIds) ?? [])];
	}

	async function loadFor(targetId: string) {
		loading = true;
		loadingMore = false;
		if (targetId === "all") {
			currentIds = allIds;
			visible = [...products];
			offset = products.length;
			hasMore = products.length < total;
			currentCount = total;
			loading = false;
			return;
		}
		const node = findNodeById(subcategories, targetId);
		const ids = node ? collectIds(node) : [];
		currentIds = ids;
		currentCount = subCounts[targetId] ?? 0;
		visible = [];
		if (!ids.length) {
			hasMore = false;
			loading = false;
			return;
		}
		try {
			const params = new URLSearchParams();
			params.set("limit", String(pageLimit));
			params.set("offset", "0");
			params.set(
				"fields",
				"title,handle,thumbnail,variants.id,*variants.calculated_price",
			);
			for (const id of ids) params.append("category_id", id);
			const res = await fetch(`/api/products?${params.toString()}`);
			if (!res.ok) {
				throw new Error(`Failed to load products: ${res.status}`);
			}
			const json = await res.json();
			const fetched = json.products ?? [];
			const { merged, added } = mergeUniqueProducts([], fetched);
			visible = merged;
			offset =
				json.next_offset ??
				(json.offset ?? 0) + (json.limit ?? pageLimit);
			hasMore = Boolean(json.has_more) && added > 0;
			currentCount = json.count ?? fetched.length ?? currentCount;
		} catch (e) {
			logger.error("Failed to load category products", e);
			visible = [];
			hasMore = false;
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (loadingMore || !hasMore || !currentIds.length) return;
		loadingMore = true;
		try {
			const params = new URLSearchParams();
			params.set("limit", String(pageLimit));
			params.set("offset", String(offset));
			params.set(
				"fields",
				"title,handle,thumbnail,variants.id,*variants.calculated_price",
			);
			for (const id of currentIds) params.append("category_id", id);
			const res = await fetch(`/api/products?${params.toString()}`);
			if (!res.ok) {
				throw new Error(`Failed to load more products: ${res.status}`);
			}
			const json = await res.json();
			const fetched = json.products ?? [];
			offset =
				json.next_offset ??
				(json.offset ?? offset) + (json.limit ?? pageLimit);
			let addedUnique = fetched.length;
			hasMore = Boolean(json.has_more);
			currentCount = json.count ?? currentCount;
			if (selected === "all") {
				const { merged, added } = mergeUniqueProducts(products, fetched);
				products = merged;
				visible = [...products];
				addedUnique = added;
				total = json.count ?? total;
				currentCount = total;
			} else {
				const { merged, added } = mergeUniqueProducts(visible, fetched);
				visible = merged;
				addedUnique = added;
			}
			hasMore = hasMore && addedUnique > 0;
		} catch (e) {
			logger.error("Failed to load more category products", e);
			hasMore = false;
		} finally {
			loadingMore = false;
		}
	}

	async function onSelect(id: string) {
		selected = id;
		const url = new URL(page.url);
		if (id === "all") url.searchParams.delete("sub");
		else url.searchParams.set("sub", id);
		await goto(`${url.pathname}${url.search}`, {
			replaceState: true,
			noScroll: true,
		});
		await tick();
		await loadFor(id);
	}
</script>

{#if !category}
	<!-- Category Not Found Section -->
	<section class="w-full py-12 sm:py-16 min-h-[calc(100vh-200px)]">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<div class="max-w-2xl mx-auto text-center">
				<!-- Icon Illustration -->
				<div class="flex justify-center mb-8">
					<svg
						class="w-24 h-24 sm:w-32 sm:h-32 text-base-content stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.5"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
				</div>

				<!-- Title -->
				<h1
					class="text-4xl sm:text-5xl font-bold mb-4 text-base-content"
				>
					Category Not Found
				</h1>

				<!-- Subtitle -->
				<p
					class="text-base sm:text-lg text-base-content/70 mb-10 max-w-md mx-auto"
				>
					Looks like this category escaped our inventory system. Let's
					find you something delicious instead!
				</p>

				<!-- Divider -->
				<div class="divider my-8"></div>

				<!-- Action Buttons -->
				<div
					class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8"
				>
					<a
						href="/categories"
						class="btn btn-primary gap-2 min-w-[160px]"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
							/>
						</svg>
						All Categories
					</a>

					<a
						href="/products"
						class="btn btn-outline gap-2 min-w-[160px]"
					>
						<svg
							class="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
							/>
						</svg>
						Browse Products
					</a>
				</div>

				<!-- Quick Links -->
				<div
					class="divider divider-neutral text-xs text-base-content/60"
				>
					or explore
				</div>

				<div class="flex flex-wrap gap-2 justify-center">
					<a href="/collections" class="link link-hover text-sm"
						>Collections</a
					>
					<span class="text-base-content/50">•</span>
					<a href="/" class="link link-hover text-sm">Home</a>
					<span class="text-base-content/50">•</span>
					<a href="/cart" class="link link-hover text-sm">Cart</a>
				</div>
			</div>
		</div>
	</section>
{:else if category}
	<SEO
		title={seoTitle}
		description={seoDescription}
		keywords={[
			category.name,
			`${category.name} products`,
			`buy ${category.name}`,
			"groceries online",
			"international foods",
			"Khadka Foods",
		]}
		canonical={`${baseUrl}/categories/${category.handle}`}
		ogImage={category.thumbnail || `${baseUrl}/logo.png`}
		ogType="website"
		ogLocale="en_US"
		ogSiteName="Khadka Foods"
		twitterSite="@khadkafoods"
		twitterCreator="@khadkafoods"
		{structuredData}
		maxImagePreview="large"
		maxSnippet={-1}
	/>

	<section class="w-full py-8">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<nav class="breadcrumbs mb-4 text-sm">
				<ul>
					<li><a href="/">Home</a></li>
					<li><a href="/categories">Categories</a></li>
					<li class="text-base-content/70">{category?.name}</li>
				</ul>
			</nav>

			<header class="mb-6 flex items-end justify-between">
				<div>
					<h1 class="text-3xl font-bold tracking-tight">
						{selected === "all"
							? category?.name
							: (findNodeById(subcategories, selected)?.name ??
								category?.name)}
					</h1>
					<p class="mt-1 text-sm opacity-70">
						{#if loading && (visible?.length ?? 0) === 0 && selected !== "all"}
							Loading products…
						{:else}
							{currentCount}
							{currentCount === 1 ? " product" : " products"}
						{/if}
					</p>
				</div>
			</header>

			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
				<!-- Sidebar - Now sticky -->
				<aside class="lg:col-span-4 xl:col-span-3">
					<div class="lg:sticky lg:top-24 lg:self-start" style="will-change: auto;">
						<div
							class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl"
						>
							<div class="card-body p-4">
								<h2 class="card-title text-xl font-bold">
									Subcategories
								</h2>
								<ul class="menu w-full menu-sm rounded-box">
									<li>
										<button
											class={cn(
												"flex w-full justify-between rounded-xl",
												selected === "all"
													? "active bg-primary/10 font-semibold text-primary border-2 border-primary/20"
													: "hover:bg-base-200 transition-colors",
											)}
											onclick={() => onSelect("all")}
										>
											<span>All products</span>
											<span class="ml-auto">{total}</span>
										</button>
									</li>
									{#each subcategories as sc}
										<li>
											<button
												class={cn(
													"flex w-full justify-between rounded-xl",
													selected === sc.id
														? "active bg-primary/10 font-semibold text-primary border-2 border-primary/20"
														: "hover:bg-base-200 transition-colors",
												)}
												onclick={() => onSelect(sc.id)}
											>
												<span>{sc.name}</span>
												<span class="ml-auto"
													>{subCounts[sc.id] ?? 0}</span
												>
											</button>
										</li>
									{/each}
								</ul>
							</div>
						</div>
					</div>
				</aside>

				<!-- Product listing -->
				<div class="lg:col-span-8 xl:col-span-9">
					{#if loading && (visible?.length ?? 0) === 0}
						<div
							class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
						>
							{#each Array(8) as _, i}
								<div
									class="mx-auto w-full max-w-[270px] animate-pulse rounded-md border p-4 shadow-sm"
								>
									<div
										class="mb-4 h-36 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800"
									></div>
									<div class="space-y-2">
										<div
											class="h-4 w-[60%] rounded bg-zinc-200 dark:bg-zinc-800"
										></div>
										<div
											class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"
										></div>
										<div
											class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"
										></div>
										<div
											class="h-4 w-[40%] rounded bg-zinc-200 dark:bg-zinc-800"
										></div>
									</div>
								</div>
							{/each}
						</div>
					{:else if (visible?.length ?? 0) > 0}
						<div
							class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
						>
							{#each visible as p}
								<ProductCard
									href={`/products/${p.handle}`}
									title={p.title}
									image={p.thumbnail ??
										p.images?.[0]?.url ??
										""}
									price={(p?.variants ?? [])
										.map((v: any) => v?.calculated_price)
										.filter(Boolean)
										.reduce(
											(min: any, cur: any) =>
												(cur?.calculated_amount ??
													cur?.amount ??
													0) <
												(min?.calculated_amount ??
													min?.amount ??
													0)
													? cur
													: min,
											p?.variants?.[0]
												?.calculated_price ?? null,
										)}
									variantId={p?.variants?.[0]?.id ?? null}
								/>
							{/each}
						</div>
						{#if hasMore}
							<div class="mt-10 flex flex-col items-center gap-3">
								<button
									class="btn btn-primary btn-md gap-2 rounded-lg hover:shadow-md transition-all disabled:opacity-60"
									onclick={loadMore}
									disabled={loadingMore}
								>
									{#if loadingMore}
										<span class="loading loading-spinner loading-sm"></span>
										Loading...
									{:else}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
										Load More
									{/if}
								</button>
								
								<!-- Compact progress indicator -->
								<div class="flex items-center gap-3">
									<span class="text-xs text-base-content/60">
										{visible.length} / {currentCount}
									</span>
									<div class="w-32 h-1.5 bg-base-200 rounded-full overflow-hidden">
										<div 
											class="h-full bg-primary rounded-full transition-all duration-500"
											style="width: {(visible.length / currentCount) * 100}%"
										></div>
									</div>
								</div>
							</div>
						{:else if visible.length > 0 && visible.length >= currentCount}
							<div class="mt-10 text-center">
								<p class="text-xs text-base-content/50 flex items-center justify-center gap-1.5">
									<svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									All {currentCount} products loaded
								</p>
							</div>
						{/if}
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-base-300 py-16 text-center"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								class="mb-4 h-16 w-16 opacity-30"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M3 3h3l2 13h10l2-9H7"
								/>
								<circle cx="9" cy="20" r="1.5" />
								<circle cx="18" cy="20" r="1.5" />
							</svg>
							<h3 class="text-lg font-semibold">
								No Items Found
							</h3>
							<p class="mt-1 text-sm opacity-70">
								Try a different subcategory or check back later.
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/if}
