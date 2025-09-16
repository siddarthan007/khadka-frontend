<script lang="ts">
	import { createAccordion, melt } from '@melt-ui/svelte'
	import ProductCard from '$lib/components/ProductCard.svelte'
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte'
	import { cn } from '$lib/utils'
	import { listProductsByCategoryIds } from '$lib/medusa'
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { tick } from 'svelte'
	let { data }: { data?: { category: any; subcategories: any[]; products: any[]; total: number; subCounts: Record<string, number> } } = $props();
	const category = data?.category
	const subcategories = data?.subcategories ?? []
	const products = data?.products ?? []
	const total = data?.total ?? 0
	const subCounts = data?.subCounts ?? {}
	// allIds is provided by the loader but optional
	const allIds: string[] = (data as any)?.allIds ?? []
	let currency = $state((products?.[0]?.variants?.[0]?.calculated_price?.currency_code ?? 'USD').toUpperCase())

	// sidebar selection: 'all' | subcat.id
	let selected: string = $state('all')
	let loading = $state(false)
	let visible = $state(products)
	let activeLabel: string = $state('All products')

	onMount(() => {
		const qs = new URLSearchParams($page.url.search)
		const sub = qs.get('sub')
		if (sub && sub !== 'all') {
			selected = sub
			loadFor(sub)
		}
		if (typeof document !== 'undefined') {
			document.title = `${category?.name ?? 'Category'} • KhadkaFoods`
		}
	})

	function findNodeById(nodes: any[], id: string): any | null {
		for (const n of nodes) {
			if (n.id === id) return n
			const found = findNodeById(n.children ?? [], id)
			if (found) return found
		}
		return null
	}

	function collectIds(node: any): string[] {
		return [node.id, ...(node.children?.flatMap(collectIds) ?? [])]
	}

	async function loadFor(targetId: string) {
		try {
			loading = true
			if (targetId === 'all') {
				visible = products
				return
			}
			const node = findNodeById(subcategories, targetId)
			const ids = node ? collectIds(node) : []
			const { products: prods } = await listProductsByCategoryIds(ids, { limit: 24, offset: 0, fields: 'title,handle,thumbnail,*variants.calculated_price' })
			visible = prods ?? []
		} catch (e) {
			console.error(e)
			visible = []
		} finally {
			loading = false
		}
	}

	function formatPrice(cp: any): string {
		if (!cp) return ''
		const amount = cp.calculated_amount ?? cp.amount ?? 0
		try {
			return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100)
		} catch {
			return `$${(amount/100).toFixed(2)}`
		}
	}

	async function onSelect(id: string) {
		selected = id
		const url = new URL($page.url)
		if (id === 'all') url.searchParams.delete('sub')
		else url.searchParams.set('sub', id)
		await goto(`${url.pathname}${url.search}`, { replaceState: true, noScroll: true })
		await tick()
		loadFor(id)
	}
</script>

<svelte:head>
	<title>{category?.name ? `${category.name} • KhadkaFoods` : 'Categories • KhadkaFoods'}</title>
	<meta name="description" content={`Shop ${category?.name ?? 'categories'} and discover more.`} />
	<meta property="og:title" content={category?.name ?? 'Categories'} />
	<meta property="og:type" content="website" />
</svelte:head>

<section class="w-full py-8">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<nav class="breadcrumbs text-sm mb-4">
			<ul>
				<li><a href="/">Home</a></li>
				<li><a href="/categories">Categories</a></li>
				<li class="text-base-content/70">{category?.name}</li>
			</ul>
		</nav>

		<header class="mb-6 flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight">{selected === 'all' ? category?.name : (findNodeById(subcategories, selected)?.name ?? category?.name)}</h1>
				{#if selected !== 'all'}
					<p class="text-sm opacity-70 mt-1">{subCounts[selected] ?? 0} products</p>
				{:else}
					<p class="text-sm opacity-70 mt-1">{total} products</p>
				{/if}
			</div>
		</header>

		<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
			<!-- Sidebar -->
			<aside class="lg:col-span-4 xl:col-span-3">
				<div class="card bg-base-100 border border-base-300/60 shadow-xl">
					<div class="card-body p-4">
						<h2 class="card-title text-lg">Subcategories</h2>
						<ul class="menu menu-sm rounded-box w-full">
							<li>
								<button class={cn('w-full flex justify-between rounded-md', selected==='all' ? 'active bg-primary/10 text-primary font-medium' : 'hover:bg-base-200')} onclick={() => onSelect('all')}>
									<span>All products</span>
									<span class="badge badge-ghost ml-auto">{total}</span>
								</button>
							</li>
							{#each subcategories as sc}
							<li>
								<button class={cn('w-full flex justify-between rounded-md', selected===sc.id ? 'active bg-primary/10 text-primary font-medium' : 'hover:bg-base-200')} onclick={() => onSelect(sc.id)}>
									<span>{sc.name}</span>
									<span class="badge badge-ghost ml-auto">{subCounts[sc.id] ?? 0}</span>
								</button>
							</li>
							{/each}
						</ul>
					</div>
				</div>
			</aside>

			<!-- Product listing -->
			<div class="lg:col-span-8 xl:col-span-9">
				{#if loading}
					<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
						{#each Array(8) as _, i}
							<div class="mx-auto w-full max-w-[270px] animate-pulse rounded-md border p-4 shadow-sm">
								<div class="mb-4 h-36 w-full rounded-sm bg-zinc-200 dark:bg-zinc-800"></div>
								<div class="space-y-2">
									<div class="h-4 w-[60%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[90%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
									<div class="h-4 w-[40%] rounded bg-zinc-200 dark:bg-zinc-800"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					{#if (visible?.length ?? 0) > 0}
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{#each visible as p}
								<ProductCard
									href={`/products/${p.handle}`}
									title={p.title}
									image={p.thumbnail ?? p.images?.[0]?.url ?? ''}
									price={(p?.variants ?? []).map((v:any)=>v?.calculated_price).filter(Boolean).reduce((min:any,cur:any)=>((cur?.calculated_amount ?? cur?.amount ?? 0)<(min?.calculated_amount ?? min?.amount ?? 0)?cur:min), (p?.variants?.[0]?.calculated_price ?? null))}
									variantId={p?.variants?.[0]?.id ?? null}
								/>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col items-center justify-center py-16 text-center border border-dashed border-base-300 rounded-2xl">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="mb-4 h-16 w-16 opacity-30">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h3l2 13h10l2-9H7" />
								<circle cx="9" cy="20" r="1.5" />
								<circle cx="18" cy="20" r="1.5" />
							</svg>
							<h3 class="text-lg font-semibold">No Items Found</h3>
							<p class="text-sm opacity-70 mt-1">Try a different subcategory or check back later.</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</section>
