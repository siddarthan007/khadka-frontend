<script lang="ts">
	import { cart } from '$lib/stores/cart';
	import {
		updateLine,
		removeLine,
		ensureCart,
		applyCoupon,
		removeCoupon,
		getCart
	} from '$lib/cart';
	import { onMount } from 'svelte';
	import ProductCard from '$lib/components/ProductCard.svelte';
	import {
		listProducts,
		listProductsByCategoryIds,
		listProductsByCollectionId,
		listProductsByCollectionAndCategories
	} from '$lib/medusa';
	import { formatCalculatedPrice, formatCurrency } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import { X, Trash } from '@lucide/svelte';
	import { customer } from '$lib/stores/customer';
	import { goto } from '$app/navigation';
	import { SiGoogle } from '@icons-pack/svelte-simple-icons';
	import { startGoogleOAuth } from '$lib/auth';

	onMount(() => {
		ensureCart();
	});

	let promo: string = $state('');
	let applying: boolean = $state(false);
	let recommended: any[] = $state([]);

	onMount(async () => {
		try {
			await getCart();
			await loadRecommendationsFromCart();
		} catch {}
		if (typeof document !== 'undefined') {
			document.title = 'Your cart • KhadkaFoods';
		}
	});

	let showChoice: boolean = $state(false);

	async function onCheckoutClick() {
		if ($customer as any) {
			await goto('/checkout');
			return;
		}
		showChoice = true;
	}

	async function loadRecommendationsFromCart() {
		try {
			const items = (($cart as any)?.items ?? []) as any[];
			const productIds = Array.from(
				new Set(
					items
						.map(
							(li: any) =>
								(li?.variant?.product_id ?? li?.product_id ?? li?.variant?.product?.id) as string
						)
						.filter(Boolean)
				)
			);
			if (productIds.length === 0) {
				recommended = [];
				return;
			}
			const { products: cartProducts } = await listProducts({
				id: productIds,
				limit: productIds.length,
				fields:
					'id,handle,title,thumbnail,*categories,*collection,variants.id,*variants.calculated_price'
			});
			const categoryIds = Array.from(
				new Set(
					(cartProducts ?? [])
						.flatMap((p: any) => (p?.categories ?? []).map((c: any) => c.id))
						.filter(Boolean)
				)
			);
			const collectionIds = Array.from(
				new Set((cartProducts ?? []).map((p: any) => p?.collection?.id).filter(Boolean))
			);

			let result: any[] = [];
			if (categoryIds.length > 0 && collectionIds.length > 0) {
				const { products } = await listProductsByCollectionAndCategories(
					collectionIds,
					categoryIds,
					{ limit: 12, fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price' }
				);
				result = products ?? [];
			}
			if ((result?.length ?? 0) === 0 && categoryIds.length > 0) {
				const { products } = await listProductsByCategoryIds(categoryIds, {
					limit: 12,
					fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price'
				});
				result = products ?? [];
			}
			if ((result?.length ?? 0) === 0 && collectionIds.length > 0) {
				const { products } = await listProductsByCollectionId(collectionIds, {
					limit: 12,
					fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price'
				});
				result = products ?? [];
			}
			if ((result?.length ?? 0) === 0) {
				const { products } = await listProducts({
					limit: 12,
					order: '-created_at',
					fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price'
				});
				result = products ?? [];
			}
			if ((result?.length ?? 0) === 0) {
				const { products } = await listProducts({
					limit: 12,
					fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price'
				});
				result = products ?? [];
			}
			const inCart = new Set(productIds);
			const dedup: any[] = [];
			const seen = new Set<string>();
			for (const p of result) {
				if (!p?.id || inCart.has(p.id)) continue;
				if (seen.has(p.id)) continue;
				seen.add(p.id);
				dedup.push(p);
			}
			recommended = dedup.slice(0, 8);
		} catch (err) {
			console.error('Failed to load recommendations', err);
			recommended = [];
		}
	}

	$effect(() => {
		// Recompute recommendations when cart items change
		const items = (($cart as any)?.items ?? []) as any[];
		const _ = JSON.stringify(items.map((i: any) => [i?.variant_id, i?.quantity]));
		if (items.length > 0) {
			void loadRecommendationsFromCart();
		} else {
			recommended = [];
		}
	});

	async function onApplyCoupon() {
		const code = promo.trim();
		if (!code) return;
		applying = true;
		try {
			await applyCoupon(code);
			await getCart();
			promo = '';
		} finally {
			applying = false;
		}
	}

	async function onRemoveCoupon(code: string) {
		applying = true;
		try {
			await removeCoupon(code);
			await getCart();
		} finally {
			applying = false;
		}
	}

	function lineTotal(li: any) {
		const unit = li?.variant?.calculated_price?.calculated_amount ?? li?.unit_price ?? 0;
		const amount = unit * (li.quantity ?? 1);
		const currency = li?.variant?.calculated_price?.currency_code || 'USD';
		return formatCurrency(amount, currency);
	}

	function itemsArray(): Array<any> {
		return (($cart as any)?.items ?? []) as Array<any>;
	}

	function subtotalMinor(): number {
		const items = itemsArray();
		return items.reduce(
			(acc, li: any) =>
				acc +
				(li?.variant?.calculated_price?.calculated_amount ?? li?.unit_price ?? 0) *
					(li.quantity ?? 1),
			0
		);
	}

	function cartSubtotal(): string {
		const items = itemsArray();
		const currency = items[0]?.variant?.calculated_price?.currency_code || 'USD';
		return formatCurrency(subtotalMinor(), currency);
	}

	function cartTax(): string {
		const currency = $cart?.items?.[0]?.variant?.calculated_price?.currency_code || 'USD';
		const taxMinor = Number(($cart as any)?.tax_total ?? 0);
		return formatCurrency(taxMinor, currency);
	}

	function cartShipping(): string {
		const currency = $cart?.items?.[0]?.variant?.calculated_price?.currency_code || 'USD';
		const shippingMinor = Number(($cart as any)?.shipping_total ?? 0);
		return formatCurrency(shippingMinor, currency);
	}

	function shippingMinor(): number {
		return Number(($cart as any)?.shipping_total ?? 0);
	}

	function discountMinor(): number {
		return Number(($cart as any)?.discount_total ?? 0);
	}

	function cartCurrency(): string {
		const items = itemsArray();
		return items[0]?.variant?.calculated_price?.currency_code || 'USD';
	}

	function cartDiscount(): string {
		return formatCurrency(discountMinor(), cartCurrency());
	}

	function cartTotalBeforeDiscount(): string {
		const totalMinor = Number(($cart as any)?.total ?? 0);
		return formatCurrency(totalMinor + discountMinor(), cartCurrency());
	}

	function cartTotal(): string {
		const currency = $cart?.items?.[0]?.variant?.calculated_price?.currency_code || 'USD';
		const totalMinor = Number(($cart as any)?.total ?? 0);
		return formatCurrency(totalMinor, currency);
	}

	function couponCodes(): string[] {
		const c: any = $cart as any;
		const codes = new Set<string>();
		const tryPush = (val: any) => {
			if (!val) return;
			const s = String(val).trim();
			if (s.length > 0) codes.add(s);
		};
		const fromArr = (arr: any) => {
			if (!Array.isArray(arr)) return;
			arr.forEach((e: any) => {
				if (typeof e === 'string') return tryPush(e);
				tryPush(
					e?.code ?? e?.promo_code ?? e?.promotion_code ?? e?.coupon_code ?? e?.promotion?.code
				);
			});
		};
		fromArr(c?.discounts);
		fromArr(c?.applied_discounts);
		fromArr(c?.promotions);
		fromArr(c?.applied_promotions);
		fromArr(c?.promo_codes);
		return Array.from(codes);
	}
</script>

<svelte:head>
	<title>Shopping Cart • KhadkaFoods - Review Your Order</title>
	<meta name="description" content="Review your shopping cart at KhadkaFoods. Check your selected products, apply coupons, and proceed to checkout for fast delivery." />
	<meta name="keywords" content="shopping cart, cart, checkout, order review, groceries cart, online shopping cart" />
	<meta name="robots" content="noindex, follow" />
	<meta name="author" content="KhadkaFoods" />
	<meta property="og:title" content="Shopping Cart • KhadkaFoods - Review Your Order" />
	<meta property="og:description" content="Review your shopping cart at KhadkaFoods. Check your selected products and proceed to checkout." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://khadkafoods.com/cart" />
	<meta property="og:image" content="/logo.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Shopping Cart • KhadkaFoods - Review Your Order" />
	<meta name="twitter:description" content="Review your shopping cart at KhadkaFoods. Check your selected products and proceed to checkout." />
	<meta name="twitter:image" content="/logo.png" />
	<link rel="canonical" href="https://khadkafoods.com/cart" />
</svelte:head>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-6">
			<h1 class="text-3xl font-bold tracking-tight">Your cart</h1>
		</header>

		{#if ($cart?.items?.length ?? 0) === 0}
			<div class="p-10 text-center opacity-70">Your cart is empty.</div>
		{:else}
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
				<div class="space-y-3 lg:col-span-8">
					{#each $cart?.items ?? [] as li}
						<div class="flex items-center gap-4 rounded-xl border border-base-300 p-3">
							<div class="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-base-200">
								{#key (li as any)?.id}
									<img
										src={(li as any)?.variant?.metadata?.thumbnail ??
											(li as any)?.variant?.product?.thumbnail ??
											(li as any)?.thumbnail ??
											''}
										alt={li.title}
										loading="lazy"
										decoding="async"
										class="h-full w-full object-cover"
									/>
								{/key}
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium">
									{li.title}
									{#if (li as any)?.variant?.title || (li as any)?.variant_title}<span
											class="text-sm opacity-60"
											>({(li as any)?.variant?.title ?? (li as any).variant_title})</span
										>{/if}
								</div>
								<div class="text-sm opacity-70">
									{formatCalculatedPrice(li.variant?.calculated_price ?? null)}
								</div>
							</div>
							<div class="join h-8 overflow-hidden rounded-full border border-base-300">
								<Button
									variant="ghost"
									size="sm"
									class="join-item"
									aria-label="Decrease quantity"
									onclick={() =>
										(li.quantity ?? 1) <= 1
											? removeLine(li.id)
											: updateLine(li.id, (li.quantity ?? 1) - 1)}>-</Button
								>
								<input
									class="join-item w-12 border-0 bg-transparent text-center"
									aria-live="polite"
									aria-label="Quantity"
									value={li.quantity ?? 1}
									readonly
								/>
								<Button
									variant="ghost"
									size="sm"
									class="join-item"
									aria-label="Increase quantity"
									onclick={() => updateLine(li.id, (li.quantity ?? 1) + 1)}>+</Button
								>
							</div>
							<div class="w-28 text-right font-semibold">{lineTotal(li)}</div>
							<button
								class="btn btn-ghost btn-xs btn-secondary"
								aria-label="Remove item"
								title="Remove"
								onclick={() => removeLine(li.id)}
							>
								<Trash class="size-3" />
							</button>
						</div>
					{/each}

					{#if (recommended?.length ?? 0) > 0}
						<div class="mt-6">
							<h3 class="mb-3 text-lg font-semibold">You may also like</h3>
							<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
								{#each recommended as p}
									<ProductCard
										href={`/products/${p.handle}`}
										title={p.title}
										image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
										price={(p?.variants ?? [])[0]?.calculated_price ?? null}
										variantId={p?.variants?.[0]?.id ?? null}
									/>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<div class="h-fit space-y-3 lg:sticky lg:top-20 lg:col-span-4">
					<!-- Coupon Card -->
					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<div class="card-body space-y-3">
							<h2 class="card-title">Coupon</h2>
							<div class="join w-full">
								<input
									id="promo"
									aria-label="Coupon code"
									class="input-bordered input join-item w-full border-base-300 input-primary"
									placeholder="Enter code"
									bind:value={promo}
								/>
								<button
									class="btn join-item btn-primary"
									class:loading={applying}
									onclick={onApplyCoupon}
									disabled={applying || promo.trim().length === 0}>Apply</button
								>
							</div>
							{#if couponCodes().length > 0}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each couponCodes() as code}
										<span
											class="badge flex items-center gap-1 rounded-full px-2.5 py-1 badge-success"
										>
											<span class="max-w-[8rem] truncate text-sm">{code}</span>
											<button
												class="btn h-5 min-h-[1.25rem] px-1 text-current btn-ghost btn-xs btn-secondary"
												aria-label="Remove coupon"
												title="Remove"
												onclick={() => onRemoveCoupon(code)}
											>
												<X class="size-3" />
											</button>
										</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Order Summary Card -->
					<div class="card border border-base-300 bg-base-100 shadow-xl">
						<div class="card-body space-y-3">
							<h2 class="card-title">Order Summary</h2>
							<div class="flex items-center justify-between text-sm">
								<span>Items</span>
								<span>{$cart?.items?.length ?? 0}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="opacity-70">Subtotal</span>
								<span class="font-medium">{cartSubtotal()}</span>
							</div>
							{#if discountMinor() > 0}
								<div class="flex items-center justify-between text-sm text-success">
									<span>Discount</span>
									<span>-{cartDiscount()}</span>
								</div>
							{/if}
							<div class="flex items-center justify-between">
								<span class="opacity-70">Estimated tax</span>
								<span class="font-medium">{cartTax()}</span>
							</div>
							<div class="divider my-1"></div>
							<div class="flex items-center justify-between text-lg">
								<span class="font-semibold">Total</span>
								<span class="font-bold">
									{#if discountMinor() > 0}
										<span class="mr-2 text-base line-through opacity-60"
											>{cartTotalBeforeDiscount()}</span
										>
									{/if}
									{cartTotal()}
								</span>
							</div>
							<div class="flex gap-2 pt-2">
								<button class="btn flex-1 btn-primary" onclick={onCheckoutClick}>Checkout</button>
								<button
									class="btn btn-error"
									onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}
									>Clear all</button
								>
							</div>

							{#if showChoice}
								<dialog class="modal-open modal">
									<div class="modal-box max-w-lg">
										<h3 class="text-lg font-bold">How do you want to check out?</h3>
										<p class="py-2 text-sm opacity-70">
											Choose to continue as a guest or sign in to save your order and track it
											easily.
										</p>
										<div class="mt-4 grid gap-2">
											<button class="btn w-full btn-primary" onclick={() => goto('/checkout')}
												>Continue as guest</button
											>
											<button
												class="btn w-full"
												onclick={() => goto('/login?return_to=%2Fcheckout')}
												>Sign in & continue</button
											>
											<button
												class="btn w-full"
												onclick={async () => {
													await startGoogleOAuth('/checkout');
												}}
											>
												<span class="mr-1"><SiGoogle size={18} /></span>
												Continue with Google
											</button>
										</div>
										<div class="modal-action">
											<button class="btn" onclick={() => (showChoice = false)}>Close</button>
										</div>
										<div class="mt-3 text-center text-sm">
											<a class="link" href="/orders/lookup">Track an order</a>
										</div>
									</div>
									<div class="modal-backdrop">
										<button type="button" class="hidden" onclick={() => (showChoice = false)}
											>close</button
										>
									</div>
								</dialog>
							{/if}
							<a href="/products" class="btn btn-ghost">Continue shopping</a>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
