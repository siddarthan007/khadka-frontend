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

{#if collection}
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
