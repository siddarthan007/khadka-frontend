<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

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
	export let slides: Slide[] = [];
	export let intervalMs: number = 5000;

	// --- STATE ---
	let current = 0;
	let hovering = false;
	let isMobile = false;
	let prefersReducedMotion = false;
	let imageLoadingErrors = new Set<number>();
	let timer: ReturnType<typeof setInterval> | null = null;
	let touchStartX: number | null = null;
	let touchDeltaX = 0;

	// --- COMPUTED STATE ---
	$: activeSlides = (slides || []).filter((s) => s && s.image && s.title);

	// keep `current` in-range when slides change
	$: if (activeSlides && activeSlides.length > 0) {
		// normalize current to valid range
		if (current < 0)
			current = ((current % activeSlides.length) + activeSlides.length) % activeSlides.length;
		else if (current >= activeSlides.length) current = current % activeSlides.length;
	}

	// --- LIFECYCLE & EVENT HANDLING ---
	function updateMediaFlags() {
		if (!browser) return;
		isMobile = window.matchMedia('(max-width: 639px)').matches;
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
		imageLoadingErrors = new Set(imageLoadingErrors);
	}

	function shouldShowSlide(index: number) {
		return !imageLoadingErrors.has(index);
	}

	// Autoplay management: react to changes in slides or preference without resetting timer unnecessarily
	$: if (browser) {
		const shouldRun = activeSlides.length > 1 && !prefersReducedMotion;
		if (shouldRun) start();
		else stop();
	}

	// --- TOUCH HANDLING ---
	function onTouchStart(e: TouchEvent) {
		if (!e.touches || e.touches.length === 0) return;
		hovering = true;
		touchStartX = e.touches[0].clientX;
		touchDeltaX = 0;
	}

	function onTouchMove(e: TouchEvent) {
		if (touchStartX == null || !e.touches || e.touches.length === 0) return;
		touchDeltaX = e.touches[0].clientX - touchStartX;
	}

	function onTouchEnd() {
		hovering = false;
		const threshold = 40;
		if (Math.abs(touchDeltaX) > threshold) {
			if (touchDeltaX < 0) next();
			else prev();
		}
		touchStartX = null;
		touchDeltaX = 0;
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
		prefersReducedMotionFlag: boolean
	): string {
		const d = circularDelta(i, cur, n);
		const abs_d = Math.abs(d);

		// Keep some motion even when reduced-motion is preferred (use gentler movement)
		const intensity = prefersReducedMotionFlag ? 0.6 : 1;
		const mobileFactor = isMobileFlag ? 0.6 : 1;

		const tx = d * 30 * mobileFactor * intensity;
		const ty = abs_d * 2 * mobileFactor * intensity;
		const tz = -abs_d * 150 * mobileFactor * intensity;
		const rotateY = -d * 12 * mobileFactor * intensity;
		const rotateX = d * 2 * mobileFactor * intensity;
		const scale = 1 - Math.min(abs_d * (isMobile ? 0.08 : 0.1), 0.22);
		const zIndex = 100 - abs_d * 10;
		const opacity = Math.max(0.15, 1 - abs_d * 0.28);
		const blurPx = prefersReducedMotion ? 0 : (abs_d === 0 ? 0 : abs_d === 1 ? 1 : 2);

		const transition = prefersReducedMotionFlag
			? 'transform 450ms ease-out, opacity 300ms ease, filter 300ms ease'
			: 'transform 900ms cubic-bezier(0.16,1,0.3,1), opacity 520ms ease, filter 520ms ease';

		return `
			transform: translate3d(${tx}%, ${ty}%, ${tz}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale});
			z-index: ${zIndex};
			opacity: ${opacity};
			filter: blur(${blurPx}px);
			backface-visibility: hidden;
			transition: ${transition};
		`;
	}

	function contentStyle(i: number, cur: number, n: number): string {
		const d = Math.abs(circularDelta(i, cur, n));
		const opacity = Math.max(0, 1 - d * 0.75);
		const scale = 1 - d * 0.1;
		return `opacity: ${opacity}; transform: scale(${scale}); transition: opacity 300ms ease, transform 300ms ease;`;
	}
</script>

