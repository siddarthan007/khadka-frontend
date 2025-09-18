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
	import {
		Menu,
		Search,
		ShoppingCart,
		Sun,
		Moon,
		ChevronRight,
		Globe,
		Trash,
		Phone,
		Mail,
		MapPin
	} from '@lucide/svelte';
	import { SiInstagram, SiFacebook, SiX } from '@icons-pack/svelte-simple-icons';
	import { Motion, useAnimation, useMotionValue, useMotionTemplate } from 'svelte-motion';
	import { cn } from '$lib/utils.js';
	import { cart } from '$lib/stores/cart';
	import { customer } from '$lib/stores/customer';
	import { ensureCart, removeLine } from '$lib/cart';
	import { toasts } from '$lib/stores/toast';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { User } from '@lucide/svelte';
	import { getCurrentCustomer } from '$lib/auth';
	import { get } from 'svelte/store';
	import { LogIn, UserPlus, CheckCircle2, AlertTriangle, Info } from '@lucide/svelte';
	import { login, register } from '$lib/auth';
	import PasswordInput from '$lib/components/ui/password-input.svelte';

	onMount(() => {
		// fire and forget; keep customer store fresh when layout mounts
		getCurrentCustomer().catch(() => {});
	});

	function onAccountClick() {
		const me = get(customer);
		goto(me ? '/account' : '/login');
	}

	let authOpen = $state(false);
	let authMode: 'login' | 'register' = $state('login');
	let authEmail = $state('');
	let authPassword = $state('');
	let authFirst = $state('');
	let authLast = $state('');
	let authLoading = $state(false);
	let authError: string | null = $state(null);
	const authContentVariants = {
		enter: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
		exit: { opacity: 0, y: 12, transition: { duration: 0.15 } }
	} as const;

	async function submitAuth(e: Event) {
		e.preventDefault();
		authError = null;
		authLoading = true;
		try {
			if (authMode === 'login') {
				const me = await login(authEmail, authPassword);
				if (me) {
					authOpen = false;
				} else {
					authError = 'Invalid email or password';
				}
			} else {
				const me = await register({
					email: authEmail,
					password: authPassword,
					first_name: authFirst,
					last_name: authLast
				});
				if (me) {
					authOpen = false;
				} else {
					authError = 'Could not create account';
				}
			}
		} finally {
			authLoading = false;
		}
	}

	type CollectionItem = { title: string; handle: string; emoji?: string };
	let { children, data }: { children: any; data?: { collectionItems?: CollectionItem[]; categoryItems?: any[]; storeMetadata?: Record<string, any> } } =
		$props();
	let collectionItems: CollectionItem[] = $state(data?.collectionItems ?? []);
	let categoryItems: any[] = $state(data?.categoryItems ?? []);
	let storeMetadata: Record<string, any> = $state(data?.storeMetadata ?? {});
	let cartOpen = $state(false);

	const navLinks = [
		{ label: 'Products', href: '/products' },
		{ label: 'Collections', href: '/collections' },
		{ label: 'Track Order', href: '/orders/lookup', icon: Search }
	];

	type Theme = 'khadka' | 'khadka-dark';
	const themes: Theme[] = ['khadka', 'khadka-dark'];
	let theme: Theme = $state('khadka');
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
		if (theme === 'khadka-dark') root.classList.add('dark');
		else root.classList.remove('dark');
		localStorage.setItem('theme', theme);
	}

	function toggleTheme() {
		theme = theme === 'khadka' ? 'khadka-dark' : 'khadka';
		applyTheme();
	}

	function initTheme() {
		const saved =
			typeof localStorage !== 'undefined' ? (localStorage.getItem('theme') as string | null) : null;
		const normalized = (saved === 'dark' ? 'khadka-dark' : saved) as Theme | null;
		if (normalized && themes.includes(normalized)) {
			theme = normalized;
		} else if (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-color-scheme: dark)').matches
		) {
			theme = 'khadka-dark';
		} else {
			theme = 'khadka';
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
		let onCountriesClick: ((e: MouseEvent) => void) | null = null;
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
			onCountriesClick = async (e: MouseEvent) => {
				const el = e.target as HTMLElement | null;
				if (!el) return;
				const anchor = el.closest('a[href^="/collections/"]') as HTMLAnchorElement | null;
				if (anchor) {
					e.preventDefault();
					isCountriesOpen = false;
					const href = anchor.getAttribute('href') || '/collections';

					// Use SvelteKit navigation with invalidateAll to ensure data reloads
					await goto(href, { invalidateAll: true });
				}
			};
			window.addEventListener('click', onDocClick, true);
			window.addEventListener('keydown', onKey);
			countriesContainer?.addEventListener('click', onCountriesClick as any, true);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('scroll', handleScroll);
				if (onDocClick) window.removeEventListener('click', onDocClick, true);
				if (onKey) window.removeEventListener('keydown', onKey);
				countriesContainer?.removeEventListener('click', onCountriesClick as any, true);
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

	function onSearchMouseEnter() {
		overlayOpacity = 1;
	}
	function onSearchMouseLeave() {
		if (!isSearchOpen) overlayOpacity = 0;
	}

	let typingTimer: ReturnType<typeof setTimeout> | null = null;
	let searchResults: {
		products: { id: string; title: string; handle: string; thumbnail: string | null }[];
		categories: { id: string; name: string; handle: string; thumbnail: string | null }[];
	} = $state({ products: [], categories: [] });
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
				if (searchQuery.trim().length === 0) {
					isSearchOpen = false;
					overlayOpacity = 0;
					searchResults = { products: [], categories: [] };
				}
			}, 250);
		}
	}

	function closeSearch() {
		isSearchOpen = false;
		overlayOpacity = 0;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-svh flex-col">
	<header
		class="sticky top-0 z-50 backdrop-blur transition-colors duration-300"
		class:bg-base-100={scrolled}
		class:shadow-md={scrolled}
		class:border-b={scrolled}
		class:border-base-300={scrolled}
	>
		<div class="mx-auto navbar max-w-7xl px-3">
			<!-- Left: logo + dropdown -->
			<div class="flex flex-1 items-center gap-2">
				<a href="/" class="btn gap-3 px-2 btn-ghost">
					<img src={logo} alt="KhadkaFoods" class="h-30 w-auto" />
				</a>
				<div class="relative hidden md:block" bind:this={countriesContainer}>
					<button
						class="inline-flex items-center gap-2 rounded-md px-3 py-2 hover:bg-base-200"
						onclick={() => (isCountriesOpen = !isCountriesOpen)}
						aria-expanded={isCountriesOpen}
					>
						<Globe class="size-4" />
						<span>Shop by countries</span>
					</button>
					{#if isCountriesOpen}
						<Motion
							animate={isCountriesOpen ? 'visible' : 'hidden'}
							variants={listVariants}
							initial="hidden"
							let:motion
						>
							<ul
								use:motion
								class={cn(
									'absolute z-50 mt-2 max-h-[70vh] min-w-64 overflow-auto rounded-xl border border-base-300 bg-base-100 p-2 shadow-xl',
									isCountriesOpen ? 'pointer-events-auto' : 'pointer-events-none'
								)}
							>
								{#each collectionItems as item, i}
									<Motion
										custom={i + 1}
										variants={itemVariants}
										initial="hidden"
										animate={isCountriesOpen ? 'visible' : 'hidden'}
										let:motion
									>
										<li use:motion>
											<a
												href={`/collections/${item.handle}`}
												class="group flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-base-200"
											>
												<span class="flex items-center gap-2">
													<span class="opacity-80">{item.emoji ?? '🌍'}</span>
													<span>{item.title}</span>
												</span>
												<ChevronRight
													class="size-3 -translate-x-1 scale-0 opacity-0 opacity-60 transition-all group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100"
												/>
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
			<div class="hidden justify-center px-4 md:flex md:flex-[1.3]">
				<div class="relative w-full max-w-xl">
					<span
						class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base-content/60"
						><Search class="size-4" /></span
					>
					<input
						onmousemove={onSearchMouseMove}
						onfocus={onSearchFocus}
						onblur={onSearchBlur}
						onmouseenter={onSearchMouseEnter}
						onmouseleave={onSearchMouseLeave}
						oninput={onSearchInput}
						bind:this={searchInputRef}
						value={searchQuery}
						type="text"
						placeholder="Search products, categories..."
						class="h-10 w-full cursor-default rounded-full border border-base-300 bg-base-100 px-3.5 pl-9 text-base-content transition-colors duration-500 placeholder:text-base-content/60 placeholder:select-none focus:outline-none"
					/>
					<input
						type="text"
						bind:this={overlayRef}
						disabled
						style={`opacity:${overlayOpacity}; -webkit-mask-image: ${$shineBorder}; mask-image: ${$shineBorder}; border: 1px solid #8678F9;`}
						aria-hidden="true"
						class="pointer-events-none absolute top-0 left-0 z-10 h-10 w-full cursor-default rounded-full bg-transparent p-0 opacity-0 transition-opacity duration-500"
					/>
				</div>
			</div>

			<!-- Right nav links -->
			<div class="hidden md:flex">
				<NavigationMenu>
					<NavigationMenuList>
						{#each navLinks as link}
							<NavigationMenuItem>
								<NavigationMenuLink href={link.href} class="rounded-md px-3 py-2 hover:bg-base-200"
									><span class="flex items-center gap-2">
										{#if link.icon}
											<link.icon class="size-4" />
										{/if}
										{link.label}
									</span></NavigationMenuLink
								>
							</NavigationMenuItem>
						{/each}
					</NavigationMenuList>
				</NavigationMenu>
			</div>

			<div class="flex-none gap-1 md:gap-2">
				<!-- Profile / Account Button -->
				<Button
					variant="ghost"
					size="icon"
					aria-label="Account"
					class="btn btn-ghost"
					onclick={onAccountClick}
				>
					<User class="size-5" />
				</Button>
				<!-- Quick auth modal trigger (mobile convenience) -->
				<Button
					variant="ghost"
					size="icon"
					aria-label="Open auth"
					class="btn btn-ghost md:hidden"
					onclick={() => {
						authMode = 'login';
						authOpen = true;
					}}
				>
					<LogIn class="size-5" />
				</Button>
				<!-- Mobile search trigger -->
				<Button
					variant="ghost"
					size="icon"
					aria-label="Search"
					class="btn btn-ghost md:hidden"
					onclick={() => {
						isSearchOpen = true;
						overlayOpacity = 1;
						if (searchInputRef) {
							searchInputRef.focus();
						}
					}}
				>
					<Search class="size-5" />
				</Button>
				<div class="dropdown dropdown-end" role="menu" tabindex="0">
					<Button
						variant="ghost"
						size="icon"
						aria-label="Cart"
						class="btn relative btn-ghost"
						onclick={() => (cartOpen = !cartOpen)}
						onkeydown={(e) => {
							if (e.key === 'Escape') cartOpen = false;
						}}
					>
						<ShoppingCart class="size-5" />
						<span
							class="absolute -top-1.5 -right-1.5 badge flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-base-100 badge-sm text-[10px] font-semibold shadow-lg badge-primary sm:h-5 sm:min-w-[1.25rem] sm:text-xs"
							>{$cart?.items?.length ?? 0}</span
						>
					</Button>
					{#if cartOpen}
						<div
							class="dropdown-content z-[55] mt-2 w-80 rounded-xl border border-base-300 bg-base-100 shadow-xl"
							role="dialog"
							tabindex="-1"
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => {
								if (e.key === 'Escape') {
									cartOpen = false;
								}
							}}
						>
							<div class="max-h-96 space-y-2 overflow-auto p-3">
								{#if ($cart?.items?.length ?? 0) === 0}
									<div class="p-6 text-center opacity-70">Your cart is empty</div>
								{:else}
									{#each $cart?.items ?? [] as li}
										<div class="flex items-center gap-3 rounded-lg border border-base-300 p-2">
											<div class="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-base-200">
												<img
													src={(li as any)?.variant?.metadata?.thumbnail ??
														(li as any)?.variant?.product?.thumbnail ??
														li.thumbnail ??
														''}
													alt={li.title}
													class="h-full w-full object-cover"
												/>
												{#if (li as any)?.variant?.title}
													<span
														class="absolute inset-x-0 bottom-0 truncate bg-base-100/70 px-1.5 py-0.5 text-[10px] leading-none text-base-content/75"
														>{(li as any).variant.title}</span
													>
												{/if}
											</div>
											<div class="min-w-0 flex-1">
												<div class="truncate font-medium">
													{li.title}
													{#if (li as any)?.variant?.title || (li as any)?.variant_title}<span
															class="text-xs opacity-60"
															>({(li as any)?.variant?.title ?? (li as any).variant_title})</span
														>{/if}
												</div>
												<div class="mt-1">
													<div class="join h-8 overflow-hidden rounded-full border border-base-300">
														<Button
															variant="ghost"
															size="sm"
															class="join-item btn-xs"
															onclick={async (e) => { e.stopPropagation(); if ((li.quantity ?? 0) > 1) { const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) - 1); } else { const m = await import('$lib/cart'); await m.removeLine(li.id); } }}
															aria-label="Decrease quantity">-</Button
														>
														<input
															class="pointer-events-none join-item w-10 border-0 bg-transparent text-center"
															value={li.quantity}
															readonly
															aria-live="polite"
															aria-label="Quantity"
														/>
														<Button
															variant="ghost"
															size="sm"
															class="join-item btn-xs"
															onclick={async (e) => { e.stopPropagation(); const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) + 1); }}
															aria-label="Increase quantity">+</Button
														>
													</div>
												</div>
											</div>
											<button
												class="btn btn-ghost btn-xs"
												title="Remove"
												onclick={() => removeLine(li.id)}
											>
												<Trash class="size-3" />
											</button>
										</div>
									{/each}
								{/if}
							</div>
							<div class="flex items-center justify-between border-t border-base-300 p-3">
								<a href="/cart" class="btn btn-sm btn-primary">View cart</a>
								<button
									class="btn btn-sm btn-error"
									onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}
									>Clear all</button
								>
							</div>
						</div>
					{/if}
				</div>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Toggle theme"
					class="btn btn-ghost"
					onclick={toggleTheme}
				>
					{#if theme === 'khadka'}
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
							<div class="space-y-1 py-4">
								<div class="px-3 py-2 text-xs uppercase opacity-60">Collections</div>
								{#each collectionItems as item}
									<a
										href={`/collections/${item.handle}`}
										class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200"
										onclick={async (e) => {
											e.preventDefault();
											const href = `/collections/${item.handle}`;

											// Use SvelteKit navigation with invalidateAll to ensure data reloads
											await goto(href, { invalidateAll: true });
										}}
									>
										<span class="flex items-center gap-2">
											<span class="opacity-80">{item.emoji ?? '🌍'}</span>
											<span>{item.title}</span>
										</span>
										<ChevronRight class="size-3 opacity-60" />
									</a>
								{/each}
								<Separator class="my-3" />
								{#each navLinks as link}
									<a
										href={link.href}
										class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200"
									>
										<span>{link.label}</span>
										<ChevronRight class="size-4 opacity-60" />
									</a>
								{/each}
								<Separator class="my-3" />
								<a
									href="/orders/lookup"
									class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200"
								>
									<span class="flex items-center gap-2">
										<Search class="size-4 opacity-60" />
										Track Order
									</span>
									<ChevronRight class="size-4 opacity-60" />
								</a>
								<Separator class="my-3" />
								<div class="flex items-center justify-between">
									<span class="text-sm opacity-70">Theme</span>
									<Button
										variant="ghost"
										size="icon"
										aria-label="Toggle theme"
										class="btn btn-ghost"
										onclick={toggleTheme}
									>
										{#if theme === 'khadka'}
											<Sun class="size-5" />
										{:else}
											<Moon class="size-5" />
										{/if}
									</Button>
								</div>
							</div>
							<div class="mt-auto"></div>
							<SheetClose>
								<Button class="btn mt-4 w-full btn-primary">Close</Button>
							</SheetClose>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</div>
	</header>

	<main class="flex-1">
		{#key $page.url.pathname}
			{@render children?.()}
		{/key}
		<!-- Toast host -->
		<div class="fixed right-4 bottom-4 z-[70] w-80 space-y-2">
			{#each $toasts as t (t.id)}
				<div
					class="alert shadow-lg transition-all"
					class:alert-success={t.type === 'success'}
					class:alert-error={t.type === 'error'}
					class:alert-info={t.type === 'info'}
				>
					<div>
						{#if t.type === 'success'}
							<CheckCircle2 class="size-4" />
						{:else if t.type === 'error'}
							<AlertTriangle class="size-4" />
						{:else}
							<Info class="size-4" />
						{/if}
					</div>
					<span>{t.message}</span>
				</div>
			{/each}
		</div>
	</main>

	<!-- Search modal -->
	{#if isSearchOpen}
		<div class="fixed inset-0 z-[60]">
			<!-- Backdrop -->
			<div
				class="absolute inset-0 bg-black/40 backdrop-blur-sm"
				role="button"
				tabindex="0"
				onclick={closeSearch}
				onkeydown={(e) => {
					if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
						closeSearch();
					}
				}}
			></div>
			<!-- Dialog -->
			<div class="absolute inset-x-0 top-16 mx-auto w-full max-w-2xl px-4">
				<div
					class="card animate-in overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl fade-in slide-in-from-top-4"
				>
					<div class="p-4">
						<div class="relative">
							<span
								class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base-content/60"
								><Search class="size-4" /></span
							>
							<input
								onmousemove={onSearchMouseMove}
								onfocus={onSearchFocus}
								onblur={onSearchBlur}
								onmouseenter={onSearchMouseEnter}
								onmouseleave={onSearchMouseLeave}
								oninput={onSearchInput}
								bind:this={searchInputRef}
								value={searchQuery}
								type="text"
								placeholder="Search products, categories..."
								class="input-bordered input h-12 w-full rounded-2xl pr-3 pl-9 input-primary"
							/>
							<input
								type="text"
								disabled
								style={`opacity:${overlayOpacity}; mask-image: ${$shineBorder};`}
								aria-hidden="true"
								class="pointer-events-none absolute top-0 left-0 z-10 h-12 w-full rounded-2xl border border-primary/60 bg-transparent p-0"
							/>
						</div>
					</div>
					<div class="border-t border-base-300">
						<div class="max-h-[60vh] space-y-3 overflow-auto p-2">
							{#if searchQuery.trim().length > 0}
								{#if searchResults.products.length > 0}
									<div>
										<h3 class="px-2 pb-1 text-xs uppercase opacity-60">Products</h3>
										<ul class="grid gap-2">
											{#each searchResults.products as p}
												<li>
													<a
														href={`/products/${p.handle}`}
														class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-base-200"
													>
														<img
															src={p.thumbnail ?? ''}
															alt={p.title}
															class="h-10 w-10 rounded bg-base-200 object-cover"
														/>
														<div class="min-w-0">
															<p class="truncate font-medium">{p.title}</p>
															<p class="truncate text-xs opacity-70">/{p.handle}</p>
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
													<a
														href={`/categories/${c.handle}`}
														class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-base-200"
													>
														<div class="min-w-0">
															<p class="truncate font-medium">{c.name}</p>
															<p class="truncate text-xs opacity-70">/{c.handle}</p>
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

	<!-- Auth modal -->
	{#if authOpen}
		<div class="fixed inset-0 z-[65]">
			<button
				type="button"
				aria-label="Close"
				class="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onclick={() => (authOpen = false)}
			></button>
			<div class="absolute inset-x-0 top-16 mx-auto w-full max-w-sm px-4 sm:max-w-md">
				<div
					class="card animate-in overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl fade-in slide-in-from-top-4"
				>
					<div
						class="flex items-center justify-between border-b border-base-300 bg-gradient-to-r from-base-200/60 to-base-100/20 p-3 sm:p-4"
					>
						<div class="tabs-boxed tabs tabs-sm sm:tabs">
							<button
								class="tab text-xs sm:text-sm transition"
								class:tab-active={authMode === 'login'}
								onclick={() => {
									authMode = 'login';
								}}>Login</button
							>
							<button
								class="tab text-xs sm:text-sm transition"
								class:tab-active={authMode === 'register'}
								onclick={() => {
									authMode = 'register';
								}}>Register</button
							>
						</div>
						<div class="flex items-center gap-2">
							{#if authMode === 'login'}<LogIn class="size-4" />{:else}<UserPlus
									class="size-4"
								/>{/if}
						</div>
					</div>
					{#key authMode}
						<Motion variants={authContentVariants} initial="exit" animate="enter" let:motion>
							<form class="space-y-3 p-3 sm:space-y-4 sm:p-4 transition-all" onsubmit={submitAuth} use:motion>
								{#if authError}
									<div class="alert alert-error text-sm"><span>{authError}</span></div>
								{/if}
								<label class="form-control w-full">
									<div class="label"><span class="label-text text-sm">Email</span></div>
									<input
										class="input-bordered input w-full border-base-300 input-primary h-10 sm:h-12 text-sm sm:text-base"
										type="email"
										placeholder="you@example.com"
										bind:value={authEmail}
										required
									/>
								</label>
								<label class="form-control w-full">
									<div class="label"><span class="label-text text-sm">Password</span></div>
									<div class="h-10 sm:h-12">
										<PasswordInput bind:value={authPassword} placeholder="••••••••" />
									</div>
								</label>
								{#if authMode === 'register'}
									<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
										<input
											class="input-bordered input border-base-300 input-primary h-10 sm:h-12 text-sm sm:text-base"
											placeholder="First name"
											bind:value={authFirst}
										/>
										<input
											class="input-bordered input border-base-300 input-primary h-10 sm:h-12 text-sm sm:text-base"
											placeholder="Last name"
											bind:value={authLast}
										/>
									</div>
								{/if}
								<div class="pt-2">
									<Button
										class={'btn w-full btn-primary h-10 sm:h-12 text-sm sm:text-base ' + (authLoading ? 'loading animate-pulse' : '')}
										disabled={authLoading}
										type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'}</Button
									>
								</div>
								{#if authMode === 'login'}
									<div class="text-center">
										<a href="/orders/lookup" class="link link-primary text-sm" onclick={() => (authOpen = false)}>
											Track your order
										</a>
									</div>
								{/if}
							</form>
						</Motion>
					{/key}
				</div>
			</div>
		</div>
	{/if}

	<footer class="border-t border-base-300 bg-base-100/70">
		<div class="mx-auto max-w-7xl px-4 py-10 md:px-6">
			<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
				<!-- Brand Section -->
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<img src={logo} alt="KhadkaFoods" class="h-8 w-8" />
						<span class="font-semibold text-lg">KhadkaFoods</span>
					</div>
					<p class="text-sm opacity-70">{storeMetadata.tagline || "Modern, thoughtful experiences for your storefront."}</p>
					<div class="flex gap-2">
						{#if storeMetadata.instagram}
							<a
								href={`https://instagram.com/${storeMetadata.instagram}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-primary btn-circle"
								aria-label="Instagram"
							>
								<SiInstagram />
							</a>
						{/if}
						{#if storeMetadata.facebook}
							<a
								href={`https://facebook.com/${storeMetadata.facebook}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-primary btn-circle"
								aria-label="Facebook"
							>
								<SiFacebook />
							</a>
						{/if}
						{#if storeMetadata.x}
							<a
								href={`https://x.com/${storeMetadata.x}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-primary btn-circle"
								aria-label="X (Twitter)"
							>
								<SiX />
							</a>
						{/if}
					</div>
				</div>

				<!-- Shop Links -->
				<div>
					<h3 class="footer-title mb-3 text-base font-semibold">Shop</h3>
					<ul class="space-y-2 text-sm">
						<li><a class="link link-hover" href="/products">All Products</a></li>
						<li><a class="link link-hover" href="/collections">Collections</a></li>
					</ul>
				</div>

				<!-- Company Links -->
				<div>
					<h3 class="footer-title mb-3 text-base font-semibold">Company</h3>
					<ul class="space-y-2 text-sm">
						<li><a class="link link-hover" href="/about">About</a></li>
					</ul>
				</div>

				<!-- Contact Info -->
				<div>
					<h3 class="footer-title mb-3 text-base font-semibold">Contact</h3>
					<div class="space-y-2 text-sm">
						{#if storeMetadata.phone}
							<p class="flex items-center gap-2">
								<Phone class="w-4 h-4 opacity-70" />
								<a href={`tel:${storeMetadata.phone}`} class="link link-hover">{storeMetadata.phone}</a>
							</p>
						{/if}
						{#if storeMetadata.email}
							<p class="flex items-center gap-2">
								<Mail class="w-4 h-4 opacity-70" />
								<a href={`mailto:${storeMetadata.email}`} class="link link-hover">{storeMetadata.email}</a>
							</p>
						{/if}
						{#if storeMetadata.address}
							<p class="flex items-start gap-2">
								<MapPin class="w-4 h-4 opacity-70 mt-0.5" />
								<a
									href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeMetadata.address)}`}
									target="_blank"
									rel="noopener noreferrer"
									class="link link-hover opacity-80 hover:opacity-100 transition-opacity"
									aria-label="Open location in Google Maps"
								>
									{storeMetadata.address}
								</a>
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div class="border-t border-base-300">
			<div
				class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 text-xs opacity-70 md:px-6"
			>
				<span>© {new Date().getFullYear()} KhadkaFoods. All rights reserved.</span>
				<div class="space-x-4">
					<a href="/privacy" class="link link-hover">Privacy</a>
					<a href="/tos" class="link link-hover">Terms</a>
				</div>
			</div>
		</div>
	</footer>
</div>
