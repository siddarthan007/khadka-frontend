<script lang="ts">
	import { cart } from '$lib/stores/cart'
	import { updateLine, removeLine, ensureCart } from '$lib/cart'
	import { onMount } from 'svelte'
	import ProductCard from '$lib/components/ProductCard.svelte'
	import { listProducts } from '$lib/medusa'
	import { formatCalculatedPrice, formatCurrency } from '$lib/utils'

	onMount(() => { ensureCart() })

	let promo: string = $state('')
	let promoDiscountMinor: number = $state(0)
	let recommended: any[] = $state([])

	onMount(async () => {
		try {
			const { products } = await listProducts({ limit: 8, fields: 'title,handle,thumbnail,variants.id,*variants.calculated_price' })
			recommended = products ?? []
		} catch {}
		if (typeof document !== 'undefined') {
			document.title = 'Your cart • KhadkaFoods'
		}
	})

	function applyPromo() {
		promoDiscountMinor = promo.trim().length > 0 ? Math.round(subtotalMinor() * 0.1) : 0
	}

	function lineTotal(li: any) {
		const unit = li?.variant?.calculated_price?.calculated_amount ?? li?.unit_price ?? 0
		const amount = unit * (li.quantity ?? 1)
		const currency = li?.variant?.calculated_price?.currency_code || 'USD'
		return formatCurrency(amount, currency)
	}

	function itemsArray(): Array<any> {
		return (($cart as any)?.items ?? []) as Array<any>
	}

	function subtotalMinor(): number {
		const items = itemsArray()
		return items.reduce((acc, li: any) => acc + ((li?.variant?.calculated_price?.calculated_amount ?? li?.unit_price ?? 0) * (li.quantity ?? 1)), 0)
	}

	function cartSubtotal(): string {
		const items = itemsArray()
		const currency = items[0]?.variant?.calculated_price?.currency_code || 'USD'
		return formatCurrency(subtotalMinor(), currency)
	}

	function cartTaxEstimate(): string {
		const items = itemsArray()
		const currency = items[0]?.variant?.calculated_price?.currency_code || 'USD'
		const taxMinor = Math.round(subtotalMinor() * 0.08)
		return formatCurrency(taxMinor, currency)
	}

	function cartTotalEstimate(): string {
		const items = itemsArray()
		const currency = items[0]?.variant?.calculated_price?.currency_code || 'USD'
		const totalMinor = subtotalMinor() - promoDiscountMinor + Math.round(subtotalMinor() * 0.08)
		return formatCurrency(totalMinor, currency)
	}
</script>

<section class="w-full py-10">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<header class="mb-6">
			<h1 class="text-3xl font-bold tracking-tight">Your cart</h1>
		</header>

		{#if (($cart?.items?.length ?? 0) === 0)}
			<div class="p-10 text-center opacity-70">Your cart is empty.</div>
		{:else}
			<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
				<div class="lg:col-span-8 space-y-3">
					{#each ($cart?.items ?? []) as li}
						<div class="flex items-center gap-4 rounded-xl border border-base-300 p-3">
							<img src={li.thumbnail ?? ''} alt={li.title} loading="lazy" decoding="async" class="h-16 w-16 rounded object-cover bg-base-200" />
							<div class="min-w-0 flex-1">
								<div class="font-medium truncate">{li.title}</div>
								<div class="text-sm opacity-70">{formatCalculatedPrice(li.variant?.calculated_price ?? null)}</div>
							</div>
							<div class="flex items-center gap-2">
								<button class="btn btn-xs" aria-label="Decrease quantity" onclick={() => updateLine(li.id, Math.max(1, (li.quantity ?? 1) - 1))}>-</button>
								<input class="input input-bordered input-xs w-12 text-center" aria-live="polite" aria-label="Quantity" value={li.quantity ?? 1} readonly />
								<button class="btn btn-xs" aria-label="Increase quantity" onclick={() => updateLine(li.id, (li.quantity ?? 1) + 1)}>+</button>
							</div>
							<div class="w-28 text-right font-semibold">{lineTotal(li)}</div>
							<button class="btn btn-ghost btn-xs" aria-label="Remove item" title="Remove" onclick={() => removeLine(li.id)}>Remove</button>
						</div>
					{/each}

					{#if (recommended?.length ?? 0) > 0}
					<div class="mt-6">
						<h3 class="text-lg font-semibold mb-3">You may also like</h3>
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{#each recommended as p}
								<ProductCard href={`/products/${p.handle}`} title={p.title} image={p.thumbnail ?? p.images?.[0]?.url ?? ''} price={(p?.variants ?? [])[0]?.calculated_price ?? null} variantId={p?.variants?.[0]?.id ?? null} />
							{/each}
						</div>
					</div>
					{/if}
				</div>
				<div class="lg:col-span-4 lg:sticky lg:top-20 h-fit">
					<div class="card bg-base-100 border border-base-300 shadow-xl">
						<div class="card-body space-y-3">
							<h2 class="card-title">Order Summary</h2>
							<div class="flex items-center justify-between text-sm">
								<span>Items</span>
								<span>{($cart?.items?.length ?? 0)}</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="opacity-70">Subtotal</span>
								<span class="font-medium">{cartSubtotal()}</span>
							</div>
							<div class="form-control">
								<label class="label" for="promo">
									<span class="label-text">Promo code</span>
								</label>
								<div class="join">
									<input id="promo" aria-label="Promo code" class="input input-bordered join-item" placeholder="Enter code" bind:value={promo} />
									<button class="btn join-item" onclick={applyPromo}>Apply</button>
								</div>
								{#if promoDiscountMinor > 0}
									<span class="text-xs opacity-70 mt-1">Applied: -{formatCurrency(promoDiscountMinor, (($cart?.items?.[0]?.variant?.calculated_price?.currency_code) || 'USD'))}</span>
								{/if}
							</div>
							<div class="flex items-center justify-between">
								<span class="opacity-70">Estimated tax</span>
								<span class="font-medium">{cartTaxEstimate()}</span>
							</div>
							<div class="divider my-1"></div>
							<div class="flex items-center justify-between text-lg">
								<span class="font-semibold">Total</span>
								<span class="font-bold">{cartTotalEstimate()}</span>
							</div>
							<div class="flex gap-2 pt-2">
								<a href="/checkout" class="btn btn-primary flex-1">Checkout</a>
								<button class="btn btn-error" onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}>Clear all</button>
							</div>
							<a href="/products" class="btn btn-ghost">Continue shopping</a>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>
