<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import { cn } from '$lib/utils';
	import DoubleRange from '$lib/components/DoubleRange.svelte';
	import { ChevronRight, SearchX } from '@lucide/svelte';
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

<section class="w-full py-8">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-6 flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Products</h1>
				<p class="mt-1 text-base-content/70">{count} results</p>
			</div>
			<form onsubmit={() => applyFilters(true)} class="join">
				<input
					type="text"
					name="q"
					placeholder="Search products"
					bind:value={q}
					class="input-bordered input join-item input-primary"
				/>
				<button class="btn join-item btn-primary" type="submit">Search</button>
			</form>
		</header>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
			<aside class="lg:col-span-3">
				<div class="card border border-base-300 bg-base-100 shadow-xl">
					<div class="card-body space-y-4">
						<h2 class="card-title text-lg">Filters</h2>
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
						<div class="flex gap-2 pt-2">
							<button
								class="btn btn-sm btn-primary"
								onclick={() => applyFilters(true)}
								disabled={loading}
								class:loading>Apply</button
							>
							<button class="btn btn-ghost btn-sm" onclick={resetFilters}>Reset</button>
						</div>
					</div>
				</div>
			</aside>

			<div class="lg:col-span-9">
				{#if products.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<SearchX class="size-16 text-base-300" />
						<p class="mt-4 text-base-content/70">No items found. Try adjusting your filters.</p>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
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
							/>
						{/each}
					</div>
				{/if}
				{#if products.length < count}
					<div class="mt-6 flex justify-center">
						<button
							class="btn btn-primary"
							onclick={() => applyFilters(false)}
							disabled={loading}
							class:loading>Load more</button
						>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
