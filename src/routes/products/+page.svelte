<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import ProductGridSkeleton from '$lib/components/ProductGridSkeleton.svelte';
	import QuickViewModal from '$lib/components/QuickViewModal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { cn } from '$lib/utils';
	import DoubleRange from '$lib/components/DoubleRange.svelte';
	import { ChevronRight, SearchX } from '@lucide/svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { onMount } from 'svelte';
	import { trackViewItemList, trackEvent } from '$lib/utils/analytics';
	import { logger } from '$lib/logger';
	
	let {
		data
	}: {
		data?: {
			products: any[];
			count: number;
			limit: number;
			offset: number;
			page: number;
			q?: string;
			categories?: any[];
			collections?: any[];
		};
	} = $props();
	let products = $state(data?.products ?? []);
	let count = $state(data?.count ?? 0);
	let q = $state(data?.q ?? '');
	const pageLimit = 24;
	let offset = $state(data?.products?.length ?? 0);

	// filters
	let selectedCategories: string[] = $state([]);
	let selectedCollections: string[] = $state([]);
	let priceMin: number = $state(0);
	let priceMax: number = $state(100);
	const categories = data?.categories ?? [];
	const collections = data?.collections ?? [];
	let loading = $state(false);
	
	// Quick view modal state
	let quickViewProduct: any = $state(null);

	function openQuickView(product: any) {
		quickViewProduct = product;
		
		// Track quick view trigger
		try {
			trackEvent('quick_view_trigger', {
				item_id: product.id,
				item_name: product.title || 'Unknown Product',
				source: 'products_page'
			});
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
		}
	}
	
	// Track view_item_list event for products page
	onMount(() => {
		try {
			const items = products.map((p: any, index: number) => ({
				item_id: p.variants?.[0]?.id || p.id,
				item_name: p.title || 'Unknown Product',
				price: p.variants?.[0]?.calculated_price?.calculated_amount || 0,
				quantity: 1,
				item_category: p.collection?.title || '',
				index
			}));
			trackViewItemList(items, 'All Products', 'products_page');
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
		}
	});

	function closeQuickView() {
		quickViewProduct = null;
	}

	$effect(() => {
		if (typeof document !== 'undefined') document.title = 'Products • KhadkaFoods';
	});

	async function applyFilters(reset = true) {
		loading = true;
		try {
			const params = new URLSearchParams();
			params.set('limit', String(reset ? pageLimit : pageLimit));
			params.set('offset', String(reset ? 0 : offset));
			if (q.trim()) params.set('q', q.trim());
			selectedCategories.forEach((id) => params.append('category_id', id));
			selectedCollections.forEach((id) => params.append('collection_id', id));
			if (priceMin != null) params.set('price_min', String(priceMin));
			if (priceMax != null) params.set('price_max', String(priceMax));
			const res = await fetch(`/api/products?${params.toString()}`);
			const json = await res.json();
			if (reset) {
				products = json.products ?? [];
				offset = products.length;
			} else {
				products = [...products, ...(json.products ?? [])];
				offset = products.length;
			}
			count = json.count ?? count;
			
			// Track filter application
			try {
				trackEvent('products_filter', {
					categories_count: selectedCategories.length,
					collections_count: selectedCollections.length,
					price_range: `${priceMin}-${priceMax}`,
					results_count: count,
					has_search: q.trim().length > 0
				});
			} catch (e) {
				logger.warn('Analytics tracking failed:', e);
			}
		} finally {
			loading = false;
		}
	}

	function resetFilters() {
		selectedCategories = [];
		selectedCollections = [];
		priceMin = 0;
		priceMax = 100;
		applyFilters(true);
	}

	function toggleCategory(id: string, checked: boolean) {
		selectedCategories = checked
			? [...selectedCategories, id]
			: selectedCategories.filter((x) => x !== id);
	}

	function toggleCollection(id: string) {
		selectedCollections = selectedCollections.includes(id)
			? selectedCollections.filter((x) => x !== id)
			: [...selectedCollections, id];
	}
</script>

<SEO
	title="Products • KhadkaFoods"
	description="Browse our wide selection of premium groceries, fresh produce, and household essentials. Find quality products at great prices."
	keywords={['products', 'groceries', 'fresh produce', 'household essentials', 'shop online']}
	canonical="https://khadkafoods.com/products"
	ogType="website"
/>

<svelte:head>
	<title>All Products • KhadkaFoods - Premium Quality Groceries & Essentials</title>
	<meta name="description" content="Browse our complete collection of premium quality products, fresh groceries, and household essentials at KhadkaFoods. Find everything you need with fast delivery." />
	<meta name="keywords" content="products, groceries, fresh food, household essentials, premium products, online shopping, food delivery" />
	<meta name="robots" content="index, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="All Products • KhadkaFoods - Premium Quality Groceries & Essentials" />
	<meta property="og:description" content="Browse our complete collection of premium quality products, fresh groceries, and household essentials at KhadkaFoods." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/products" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="All Products • KhadkaFoods - Premium Quality Groceries & Essentials" />
	<meta name="twitter:description" content="Browse our complete collection of premium quality products, fresh groceries, and household essentials at KhadkaFoods." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/products" />
</svelte:head>

