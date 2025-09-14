<script lang="ts">
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import Pill from '$lib/components/Pill.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	let { data }: { data?: { slides: any[]; collectionItems?: Array<{ title: string; handle: string; emoji?: string }>; categoryItems?: Array<{ name: string; handle: string; thumbnail?: string | null }>; initialProducts?: any[]; initialCount?: number } } = $props();
	const slides: any[] = data?.slides ?? [];
	const collections = (data?.collectionItems ?? []).slice(0, 10);
	const categories = (data?.categoryItems ?? []).slice(0, 10);
	let products: any[] = $state((data?.initialProducts ?? []).slice(0, 16));
	let totalCount: number = $state(data?.initialCount ?? products.length);

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.title = 'KhadkaFoods'
		}
	})
</script>

<!-- Center the carousel on the homepage -->
<section class="w-full py-4 sm:py-6">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-center">
			<HeroCarousel {slides} />
		</div>
	</div>
</section>

<LabeledSeparator gradient class="my-10" />

<!-- Shop by Countries -->
{#if collections.length > 0}
<section aria-labelledby="countries-heading" class="w-full py-6 sm:py-14">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-6 flex items-end justify-between">
			<h2 id="countries-heading" class="text-2xl font-bold tracking-tight">Shop by countries</h2>
			<a class="btn btn-sm btn-outline" href="/collections">View all →</a>
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
			<h2 id="categories-heading" class="text-2xl font-bold tracking-tight">Shop by categories</h2>
			<a class="btn btn-sm btn-outline" href="/categories">View all →</a>
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
			<a class="btn btn-sm btn-outline" href="/products">View all →</a>
		</header>
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
