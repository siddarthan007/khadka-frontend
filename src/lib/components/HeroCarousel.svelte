<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { cn } from '$lib/utils';

	// --- TYPE DEFINITIONS ---
	type CTA = { label: string; href: string };
	type Slide = {
		image: string;
		badge?: string;
		title: string;
		accent?: string;
		subtitle?: string;
		ctaPrimary?: CTA;
		ctaSecondary?: CTA;
		contentPosition?:
			| 'top-left'
			| 'top-center'
			| 'top-right'
			| 'center-left'
			| 'center'
			| 'center-right'
			| 'bottom-left'
			| 'bottom-center'
			| 'bottom-right';
		textAlign?: 'left' | 'center' | 'right';
	};

	// --- PROPS ---
	let { slides = [], intervalMs = 5000 }: { slides?: Slide[]; intervalMs?: number } = $props();

	// --- STATE ---
	let current = $state(0);
	let hovering = $state(false);
	let isMobile = $state(false);
	let prefersReducedMotion = $state(false);
	let imageLoadingErrors = $state(new Set<number>());
	let timer: ReturnType<typeof setInterval> | null = null;
	let touchStartX: number | null = null;
	let touchDeltaX = $state(0);
	let containerWidth = $state(0);
	let containerRef: HTMLDivElement;

	// --- COMPUTED STATE ---
	const activeSlides = $derived((slides || []).filter((s) => s && s.image && s.title));

	// keep `current` in-range when slides change
	$effect(() => {
		if (activeSlides && activeSlides.length > 0) {
			// normalize current to valid range
			if (current < 0)
				current = ((current % activeSlides.length) + activeSlides.length) % activeSlides.length;
			else if (current >= activeSlides.length) current = current % activeSlides.length;
		}
	});

	// --- LIFECYCLE & EVENT HANDLING ---
	function updateMediaFlags() {
		if (!browser) return;
		const wasMobile = isMobile;
		isMobile = window.matchMedia('(max-width: 768px)').matches;
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Update container width for responsive calculations
		if (containerRef) {
			containerWidth = containerRef.offsetWidth;
		}

		// Restart timer if mobile state changed
		if (wasMobile !== isMobile) {
			stop();
			start();
		}
	}

	onMount(() => {
		updateMediaFlags();
		if (browser) {
			window.addEventListener('resize', updateMediaFlags);
			start();
		}
		return () => {
			stop();
			if (browser) {
				window.removeEventListener('resize', updateMediaFlags);
			}
		};
	});

	onDestroy(() => {
		stop();
		if (browser) {
			window.removeEventListener('resize', updateMediaFlags);
		}
	});

	// --- CAROUSEL LOGIC ---
	function next() {
		const n = activeSlides.length || 1;
		if (n < 2) return;
		current = (current + 1) % n;
	}

	function prev() {
		const n = activeSlides.length || 1;
		if (n < 2) return;
		current = (current - 1 + n) % n;
	}

	function start() {
		if (timer !== null) return;
		if (browser && activeSlides.length > 1 && !prefersReducedMotion) {
			timer = setInterval(() => {
				if (!hovering) next();
			}, intervalMs);
		}
	}

	function stop() {
		if (timer !== null) {
			clearInterval(timer as ReturnType<typeof setInterval>);
			timer = null;
		}
	}

	function handleImageError(index: number) {
		imageLoadingErrors.add(index);
	}

	function shouldShowSlide(index: number) {
		return !imageLoadingErrors.has(index);
	}

	const isCompactMobile = $derived(() => isMobile && containerWidth > 0 && containerWidth <= 425);

	$effect(() => {
		if (!browser || !containerRef) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries?.[0];
			if (!entry) return;
			containerWidth = entry.contentRect.width;
		});
		observer.observe(containerRef);
		return () => observer.disconnect();
	});

	// Autoplay management: react to changes in slides or preference without resetting timer unnecessarily
	$effect(() => {
		if (browser) {
			const shouldRun = activeSlides.length > 1 && !prefersReducedMotion;
			if (shouldRun) start();
			else stop();
		}
	});

	// --- TOUCH HANDLING ---
	function onTouchStart(e: TouchEvent) {
		if (!e.touches || e.touches.length === 0) return;
		hovering = true;
		stop(); // Stop autoplay on touch
		touchStartX = e.touches[0].clientX;
		touchDeltaX = 0;
	}

	function onTouchMove(e: TouchEvent) {
    	if (touchStartX == null || !e.touches || e.touches.length === 0) return;
    	touchDeltaX = e.touches[0].clientX - touchStartX;

    	if (isMobile) {
        	e.preventDefault(); // only on mobile to avoid blocking desktop scroll
    	}
	}

	function onTouchEnd() {
		hovering = false;
		const threshold = isMobile ? 50 : 40; // Larger threshold on mobile for easier swiping
		if (Math.abs(touchDeltaX) > threshold) {
			if (touchDeltaX < 0) next();
			else prev();
		}
		touchStartX = null;
		touchDeltaX = 0;
		start(); // Restart autoplay after touch interaction
	}

	// --- STYLING FUNCTIONS ---
	function positionClasses(pos?: Slide['contentPosition']): string {
		switch (pos) {
			case 'top-left':
				return 'items-start justify-start';
			case 'top-center':
				return 'items-start justify-center';
			case 'top-right':
				return 'items-start justify-end';
			case 'center':
				return 'items-center justify-center';
			case 'center-right':
				return 'items-center justify-end';
			case 'bottom-left':
				return 'items-end justify-start';
			case 'bottom-center':
				return 'items-end justify-center';
			case 'bottom-right':
				return 'items-end justify-end';
			case 'center-left':
			default:
				return 'items-center justify-start';
		}
	}

	function justifyClasses(align?: Slide['textAlign']): string {
		switch (align) {
			case 'center':
				return 'justify-center';
			case 'right':
				return 'justify-end';
			case 'left':
			default:
				return 'justify-start';
		}
	}

	function textAlignClass(align?: Slide['textAlign']): string {
		switch (align) {
			case 'center':
				return 'text-center';
			case 'right':
				return 'text-right';
			case 'left':
			default:
				return 'text-left';
		}
	}

	function circularDelta(i: number, cur: number, n: number) {
		let d = i - cur;
		if (d > n / 2) d -= n;
		if (d < -n / 2) d += n;
		return d;
	}

	function isRenderableSlide(i: number, cur: number, n: number, isMobileFlag: boolean): boolean {
		const neighbors = isMobileFlag ? 1 : 2; // 3 visible on mobile, 5 on desktop
		return Math.abs(circularDelta(i, cur, n)) <= neighbors;
	}

	function slideStyle(
		i: number,
		cur: number,
		n: number,
		isMobileFlag: boolean,
		prefersReducedMotionFlag: boolean,
		isCompactMobileFlag: boolean
	): string {
		const d = circularDelta(i, cur, n);
		const abs_d = Math.abs(d);

		// More aggressive motion reduction on compact screens for better performance
		const mobileFactor = isCompactMobileFlag ? 0.35 : isMobileFlag ? 0.5 : 1;
		const intensity = prefersReducedMotionFlag ? 0.4 : mobileFactor;

		const tx = d * 22 * mobileFactor * intensity;
		const ty = abs_d * 1.2 * mobileFactor * intensity;
		const tz = -abs_d * 85 * mobileFactor * intensity;
		const rotateY = -d * 6 * mobileFactor * intensity;
		const rotateX = d * 1.2 * mobileFactor * intensity;
		const scaleReduction = isCompactMobileFlag ? 0.045 : isMobileFlag ? 0.05 : 0.08;
		const maxScaleDrop = isCompactMobileFlag ? 0.12 : isMobileFlag ? 0.15 : 0.18;
		const scale = 1 - Math.min(abs_d * scaleReduction, maxScaleDrop);
		const zIndex = 100 - abs_d * 10;
		const opacity = Math.max(0.25, 1 - abs_d * 0.22);
		const blurPx = prefersReducedMotionFlag
			? 0
			: abs_d === 0
				? 0
				: abs_d === 1
					? isCompactMobileFlag ? 0.35 : 0.5
					: 0.8;

		const transition = prefersReducedMotionFlag
			? 'transform 350ms ease-out, opacity 250ms ease, filter 250ms ease'
			: 'transform 700ms cubic-bezier(0.16,1,0.3,1), opacity 400ms ease, filter 400ms ease';

		return `
			transform: translate3d(${tx}%, ${ty}%, ${tz}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale});
			z-index: ${zIndex};
			opacity: ${opacity};
			filter: blur(${blurPx}px);
			backface-visibility: hidden;
			transition: ${transition};
		`;
	}

	function contentStyle(
		i: number,
		cur: number,
		n: number,
		isCompactMobileFlag: boolean
	): string {
		const d = Math.abs(circularDelta(i, cur, n));
		const opacity = Math.max(0, 1 - d * 0.75);
		const scaleFactor = isCompactMobileFlag ? 0.06 : 0.1;
		const scale = 1 - d * scaleFactor;
		return `opacity: ${opacity}; transform: scale(${scale}); transition: opacity 300ms ease, transform 300ms ease;`;
	}
