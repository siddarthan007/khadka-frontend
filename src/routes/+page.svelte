<script lang="ts">
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import Pill from '$lib/components/Pill.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
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

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.title = 'KhadkaFoods';
		}
	});
</script>

<svelte:head>
	<title>KhadkaFoods - Premium Quality Products & Fresh Groceries</title>
	<meta name="description" content="Discover premium quality products and fresh groceries at KhadkaFoods. Shop our curated collection of groceries, fresh produce, and household essentials with fast delivery." />
	<meta name="keywords" content="groceries, fresh produce, household essentials, online grocery store, premium products, food delivery" />
	<meta name="robots" content="index, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="KhadkaFoods - Premium Quality Products & Fresh Groceries" />
	<meta property="og:description" content="Discover premium quality products and fresh groceries at KhadkaFoods. Shop our curated collection with fast delivery." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="KhadkaFoods - Premium Quality Products & Fresh Groceries" />
	<meta name="twitter:description" content="Discover premium quality products and fresh groceries at KhadkaFoods. Shop our curated collection with fast delivery." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com" />
</svelte:head>

<!-- Full-width carousel on the homepage -->
<section class="w-full py-4 sm:py-6">
	<HeroCarousel {slides} />
</section>

<LabeledSeparator gradient class="my-10" />

<!-- Shop by Countries -->
{#if collections.length > 0}
	<section aria-labelledby="countries-heading" class="w-full py-6 sm:py-14">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<header class="mb-6 flex items-end justify-between">
				<h2 id="countries-heading" class="text-2xl font-bold tracking-tight">Shop by countries</h2>
				<a class="btn btn-outline btn-sm btn-primary" href="/collections">View all →</a>
			</header>
			<div class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

<LabeledSeparator gradient class="my-10" />

<!-- Shop by Categories -->
{#if categories.length > 0}
	<section aria-labelledby="categories-heading" class="w-full py-6 sm:py-14">
		<div class="container mx-auto px-4 sm:px-6 lg:px-8">
			<header class="mb-6 flex items-end justify-between">
				<h2 id="categories-heading" class="text-2xl font-bold tracking-tight">
					Shop by categories
				</h2>
				<a class="btn btn-outline btn-sm btn-primary" href="/categories">View all →</a>
			</header>
			<div class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4">
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

<LabeledSeparator gradient class="my-10" />

<!-- General products -->
<section class="w-full py-6 sm:py-14">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-6 flex items-end justify-between">
			<h2 class="text-2xl font-bold tracking-tight">Just for you</h2>
			<a class="btn btn-outline btn-sm btn-primary" href="/products">View all →</a>
		</header>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
