<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cart } from '$lib/stores/cart';
	import { goto } from '$app/navigation';
	import { Button } from './ui/button';
	import { formatCurrency } from '$lib/utils';

	let visible = $state(false);
	let lastScrollY = $state(0);

	onMount(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			
			// Show bar when scrolling down past 200px
			if (currentScrollY > 200 && currentScrollY > lastScrollY) {
				visible = true;
			} else if (currentScrollY < lastScrollY - 50) {
				// Hide when scrolling up significantly
				visible = false;
			}
			
			lastScrollY = currentScrollY;
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		
		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});

	const itemCount = $derived($cart?.items?.length || 0);
	const total = $derived(() => {
		if (!$cart?.total) return formatCurrency(0, 'usd');
		const currencyCode = $cart.currency_code || 'usd';
		return formatCurrency($cart.total, currencyCode);
	});

	function handleViewCart() {
		goto('/cart');
	}
</script>

{#if visible && itemCount > 0}
	<div
		class="fixed bottom-0 left-0 right-0 z-40 bg-primary text-primary-content shadow-2xl md:hidden"
		transition:fly={{ y: 100, duration: 300 }}
	>
		<div class="container mx-auto px-4 py-3">
			<div class="flex items-center justify-between gap-4">
				<!-- Cart info -->
				<div class="flex items-center gap-3">
					<div class="relative">
						<svg
							class="h-6 w-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
							/>
						</svg>
						{#if itemCount > 0}
							<span
								class="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error text-xs font-bold text-error-content"
								transition:fade={{ duration: 200 }}
							>
								{itemCount}
							</span>
						{/if}
					</div>
					<div class="text-left">
						<div class="text-xs opacity-90">
							{itemCount} {itemCount === 1 ? 'item' : 'items'}
						</div>
						<div class="text-lg font-bold">
							{total()}
						</div>
					</div>
				</div>

				<!-- View Cart button -->
				<Button
					variant="secondary"
					size="lg"
					class="px-6 shadow-lg"
					onclick={handleViewCart}
				>
					<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					View Cart
				</Button>
			</div>
		</div>

		<!-- Pulsing glow effect -->
		<div class="absolute inset-0 -z-10 animate-pulse bg-primary opacity-50 blur-xl"></div>
	</div>
{/if}
