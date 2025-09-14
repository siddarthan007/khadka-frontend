<script lang="ts">
	import { addLine, updateLine, removeLine, getCart } from '$lib/cart'
	import { cart } from '$lib/stores/cart'
	import { formatCalculatedPrice } from '$lib/utils'
	import ProductCard from '$lib/components/ProductCard.svelte'
	
	let { data }: { data?: { product: any, recByCategory?: any[], recByCollection?: any[] } } = $props();
	const product = data?.product
	const recByCategory = data?.recByCategory ?? []
	const recByCollection = data?.recByCollection ?? []
	let selected: Record<string, string> = $state({})
	let activeImage: string | null = $state(null)

	const isNew = $derived(() => {
		const created = product?.created_at ? new Date(product.created_at).getTime() : NaN
		if (Number.isNaN(created)) return false
		const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000
		return Date.now() - created <= fifteenDaysMs
	})

	$effect(() => {
		if (product?.title) {
			if (typeof document !== 'undefined') {
				document.title = `${product.title} • KhadkaFoods`
			}
		}
	})

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
	})

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
			console.error('Failed to add to cart:', error);
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
			console.error('Failed to update cart:', error);
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
			console.error('Failed to update cart:', error);
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

<svelte:head>
	<title>{product?.title ? `${product.title} • KhadkaFoods` : 'Product • KhadkaFoods'}</title>
	{#if product?.description}
		<meta name="description" content={product.description.slice(0, 150)} />
	{/if}
	{#if activeImage}
		<meta property="og:image" content={activeImage} />
	{/if}
	<meta property="og:title" content={product?.title ?? 'Product'} />
	<meta property="og:type" content="product" />
</svelte:head>

<section class="w-full py-8">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		{#if product}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
				<!-- Product Images -->
				<div class="space-y-4">
					<div class="aspect-square overflow-hidden rounded-2xl border border-base-300 bg-base-200">
						<img 
							src={activeImage ?? ''} 
							alt={product.title} 
							loading="lazy" 
							decoding="async" 
							class="h-full w-full object-cover transition-all duration-300" 
						/>
					</div>
					{#if product.images && product.images.length > 1}
						<div class="grid grid-cols-4 gap-2">
							{#each product.images.slice(0, 8) as img}
								<button class="aspect-square overflow-hidden rounded-lg border border-base-300 bg-base-200 cursor-pointer hover:border-primary/50 transition-colors" onclick={() => (activeImage = img.url)}>
									<img src={img.url} alt={product.title} class="h-full w-full object-cover" />
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Product Info as sticky card -->
				<div class="lg:sticky lg:top-24 h-fit">
					<div class="card bg-base-100 border border-base-300/70 shadow-xl rounded-2xl">
						<div class="card-body space-y-5">
							<div class="space-y-2">
								<h1 class="text-3xl lg:text-4xl font-bold tracking-tight">{product.title}</h1>
								{#if product.subtitle}
									<p class="text-base text-base-content/70">{product.subtitle}</p>
								{/if}
								<div class="text-2xl font-semibold text-primary">
									{formatCalculatedPrice(selectedVariant()?.calculated_price ?? product.variants?.[0]?.calculated_price ?? null)}
								</div>
							</div>
							{#if isNew()}
								<span class="badge badge-primary badge-sm">NEW</span>
							{/if}

							{#if (product.options?.length ?? 0) > 0}
								<div class="space-y-4">
									{#each product.options as opt}
										<div class="space-y-2">
											<div class="text-sm font-medium text-base-content/80">{opt.title}</div>
											<div class="flex flex-wrap gap-2">
												{#each opt.values ?? [] as ov}
													<button 
														class="btn btn-md"
														class:btn-primary={selected[opt.id!] === ov.value}
														class:btn-outline={selected[opt.id!] !== ov.value}
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

							<div class="space-y-3">
								{#if currentQty() > 0}
									<div class="flex items-center gap-4">
										<div class="join">
											<button class="btn btn-md join-item" onclick={decSelected} disabled={isUpdating} class:loading={isUpdating} aria-label="Decrease quantity">{#if !isUpdating}-{/if}</button>
											<span class="btn btn-md join-item btn-ghost no-animation cursor-default font-semibold" aria-live="polite">{currentQty()}</span>
											<button class="btn btn-md join-item" onclick={incSelected} disabled={isUpdating} class:loading={isUpdating} aria-label="Increase quantity">{#if !isUpdating}+{/if}</button>
										</div>
										<a href="/cart" class="btn btn-outline btn-primary btn-sm">View cart</a>
									</div>
								{:else}
									<button class="btn btn-primary btn-md w-full" disabled={!selectedVariant()?.id || !isInStock(selectedVariant()) || isUpdating} class:loading={isUpdating} onclick={addSelected} aria-label="Add to cart">
										{#if isUpdating}{:else if !isInStock(selectedVariant())}Out of Stock{:else}Add to cart{/if}
									</button>
									{#if justAdded}
										<a href="/cart" class="btn btn-outline btn-primary btn-sm w-full">View cart</a>
									{/if}
								{/if}
							</div>

							<!-- Details & Meta -->
							<div class="space-y-4">
								{#if product.description}
									<div class="space-y-2">
										<h3 class="text-lg font-semibold">Description</h3>
										<div class="prose prose-sm max-w-none text-base-content/80">{product.description}</div>
									</div>
								{/if}
								{#if (product.categories?.length ?? 0) > 0 || product.collection || (product.tags?.length ?? 0) > 0}
									<div class="space-y-2 pt-1">
										<h3 class="text-lg font-semibold">Details</h3>
										<div class="flex flex-wrap gap-2">
											{#if (product.categories?.length ?? 0) > 0}
												{#each product.categories as c}
													<a href={`/categories/${c.handle}`} class="badge badge-outline hover:badge-primary transition-colors">{c.name}</a>
												{/each}
											{/if}
											{#if product.collection}
												<a href={`/collections/${product.collection.handle}`} class="badge badge-secondary badge-outline hover:badge-secondary">{product.collection.title}</a>
											{/if}
											{#if (product.tags?.length ?? 0) > 0}
												{#each product.tags as t}
													<span class="badge badge-ghost">#{t.value}</span>
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
				{#if (recByCategory.length + recByCollection.length) > 0}
					<div class="mt-16 space-y-10">
						{#if recByCategory.length > 0}
							<div>
								<h3 class="text-lg font-semibold mb-3">You may also like</h3>
								<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-5">
									{#each recByCategory as p}
										<ProductCard href={`/products/${p.handle}`} title={p.title} image={p.thumbnail ?? p.images?.[0]?.url ?? ''} price={(p?.variants ?? [])[0]?.calculated_price ?? null} variantId={(p?.variants ?? [])[0]?.id ?? null} createdAt={p?.created_at ?? null} />
									{/each}
								</div>
							</div>
						{/if}
						{#if recByCollection.length > 0}
							<div>
								<h3 class="text-lg font-semibold mb-3">More from this collection</h3>
								<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-5">
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