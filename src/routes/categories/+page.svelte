<script lang="ts">
	import Pill from '$lib/components/Pill.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	let {
		data
	}: { data?: { topLevel: Array<{ name: string; handle: string; thumbnail?: string | null }> } } =
		$props();
	const topLevel = data?.topLevel ?? [];
</script>

<svelte:head>
	<title>Categories • KhadkaFoods - Browse Product Categories</title>
	<meta name="description" content="Browse all product categories at KhadkaFoods. Find fresh produce, groceries, household essentials, and more organized by category." />
	<meta name="keywords" content="categories, product categories, groceries categories, fresh produce, household essentials, food categories" />
	<meta name="robots" content="index, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Categories • KhadkaFoods - Browse Product Categories" />
	<meta property="og:description" content="Browse all product categories at KhadkaFoods. Find fresh produce, groceries, household essentials, and more." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/categories" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Categories • KhadkaFoods - Browse Product Categories" />
	<meta name="twitter:description" content="Browse all product categories at KhadkaFoods. Find fresh produce, groceries, household essentials, and more." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/categories" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight">All categories</h1>
			<p class="mt-1 text-base-content/70">Browse all top-level categories.</p>
		</header>
		<div class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4">
			{#each topLevel as c}
				<Pill
					size="lg"
					href={`/categories/${c.handle}`}
					label={c.name}
					thumbnail={c.thumbnail ? { src: c.thumbnail, alt: c.name } : null}
					class="w-full"
				/>
			{/each}
		</div>
	</div>
</section>
