<script lang="ts">
	import Pill from '$lib/components/Pill.svelte';
	import SEO from '$lib/components/SEO.svelte';
	let {
		data
	}: {
		data?: {
			collections: Array<{
				name: string;
				handle: string;
				thumbnail?: string | null;
				emoji?: string;
			}>;
		};
	} = $props();
	const items = (data?.collections ?? []).slice().reverse();

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.title = 'Collections • Khadka Foods';
		}
	});
</script>

<SEO
	title="Collections • Khadka Foods"
	description="Explore our carefully curated product collections at Khadka Foods. Find themed collections of premium groceries, fresh produce, and household essentials."
	keywords={['collections', 'product collections', 'curated products', 'groceries collections', 'household essentials', 'themed products']}
	canonical="https://khadkafoods.com/collections"
	ogType="website"
/>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight">All collections</h1>
			<p class="mt-1 text-base-content/70">Browse all collections.</p>
		</header>
		<div
			class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5"
		>
			{#each items as c}
				<Pill
					href={`/collections/${c.handle}`}
					label={c.name}
					emoji={c.emoji ?? '🌍'}
					class="w-full"
				/>
			{/each}
		</div>
	</div>
</section>
