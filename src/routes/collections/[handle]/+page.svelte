<script lang="ts">
	import ProductCard from '$lib/components/ProductCard.svelte';
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

	$effect(() => {
		if (typeof document !== 'undefined') {
			const c = collection as any;
			document.title = `${c?.title ?? c?.handle ?? 'Collection'} • KhadkaFoods`;
		}
	});
</script>

<svelte:head>
	<title>{collection?.title ? `${collection.title} • KhadkaFoods` : 'Collection • KhadkaFoods'}</title>
	<meta name="description" content={collection?.description ? `${collection.description.slice(0, 150)}${collection.description.length > 150 ? '...' : ''}` : `Browse our ${collection?.title ?? 'premium'} collection of quality products at KhadkaFoods.`} />
	<meta name="keywords" content={`collection, ${collection?.title ?? 'products'}, groceries, premium products, KhadkaFoods collections`} />
	<meta name="robots" content="index, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content={collection?.title ?? 'Collection'} />
	<meta property="og:description" content={collection?.description ?? `Browse our premium collection at KhadkaFoods`} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={`https://khadkafoods.com/collections/${collection?.handle ?? ''}`} />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={collection?.title ?? 'Collection'} />
	<meta name="twitter:description" content={collection?.description ?? `Browse our premium collection at KhadkaFoods`} />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href={`https://khadkafoods.com/collections/${collection?.handle ?? ''}`} />
</svelte:head>

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
