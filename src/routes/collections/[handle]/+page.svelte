<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { 
		generateBreadcrumbStructuredData,
		generateCollectionPageStructuredData,
		generateItemListStructuredData,
		generateOptimizedTitle,
		generateOptimizedDescription
	} from '$lib/seo';
	import { cn } from '$lib/utils';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { trackViewItemList } from '$lib/utils/analytics';
	import { logger } from '$lib/logger';

	let { data }: { data?: { collection: any; products: any[]; total: number } } = $props();
	const collection = data?.collection;
	const products = data?.products ?? [];
	const total = data?.total ?? 0;

	function minPrice(p: any) {
		const cps = (p?.variants ?? []).map((v: any) => v?.calculated_price).filter(Boolean);
		if (cps.length === 0) return '';
		return cps.reduce(
			(min: any, cur: any) =>
				(cur?.calculated_amount ?? cur?.amount ?? 0) < (min?.calculated_amount ?? min?.amount ?? 0)
					? cur
					: min,
			cps[0]
		);
	}

	function defaultVariantId(p: any) {
		return p?.variants?.[0]?.id ?? null;
	}

	const baseUrl = 'https://khadkafoods.com';
	const breadcrumbs = [
		{ name: 'Home', url: baseUrl },
		{ name: 'Collections', url: `${baseUrl}/collections` },
		{ name: collection?.title || 'Collection', url: `${baseUrl}/collections/${collection?.handle || ''}` }
	];
	
	// Enhanced structured data
	const structuredData = [
		generateBreadcrumbStructuredData(breadcrumbs),
		generateCollectionPageStructuredData({
			name: collection?.title || 'Collection',
			description: collection?.metadata?.description as string || `Explore our ${collection?.title} collection of premium products.`,
			url: `${baseUrl}/collections/${collection?.handle}`,
			hasPart: products.slice(0, 10).map(p => ({
				url: `${baseUrl}/products/${p.handle}`,
				name: p.title
			}))
		}),
		generateItemListStructuredData({
			name: `${collection?.title} Collection`,
			items: products.slice(0, 20).map((p, index) => ({
				position: index + 1,
				name: p.title,
				url: `${baseUrl}/products/${p.handle}`,
				image: p.thumbnail || p.images?.[0]?.url
			}))
		})
	];
	
	// Generate optimized SEO content
	const seoTitle = collection?.title 
		? generateOptimizedTitle(collection.title, undefined, 'collection')
		: 'Collection | Khadka Foods';
	
	const seoDescription = collection?.title
		? generateOptimizedDescription(collection.title, {
				type: 'collection',
				usps: ['Authentic Products', 'Premium Quality', 'Fast Shipping', 'Best Selection']
			})
		: 'Browse our collection of premium products at Khadka Foods.';
	
	// Track view_item_list event for collection page
	onMount(() => {
		try {
			const items = products.map((p: any, index: number) => ({
				item_id: p.variants?.[0]?.id || p.id,
				item_name: p.title || 'Unknown Product',
				price: p.variants?.[0]?.calculated_price?.calculated_amount || 0,
				quantity: 1,
				item_category: collection?.title || '',
				index
			}));
			trackViewItemList(items, `Collection: ${collection?.title || 'Unknown'}`, collection?.id);
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
		}
	});
</script>

{#if !collection}
	<!-- Collection Not Found Section -->
	<section class="w-full py-12 sm:py-16 min-h-[calc(100vh-200px)]">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<div class="max-w-2xl mx-auto text-center">
				
				<!-- Icon Illustration -->
				<div class="flex justify-center mb-8">
					<svg
						class="w-24 h-24 sm:w-32 sm:h-32 text-base-content/30 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>

				<!-- Title -->
				<h1 class="text-4xl sm:text-5xl font-bold mb-4 text-base-content">
					Collection Not Found
				</h1>

				<!-- Subtitle -->
				<p class="text-base sm:text-lg text-base-content/70 mb-10 max-w-md mx-auto">
					This collection took a trip to a different country and forgot to leave a forwarding address!
				</p>

				<!-- Divider -->
				<div class="divider my-8"></div>

				<!-- Action Buttons -->
				<div class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
					<a href="/collections" class="btn btn-primary gap-2 min-w-[160px]">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
						All Collections
					</a>

					<a href="/products" class="btn btn-outline gap-2 min-w-[160px]">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
						</svg>
						Browse Products
					</a>
				</div>

				<!-- Quick Links -->
				<div class="divider divider-neutral text-xs text-base-content/60">or explore</div>
				
				<div class="flex flex-wrap gap-2 justify-center">
					<a href="/categories" class="link link-hover text-sm">Categories</a>
					<span class="text-base-content/50">•</span>
					<a href="/" class="link link-hover text-sm">Home</a>
					<span class="text-base-content/50">•</span>
					<a href="/cart" class="link link-hover text-sm">Cart</a>
				</div>
			</div>
		</div>
	</section>
{:else if collection}
	<SEO
		title={seoTitle}
		description={seoDescription}
		keywords={[
			collection.title,
			`${collection.title} collection`,
			`buy ${collection.title}`,
			'authentic products',
			'international foods',
			'Khadka Foods'
		]}
		canonical={`${baseUrl}/collections/${collection.handle}`}
		ogImage={`${baseUrl}/logo.png`}
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

{#key collection?.id ?? collection?.handle ?? 'unknown'}
	<section class="w-full py-8">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<nav class="breadcrumbs mb-4 text-sm">
				<ul>
					<li><a href="/">Home</a></li>
					<li><a href="/collections">Collections</a></li>
					<li class="text-base-content/70">{collection?.title ?? collection?.handle}</li>
				</ul>
			</nav>

			<header class="mb-6 flex items-end justify-between">
				<div>
					<h1 class="text-3xl font-bold tracking-tight">
						{collection?.title ?? collection?.handle}
					</h1>
					<p class="mt-1 text-base-content/70">{total} products</p>
				</div>
			</header>

			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
				<div class="lg:col-span-12">
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
						{#each products as p}
							<ProductCard
								href={`/products/${p.handle}`}
								title={p.title ?? 'Untitled'}
								image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
								price={minPrice(p)}
								variantId={defaultVariantId(p)}
								createdAt={p?.created_at ?? null}
							/>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</section>
{/key}
