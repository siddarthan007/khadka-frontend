<script lang="ts">
	import { addLine, updateLine, removeLine, getCart } from '$lib/cart';
	import { cart } from '$lib/stores/cart';
	import { formatCalculatedPrice } from '$lib/utils';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import SEO from '$lib/components/SEO.svelte';
	import { 
		generateProductStructuredData, 
		generateBreadcrumbStructuredData,
		generateOptimizedTitle,
		generateOptimizedDescription
	} from '$lib/seo';
	import { ShoppingCart } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { trackViewItem } from '$lib/utils/analytics';
	import { onMount } from 'svelte';
	import { logger } from '$lib/logger';

	let { data }: { data?: { product: any; recByCategory?: any[]; recByCollection?: any[] } } =
		$props();
	const product = data?.product;
	const recByCategory = data?.recByCategory ?? [];
	const recByCollection = data?.recByCollection ?? [];
	let selected: Record<string, string> = $state({});
	let activeImage: string | null = $state(
		product?.thumbnail || product?.images?.[0]?.url || null
	);

	const isNew = $derived(() => {
		const created = product?.created_at ? new Date(product.created_at).getTime() : NaN;
		if (Number.isNaN(created)) return false;
		const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
		return Date.now() - created <= fifteenDaysMs;
	});

	const baseUrl = 'https://khadkafoods.com';
	
	// Track view_item event on mount
	onMount(() => {
		if (product) {
			try {
				const variant = selectedVariant();
				const price = variant?.calculated_price?.calculated_amount || variant?.prices?.[0]?.amount || 0;
				const currency = variant?.calculated_price?.currency_code || variant?.prices?.[0]?.currency_code || 'USD';
				trackViewItem({
					id: product.id,
					name: product.title,
					price: price,
					currency: currency.toUpperCase(),
					category: product.collection?.title || product.categories?.[0]?.name,
					brand: 'Khadka Foods'
				});
			} catch (e) {
				logger.warn('Analytics tracking failed:', e);
			}
		}
	});
	
	// Generate structured data
	const structuredData = $derived(() => {
		if (!product) return [];
		
		const breadcrumbItems = [
			{ name: 'Home', url: baseUrl },
			{ name: 'Products', url: `${baseUrl}/products` },
			{ name: product.title, url: `${baseUrl}/products/${product.handle}` }
		];
		
		const variant = selectedVariant();
		const price = variant?.calculated_price?.calculated_amount || variant?.prices?.[0]?.amount || 0;
		const currency = variant?.calculated_price?.currency_code || variant?.prices?.[0]?.currency_code || 'USD';
		
		// Check if product has multiple variants for aggregate offer
		const hasMultipleVariants = (product.variants?.length || 0) > 1;
		const variantPrices = product.variants?.map((v: any) => 
			v?.calculated_price?.calculated_amount || v?.prices?.[0]?.amount || 0
		).filter((p: number) => p > 0) || [];
		
		const productSchema = generateProductStructuredData({
			name: product.title,
			description: product.description || `Shop ${product.title} at Khadka Foods. Premium quality, fast delivery.`,
			image: activeImage || product.thumbnail || `${baseUrl}/logo.png`,
			price: price / 100, // Convert from cents
			currency: currency.toUpperCase(),
			availability: isInStock(variant) ? 'InStock' : 'OutOfStock',
			brand: 'Khadka Foods',
			sku: variant?.sku || product.id,
			// Add aggregate offer data if multiple variants
			...(hasMultipleVariants && variantPrices.length > 1 ? {
				lowPrice: Math.min(...variantPrices) / 100,
				highPrice: Math.max(...variantPrices) / 100,
				offerCount: product.variants.length
			} : {})
		});
		
		return [
			productSchema,
			generateBreadcrumbStructuredData(breadcrumbItems)
		];
	});
	
	// Generate optimized title and description
	const seoTitle = $derived(() => {
		if (!product) return 'Product | Khadka Foods';
		const category = product.collection?.title || product.categories?.[0]?.name;
		return generateOptimizedTitle(product.title, category, 'product');
	});
	
	const seoDescription = $derived(() => {
		if (!product) return '';
		const variant = selectedVariant();
		const price = variant?.calculated_price?.calculated_amount || variant?.prices?.[0]?.amount || 0;
		const currency = variant?.calculated_price?.currency_code || variant?.prices?.[0]?.currency_code || 'USD';
		const priceFormatted = formatCalculatedPrice({ calculated_amount: price, currency_code: currency });
		
		return generateOptimizedDescription(
			product.title,
			{
				price: priceFormatted,
				availability: isInStock(variant) ? 'instock' : 'outofstock',
				category: product.collection?.title || product.categories?.[0]?.name,
				usps: ['Premium Quality', 'Fast Shipping', 'Secure Checkout'],
				type: 'product'
			}
		);
	});

	// Initialize default selections for each option
	$effect(() => {
		if (product?.options && Object.keys(selected).length === 0) {
			const defaults: Record<string, string> = {};
			product.options.forEach((opt: any) => {
				if (opt.values?.[0]?.value) {
					defaults[opt.id] = opt.values[0].value;
				}
			});
			selected = defaults;
		}
	});

	function selectedVariant() {
		if (!product?.variants) return product?.variants?.[0] ?? null;
		if (!product?.options || product.options.length === 0) return product.variants?.[0] ?? null;

		const variant = product.variants.find((v: any) =>
			v.options?.every((ov: any) => selected[ov.option_id!] === ov.value)
		);
		return variant ?? product.variants?.[0] ?? null;
	}

	// Set default active image on load and when variant changes
	$effect(() => {
		const v = selectedVariant();
		const vThumb = v?.metadata?.thumbnail ?? null;
		const fallback = product?.thumbnail ?? product?.images?.[0]?.url ?? null;
		activeImage = (vThumb as string | null) ?? fallback;
	});

	// Reactive quantity that updates when cart or selected variant changes — align with ProductCard usage
	let currentQty = $derived(() => {
		const v = selectedVariant();
		if (!v?.id || !$cart?.items) return 0;
		const item = $cart.items.find((i: any) => i?.variant_id === v.id);
		return item?.quantity ?? 0;
	});

	// Loading state for cart operations
	let isUpdating = $state(false);
	let justAdded = $state(false);

	// Hide "View cart" when quantity returns to 0
	$effect(() => {
		if (currentQty() === 0) justAdded = false;
	});

	async function addSelected() {
		const v = selectedVariant();
		if (!v?.id || isUpdating) return;

		isUpdating = true;
		try {
			await addLine(v.id, 1);
			await getCart();
			justAdded = true;
			const m = await import('$lib/stores/toast');
			m.showToast('Added to cart', { type: 'success' });
		} catch (error) {
			logger.error('Failed to add to cart:', error);
			const m = await import('$lib/stores/toast');
			m.showToast('Failed to add to cart', { type: 'error' });
		} finally {
			isUpdating = false;
		}
	}

	async function incSelected() {
		const v = selectedVariant();
		if (!v?.id || !$cart?.items || isUpdating) return;

		const item = $cart.items.find((i: any) => i?.variant_id === v.id);
		if (!item) return;

		isUpdating = true;
		try {
			await updateLine(item.id, (item.quantity ?? 0) + 1);
			await getCart();
		} catch (error) {
			logger.error('Failed to update cart:', error);
		} finally {
			isUpdating = false;
		}
	}

	async function decSelected() {
		const v = selectedVariant();
		if (!v?.id || !$cart?.items || isUpdating) return;

		const item = $cart.items.find((i: any) => i?.variant_id === v.id);
		if (!item) return;

		isUpdating = true;
		try {
			if ((item.quantity ?? 0) > 1) {
				await updateLine(item.id, item.quantity - 1);
			} else {
				await removeLine(item.id);
			}
			await getCart();
		} catch (error) {
			logger.error('Failed to update cart:', error);
		} finally {
			isUpdating = false;
		}
	}

	// Check if variant is in stock
	function isInStock(variant: any): boolean {
		if (!variant) return false;
		if (!variant.manage_inventory) return true;
		return (variant.inventory_quantity || 0) > 0;
	}
