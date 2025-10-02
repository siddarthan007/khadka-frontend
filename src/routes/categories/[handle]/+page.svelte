<script lang="ts">
	import { createAccordion, melt } from '@melt-ui/svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { 
		generateBreadcrumbStructuredData,
		generateCollectionPageStructuredData,
		generateItemListStructuredData,
		generateOptimizedTitle,
		generateOptimizedDescription
	} from '$lib/seo';
	import { cn } from '$lib/utils';
	import { listProductsByCategoryIds } from '$lib/medusa';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { logger } from '$lib/logger';
	import { trackViewItemList } from '$lib/utils/analytics';
	let {
		data
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
	const products = data?.products ?? [];
	const total = data?.total ?? 0;
	const subCounts = data?.subCounts ?? {};
	// allIds is provided by the loader but optional
	const allIds: string[] = (data as any)?.allIds ?? [];
	let currency = $state(
		(products?.[0]?.variants?.[0]?.calculated_price?.currency_code ?? 'USD').toUpperCase()
	);

	// sidebar selection: 'all' | subcat.id
	let selected: string = $state('all');
	let loading = $state(false);
	let visible = $state(products);
	let activeLabel: string = $state('All products');

	const baseUrl = 'https://khadkafoods.com';
	const breadcrumbs = [
		{ name: 'Home', url: baseUrl },
		{ name: 'Categories', url: `${baseUrl}/categories` },
		{ name: category?.name || 'Category', url: `${baseUrl}/categories/${category?.handle || ''}` }
	];
	
	// Enhanced structured data
	const structuredData = [
		generateBreadcrumbStructuredData(breadcrumbs),
		generateCollectionPageStructuredData({
			name: category?.name || 'Category',
			description: category?.description || `Explore our ${category?.name} category with premium quality products.`,
			url: `${baseUrl}/categories/${category?.handle}`,
			hasPart: products.slice(0, 10).map(p => ({
				url: `${baseUrl}/products/${p.handle}`,
				name: p.title
			}))
		}),
		generateItemListStructuredData({
			name: `${category?.name} Products`,
			items: products.slice(0, 20).map((p, index) => ({
				position: index + 1,
				name: p.title,
				url: `${baseUrl}/products/${p.handle}`,
				image: p.thumbnail || p.images?.[0]?.url
			}))
		})
	];
	
	// Generate optimized SEO content
	const seoTitle = category?.name 
		? generateOptimizedTitle(category.name, undefined, 'category')
		: 'Category | Khadka Foods';
	
	const seoDescription = category?.name
		? generateOptimizedDescription(category.name, {
				type: 'category',
				usps: ['Premium Quality', 'Wide Selection', 'Fast Delivery', 'Best Prices']
			})
		: 'Browse our category of premium products at Khadka Foods.';

	onMount(() => {
		const qs = new URLSearchParams(page.url.search);
		const sub = qs.get('sub');
		if (sub && sub !== 'all') {
			selected = sub;
			loadFor(sub);
		}
		
		// Track view_item_list event for category page
		try {
			const items = products.map((p: any, index: number) => ({
				item_id: p.variants?.[0]?.id || p.id,
				item_name: p.title || 'Unknown Product',
				price: p.variants?.[0]?.calculated_price?.calculated_amount || 0,
				quantity: 1,
				item_category: category?.name || '',
				index
			}));
			trackViewItemList(items, `Category: ${category?.name || 'Unknown'}`, category?.id);
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
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
		try {
			loading = true;
			if (targetId === 'all') {
				visible = products;
				return;
			}
			const node = findNodeById(subcategories, targetId);
			const ids = node ? collectIds(node) : [];
			const { products: prods } = await listProductsByCategoryIds(ids, {
				limit: 24,
				offset: 0,
				fields: 'title,handle,thumbnail,*variants.calculated_price'
			});
			visible = prods ?? [];
		} catch (e) {
			logger.error(e);
			visible = [];
		} finally {
			loading = false;
		}
	}

	async function onSelect(id: string) {
		selected = id;
		const url = new URL(page.url);
		if (id === 'all') url.searchParams.delete('sub');
		else url.searchParams.set('sub', id);
		await goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true });
		await tick();
		loadFor(id);
	}
</script>

{#if category}
	<SEO
		title={seoTitle}
		description={seoDescription}
		keywords={[
			category.name,
			`${category.name} products`,
			`buy ${category.name}`,
			'groceries online',
			'international foods',
			'Khadka Foods'
		]}
		canonical={`${baseUrl}/categories/${category.handle}`}
		ogImage={category.thumbnail || `${baseUrl}/logo.png`}
		ogType="website"
		ogLocale="en_US"
		ogSiteName="Khadka Foods"
		twitterSite="@khadkafoods"
		twitterCreator="@khadkafoods"
		structuredData={structuredData}
		maxImagePreview="large"
		maxSnippet={-1}
	/>
{/if}

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
					{selected === 'all'
						? category?.name
						: (findNodeById(subcategories, selected)?.name ?? category?.name)}
				</h1>
				{#if selected !== 'all'}
					<p class="mt-1 text-sm opacity-70">{subCounts[selected] ?? 0} products</p>
				{:else}
					<p class="mt-1 text-sm opacity-70">{total} products</p>
				{/if}
			</div>
		</header>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
			<!-- Sidebar -->
			<aside class="lg:col-span-4 xl:col-span-3">
				<div class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl">
					<div class="card-body p-4">
						<h2 class="card-title text-xl font-bold">Subcategories</h2>
						<ul class="menu w-full menu-sm rounded-box">
							<li>
								<button
									class={cn(
										'flex w-full justify-between rounded-xl',
										selected === 'all'
											? 'active bg-primary/10 font-semibold text-primary border-2 border-primary/20'
											: 'hover:bg-base-200 transition-colors'
									)}
									onclick={() => onSelect('all')}
								>
									<span>All products</span>
									<span class="ml-auto">{total}</span>
								</button>
							</li>
							{#each subcategories as sc}
								<li>
									<button
										class={cn(
											'flex w-full justify-between rounded-xl',
											selected === sc.id
												? 'active bg-primary/10 font-semibold text-primary border-2 border-primary/20'
												: 'hover:bg-base-200 transition-colors'
										)}
										onclick={() => onSelect(sc.id)}
									>
										<span>{sc.name}</span>
										<span class="ml-auto">{subCounts[sc.id] ?? 0}</span>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</aside>

			<!-- Product listing -->
			<div class="lg:col-span-8 xl:col-span-9">
				{#if loading}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
						{#each Array(8) as _, i}
							<div
								class="mx-auto w-full max-w-[270px] animate-pulse rounded-md border p-4 shadow-sm"
							>
								<div class="mb-4 h-36 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800"></div>
								<div class="space-y-2">
									<div class="h-4 w-[60%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[40%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if (visible?.length ?? 0) > 0}
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
						{#each visible as p}
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
							/>
						{/each}
					</div>
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
						<h3 class="text-lg font-semibold">No Items Found</h3>
						<p class="mt-1 text-sm opacity-70">Try a different subcategory or check back later.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
