<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Button } from '$lib/components/ui/button';
	import OptimizedImage from './OptimizedImage.svelte';
	import { showToast } from '$lib/stores/toast';
	import { addLine, ensureCart } from '$lib/cart';
	import { formatCurrency } from '$lib/utils';
	import type { HttpTypes } from '@medusajs/types';
	import { trackEvent, trackAddToCart } from '$lib/utils/analytics';
	import { logger } from '$lib/logger';

	interface Props {
		product: HttpTypes.StoreProduct;
		onClose: () => void;
	}

	let { product, onClose }: Props = $props();

	let selectedOptions = $state<Record<string, string>>({});
	let selectedVariant = $state<HttpTypes.StoreProductVariant | null>(null);
	let activeImage = $state<string | null>(null);
	let quantity = $state(1);
	let adding = $state(false);

	// Initialize selected options and active image
	onMount(() => {
		if (product.options?.length) {
			const initial: Record<string, string> = {};
			for (const opt of product.options) {
				const firstValue = opt.values?.[0]?.value;
				if (firstValue && opt.id) {
					initial[opt.id] = firstValue;
				}
			}
			selectedOptions = initial;
		}
		updateSelectedVariant();
		// Initialize active image
		activeImage = product.thumbnail || product.images?.[0]?.url || null;
		
		// Track quick view event
		try {
			trackEvent('quick_view', {
				item_id: product.id,
				item_name: product.title || 'Unknown Product'
			});
		} catch (e) {
			logger.warn('Analytics tracking failed:', e);
		}
	});

	function updateSelectedVariant() {
		if (!product.variants) return;

		const variant = product.variants.find((v) => {
			if (!v.options) return false;
			return Object.entries(selectedOptions).every(
				([optionId, value]) =>
					v.options?.some((opt) => opt.option_id === optionId && opt.value === value)
			);
		});

		selectedVariant = variant || product.variants[0] || null;
	}
	
	// Update image when variant changes - similar to product detail page
	$effect(() => {
		const v = selectedVariant;
		if (v) {
			// Check if variant has a custom thumbnail in metadata
			const variantThumbnail = v?.metadata?.thumbnail as string | null | undefined;
			const fallback = product.thumbnail || product.images?.[0]?.url || null;
			activeImage = variantThumbnail ?? fallback;
		}
	});

	function handleOptionChange(optionId: string, value: string) {
		selectedOptions = { ...selectedOptions, [optionId]: value };
		updateSelectedVariant();
	}

	async function handleAddToCart() {
		if (!selectedVariant?.id) {
			showToast('Please select a variant', { type: 'error' });
			return;
		}

		adding = true;
		try {
			await ensureCart();
			await addLine(selectedVariant.id, quantity);
			
			// Track add_to_cart event from quick view
			try {
				trackAddToCart({
					id: selectedVariant.id,
					name: product.title || 'Unknown Product',
					price: selectedVariant.calculated_price?.calculated_amount || 0,
					quantity,
					currency: selectedVariant.calculated_price?.currency_code?.toUpperCase() || 'USD',
					category: product.collection?.title || ''
				});
				trackEvent('add_to_cart_quick_view', {
					item_id: selectedVariant.id,
					item_name: product.title,
					source: 'quick_view'
				});
			} catch (e) {
				logger.warn('Analytics tracking failed:', e);
			}
			
			showToast('Added to cart!', { type: 'success' });
			onClose();
		} catch (err: any) {
			showToast(err?.message || 'Failed to add to cart', { type: 'error' });
		} finally {
			adding = false;
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	const price = $derived(() => {
		if (!selectedVariant?.calculated_price) return null;
		const regionCurrency = selectedVariant.calculated_price.currency_code || 'usd';
		return formatCurrency(selectedVariant.calculated_price.calculated_amount || 0, regionCurrency);
	});

	const originalPrice = $derived(() => {
		if (!selectedVariant?.calculated_price?.original_amount) return null;
		if (
			selectedVariant.calculated_price.original_amount ===
			selectedVariant.calculated_price.calculated_amount
		)
			return null;
		const regionCurrency = selectedVariant.calculated_price.currency_code || 'usd';
		return formatCurrency(selectedVariant.calculated_price.original_amount, regionCurrency);
	});

	const isInStock = $derived(
		selectedVariant?.inventory_quantity ? selectedVariant.inventory_quantity > 0 : true
	);
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
	transition:fade={{ duration: 200 }}
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="dialog"
	aria-modal="true"
	aria-labelledby="quickview-title"
	tabindex="-1"
>
	<!-- Modal -->
	<div
		class="relative w-full max-w-5xl overflow-hidden rounded-xl sm:rounded-2xl bg-base-100 shadow-2xl max-h-[95vh] flex flex-col"
		transition:scale={{ start: 0.95, duration: 300, easing: cubicOut }}
		role="document"
	>
		<!-- Close button -->
		<button
			class="absolute right-2 top-2 sm:right-4 sm:top-4 z-10 rounded-full bg-base-100/90 p-2 shadow-lg transition-transform hover:scale-110 hover:bg-base-100"
			onclick={onClose}
			aria-label="Close quick view"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>

		<!-- Content -->
		<div class="grid grid-cols-1 gap-4 sm:gap-6 overflow-y-auto p-4 sm:p-6 md:grid-cols-2 md:p-8 flex-1 min-h-0">
			<!-- Image Section -->
			<div class="space-y-3">
				<!-- Main Image -->
				<div class="relative aspect-square overflow-hidden rounded-lg sm:rounded-xl border border-base-300 bg-base-200">
					{#if activeImage}
						<OptimizedImage
							src={activeImage}
							alt={product.title || 'Product'}
							width={600}
							height={600}
							class="h-full w-full object-contain"
							priority={true}
						/>
					{:else}
						<div class="flex h-full items-center justify-center text-base-content/40">
							<svg class="h-16 w-16 sm:h-24 sm:w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
						</div>
					{/if}
				</div>
				
				<!-- Thumbnail Gallery -->
				{#if product.images && product.images.length > 1}
					<div class="grid grid-cols-4 gap-2">
						{#each product.images.slice(0, 4) as img}
							<button
								class="aspect-square cursor-pointer overflow-hidden rounded-md border-2 transition-colors {activeImage === img.url ? 'border-primary' : 'border-base-300 hover:border-base-400'}"
								onclick={() => (activeImage = img.url)}
							>
								<OptimizedImage 
									src={img.url} 
									alt={product.title || 'Product'} 
									width={150}
									height={150}
									class="h-full w-full object-contain" 
								/>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Details -->
			<div class="flex flex-col">
				<h2 id="quickview-title" class="mb-2 sm:mb-3 text-xl sm:text-2xl font-bold">
					{product.title}
				</h2>

				{#if product.description}
					<p class="mb-3 sm:mb-4 text-sm sm:text-base text-base-content/70 line-clamp-3">
						{product.description}
					</p>
				{/if}

				<!-- Price -->
				<div class="mb-4 sm:mb-6 flex items-baseline gap-2 sm:gap-3">
					<span class="text-2xl sm:text-3xl font-bold text-primary">{price()}</span>
					{#if originalPrice()}
						<span class="text-base sm:text-lg text-base-content/50 line-through">{originalPrice()}</span>
					{/if}
				</div>

				<!-- Stock Status -->
				{#if selectedVariant}
					<div class="mb-4">
						<span class="text-xs sm:text-sm font-medium {isInStock ? 'text-success' : 'text-error'}">
							{#if isInStock}
								✓ In Stock {selectedVariant.inventory_quantity ? `(${selectedVariant.inventory_quantity} available)` : ''}
							{:else}
								✗ Out of Stock
							{/if}
						</span>
					</div>
				{/if}

				<!-- Options -->
				{#if product.options?.length}
					<div class="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
						{#each product.options as option}
							{#if option.id}
								<div>
									<div role="heading" aria-level="3" class="mb-2 block text-sm font-medium">
										{option.title}
									</div>
									<div class="flex flex-wrap gap-2">
										{#each option.values || [] as value}
											<button
												type="button"
												class="rounded-lg border-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors {selectedOptions[
													option.id
												] === value.value
													? 'border-primary bg-primary text-primary-content'
													: 'border-base-300 bg-base-100 hover:border-base-400'}"
												onclick={() => handleOptionChange(option.id!, value.value || '')}
											>
												{value.value}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Quantity -->
				<div class="mb-4 sm:mb-6">
					<label for="quantity" class="mb-2 block text-sm font-medium">
						Quantity
					</label>
					<div
						class="stepper join h-10 sm:h-12"
						style="--stepper-height: clamp(2.5rem, 6vw, 3rem); --stepper-max-width: 12rem;"
					>
						<button
							type="button"
							class="stepper-button join-item flex-1 basis-[2.75rem] text-lg font-bold"
							onclick={() => (quantity = Math.max(1, quantity - 1))}
							disabled={adding}
							aria-label="Decrease quantity"
						>
							<span class="leading-none">−</span>
						</button>
						<input
							id="quantity"
							type="number"
							min="1"
							bind:value={quantity}
							class="stepper-input join-item flex-[1.15] basis-[3rem] border-0 bg-transparent text-center text-sm sm:text-base font-bold focus:outline-none"
							disabled={adding}
						/>
						<button
							type="button"
							class="stepper-button join-item flex-1 basis-[2.75rem] text-lg font-bold"
							onclick={() => (quantity = quantity + 1)}
							disabled={adding}
							aria-label="Increase quantity"
						>
							<span class="leading-none">+</span>
						</button>
					</div>
				</div>				<!-- Actions -->
				<div class="mt-auto pt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
					<Button
						variant="outline"
						class="flex-1 text-sm sm:text-base"
						onclick={onClose}
						disabled={adding}
					>
						Continue Shopping
					</Button>
					<Button
						class="flex-1 text-sm sm:text-base"
						onclick={handleAddToCart}
						disabled={!isInStock || adding}
					>
						{#if adding}
							Adding...
						{:else if !isInStock}
							Out of Stock
						{:else}
							Add to Cart
						{/if}
					</Button>
				</div>

				{#if !isInStock}
					<p class="mt-3 text-center text-xs sm:text-sm text-error">This item is currently out of stock</p>
				{/if}
			</div>
		</div>
	</div>
</div>