</script>

{#if product}
	<SEO
		title={seoTitle()}
		description={seoDescription()}
		keywords={[
			`buy ${product.title}`,
			`${product.title} online`,
			product.collection?.title || '',
			product.categories?.[0]?.name || '',
			'groceries online',
			'international foods',
			'Khadka Foods'
		].filter(Boolean)}
		canonical={`${baseUrl}/products/${product.handle}`}
		ogType="product"
		ogImage={activeImage || product.thumbnail || `${baseUrl}/logo.png`}
		ogLocale="en_US"
		ogSiteName="Khadka Foods"
		twitterSite="@khadkafoods"
		twitterCreator="@khadkafoods"
		twitterCard="summary_large_image"
		productPrice={(() => {
			const variant = selectedVariant();
			const price = variant?.calculated_price?.calculated_amount || variant?.prices?.[0]?.amount || 0;
			return (price / 100).toFixed(2);
		})()}
		productCurrency={(() => {
			const variant = selectedVariant();
			return (variant?.calculated_price?.currency_code || variant?.prices?.[0]?.currency_code || 'USD').toUpperCase();
		})()}
		productAvailability={(() => {
			const variant = selectedVariant();
			return isInStock(variant) ? 'instock' : 'outofstock';
		})()}
		productBrand="Khadka Foods"
		productCondition="new"
		structuredData={structuredData()}
		maxImagePreview="large"
		maxSnippet={-1}
	/>
{/if}

<section class="w-full py-12">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		{#if product}
			<div class="grid grid-cols-1 gap-8 lg:gap-12 lg:grid-cols-2">
				<!-- Product Images -->
				<div class="space-y-4 lg:space-y-6">
					<div class="group relative aspect-square overflow-hidden rounded-3xl border-2 border-base-300/50 bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-500">
						{#if activeImage}
							<OptimizedImage
								src={activeImage}
								alt={product.title}
								loading="eager"
								width={800}
								height={800}
								class="h-full w-full object-contain transition-transform duration-700 group-hover:scale-105"
								priority={true}
							/>
							<div class="absolute inset-0 bg-base-300/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
						{:else}
							<div class="flex h-full w-full items-center justify-center bg-base-200 text-base-content/40">
								<svg class="h-24 w-24 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</div>
						{/if}
					</div>
					{#if product.images && product.images.length > 1}
						<div class="grid grid-cols-4 gap-3">
							{#each product.images.slice(0, 8) as img, idx}
								<button
									class="group aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all duration-300 {activeImage === img.url ? 'border-primary shadow-lg scale-105' : 'border-base-300/50 hover:border-primary/50 hover:shadow-md'}"
									onclick={() => (activeImage = img.url)}
									style="animation-delay: {idx * 50}ms"
								>
									<OptimizedImage 
										src={img.url} 
										alt={product.title} 
										width={200}
										height={200}
										class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-110" 
									/>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Product Info as sticky card -->
				<div class="h-fit lg:sticky lg:top-24">
					<div class="card rounded-3xl border-2 border-base-300/50 bg-base-100 shadow-2xl hover:shadow-3xl transition-all duration-500 backdrop-blur-sm">
						<div class="card-body space-y-6 p-6 lg:p-8">
							<div class="space-y-3">
								<div class="flex items-start justify-between gap-3">
									<h1 class="flex-1 text-3xl font-extrabold tracking-tight lg:text-4xl">{product.title}</h1>
									{#if isNew()}
										<span class="badge badge-primary badge-lg rounded-full px-4 py-3 text-xs font-bold shadow-lg animate-pulse">NEW</span>
									{/if}
								</div>
								{#if product.subtitle}
									<p class="text-base lg:text-lg text-base-content/70 leading-relaxed">{product.subtitle}</p>
								{/if}
								<div class="flex items-baseline gap-3 pt-2">
									<div class="text-4xl lg:text-5xl font-black text-primary drop-shadow-sm">
										{formatCalculatedPrice(
											selectedVariant()?.calculated_price ??
												product.variants?.[0]?.calculated_price ??
												null
										)}
									</div>
								</div>
								<div class="flex flex-wrap items-center gap-2">
									{#if selectedVariant()?.sku}
										<div class="badge badge-outline badge-sm gap-1 font-mono">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
											SKU: {selectedVariant()?.sku}
										</div>
									{/if}
									{#if isInStock(selectedVariant())}
										<div class="badge badge-success badge-sm gap-1.5 font-semibold px-3 py-2.5 shadow-md">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
											In Stock
										</div>
									{:else}
										<div class="badge badge-error badge-sm gap-1.5 font-semibold px-3 py-2.5 shadow-md">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
											Out of Stock
										</div>
									{/if}
								</div>
							</div>

							{#if (product.options?.length ?? 0) > 0}
								<div class="space-y-5">
									{#each product.options as opt}
										<div class="space-y-3">
											<div class="text-sm font-bold uppercase tracking-wider text-base-content/80">{opt.title}</div>
											<div class="flex flex-wrap gap-2.5">
												{#each opt.values ?? [] as ov}
													<button
														class="btn btn-lg rounded-xl transition-all duration-300 {selected[opt.id!] === ov.value ? 'btn-primary shadow-lg scale-105' : 'btn-outline hover:scale-105'}"
														onclick={() => (selected[opt.id!] = ov.value)}
														aria-pressed={selected[opt.id!] === ov.value}
														aria-label={`Select ${opt.title} ${ov.value}`}
													>
														{ov.value}
													</button>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<div class="divider my-2"></div>

							<div class="space-y-4">
								{#if currentQty() > 0}
									<div class="flex flex-col sm:flex-row items-center gap-3">
										<div class="join w-full sm:w-auto overflow-hidden rounded-2xl border-2 border-base-300 shadow-md">
											<Button
												variant="ghost"
												size="lg"
												class="join-item text-lg font-bold"
												onclick={decSelected}
												disabled={isUpdating}
												aria-label="Decrease quantity">−</Button
											>
											<input
												class="join-item w-20 border-0 bg-transparent text-center text-lg font-bold pointer-events-none"
												value={currentQty()}
												readonly
												aria-live="polite"
												aria-label="Quantity"
											/>
											<Button
												variant="ghost"
												size="lg"
												class="join-item text-lg font-bold"
												onclick={incSelected}
												disabled={isUpdating}
												aria-label="Increase quantity">+</Button
											>
										</div>
										<a href="/cart" class="btn btn-outline btn-primary btn-lg rounded-xl flex-1 sm:flex-initial shadow-md hover:shadow-lg transition-all duration-300">View cart</a>
									</div>
								{:else}
									<button
										class="btn w-full btn-lg btn-primary rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 {isUpdating ? 'loading' : ''}"
										disabled={!selectedVariant()?.id || !isInStock(selectedVariant()) || isUpdating}
										onclick={addSelected}
										aria-label="Add to cart"
									>
										{#if isUpdating}
											<span class="loading loading-spinner"></span>
											Adding...
										{:else if !isInStock(selectedVariant())}
											Out of Stock
										{:else}
											<ShoppingCart class="size-5" />
											Add to cart
										{/if}
									</button>
									{#if justAdded}
										<a href="/cart" class="btn w-full btn-outline btn-primary btn-sm rounded-xl animate-fade-in">View cart</a>
									{/if}
								{/if}
							</div>

							<!-- Details & Meta -->
							<div class="space-y-5">
								{#if product.description}
									<div class="space-y-3">
										<h3 class="text-lg font-bold flex items-center gap-2">
											<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
											Description
										</h3>
										<div class="prose prose-sm max-w-none text-base-content/80 leading-relaxed p-4 rounded-xl bg-base-200/30">
											{product.description}
										</div>
									</div>
								{/if}
								{#if (product.categories?.length ?? 0) > 0 || product.collection || (product.tags?.length ?? 0) > 0}
									<div class="space-y-3">
										<h3 class="text-lg font-bold flex items-center gap-2">
											<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
											Categories & Tags
										</h3>

										<div class="flex flex-wrap gap-2">
											{#if (product.categories?.length ?? 0) > 0}
												{#each product.categories as c}
													<a
														href={`/categories/${c.handle}`}
														class="badge badge-primary badge-lg rounded-full px-4 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105"
														>{c.name}</a
													>
												{/each}
											{/if}
											{#if product.collection}
												<a
													href={`/collections/${product.collection.handle}`}
													class="badge badge-secondary badge-lg rounded-full px-4 py-3 transition-all duration-300 hover:shadow-lg hover:scale-105"
													>{product.collection.title}</a
												>
											{/if}
											{#if (product.tags?.length ?? 0) > 0}
												{#each product.tags as t}
													<span class="badge badge-outline badge-lg rounded-full px-4 py-3 transition-all duration-300 hover:bg-base-200">#{t.value}</span>
												{/each}
											{/if}
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Recommendations -->
				{#if recByCategory.length + recByCollection.length > 0}
					<div class="col-span-1 lg:col-span-2 mt-16 space-y-10">
						{#if recByCategory.length > 0}
							<div>
								<h3 class="mb-6 text-2xl font-bold flex items-center gap-2">
									<svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
									You may also like
								</h3>
								<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
									{#each recByCategory as p}
										<ProductCard
											href={`/products/${p.handle}`}
											title={p.title}
											image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
											price={(p?.variants ?? [])[0]?.calculated_price ?? null}
											variantId={(p?.variants ?? [])[0]?.id ?? null}
											createdAt={p?.created_at ?? null}
										/>
									{/each}
								</div>
							</div>
						{/if}
						{#if recByCollection.length > 0}
							<div>
								<h3 class="mb-6 text-2xl font-bold flex items-center gap-2">
									<svg class="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
									More from this collection
								</h3>
								<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
									{#each recByCollection as p}
										<ProductCard
											href={`/products/${p.handle}`}
											title={p.title}
											image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
											price={(p?.variants ?? [])[0]?.calculated_price ?? null}
											variantId={(p?.variants ?? [])[0]?.id ?? null}
											createdAt={p?.created_at ?? null}
										/>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<div class="p-10 text-center opacity-70">Product not found</div>
		{/if}
	</div>
</section>
