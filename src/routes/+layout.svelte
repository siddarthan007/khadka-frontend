<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button';
	import {
		Root as NavigationMenu,
		NavigationMenuList,
		NavigationMenuItem,
		NavigationMenuLink
	} from '$lib/components/ui/navigation-menu';
	import {
		Sheet,
		SheetTrigger,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetClose
	} from '$lib/components/ui/sheet';
	import { Separator } from '$lib/components/ui/separator';
	import logo from '$lib/assets/logo.png';
	import { Menu, Search, ShoppingCart, Sun, Moon, Github, Twitter, Linkedin, ChevronRight, Globe, Trash } from '@lucide/svelte';
	import { Motion, useAnimation, useMotionValue, useMotionTemplate } from 'svelte-motion';
	import { cn } from '$lib/utils.js';
	import { cart } from '$lib/stores/cart';
	import { ensureCart, removeLine } from '$lib/cart';
	import { toasts } from '$lib/stores/toast';
	import { page } from '$app/stores';

	type CollectionItem = { title: string; handle: string; emoji?: string };
	let { children, data }: { children: any; data?: { collectionItems?: CollectionItem[] } } = $props();
	let collectionItems: CollectionItem[] = $state(data?.collectionItems ?? []);
	let cartOpen = $state(false);

	const navLinks = [
		{ label: 'Shop', href: '/shop' },
		{ label: 'Collections', href: '/collections' },
		{ label: 'About', href: '/about' }
	];

	type Theme = 'light' | 'dark';
	const themes: Theme[] = ['light', 'dark'];
	let theme: Theme = $state('light');
	let scrolled = $state(false);
	let isCountriesOpen = $state(false);
	let countriesContainer: HTMLElement | null = $state(null);
	let svgControls = useAnimation();


	const listVariants = {
		visible: {
			clipPath: 'inset(0% 0% 0% 0% round 12px)',
			transition: { type: 'spring', bounce: 0 }
		},
		hidden: {
			clipPath: 'inset(10% 50% 90% 50% round 12px)',
			transition: { duration: 0.25, type: 'spring', bounce: 0 }
		}
	} as const;

	const itemVariants = {
		visible: (i: number) => ({
			opacity: 1,
			scale: 1,
			filter: 'blur(0px)',
			transition: { duration: 0.25, delay: i * 0.035 }
		}),
		hidden: { opacity: 0, scale: 0.92, filter: 'blur(10px)' }
	} as const;

	function applyTheme() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		const body = document.body;
		root.setAttribute('data-theme', theme);
		if (body) body.setAttribute('data-theme', theme);
		if (theme === 'dark') root.classList.add('dark');
		else root.classList.remove('dark');
		localStorage.setItem('theme', theme);
	}

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
		applyTheme();
	}

	function initTheme() {
		const saved = typeof localStorage !== 'undefined' ? (localStorage.getItem('theme') as Theme | null) : null;
		if (saved && themes.includes(saved)) {
			theme = saved;
		} else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
			theme = 'dark';
		} else {
			theme = 'light';
		}
		applyTheme();
	}

	function handleScroll() {
		scrolled = typeof window !== 'undefined' ? window.scrollY > 6 : false;
	}

	onMount(() => {
		initTheme();
		handleScroll();
		let onDocClick: ((e: MouseEvent) => void) | null = null;
		let onKey: ((e: KeyboardEvent) => void) | null = null;
		if (typeof window !== 'undefined') {
			window.addEventListener('scroll', handleScroll, { passive: true });
			onDocClick = (e: MouseEvent) => {
				if (!isCountriesOpen) return;
				const target = e.target as Node | null;
				if (countriesContainer && target && !countriesContainer.contains(target)) {
					isCountriesOpen = false;
				}
			};
			onKey = (e: KeyboardEvent) => {
				if (e.key === 'Escape') isCountriesOpen = false;
			};
			window.addEventListener('click', onDocClick, true);
			window.addEventListener('keydown', onKey);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('scroll', handleScroll);
				if (onDocClick) window.removeEventListener('click', onDocClick, true);
				if (onKey) window.removeEventListener('keydown', onKey);
			}
		};
	});

	let searchInputRef: HTMLInputElement | null = $state(null);
	let overlayRef: HTMLInputElement | null = $state(null);
	let isSearchOpen = $state(false);
	let searchQuery = $state('');
	let overlayOpacity = $state(0);
	let posX = useMotionValue(0);
	let posY = useMotionValue(0);
	let shineBorder = useMotionTemplate`radial-gradient(30% 30px at ${posX}px ${posY}px, rgba(134,120,249,1) 45%, transparent)`;

	function onSearchMouseMove(e: MouseEvent) {
	    if (!searchInputRef) return;
	    const rect = searchInputRef.getBoundingClientRect();
	    posX.set(e.clientX - rect.left);
	    posY.set(e.clientY - rect.top);
	}

	function onSearchFocus() {
	    overlayOpacity = 1;
	}

	function onSearchBlur() {
	    if (!isSearchOpen) overlayOpacity = 0;
	}

	function onSearchMouseEnter() { overlayOpacity = 1; }
	function onSearchMouseLeave() { if (!isSearchOpen) overlayOpacity = 0; }

	let typingTimer: ReturnType<typeof setTimeout> | null = null;
	let searchResults: { products: { id: string; title: string; handle: string; thumbnail: string | null }[]; categories: { id: string; name: string; handle: string; thumbnail: string | null }[] } = $state({ products: [], categories: [] });
	async function onSearchInput(e: Event) {
	    const value = (e.target as HTMLInputElement).value;
	    searchQuery = value;
	    if (typingTimer) clearTimeout(typingTimer);
	    if (value.trim().length > 0) {
	        isSearchOpen = true;
	        overlayOpacity = 1;
	        typingTimer = setTimeout(async () => {
	            try {
	                const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=6`);
	                const data = await res.json();
	                searchResults = { products: data.products ?? [], categories: data.categories ?? [] };
	            } catch (err) {
	                console.error('Search failed', err);
	                searchResults = { products: [], categories: [] };
	            }
	        }, 200);
	    } else {
	        typingTimer = setTimeout(() => {
	            if (searchQuery.trim().length === 0) { isSearchOpen = false; overlayOpacity = 0; searchResults = { products: [], categories: [] }; }
	        }, 250);
	    }
	}

	function closeSearch() { isSearchOpen = false; overlayOpacity = 0; }
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-svh flex flex-col">
	<header class="sticky top-0 z-50 backdrop-blur transition-colors duration-300" class:bg-base-100={scrolled} class:shadow-md={scrolled} class:border-b={scrolled} class:border-base-300={scrolled}>
		<div class="navbar max-w-7xl mx-auto px-3">
			<!-- Left: logo + dropdown -->
			<div class="flex items-center gap-2 flex-1">
				<a href="/" class="btn btn-ghost px-2 gap-3">
					<img src={logo} alt="KhadkaFoods" class="h-30 w-auto" />
				</a>
				<div class="relative hidden md:block" bind:this={countriesContainer}>
					<button class="px-3 py-2 rounded-md hover:bg-base-200 inline-flex items-center gap-2" onclick={() => (isCountriesOpen = !isCountriesOpen)} aria-expanded={isCountriesOpen}>
						<Globe class="size-4" />
						<span>Shop by countries</span>
					</button>
					{#if isCountriesOpen}
						<Motion animate={isCountriesOpen ? 'visible' : 'hidden'} variants={listVariants} initial="hidden" let:motion>
							<ul use:motion class={cn("absolute mt-2 min-w-64 max-h-[70vh] overflow-auto z-50 p-2 rounded-xl border bg-base-100 border-base-300 shadow-xl", isCountriesOpen ? "pointer-events-auto" : "pointer-events-none")}
							>
								{#each collectionItems as item, i}
									<Motion custom={i + 1} variants={itemVariants} initial="hidden" animate={isCountriesOpen ? 'visible' : 'hidden'} let:motion>
										<li use:motion>
											<a href={`/collections/${item.handle}`} class="group flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-base-200">
												<span class="flex items-center gap-2">
													<span class="opacity-80">{item.emoji ?? '🌍'}</span>
													<span>{item.title}</span>
												</span>
												<ChevronRight class="size-3 opacity-60 -translate-x-1 scale-0 opacity-0 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-x-0 transition-all" />
											</a>
										</li>
									</Motion>
								{/each}
							</ul>
						</Motion>
					{/if}
				</div>
			</div>

			<!-- Center search (desktop) -->
			<div class="hidden md:flex md:flex-[1.3] justify-center px-4">
				<div class="relative w-full max-w-xl">
					<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"><Search class="size-4" /></span>
					<input onmousemove={onSearchMouseMove} onfocus={onSearchFocus} onblur={onSearchBlur} onmouseenter={onSearchMouseEnter} onmouseleave={onSearchMouseLeave} oninput={onSearchInput} bind:this={searchInputRef} value={searchQuery} type="text" placeholder="Search products, categories..." class="h-10 w-full cursor-default rounded-full border border-base-300 bg-base-100 px-3.5 pl-9 text-base-content transition-colors duration-500 placeholder:select-none placeholder:text-base-content/60 focus:outline-none" />
					<input type="text" bind:this={overlayRef} disabled style={`opacity:${overlayOpacity}; -webkit-mask-image: ${$shineBorder}; mask-image: ${$shineBorder}; border: 1px solid #8678F9;`} aria-hidden="true" class="pointer-events-none absolute left-0 top-0 z-10 h-10 w-full cursor-default rounded-full bg-transparent p-0 opacity-0 transition-opacity duration-500" />
				</div>
			</div>

			<!-- Right nav links -->
			<div class="hidden md:flex">
				<NavigationMenu>
					<NavigationMenuList>
						{#each navLinks as link}
							<NavigationMenuItem>
								<NavigationMenuLink href={link.href} class="px-3 py-2 rounded-md hover:bg-base-200">{link.label}</NavigationMenuLink>
							</NavigationMenuItem>
						{/each}
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			<div class="flex-none gap-1 md:gap-2">
				<div class="dropdown dropdown-end" role="menu" tabindex="0">
					<Button variant="ghost" size="icon" aria-label="Cart" class="btn btn-ghost relative" onclick={() => (cartOpen = !cartOpen)} onkeydown={(e) => { if (e.key === 'Escape') cartOpen = false; }}>
						<ShoppingCart class="size-5" />
						<span class="badge badge-primary badge-sm absolute -right-1 -top-1">{($cart?.items?.length) ?? 0}</span>
					</Button>
					{#if cartOpen}
					<div class="dropdown-content z-[55] mt-2 w-80 rounded-xl border border-base-300 bg-base-100 shadow-xl" role="dialog" tabindex="-1" onclick={(e)=>e.stopPropagation()} onkeydown={(e)=>{ if(e.key==='Escape'){ cartOpen=false; } }}>
						<div class="p-3 max-h-96 overflow-auto space-y-2">
							{#if (($cart?.items?.length) ?? 0) === 0}
								<div class="p-6 text-center opacity-70">Your cart is empty</div>
							{:else}
								{#each $cart?.items ?? [] as li}
									<div class="flex items-center gap-3 rounded-lg border border-base-300 p-2">
										<img src={li.thumbnail ?? ''} alt={li.title} class="h-12 w-12 rounded object-cover bg-base-200" />
										<div class="min-w-0 flex-1">
											<div class="font-medium truncate">{li.title}</div>
											<div class="mt-1">
												<div class="join join-xs">
													<button class="btn btn-xs join-item" onclick={async (e) => { e.stopPropagation(); if ((li.quantity ?? 0) > 1) { const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) - 1); } else { const m = await import('$lib/cart'); await m.removeLine(li.id); } }}>-</button>
													<span class="btn btn-xs join-item btn-ghost no-animation cursor-default">{li.quantity}</span>
													<button class="btn btn-xs join-item" onclick={async (e) => { e.stopPropagation(); const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) + 1); }}>+</button>
												</div>
											</div>
										</div>
										<button class="btn btn-ghost btn-xs" title="Remove" onclick={() => removeLine(li.id)}>
											<Trash class="size-3" />
										</button>
									</div>
								{/each}
							{/if}
						</div>
						<div class="border-t border-base-300 p-3 flex items-center justify-between">
							<a href="/cart" class="btn btn-sm btn-primary">View cart</a>
							<button class="btn btn-sm btn-error" onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}>Clear all</button>
						</div>
					</div>
					{/if}
				</div>
				<Button variant="ghost" size="icon" aria-label="Toggle theme" class="btn btn-ghost" onclick={toggleTheme}>
					{#if theme === 'light'}
						<Sun class="size-5" />
					{:else}
						<Moon class="size-5" />
					{/if}
				</Button>

				<div class="md:hidden">
					<Sheet>
						<SheetTrigger>
							<Button variant="ghost" size="icon" aria-label="Open menu" class="btn btn-ghost">
								<Menu class="size-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="right" class="w-80">
							<SheetHeader>
								<SheetTitle>
									<div class="flex items-center gap-3">
										<img src={logo} alt="KhadkaFoods" class="h-8 w-auto" />
										<span class="font-semibold">KhadkaFoods</span>
									</div>
								</SheetTitle>
							</SheetHeader>
							<div class="py-4 space-y-1">
								<div class="px-3 py-2 text-xs uppercase opacity-60">Collections</div>
								{#each collectionItems as item}
									<a href={`/collections/${item.handle}`} class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200">
										<span class="flex items-center gap-2">
											<span class="opacity-80">{item.emoji ?? '🌍'}</span>
											<span>{item.title}</span>
										</span>
										<ChevronRight class="size-3 opacity-60" />
									</a>
								{/each}
								<Separator class="my-3" />
								{#each navLinks as link}
									<a href={link.href} class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200">
										<span>{link.label}</span>
										<ChevronRight class="size-4 opacity-60" />
									</a>
								{/each}
								<Separator class="my-3" />
								<div class="flex items-center justify-between">
									<span class="text-sm opacity-70">Theme</span>
									<Button variant="ghost" size="icon" aria-label="Toggle theme" class="btn btn-ghost" onclick={toggleTheme}>
										{#if theme === 'light'}
											<Sun class="size-5" />
										{:else}
											<Moon class="size-5" />
										{/if}
									</Button>
								</div>
							</div>
							<div class="mt-auto"></div>
							<SheetClose>
								<Button class="btn btn-primary w-full mt-4">Close</Button>
							</SheetClose>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</div>
	</header>

	<main class="flex-1">
		{@render children?.()}
		<!-- Toast host -->
		<div class="fixed bottom-4 right-4 z-[70] space-y-2 w-80">
			{#each $toasts as t (t.id)}
				<div class="alert shadow-lg" class:alert-success={t.type==='success'} class:alert-error={t.type==='error'} class:alert-info={t.type==='info'}>
					<span>{t.message}</span>
				</div>
			{/each}
		</div>
	</main>

	<!-- Search modal -->
	{#if isSearchOpen}
		<div class="fixed inset-0 z-[60]">
			<!-- Backdrop -->
			<div class="absolute inset-0 bg-black/40 backdrop-blur-sm" role="button" tabindex="0" onclick={closeSearch} onkeydown={(e)=>{ if(e.key==='Escape' || e.key==='Enter' || e.key===' '){ closeSearch(); } }}></div>
			<!-- Dialog -->
			<div class="absolute inset-x-0 top-16 mx-auto w-full max-w-2xl px-4">
				<div class="card bg-base-100 shadow-2xl border border-base-300 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4">
					<div class="p-4">
						<div class="relative">
							<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"><Search class="size-4" /></span>
							<input onmousemove={onSearchMouseMove} onfocus={onSearchFocus} onblur={onSearchBlur} onmouseenter={onSearchMouseEnter} onmouseleave={onSearchMouseLeave} oninput={onSearchInput} bind:this={searchInputRef} value={searchQuery} type="text" placeholder="Search products, categories..." class="input input-bordered w-full h-12 pl-9 pr-3 rounded-2xl" />
							<input type="text" disabled style={`opacity:${overlayOpacity}; mask-image: ${$shineBorder};`} aria-hidden="true" class="pointer-events-none absolute left-0 top-0 z-10 h-12 w-full rounded-2xl border border-primary/60 bg-transparent p-0" />
						</div>
					</div>
					<div class="border-t border-base-300">
						<div class="max-h-[60vh] overflow-auto p-2 space-y-3">
							{#if searchQuery.trim().length > 0}
								{#if searchResults.products.length > 0}
									<div>
										<h3 class="px-2 pb-1 text-xs uppercase opacity-60">Products</h3>
										<ul class="grid gap-2">
											{#each searchResults.products as p}
												<li>
													<a href={`/products/${p.handle}`} class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-base-200 transition-colors">
														<img src={p.thumbnail ?? ''} alt={p.title} class="h-10 w-10 rounded object-cover bg-base-200" />
														<div class="min-w-0">
															<p class="font-medium truncate">{p.title}</p>
															<p class="text-xs opacity-70 truncate">/{p.handle}</p>
														</div>
													</a>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if searchResults.categories.length > 0}
									<div>
										<h3 class="px-2 pb-1 text-xs uppercase opacity-60">Categories</h3>
										<ul class="grid gap-2">
											{#each searchResults.categories as c}
												<li>
													<a href={`/collections/${c.handle}`} class="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-base-200 transition-colors">
														<img src={c.thumbnail ?? ''} alt={c.name} class="h-10 w-10 rounded object-cover bg-base-200" />
														<div class="min-w-0">
															<p class="font-medium truncate">{c.name}</p>
															<p class="text-xs opacity-70 truncate">/{c.handle}</p>
														</div>
													</a>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if searchResults.products.length === 0 && searchResults.categories.length === 0}
									<div class="px-3 py-6 text-center opacity-70">No results yet…</div>
								{/if}
							{:else}
								<div class="px-3 py-6 text-center opacity-70">Start typing to search...</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<footer class="border-t border-base-300 bg-base-100/70">
		<div class="max-w-7xl mx-auto px-4 md:px-6 py-10 grid gap-8 md:grid-cols-3">
			<div class="space-y-3">
				<div class="flex items-center gap-3">
					<span class="font-semibold">KhadkaFoods</span>
				</div>
				<p class="text-sm opacity-70">Modern, thoughtful experiences for your storefront.</p>
				<div class="flex gap-2">
					<Button size="icon" class="btn btn-ghost"><Github class="size-4" /></Button>
					<Button size="icon" class="btn btn-ghost"><Twitter class="size-4" /></Button>
					<Button size="icon" class="btn btn-ghost"><Linkedin class="size-4" /></Button>
				</div>
			</div>
			<div>
				<h3 class="footer-title text-base font-semibold mb-3">Shop</h3>
				<ul class="space-y-2 text-sm">
					<li><a class="link link-hover" href="/shop">All Products</a></li>
					<li><a class="link link-hover" href="/collections">Collections</a></li>
					<li><a class="link link-hover" href="/deals">Deals</a></li>
					<li><a class="link link-hover" href="/gift-cards">Gift Cards</a></li>
				</ul>
			</div>
			<div>
				<h3 class="footer-title text-base font-semibold mb-3">Company</h3>
				<ul class="space-y-2 text-sm">
					<li><a class="link link-hover" href="/about">About</a></li>
					<li><a class="link link-hover" href="/contact">Contact</a></li>
					<li><a class="link link-hover" href="/careers">Careers</a></li>
					<li><a class="link link-hover" href="/support">Support</a></li>
				</ul>
			</div>
		</div>
		<div class="border-t border-base-300">
			<div class="max-w-7xl mx-auto px-4 md:px-6 py-4 text-xs opacity-70 flex items-center justify-between">
				<span>© {new Date().getFullYear()} KhadkaFoods. All rights reserved.</span>
				<div class="space-x-4">
					<a href="/privacy" class="link link-hover">Privacy</a>
					<a href="/terms" class="link link-hover">Terms</a>
				</div>
			</div>
		</div>
	</footer>
</div>
