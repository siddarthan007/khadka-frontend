<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		gradient = false,
		class: className = '',
		label,
		children
	}: {
		gradient?: boolean;
		class?: string;
		label?: Snippet;
		children?: Snippet;
	} = $props();
</script>

{#if label}
	<div class="flex w-full items-center">
		<div
			class={cn(
				'h-[1px] w-full rounded-full',
				gradient
					? 'bg-gradient-to-r from-transparent to-zinc-500 dark:from-zinc-800 dark:to-zinc-400'
					: 'bg-zinc-300 dark:bg-zinc-800',
				className
			)}
		></div>
		<div
			class="mx-3 w-fit text-xs tracking-wider text-nowrap text-gray-600 uppercase sm:text-sm dark:text-gray-300"
		>
			{@render label()}
		</div>
		<div
			class={cn(
				'h-[1px] w-full rounded-full',
				gradient
					? 'bg-gradient-to-r from-zinc-500 to-transparent dark:from-zinc-200 dark:to-zinc-700'
					: 'bg-zinc-300 dark:bg-zinc-800',
				className
			)}
		></div>
	</div>
{:else if children}
	{@render children()}
{:else}
	<div
		class={cn(
			'h-[1px] w-full rounded-full',
			gradient
				? 'bg-gradient-to-r from-transparent via-zinc-500 to-transparent dark:from-zinc-800 dark:via-zinc-200 dark:to-zinc-700'
				: 'bg-zinc-300 dark:bg-zinc-800',
			className
		)}
	></div>
{/if}
