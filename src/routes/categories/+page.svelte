<script lang="ts">
	import Pill from '$lib/components/Pill.svelte'
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte'
	let { data }: { data?: { topLevel: Array<{ name: string; handle: string; thumbnail?: string | null }> } } = $props();
	const topLevel = data?.topLevel ?? []
</script>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight">All categories</h1>
			<p class="text-base-content/70 mt-1">Browse all top-level categories.</p>
		</header>
		<div class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4">
			{#each topLevel as c}
				<Pill size="lg" href={`/categories/${c.handle}`} label={c.name} thumbnail={c.thumbnail ? { src: c.thumbnail, alt: c.name } : null} class="w-full" />
			{/each}
		</div>
	</div>
</section>
