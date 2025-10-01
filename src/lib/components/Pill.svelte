<script lang="ts">
	import { Motion, useMotionValue, useMotionTemplate } from 'svelte-motion';
	import { cn } from '$lib/utils';

	type Thumbnail = { src: string; alt?: string };

	let {
		label,
		href = '#',
		emoji = null,
		thumbnail = null,
		class: className = '',
		size = 'md',
		gradientSize = 200,
		gradientColor = 'rgba(134,120,249,0.35)',
		gradientOpacity = 0.6
	}: {
		label: string;
		href?: string;
		emoji?: string | null;
		thumbnail?: Thumbnail | null;
		class?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		gradientSize?: number;
		gradientColor?: string;
		gradientOpacity?: number;
	} = $props();

	let gradSize = useMotionValue(gradientSize);
	let gradColor = useMotionValue(gradientColor);
	let mouseX = useMotionValue(-gradientSize);
	let mouseY = useMotionValue(-gradientSize);
	let bg = useMotionTemplate`radial-gradient(${gradSize}px circle at ${mouseX}px ${mouseY}px, ${gradColor}, transparent 100%)`;

	function handleMouseMove(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
		mouseX.set(e.clientX - rect.left);
		mouseY.set(e.clientY - rect.top);
	}
	function handleMouseLeave() {
		mouseX.set(-gradientSize);
		mouseY.set(-gradientSize);
	}

	// Cleanup motion values with $effect instead of onDestroy
	$effect(() => {
		return () => {
			mouseX.set(-gradientSize);
			mouseY.set(-gradientSize);
		};
	});

	const sizeClass = () => {
		switch (size) {
			case 'sm':
				return 'size-16 sm:size-20 md:size-24';
			case 'lg':
				return 'size-24 sm:size-28 md:size-32';
			case 'xl':
				return 'size-28 sm:size-32 md:size-36';
			case 'md':
			default:
				return 'size-20 sm:size-24 md:size-28';
		}
	};

	const labelSizeClass = () => {
		switch (size) {
			case 'sm':
				return 'text-xs sm:text-sm md:text-base max-w-[8rem]';
			case 'lg':
				return 'text-base sm:text-lg md:text-xl max-w-[12rem]';
			case 'xl':
				return 'text-lg sm:text-xl md:text-2xl max-w-[14rem]';
			case 'md':
			default:
				return 'text-sm sm:text-base md:text-lg max-w-[9rem]';
		}
	};
</script>

<a {href} class={cn('inline-block focus:outline-none', className)}>
	<div class="group relative flex w-full flex-col items-center">
		<div
			role="button"
			tabindex="0"
			onmousemove={handleMouseMove}
			onmouseleave={handleMouseLeave}
			class={cn(
				'relative grid place-items-center overflow-hidden rounded-full border bg-base-100/80 text-base-content/90 shadow-xl backdrop-blur transition-all duration-300 supports-[backdrop-filter]:bg-base-100/70',
				'group-hover:scale-105 group-hover:shadow-2xl hover:border-primary/40',
				'ring-1 ring-black/5',
				sizeClass(),
				'border-base-300 dark:border-base-300/50'
			)}
		>
			<div class="relative z-10 flex items-center justify-center">
				{#if thumbnail}
					<span class="inline-flex h-full w-full overflow-hidden rounded-full ring-1 ring-base-300">
						<img
							src={thumbnail.src}
							alt={thumbnail.alt ?? label}
							class="h-full w-full object-cover"
						/>
					</span>
				{:else if emoji}
					<span
						class="inline-flex items-center justify-center text-2xl leading-none sm:text-3xl md:text-4xl"
					>
						{emoji}
					</span>
				{/if}
			</div>
			<Motion style={{ background: bg, opacity: gradientOpacity }} let:motion>
				<div
					use:motion
					class="pointer-events-none absolute -inset-px rounded-full opacity-0 shadow-[0_0_0_rgba(0,0,0,0)] transition-[opacity,box-shadow] duration-300 group-hover:opacity-100 group-hover:shadow-[0_0_40px_rgba(134,120,249,0.45)]"
				></div>
			</Motion>
		</div>
		<div class="mt-3 text-center">
			<span class={cn('block truncate font-medium', labelSizeClass())}>
				{label}
			</span>
		</div>
	</div>
</a>
