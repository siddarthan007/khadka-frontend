<script lang="ts">
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import Pill from '$lib/components/Pill.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { 
		generateOrganizationStructuredData, 
		generateWebsiteStructuredData,
		generateItemListStructuredData 
	} from '$lib/seo';
	
	let {
		data
	}: {
		data?: {
			slides: any[];
			collectionItems?: Array<{ title: string; handle: string; emoji?: string }>;
			categoryItems?: Array<{ name: string; handle: string; thumbnail?: string | null }>;
			initialProducts?: any[];
			initialCount?: number;
		};
	} = $props();
	const slides: any[] = data?.slides ?? [];
	const collections = (data?.collectionItems ?? []).slice(0, 10);
	const categories = (data?.categoryItems ?? []).slice(0, 10);
	let products: any[] = $state(data?.initialProducts ?? []);
	let totalCount: number = $state(data?.initialCount ?? 0);
	let isLoadingMore = $state(false);
	let currentOffset = $state(15); // Start from 15 since we loaded 15 initially
	const PRODUCTS_PER_PAGE = 15;

	// Check if there are more products to load
	let hasMore = $derived(products.length < totalCount);

	// Load more products function
	async function loadMoreProducts() {
		if (isLoadingMore || !hasMore) return;

		isLoadingMore = true;
		try {
			const response = await fetch(
				`/api/products/load-more?offset=${currentOffset}&limit=${PRODUCTS_PER_PAGE}`
			);
			
			if (!response.ok) throw new Error('Failed to load products');
			
			const result = await response.json();
			
			if (result.success && result.products.length > 0) {
				products = [...products, ...result.products];
				currentOffset = result.nextOffset;
				totalCount = result.count;
			}
		} catch (error) {
			console.error('Error loading more products:', error);
		} finally {
			isLoadingMore = false;
		}
	}

	const baseUrl = 'https://khadkafoods.com';
	
	// Enhanced structured data with ItemList - using $derived to track products changes
	let structuredData = $derived([
		generateOrganizationStructuredData({
			name: 'Khadka Foods',
			url: baseUrl,
			logo: `${baseUrl}/logo.png`,
			description: 'Premium quality groceries, fresh produce, and international foods delivered to your door. Shop authentic products from around the world.',
			socialLinks: [
				// Add your social media links here
				// 'https://facebook.com/khadkafoods',
				// 'https://twitter.com/khadkafoods',
				// 'https://instagram.com/khadkafoods'
			],
			contactPoint: {
				telephone: '+1-555-123-4567', // Update with real phone
				contactType: 'Customer Service',
				email: 'support@khadkafoods.com' // Update with real email
			}
		}),
		generateWebsiteStructuredData({
			name: 'Khadka Foods',
			url: baseUrl,
			searchUrl: `${baseUrl}/products`
		}),
		// Add ItemList for featured products
		generateItemListStructuredData({
			name: 'Featured Products',
			items: products.slice(0, 10).map((p, index) => ({
				position: index + 1,
				name: p.title || 'Product',
				url: `${baseUrl}/products/${p.handle}`,
				image: p.thumbnail || p.images?.[0]?.url
			}))
		})
	]);
</script>

<SEO
	title="Khadka Foods - Premium Quality Groceries & Fresh Produce Online"
	description="Shop premium quality groceries, fresh produce, and authentic international foods at Khadka Foods. ✓ Fast delivery ✓ Quality guaranteed ✓ Wide selection. Order now!"
	keywords={[
		'online grocery shopping',
		'fresh produce delivery',
		'international foods online',
		'ethnic grocery store',
		'premium groceries',
		'food delivery',
		'Khadka Foods',
		'authentic ingredients',
		'grocery delivery near me'
	]}
	canonical={baseUrl}
	ogImage={`${baseUrl}/logo.png`}
	ogType="website"
	ogLocale="en_US"
	ogSiteName="Khadka Foods"
	twitterSite="@khadkafoods"
	twitterCreator="@khadkafoods"
	structuredData={structuredData}
	maxImagePreview="large"
	maxSnippet={-1}
	maxVideoPreview={-1}