<!-- Full-width carousel -->
<section class="relative w-full overflow-hidden">
	<div class="w-full">
		<div
			class="relative min-h-[400px] sm:min-h-[480px] md:min-h-[580px] lg:min-h-[720px]"
		>
			<!-- Ambient background elements removed to eliminate faint container -->

			<div
				class="relative h-full w-full overflow-hidden"
				role="region"
				aria-roledescription="carousel"
				aria-label={'Hero carousel with ' + (activeSlides.length || 0) + ' slides'}
				on:mouseenter={() => (hovering = true)}
				on:mouseleave={() => (hovering = false)}
				on:touchstart|passive={onTouchStart}
				on:touchmove|passive={onTouchMove}
				on:touchend|passive={onTouchEnd}
			>
				<!-- Background mask and floor glow removed -->
				<!-- Loading state -->
				{#if activeSlides.length === 0}
				<div
					class="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-primary/10 to-primary/5"
				>
					<div class="text-center">
						<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
						<p class="font-medium text-primary">Loading...</p>
					</div>
				</div>
				{:else}
					<!-- Slide container with perspective for 3D depth -->
					<div
						class="relative w-full h-[400px] sm:h-[480px] md:h-[580px] lg:h-[720px]"
						style={`perspective: ${isMobile ? 1400 : 2000}px; transform-style: preserve-3d;`}
					>
						{#each activeSlides as slide, i (slide.image ?? i)}
							{#if isRenderableSlide(i, current, activeSlides.length || 1, isMobile)}
								<div
									class="absolute inset-0 flex items-center justify-center will-change-transform"
									style={slideStyle(i, current, activeSlides.length || 1, isMobile, prefersReducedMotion)}
								>
								<!-- Card container with full responsive sizing -->
								<div
									class="relative w-[92%] sm:w-[88%] md:w-[85%] lg:w-[80%] xl:w-[75%] h-[85%] sm:h-[87%] md:h-[90%] rounded-3xl bg-base-100 shadow-2xl overflow-hidden border border-base-300/20"
								>
									<!-- Image with error handling -->
									{#if shouldShowSlide(i)}
										<figure class="absolute inset-0">
											<img
												src={slide.image}
												alt={slide.title}
												class="h-full w-full object-cover transition-opacity duration-300"
												loading={i === current ? 'eager' : 'lazy'}
												decoding="async"
												on:error={() => handleImageError(i)}
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
										class={`absolute inset-0 flex ${positionClasses(slide.contentPosition)} p-6 md:p-8`}
									>
										<div class={`flex w-full ${justifyClasses(slide.textAlign)}`}>
											<div
												class={`max-w-3xl text-white ${textAlignClass(slide.textAlign)}`}
												style={contentStyle(i, current, activeSlides.length || 1)}
												aria-hidden={i !== current}
											>
												<!-- Badge -->
												{#if slide.badge}
													<div
														class="mb-4 inline-flex items-center px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium border border-white/30 backdrop-blur-sm"
													>
														{slide.badge}
													</div>
												{/if}

												<!-- Title -->
												<h1 class="mb-4 text-3xl leading-tight font-bold md:text-5xl xl:text-6xl">
													{slide.title}
													{#if slide.accent}
														<br />
														<span class="text-primary-content/90 drop-shadow-lg">{slide.accent}</span>
													{/if}
												</h1>

												<!-- Subtitle -->
												{#if slide.subtitle}
													<p
														class="mb-6 max-w-2xl text-lg leading-relaxed text-white/90 md:text-xl"
													>
														{slide.subtitle}
													</p>
												{/if}

												<!-- CTA Buttons -->
												<div
													class={`flex flex-col gap-4 sm:flex-row ${justifyClasses(slide.textAlign)}`}
												>
													{#if slide.ctaPrimary}
														<a
															href={slide.ctaPrimary.href}
															class="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-primary text-primary-content font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-primary/90"
															tabindex={i === current ? 0 : -1}
														>
															{slide.ctaPrimary.label}
														</a>
													{/if}
													{#if slide.ctaSecondary}
														<a
															href={slide.ctaSecondary.href}
															class="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/30 text-white font-semibold transition-all duration-300 hover:bg-white/20"
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
						on:click={prev}
						class="absolute top-1/2 left-4 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white flex items-center justify-center hover:bg-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
						aria-label="Previous slide"
					>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 19l-7-7 7-7"
							/>
						</svg>
					</button>
					<button
						on:click={next}
						class="absolute top-1/2 right-4 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white flex items-center justify-center hover:bg-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
						aria-label="Next slide"
					>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
					<div class="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-3">
						{#each activeSlides as _, i (i)}
							<button
								on:click={() => (current = i)}
								class={`h-3 w-3 rounded-full transition-all duration-200 focus:ring-2 focus:ring-white/50 focus:outline-none ${
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