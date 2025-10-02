<script lang="ts">
	import { cart } from "$lib/stores/cart";
	import {
		updateLine,
		removeLine,
		ensureCart,
		applyCoupon,
		removeCoupon,
		getCart,
	} from "$lib/cart";
	import { onMount } from "svelte";
	import SEO from "$lib/components/SEO.svelte";
	import EmptyState from "$lib/components/EmptyState.svelte";
	import ProductCard from "$lib/components/ProductCard.svelte";
	import CartSkeleton from "$lib/components/CartSkeleton.svelte";
	import { logger } from "$lib/logger";
	import {
		listProducts,
		listProductsByCategoryIds,
		listProductsByCollectionId,
		listProductsByCollectionAndCategories,
	} from "$lib/medusa";
	import { formatCalculatedPrice, formatCurrency } from "$lib/utils";
	import { Button } from "$lib/components/ui/button";
	import { X, Trash } from "@lucide/svelte";
	import { customer } from "$lib/stores/customer";
	import { goto } from "$app/navigation";
	import { SiGoogle } from "@icons-pack/svelte-simple-icons";
	import { startGoogleOAuth } from "$lib/auth";
	import { createDialog, melt } from "@melt-ui/svelte";
	import {
		trackViewCart,
		formatCartItemsForAnalytics,
		calculateCartValue,
	} from "$lib/utils/analytics";

	let promo: string = $state("");
	let applying: boolean = $state(false);
	let recommended: any[] = $state([]);
	let loading: boolean = $state(true);
	let isMobile: boolean = $state(false);

	onMount(() => {
		ensureCart();

		// Detect mobile/desktop
		const checkMobile = () => {
			isMobile = window.innerWidth < 768; // Tailwind 'md' breakpoint
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);

		return () => {
			window.removeEventListener("resize", checkMobile);
		};
	});

	onMount(async () => {
		try {
			await getCart();
			await loadRecommendationsFromCart();

			// Track view_cart event
			if (
				$cart &&
				($cart as any).items &&
				($cart as any).items.length > 0
			) {
				try {
					const items = formatCartItemsForAnalytics(
						($cart as any).items,
					);
					const value = calculateCartValue($cart);
					trackViewCart(
						value,
						($cart as any).currency_code?.toUpperCase() || "USD",
						items,
					);
				} catch (e) {
					logger.warn("Analytics tracking failed:", e);
				}
			}
		} catch {
		} finally {
			loading = false;
		}
	});

	// Melt UI Dialog setup
	const {
		elements: {
			trigger,
			portalled,
			overlay,
			content,
			title,
			description,
			close,
		},
		states: { open },
	} = createDialog({
		preventScroll: true,
	});

	async function onCheckoutClick() {
		if ($customer as any) {
			await goto("/checkout");
			return;
		}
		// Open the Melt UI dialog
		open.set(true);
	}

	async function loadRecommendationsFromCart() {
		try {
			const items = (($cart as any)?.items ?? []) as any[];
			const cartProductIds = new Set(
				items
					.map(
						(li: any) =>
							li?.variant?.product_id ??
							li?.product_id ??
							li?.variant?.product?.id,
					)
					.filter(Boolean),
			);

			if (cartProductIds.size === 0) {
				recommended = [];
				return;
			}

			// Fetch cart products with categories/collection
			const { products: cartProducts } = await listProducts({
				id: Array.from(cartProductIds),
				limit: cartProductIds.size,
				fields: "id,handle,title,thumbnail,*categories,*collection,variants.id,*variants.calculated_price",
			});

			const categoryIds = Array.from(
				new Set(
					(cartProducts ?? [])
						.flatMap((p: any) =>
							(p?.categories ?? []).map((c: any) => c.id),
						)
						.filter(Boolean),
				),
			);
			const collectionIds = Array.from(
				new Set(
					(cartProducts ?? [])
						.map((p: any) => p?.collection?.id)
						.filter(Boolean),
				),
			);

			let result: any[] = [];

			// 1️⃣ Try collection first
			if (collectionIds.length > 0) {
				const { products } = await listProductsByCollectionId(
					collectionIds,
					{
						limit: 12,
						fields: "title,handle,thumbnail,variants.id,*variants.calculated_price",
					},
				);
				result = products ?? [];
			}

			// 2️⃣ Add products from the same categories (avoid duplicates)
			if (categoryIds.length > 0) {
				const { products } = await listProductsByCategoryIds(
					categoryIds,
					{
						limit: 12,
						fields: "title,handle,thumbnail,variants.id,*variants.calculated_price",
					},
				);
				result = [...result, ...(products ?? [])];
			}

			// 3️⃣ Fallback to recent products if we still have less than 8
			if ((result?.length ?? 0) < 8) {
				const { products } = await listProducts({
					limit: 12,
					order: "-created_at",
					fields: "title,handle,thumbnail,variants.id,*variants.calculated_price",
				});
				result = [...result, ...(products ?? [])];
			}

			// Deduplicate & remove items already in cart
			const dedup: any[] = [];
			const seen = new Set<string>();
			for (const p of result) {
				if (!p?.id) continue;
				if (cartProductIds.has(p.id)) continue;
				if (seen.has(p.id)) continue;
				seen.add(p.id);
				dedup.push(p);
				if (dedup.length >= 8) break; // Only take first 8
			}

			recommended = dedup;
		} catch (err) {
			logger.error("Failed to load recommendations", err);
			recommended = [];
		}
	}

	$effect(() => {
		// Recompute recommendations when cart items change
		// Only track item IDs and quantities to avoid unnecessary runs
		const items = (($cart as any)?.items ?? []) as any[];
		const itemsKey = items
			.map((i: any) => `${i?.variant_id ?? ""}-${i?.quantity ?? 0}`)
			.join(",");

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
			promo = "";
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
		const unit =
			li?.variant?.calculated_price?.calculated_amount ??
			li?.unit_price ??
			0;
		const amount = unit * (li.quantity ?? 1);
		const currency = li?.variant?.calculated_price?.currency_code || "USD";
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
				(li?.variant?.calculated_price?.calculated_amount ??
					li?.unit_price ??
					0) *
					(li.quantity ?? 1),
			0,
		);
	}

	function cartSubtotal(): string {
		const items = itemsArray();
		const currency =
			items[0]?.variant?.calculated_price?.currency_code || "USD";
		return formatCurrency(subtotalMinor(), currency);
	}

	function cartTax(): string {
		const currency =
			$cart?.items?.[0]?.variant?.calculated_price?.currency_code ||
			"USD";
		const taxMinor = Number(($cart as any)?.tax_total ?? 0);
		return formatCurrency(taxMinor, currency);
	}

	function cartShipping(): string {
		const currency =
			$cart?.items?.[0]?.variant?.calculated_price?.currency_code ||
			"USD";
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
		return items[0]?.variant?.calculated_price?.currency_code || "USD";
	}

	function cartDiscount(): string {
		return formatCurrency(discountMinor(), cartCurrency());
	}

	function cartTotalBeforeDiscount(): string {
		const totalMinor = Number(($cart as any)?.total ?? 0);
		return formatCurrency(totalMinor + discountMinor(), cartCurrency());
	}

	function cartTotal(): string {
		const currency =
			$cart?.items?.[0]?.variant?.calculated_price?.currency_code ||
			"USD";
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
				if (typeof e === "string") return tryPush(e);
				tryPush(
					e?.code ??
						e?.promo_code ??
						e?.promotion_code ??
						e?.coupon_code ??
						e?.promotion?.code,
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

<SEO
	title="Shopping Cart • Khadka Foods - Review Your Order"
	description="Review your shopping cart at Khadka Foods. Check your selected products, apply coupons, and proceed to checkout for fast delivery."
	keywords={[
		"shopping cart",
		"cart",
		"checkout",
		"order review",
		"groceries cart",
		"online shopping cart",
	]}
	canonical="https://khadkafoods.com/cart"
	noindex={true}
/>

<section class="w-full py-12 min-h-screen">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-8">
			<h1 class="text-4xl font-extrabold tracking-tight text-primary">
				Your Shopping Cart
			</h1>
			<p class="mt-2 text-base-content/60">
				Review your items and proceed to checkout
			</p>
		</header>

		{#if loading}
			<CartSkeleton />
		{:else if ($cart?.items?.length ?? 0) === 0}
			<EmptyState
				message="Your cart is empty"
				icon="cart"
				description="Looks like you haven't added anything yet. Start exploring our products!"
				actionText="Start Shopping"
				actionHref="/products"
				class="min-h-[500px]"
			/>
		{:else}
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
				<div class="space-y-4 lg:col-span-8">
					<div
						class="card bg-base-100 shadow-xl border-2 border-base-300/50 rounded-3xl"
					>
						<div class="card-body p-4 sm:p-6">
							<h2 class="card-title text-xl font-bold mb-4">
								Cart Items ({$cart?.items?.length ?? 0})
							</h2>
							<div class="space-y-3">
								{#each $cart?.items ?? [] as li}
									<div
										class="group flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border-2 border-base-300/50 bg-base-100 hover:shadow-lg hover:border-primary/30 transition-all duration-300"
									>
										<!-- Left side: Image + Text -->
										<div
											class="flex items-center gap-4 flex-1 min-w-0"
										>
											<div
												class="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-base-200 shadow-md group-hover:shadow-lg transition-shadow"
											>
												{#key (li as any)?.id}
													<img
														src={(li as any)
															?.variant?.metadata
															?.thumbnail ??
															(li as any)?.variant
																?.product
																?.thumbnail ??
															(li as any)
																?.thumbnail ??
															""}
														alt={li.title}
														loading="lazy"
														decoding="async"
														class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
													/>
												{/key}
											</div>
											<div class="min-w-0 flex-1">
												<div
													class="font-semibold text-base truncate"
												>
													{li.title}
													{#if (li as any)?.variant?.title || (li as any)?.variant_title}
														<span
															class="text-sm text-base-content/60"
															>({(li as any)
																?.variant
																?.title ??
																(li as any)
																	.variant_title})</span
														>
													{/if}
												</div>
												<div
													class="text-sm font-medium text-primary mt-1"
												>
													{formatCalculatedPrice(
														li.variant
															?.calculated_price ??
															null,
													)}
												</div>
											</div>
										</div>

										<!-- Right side: Stepper + Price + Delete -->
										<div
											class="flex items-center gap-3 sm:gap-4"
										>
											<div
												class="join h-11 overflow-hidden rounded-full border-2 border-base-300 bg-base-100 shadow-md shrink-0"
											>
												<button
													type="button"
													class="join-item h-11 w-11 flex items-center justify-center text-xl font-bold hover:bg-base-200 active:bg-base-300 transition-all"
													aria-label="Decrease quantity"
													onclick={() =>
														(li.quantity ?? 1) <= 1
															? removeLine(li.id)
															: updateLine(
																	li.id,
																	(li.quantity ??
																		1) - 1,
																)}
												>
													<span class="leading-none"
														>−</span
													>
												</button>
												<input
													type="text"
													class="join-item w-14 border-0 bg-transparent text-center text-base font-bold focus:outline-none pointer-events-none"
													aria-live="polite"
													aria-label="Quantity"
													value={li.quantity ?? 1}
													readonly
												/>
												<button
													type="button"
													class="join-item h-11 w-11 flex items-center justify-center text-xl font-bold hover:bg-base-200 active:bg-base-300 transition-all"
													aria-label="Increase quantity"
													onclick={() =>
														updateLine(
															li.id,
															(li.quantity ?? 1) +
																1,
														)}
												>
													<span class="leading-none"
														>+</span
													>
												</button>
											</div>
											<div
												class="hidden sm:block w-24 text-right font-bold text-lg"
											>
												{lineTotal(li)}
											</div>
											<button
												class="btn btn-ghost btn-sm h-11 w-11 min-h-[2.75rem] p-0 rounded-xl hover:bg-error/10 hover:text-error transition-all"
												aria-label="Remove item"
												title="Remove"
												onclick={() =>
													removeLine(li.id)}
											>
												<Trash class="size-5" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					{#if (recommended?.length ?? 0) > 0}
						<div class="mt-6">
							<h3 class="mb-3 text-lg font-semibold">
								You may also like
							</h3>
							<div
								class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
							>
								{#each recommended.slice(0, isMobile ? 4 : 8) as p}
									<ProductCard
										href={`/products/${p.handle}`}
										title={p.title}
										image={p.thumbnail ??
											p.images?.[0]?.url ??
											""}
										price={(p?.variants ?? [])[0]
											?.calculated_price ?? null}
										variantId={p?.variants?.[0]?.id ?? null}
										class="min-w-0"
									/>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				<div class="h-fit space-y-4 lg:sticky lg:top-20 lg:col-span-4">
					<!-- Coupon Card -->
					<div
						class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl"
					>
						<div class="card-body space-y-4 p-6">
							<h2
								class="card-title text-xl font-bold flex items-center gap-2"
							>
								<svg
									class="w-6 h-6 text-primary"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/></svg
								>
								Coupon Code
							</h2>
							<div class="join w-full">
								<input
									id="promo"
									aria-label="Coupon code"
									class="input input-bordered join-item w-full border-2 input-primary bg-base-100 focus:border-primary transition-all rounded-l-xl"
									placeholder="Enter coupon code"
									bind:value={promo}
								/>
								<button
									class="btn join-item btn-primary rounded-r-xl px-6"
									class:loading={applying}
									onclick={onApplyCoupon}
									disabled={applying ||
										promo.trim().length === 0}
								>
									{#if applying}
										<span
											class="loading loading-spinner loading-sm"
										></span>
									{:else}
										Apply
									{/if}
								</button>
							</div>
							{#if couponCodes().length > 0}
								<div class="mt-2 flex flex-wrap gap-2">
									{#each couponCodes() as code}
										<span
											class="badge flex items-center gap-2 rounded-full px-3 py-3 badge-success shadow-md font-semibold whitespace-nowrap"
										>
											<svg
												class="w-3.5 h-3.5"
												fill="currentColor"
												viewBox="0 0 20 20"
												><path
													fill-rule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clip-rule="evenodd"
												/></svg
											>
											<span
												class="max-w-[8rem] truncate text-xs font-bold leading-none"
												>{code}</span
											>
											<button
												class="btn h-5 min-h-[1.25rem] px-1.5 text-current btn-ghost btn-xs hover:bg-success-content/20 rounded-full transition-all"
												aria-label="Remove coupon"
												title="Remove"
												onclick={() =>
													onRemoveCoupon(code)}
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
					<div
						class="card border-2 border-base-300/50 bg-base-100 shadow-xl rounded-3xl"
					>
						<div class="card-body space-y-4 p-6">
							<h2
								class="card-title text-xl font-bold flex items-center gap-2"
							>
								<svg
									class="w-6 h-6 text-primary"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
									/></svg
								>
								Order Summary
							</h2>
							<div
								class="bg-base-200/30 rounded-xl p-4 space-y-3"
							>
								<div
									class="flex items-center justify-between text-sm"
								>
									<span
										class="flex items-center gap-2 text-base-content/70"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
											/></svg
										>
										Items
									</span>
									<span class="font-bold"
										>{$cart?.items?.length ?? 0}</span
									>
								</div>
								<div class="divider my-0"></div>
								<div class="flex items-center justify-between">
									<span class="text-base-content/70"
										>Subtotal</span
									>
									<span class="font-semibold"
										>{cartSubtotal()}</span
									>
								</div>
								{#if discountMinor() > 0}
									<div
										class="flex items-center justify-between text-sm bg-success/10 rounded-lg p-2 -mx-2"
									>
										<span
											class="flex items-center gap-1.5 text-success font-medium"
										>
											<svg
												class="w-4 h-4"
												fill="currentColor"
												viewBox="0 0 20 20"
												><path
													fill-rule="evenodd"
													d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
													clip-rule="evenodd"
												/></svg
											>
											Discount
										</span>
										<span class="font-bold text-success"
											>-{cartDiscount()}</span
										>
									</div>
								{/if}
								<div class="flex items-center justify-between">
									<span class="text-base-content/70"
										>Estimated tax</span
									>
									<span class="font-semibold"
										>{cartTax()}</span
									>
								</div>
								{#if shippingMinor() > 0}
									<div
										class="flex items-center justify-between"
									>
										<span class="text-base-content/70"
											>Shipping</span
										>
										<span class="font-semibold"
											>{cartShipping()}</span
										>
									</div>
								{/if}
							</div>
							<div class="divider my-1"></div>
							<div
								class="flex items-center justify-between text-xl bg-primary/10 rounded-xl p-4"
							>
								<span class="font-bold">Total</span>
								<span class="font-extrabold text-primary">
									{#if discountMinor() > 0}
										<span
											class="mr-2 text-base line-through opacity-50 font-normal"
											>{cartTotalBeforeDiscount()}</span
										>
									{/if}
									{cartTotal()}
								</span>
							</div>
							<div class="flex gap-2 pt-2">
								<button
									class="btn flex-1 btn-primary btn-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
									onclick={onCheckoutClick}
								>
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
										/></svg
									>
									Checkout
								</button>
								<button
									class="btn btn-error btn-lg rounded-xl hover:shadow-lg transition-all"
									aria-label="Clear cart"
									title="Clear all items"
									onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}
								>
									<svg
										class="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/></svg
									>
								</button>
							</div>

							{#if $open}
								<div use:melt={$portalled}>
									<!-- Backdrop -->
									<div
										use:melt={$overlay}
										class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
									></div>

									<!-- Dialog Content -->
									<div
										use:melt={$content}
										class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-base-300/50 bg-base-100 shadow-2xl animate-in zoom-in-95 fade-in duration-200 mx-4 sm:max-w-lg"
									>
										<!-- Header with gradient background -->
										<!-- Header with gradient background -->
										<div
											class="bg-base-200/30 border-b-2 border-base-300/50 p-4 sm:p-6 rounded-t-2xl sm:rounded-t-3xl"
										>
											<div
												class="flex items-center justify-between"
											>
												<h3
													use:melt={$title}
													class="text-xl sm:text-2xl font-bold text-primary"
												>
													Ready to Checkout?
												</h3>
												<button
													use:melt={$close}
													class="btn btn-ghost btn-sm btn-circle hover:bg-error/10 hover:text-error transition-all"
													aria-label="Close dialog"
												>
													<X class="w-5 h-5" />
												</button>
											</div>
											<!-- Description -->
											<p
												use:melt={$description}
												class="text-sm text-base-content/70 mt-2"
											>
												Choose how you'd like to proceed
												with your order
											</p>
										</div>

										<!-- Content Body -->
										<!-- Content Body -->
										<div class="p-6">
											<!-- Action Buttons -->
											<div class="space-y-3">
												<button
													class="btn btn-primary w-full h-12 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
													onclick={() => {
														open.set(false);
														goto("/checkout");
													}}
												>
													<svg
														class="w-5 h-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														><path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M13 7l5 5m0 0l-5 5m5-5H6"
														/></svg
													>
													Continue as Guest
												</button>

												<div
													class="divider text-xs text-base-content/50 my-2"
												>
													OR
												</div>

												<button
													class="btn btn-outline btn-primary w-full h-12 rounded-xl text-base font-semibold border-2 hover:bg-primary hover:text-primary-content transition-all duration-300"
													onclick={() => {
														open.set(false);
														goto(
															"/login?return_to=%2Fcheckout",
														);
													}}
												>
													<svg
														class="w-5 h-5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														><path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
														/></svg
													>
													Sign In to Your Account
												</button>

												<button
													class="btn btn-outline w-full h-12 rounded-xl text-base font-semibold border-2 hover:bg-base-200 transition-all duration-300"
													onclick={async () => {
														open.set(false);
														await startGoogleOAuth(
															"/checkout",
														);
													}}
												>
													<div
														class="flex items-center justify-center gap-2"
													>
														<SiGoogle size={20} />
														<span
															>Continue with
															Google</span
														>
													</div>
												</button>
											</div>

											<!-- Footer Link -->
											<div
												class="mt-6 pt-4 border-t border-base-300/50 text-center"
											>
												<a
													href="/orders/lookup"
													class="text-sm text-primary hover:text-primary-focus font-medium inline-flex items-center gap-1 transition-colors"
													onclick={() =>
														open.set(false)}
												>
													<svg
														class="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														><path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
														/></svg
													>
													Track an Existing Order
												</a>
											</div>
										</div>
									</div>
								</div>
							{/if}
							<a href="/products" class="btn btn-ghost"
								>Continue shopping</a
							>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