/>

<!-- Full-width carousel touching the sides -->
<section class="w-full py-4 sm:py-8">
	<HeroCarousel {slides} />
</section>

<LabeledSeparator gradient class="my-12" />

<!-- Shop by Countries -->
{#if collections.length > 0}
	<section aria-labelledby="countries-heading" class="w-full py-8 sm:py-16">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<header class="mb-8 flex items-end justify-between">
				<div>
					<h2 id="countries-heading" class="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
						Shop by Countries
					</h2>
					<p class="mt-2 text-base-content/60">Explore authentic flavors from around the world</p>
				</div>
				<a class="btn btn-outline btn-primary rounded-xl shadow-md hover:shadow-lg transition-all duration-300" href="/collections">
					View all →
				</a>
			</header>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each collections as c}
					<Pill
						href={`/collections/${c.handle}`}
						label={c.title}
						emoji={c.emoji ?? '🌍'}
						class="w-full"
					/>
				{/each}
			</div>
		</div>
	</section>
{/if}

<LabeledSeparator gradient class="my-12" />

<!-- Shop by Categories -->
{#if categories.length > 0}
	<section aria-labelledby="categories-heading" class="w-full py-8 sm:py-16">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<header class="mb-8 flex items-end justify-between">
				<div>
					<h2 id="categories-heading" class="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
						Shop by Categories
					</h2>
					<p class="mt-2 text-base-content/60">Find exactly what you're looking for</p>
				</div>
				<a class="btn btn-outline btn-primary rounded-xl shadow-md hover:shadow-lg transition-all duration-300" href="/categories">
					View all →
				</a>
			</header>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each categories as c}
					<Pill
						size="xl"
						href={`/categories/${c.handle}`}
						label={c.name}
						thumbnail={c.thumbnail ? { src: c.thumbnail, alt: c.name } : null}
						class="w-full"
					/>
				{/each}
			</div>
		</div>
	</section>
{/if}

<LabeledSeparator gradient class="my-12" />

<!-- General products -->
<section class="w-full py-8 sm:py-16">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8 flex items-end justify-between">
			<div>
				<h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary">
					Just for You
				</h2>
				<p class="mt-2 text-base-content/60">
					Handpicked products we think you'll love
				</p>
			</div>
			<a class="btn btn-outline btn-primary rounded-xl shadow-md hover:shadow-lg transition-all duration-300" href="/products">
				View all →
			</a>
		</header>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{#each products as p}
				<ProductCard
					href={`/products/${p.handle}`}
					title={p.title}
					image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
					price={(p?.variants ?? [])[0]?.calculated_price ?? null}
					variantId={(p?.variants ?? [])[0]?.id ?? null}
					createdAt={p?.created_at ?? null}
				/>
			{/each}
		</div>
		
		<!-- Load More Button -->
		{#if hasMore}
			<div class="mt-10 flex flex-col items-center gap-3">
				<button
					class="btn btn-primary btn-md gap-2 rounded-lg hover:shadow-md transition-all disabled:opacity-60"
					onclick={loadMoreProducts}
					disabled={isLoadingMore}
				>
					{#if isLoadingMore}
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
						{products.length} / {totalCount}
					</span>
					<div class="w-32 h-1.5 bg-base-200 rounded-full overflow-hidden">
						<div 
							class="h-full bg-primary rounded-full transition-all duration-500"
							style="width: {(products.length / totalCount) * 100}%"
						></div>
					</div>
				</div>
			</div>
		{:else if products.length > 0 && products.length >= totalCount}
			<div class="mt-10 text-center">
				<p class="text-xs text-base-content/50 flex items-center justify-center gap-1.5">
					<svg class="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					You've seen all {totalCount} products in our catalog.
				</p>
			</div>
		{/if}
	</div>
</section>
