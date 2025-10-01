<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { generateBreadcrumbStructuredData } from '$lib/seo';
	import { cn } from '$lib/utils';
	import { page } from '$app/state';

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
	const structuredData = [generateBreadcrumbStructuredData(breadcrumbs)];
</script>

{#if collection}
	<SEO
		title={`${collection.title} - KhadkaFoods`}
		description={collection.description || `Browse our ${collection.title} collection of quality products at KhadkaFoods.`}
		keywords={['collection', collection.title, 'groceries', 'premium products', 'KhadkaFoods']}
		canonical={`${baseUrl}/collections/${collection.handle}`}
		ogImage={`${baseUrl}/logo.png`}
		structuredData={structuredData}
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
