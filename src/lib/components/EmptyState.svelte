<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		message?: string;
		icon?: 'cart' | 'box' | 'search' | 'heart';
		actionText?: string;
		actionHref?: string;
		class?: string;
		description?: string;
	}

	let {
		message = 'Nothing to see here yet',
		icon = 'box',
		actionText,
		actionHref,
		class: className = '',
		description = 'Start exploring our products to fill this space'
	}: Props = $props();

	const icons = {
		cart: `<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
		</svg>`,
		box: `<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
		</svg>`,
		search: `<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>`,
		heart: `<svg class="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
		</svg>`
	};
</script>

<div class="flex min-h-[400px] flex-col items-center justify-center py-12 px-4 text-center {className}">
	<!-- Icon with animation -->
	<div class="mb-6 text-gray-300 dark:text-gray-600 animate-float">
		{@html icons[icon]}
	</div>

	<!-- Message -->
	<h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
		{message}
	</h3>
	<p class="mb-8 text-gray-600 dark:text-gray-400 max-w-md">
		{description}
	</p>

	<!-- Action button (if provided) -->
	{#if actionText && actionHref}
		<a
			href={actionHref}
			class="btn btn-primary rounded-xl btn-lg shadow-lg hover:shadow-xl transition-shadow"
		>
			{actionText}
			<svg class="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 7l5 5m0 0l-5 5m5-5H6"
				/>
			</svg>
		</a>
	{/if}
</div>

<style>
	@keyframes float {
		0%,
		100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	.animate-float {
		animation: float 3s ease-in-out infinite;
	}
</style>