<section class="w-full py-8 min-h-screen">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
			<div>
				<h1 class="text-4xl font-extrabold tracking-tight text-primary">All Products</h1>
				<p class="mt-2 text-base-content/60">{count} {count === 1 ? 'product' : 'products'} found</p>
			</div>
			<form onsubmit={() => applyFilters(true)} class="join shadow-md w-full sm:w-auto rounded-xl">
				<input
					type="text"
					name="q"
					placeholder="Search products..."
					bind:value={q}
					class="input input-bordered join-item input-primary border-2 bg-base-100 focus:border-primary transition-all rounded-l-xl w-full sm:w-64"
				/>
				<button class="btn join-item btn-primary rounded-r-xl" type="submit">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
					Search
				</button>
			</form>
		</header>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
			<aside class="lg:col-span-3">
				<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl sticky top-24">
					<div class="card-body space-y-6 p-6">
						<h2 class="card-title text-xl font-bold flex items-center gap-2">
							<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
							Filters
						</h2>
						<div>
							<div class="mb-2 text-sm font-medium">Categories</div>
							<!-- Tree UI -->
							<ul class="space-y-1">
								{#each categories as cat}
									<li>
										<details class="group">
											<summary class="flex cursor-pointer items-center gap-2">
												<ChevronRight class="size-3 transition-transform group-open:rotate-90" />
												<input
													type="checkbox"
													checked={selectedCategories.includes(cat.id)}
													onchange={(e) =>
														toggleCategory(cat.id, (e.target as HTMLInputElement).checked)}
												/>
												<span>{cat.name}</span>
											</summary>
											{#if (cat.children?.length ?? 0) > 0}
												<ul class="ml-4 border-l pl-3">
													{#each cat.children as child}
														<li>
															<details class="group">
																<summary class="flex cursor-pointer items-center gap-2">
																	<ChevronRight
																		class="size-3 transition-transform group-open:rotate-90"
																	/>
																	<input
																		type="checkbox"
																		checked={selectedCategories.includes(child.id)}
																		onchange={(e) =>
																			toggleCategory(
																				child.id,
																				(e.target as HTMLInputElement).checked
																			)}
																	/>
																	<span>{child.name}</span>
																</summary>
																{#if (child.children?.length ?? 0) > 0}
																	<ul class="ml-4 border-l pl-3">
																		{#each child.children as gchild}
																			<li>
																				<label class="flex cursor-pointer items-center gap-2">
																					<input
																						type="checkbox"
																						checked={selectedCategories.includes(gchild.id)}
																						onchange={(e) =>
																							toggleCategory(
																								gchild.id,
																								(e.target as HTMLInputElement).checked
																							)}
																					/>
																					<span>{gchild.name}</span>
																				</label>
																			</li>
																		{/each}
																	</ul>
																{/if}
															</details>
														</li>
													{/each}
												</ul>
											{/if}
										</details>
									</li>
								{/each}
							</ul>
						</div>
						<div>
							<div class="mb-2 text-sm font-medium">Collections</div>
							<div class="flex max-h-40 flex-wrap gap-2 overflow-auto pr-1">
								{#each collections as col}
									<button
										type="button"
										class={cn(
											'top-2 left-2 badge cursor-pointer gap-1 rounded-full badge-sm px-2.5 py-0.5 shadow',
											selectedCollections.includes(col.id) ? 'badge-primary' : 'badge-outline'
										)}
										onclick={() => toggleCollection(col.id)}
									>
										<span>{col.title}</span>
									</button>
								{/each}
							</div>
						</div>
						<div>
							<div class="mb-2 text-sm font-medium">Price</div>
							<div class="px-2">
								<DoubleRange
									min={0}
									max={100}
									step={1}
									value={[priceMin, priceMax]}
									minGap={1}
									onInput={(v) => {
										priceMin = v[0];
										priceMax = v[1];
									}}
									onChange={(v) => {
										priceMin = v[0];
										priceMax = v[1];
									}}
								/>
							</div>
						</div>
						<div class="flex gap-2 pt-4">
							<button
								class="btn btn-sm btn-primary flex-1 rounded-xl shadow-md hover:shadow-lg transition-all"
								onclick={() => applyFilters(true)}
								disabled={loading}
								class:loading>
								{#if loading}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
								Apply
							</button>
							<button class="btn btn-ghost btn-sm rounded-xl" onclick={resetFilters}>Reset</button>
						</div>
					</div>
				</div>
			</aside>

			<div class="lg:col-span-9">
				{#if loading && products.length === 0}
					<!-- Show skeleton on initial load -->
					<ProductGridSkeleton count={12} />
				{:else if products.length === 0}
					<EmptyState
						message="No products found"
						icon="search"
						description="Try adjusting your filters or search query to find what you're looking for"
						actionText="Reset Filters"
						actionHref="javascript:void(0)"
						class="min-h-[500px]"
					/>
					<button
						class="btn btn-primary btn-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 mx-auto block mt-4"
						onclick={resetFilters}
					>
						Reset Filters
					</button>
				{:else}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
						{#each products as p}
							<ProductCard
								href={`/products/${p.handle}`}
								title={p.title}
								image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
								price={(p?.variants ?? [])
									.map((v: any) => v?.calculated_price)
									.filter(Boolean)
									.reduce(
										(min: any, cur: any) =>
											(cur?.calculated_amount ?? cur?.amount ?? 0) <
											(min?.calculated_amount ?? min?.amount ?? 0)
												? cur
												: min,
										p?.variants?.[0]?.calculated_price ?? null
									)}
								variantId={p?.variants?.[0]?.id ?? null}
								createdAt={p?.created_at ?? null}
								onQuickView={() => openQuickView(p)}
							/>
						{/each}
					</div>
				{/if}
				{#if products.length < count}
					<div class="mt-8 flex justify-center">
						<button
							class="btn btn-primary btn-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
							onclick={() => applyFilters(false)}
							disabled={loading}
							class:loading>
							{#if loading}
								<span class="loading loading-spinner"></span>
							{/if}
							Load more
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<!-- Quick View Modal -->
{#if quickViewProduct}
	<QuickViewModal product={quickViewProduct} onClose={closeQuickView} />
{/if}
