<script lang="ts">
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import Pill from '$lib/components/Pill.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { generateOrganizationStructuredData, generateWebsiteStructuredData } from '$lib/seo';
	
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
	let products: any[] = $state((data?.initialProducts ?? []).slice(0, 16));
	let totalCount: number = $state(data?.initialCount ?? products.length);

	const baseUrl = 'https://khadkafoods.com';
	
	// Combine organization and website structured data
	const structuredData = [
		generateOrganizationStructuredData({
			name: 'KhadkaFoods',
			url: baseUrl,
			logo: `${baseUrl}/logo.png`,
			socialLinks: []
		}),
		generateWebsiteStructuredData({
			name: 'KhadkaFoods',
			url: baseUrl,
			searchUrl: `${baseUrl}/products`
		})
	];
</script>

<SEO
	title="KhadkaFoods - Premium Quality Products & Fresh Groceries"
	description="Discover premium quality products and fresh groceries at KhadkaFoods. Shop our curated collection of groceries, fresh produce, and household essentials with fast delivery."
	keywords={['groceries', 'fresh produce', 'household essentials', 'online grocery store', 'premium products', 'food delivery', 'KhadkaFoods']}
	canonical={baseUrl}
	ogImage={`${baseUrl}/logo.png`}
	ogType="website"
	structuredData={structuredData}
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
				<p class="mt-2 text-base-content/60">Handpicked products we think you'll love</p>
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
	</div>
</section>