</script>

<!-- Full-width carousel -->
<section class="relative w-full overflow-hidden max-w-[100vw]">
	<div class="w-full max-w-full">
		<div
			class={cn(
				'relative w-full max-w-full sm:aspect-auto sm:min-h-[400px] md:min-h-[500px] lg:min-h-[600px] xl:min-h-[720px]',
				isCompactMobile() ? 'min-h-[22rem]' : 'aspect-[16/9]'
			)}
			style={isCompactMobile() ? 'min-height: clamp(22rem, 78vw + 4rem, 27rem);' : ''}
		>
			<!-- Ambient background elements removed to eliminate faint container -->

			<div
				bind:this={containerRef}
				class="relative h-full w-full max-w-full overflow-hidden"
				role="region"
				aria-roledescription="carousel"
				aria-label={'Hero carousel with ' + (activeSlides.length || 0) + ' slides'}
				onmouseenter={() => (hovering = true)}
				onmouseleave={() => (hovering = false)}
				ontouchstart={onTouchStart}
				ontouchmove={onTouchMove}
				ontouchend={onTouchEnd}
			>
				<!-- Background mask and floor glow removed -->
				<!-- Loading state -->
				{#if activeSlides.length === 0}
					<div
						class="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-primary/10 to-primary/5"
					>
						<div class="text-center">
							<div
								class="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"
							></div>
							<p class="font-medium text-primary">Loading...</p>
						</div>
					</div>
				{:else}
					<!-- Slide container with perspective for 3D depth -->
					<div
						class="relative w-full h-full sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[720px]"
						style={`perspective: ${isCompactMobile() ? 1000 : isMobile ? 1200 : 1800}px; transform-style: preserve-3d;${isCompactMobile() ? ' min-height: inherit;' : ''}`}
					>
						{#each activeSlides as slide, i (slide.image ?? i)}
							{#if isRenderableSlide(i, current, activeSlides.length || 1, isMobile)}
								<div
									class="absolute inset-0 flex items-center justify-center will-change-transform"
									style={slideStyle(
										i,
										current,
										activeSlides.length || 1,
										isMobile,
										prefersReducedMotion,
										isCompactMobile()
									)}
								>
									<!-- Card container with full responsive sizing -->
									<div
										class={cn(
											'hero-card relative mx-auto overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl',
											isCompactMobile()
												? 'aspect-[4/5] w-[88%] max-w-[380px]'
												: 'h-[85%] w-[90%] sm:h-[87%] sm:w-[88%] md:h-[88%] md:w-[85%] lg:h-[90%] lg:w-[82%] xl:w-[78%]'
										)}
										style={isCompactMobile() ? 'min-height: clamp(20rem, 72vw + 3rem, 23.5rem);' : ''}
									>
										<!-- Image with error handling -->
										{#if shouldShowSlide(i)}
											<figure class="absolute inset-0">
												<img
													src={slide.image}
													alt={slide.title}
													class="h-full w-full object-cover object-center transition-opacity duration-300"
													loading={i === current ? 'eager' : 'lazy'}
													decoding="async"
													onerror={() => handleImageError(i)}
												/>
											</figure>
										{:else}
											<div
												class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-base-300 to-base-200"
											>
												<div class="text-center text-base-content/60">
													<div class="mb-2 text-4xl">📷</div>
													<p class="text-sm">Image failed to load</p>
												</div>
											</div>
										{/if}

										<!-- Gradient overlay -->
										<div
											class="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent"
										></div>

										<!-- Content overlay -->
										<div
											class={cn(
												'absolute inset-0 flex hero-content',
												positionClasses(slide.contentPosition),
												'p-[clamp(1rem,3vw,2rem)] sm:p-6 md:p-8 lg:p-10'
											)}
											style={isCompactMobile() ? 'padding: clamp(0.8rem, 3.5vw, 1.4rem);' : ''}
										>
											<div class={cn('flex w-full', justifyClasses(slide.textAlign))}>
												<div
													class={cn(
														'hero-copy max-w-[clamp(20rem,60vw,40rem)] text-white',
														textAlignClass(slide.textAlign),
														isCompactMobile() && 'max-w-[95%]'
													)}
													style={contentStyle(i, current, activeSlides.length || 1, isCompactMobile())}
													aria-hidden={i !== current}
												>
													<!-- Badge -->
													{#if slide.badge}
														<div
															class={cn(
																'mb-4 inline-flex items-center rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-[clamp(0.7rem,1.5vw,0.8rem)] font-medium text-white backdrop-blur-sm',
																isCompactMobile() && 'mb-3 px-2.5 py-1 text-[clamp(0.65rem,1.8vw,0.75rem)]'
															)}
														>
															{slide.badge}
														</div>
													{/if}

													<!-- Title -->
													<h1
														class={cn(
															'mb-3 leading-tight font-bold text-[clamp(1.8rem,4vw,3rem)] sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl',
															isCompactMobile() && 'mb-2 text-[clamp(1.4rem,5vw,2.2rem)] leading-[1.15]'
														)}
													>
														{slide.title}
														{#if slide.accent}
															<br />
															<span
																class={cn(
																	'text-primary drop-shadow-lg',
																	isCompactMobile() && 'drop-shadow-md'
																)}
																>{slide.accent}</span
															>
														{/if}
													</h1>

													<!-- Subtitle -->
													{#if slide.subtitle}
														<p
															class={cn(
																'mb-4 max-w-xl text-[clamp(0.9rem,2.5vw,1.2rem)] leading-relaxed text-white/90 sm:text-lg md:text-xl',
																isCompactMobile() && 'mb-2 text-[clamp(0.75rem,3vw,1rem)] leading-[1.45]'
															)}
														>
															{slide.subtitle}
														</p>
													{/if}

													<!-- CTA Buttons -->
													<div
														class={cn(
															'flex flex-col gap-3 sm:flex-row',
															justifyClasses(slide.textAlign),
															isCompactMobile() && 'gap-2 text-[0.85rem]'
														)}
													>
														{#if slide.ctaPrimary}
															<a
																href={slide.ctaPrimary.href}
																class={cn(
																	'inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-[clamp(0.85rem,2vw,0.95rem)] font-semibold text-primary-content shadow-lg transition-all duration-300 hover:scale-105 hover:bg-primary/90 hover:shadow-xl sm:px-8 sm:py-4 sm:text-base',
																	isCompactMobile() && 'px-4 py-2.5 text-[clamp(0.8rem,2.2vw,0.9rem)]'
																)}
																tabindex={i === current ? 0 : -1}
															>
																{slide.ctaPrimary.label}
															</a>
														{/if}
														{#if slide.ctaSecondary}
															<a
																href={slide.ctaSecondary.href}
																class={cn(
																	'inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-[clamp(0.85rem,2vw,0.95rem)] font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:bg-white/20 sm:px-8 sm:py-4 sm:text-base',
																	isCompactMobile() && 'px-4 py-2.5 text-[clamp(0.8rem,2.2vw,0.9rem)]'
																)}
																tabindex={i === current ? 0 : -1}
															>
																{slide.ctaSecondary.label}
															</a>
														{/if}
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Navigation Controls -->
				{#if activeSlides.length > 1}
					<button
						onclick={prev}
						class="absolute top-1/2 left-4 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:left-8 md:flex md:left-12 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
						aria-label="Previous slide"
					>
						<svg class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<button
						onclick={next}
						class="absolute top-1/2 right-4 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:right-8 md:flex md:right-12 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
						aria-label="Next slide"
					>
						<svg class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
					</button>
				{/if}

				<!-- Pagination Dots -->
				{#if activeSlides.length > 1}
					<div class="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-6 sm:gap-3">
						{#each activeSlides as _, i (i)}
							<button
								onclick={() => (current = i)}
								class={`h-2.5 w-2.5 rounded-full transition-all duration-200 focus:ring-2 focus:ring-white/50 focus:outline-none sm:h-3 sm:w-3 ${
									i === current ? 'scale-125 bg-white' : 'bg-white/50 hover:bg-white/80'
								}`}
								aria-label={'Go to slide ' + (i + 1)}
							></button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	@media (max-width: 425px) {
		:global(.hero-copy) {
			display: grid;
			gap: clamp(0.75rem, 3.5vw, 1.4rem);
		}

		:global(.hero-card) {
			border-radius: min(1.25rem, 6vw);
		}
	}
	.will-change-transform {
		will-change: transform, opacity, filter;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}
</style>