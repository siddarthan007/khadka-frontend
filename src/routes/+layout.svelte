<script lang="ts">
	import "../app.css";
	import favicon from "$lib/assets/favicon.svg";
	import { onMount } from "svelte";
	import { afterNavigate } from "$app/navigation";
	import { throttle } from "$lib/utils";
	import { logger } from "$lib/logger";

	import { Button } from "$lib/components/ui/button";
	import {
		Root as NavigationMenu,
		NavigationMenuList,
		NavigationMenuItem,
		NavigationMenuLink,
	} from "$lib/components/ui/navigation-menu";
	import {
		Sheet,
		SheetTrigger,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetClose,
	} from "$lib/components/ui/sheet";
	import { Separator } from "$lib/components/ui/separator";
	import logo from "$lib/assets/logo.png";
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
		MapPin,
	} from "@lucide/svelte";
	import {
		SiInstagram,
		SiFacebook,
		SiX,
	} from "@icons-pack/svelte-simple-icons";
	import {
		Motion,
		useAnimation,
		useMotionValue,
		useMotionTemplate,
	} from "svelte-motion";
	import { cn } from "$lib/utils.js";
	import { cart } from "$lib/stores/cart";
	import { customer } from "$lib/stores/customer";
	import { ensureCart, removeLine } from "$lib/cart";
	import { page } from "$app/state";
	import { goto, invalidateAll } from "$app/navigation";
	import { User } from "@lucide/svelte";
	import { getCurrentCustomer } from "$lib/auth";
	import { LogIn, UserPlus } from "@lucide/svelte";
	import { login, register } from "$lib/auth";
	import { sanitizeSearchQuery } from "$lib/security";
	import PasswordInput from "$lib/components/ui/password-input.svelte";
	import ToastContainer from "$lib/components/ToastContainer.svelte";
	import StickyMobileCart from "$lib/components/StickyMobileCart.svelte";
	import {
		initGoogleAnalytics,
		trackPageView,
		trackSearch,
		trackLinkClick,
		trackSelectItem,
	} from "$lib/utils/analytics";

	onMount(() => {
		// fire and forget; keep customer store fresh when layout mounts
		getCurrentCustomer().catch(() => {});

		// Initialize Google Analytics
		initGoogleAnalytics();
	});

	// Track page views on SPA navigation (SvelteKit doesn't reload pages)
	afterNavigate((nav) => {
		if (nav.to?.url) {
			trackPageView(nav.to.url.pathname, document.title);
		}
	});

	function onAccountClick() {
		const me = $customer;
		goto(me ? "/account" : "/login");
	}

	let authOpen = $state(false);
	let authMode: "login" | "register" = $state("login");
	let authEmail = $state("");
	let authPassword = $state("");
	let authFirst = $state("");
	let authLast = $state("");
	let authLoading = $state(false);
	let authError: string | null = $state(null);
	const authContentVariants = {
		enter: {
			opacity: 1,
			y: 0,
			transition: { type: "spring", stiffness: 220, damping: 24 },
		},
		exit: { opacity: 0, y: 12, transition: { duration: 0.15 } },
	} as const;

	async function submitAuth(e: Event) {
		e.preventDefault();
		authError = null;
		authLoading = true;
		try {
			if (authMode === "login") {
				const me = await login(authEmail, authPassword);
				if (me) {
					authOpen = false;
				} else {
					authError = "Invalid email or password";
				}
			} else {
				const me = await register({
					email: authEmail,
					password: authPassword,
					first_name: authFirst,
					last_name: authLast,
				});
				if (me) {
					authOpen = false;
				} else {
					authError = "Could not create account";
				}
			}
		} finally {
			authLoading = false;
		}
	}

	type CollectionItem = { title: string; handle: string; emoji?: string };
	let {
		children,
		data,
	}: {
		children: any;
		data?: {
			collectionItems?: CollectionItem[];
			categoryItems?: any[];
			storeMetadata?: Record<string, any>;
		};
	} = $props();
	let collectionItems: CollectionItem[] = $state(data?.collectionItems ?? []);
	let categoryItems: any[] = $state(data?.categoryItems ?? []);
	let storeMetadata: Record<string, any> = $state(data?.storeMetadata ?? {});
	let cartOpen = $state(false);

	const navLinks = [
		{ label: "Products", href: "/products" },
		{ label: "Collections", href: "/collections" },
		{ label: "Track Order", href: "/orders/lookup", icon: Search },
	];

	type Theme = "khadka" | "khadka-dark";
	const themes: Theme[] = ["khadka", "khadka-dark"];
	let theme: Theme = $state("khadka");
	let scrolled = $state(false);
	let isCountriesOpen = $state(false);
	let countriesContainer: HTMLElement | null = $state(null);
	let svgControls = useAnimation();

	const listVariants = {
		visible: {
			clipPath: "inset(0% 0% 0% 0% round 12px)",
			transition: { type: "spring", bounce: 0 },
		},
		hidden: {
			clipPath: "inset(10% 50% 90% 50% round 12px)",
			transition: { duration: 0.25, type: "spring", bounce: 0 },
		},
	} as const;

	const itemVariants = {
		visible: (i: number) => ({
			opacity: 1,
			scale: 1,
			filter: "blur(0px)",
			transition: { duration: 0.25, delay: i * 0.035 },
		}),
		hidden: { opacity: 0, scale: 0.92, filter: "blur(10px)" },
	} as const;

	function applyTheme() {
		if (typeof document === "undefined") return;
		const root = document.documentElement;
		const body = document.body;
		root.setAttribute("data-theme", theme);
		if (body) body.setAttribute("data-theme", theme);
		if (theme === "khadka-dark") root.classList.add("dark");
		else root.classList.remove("dark");
		localStorage.setItem("theme", theme);
	}

	function toggleTheme() {
		theme = theme === "khadka" ? "khadka-dark" : "khadka";
		applyTheme();
	}

	function initTheme() {
		const saved =
			typeof localStorage !== "undefined"
				? (localStorage.getItem("theme") as string | null)
				: null;
		const normalized = (
			saved === "dark" ? "khadka-dark" : saved
		) as Theme | null;
		if (normalized && themes.includes(normalized)) {
			theme = normalized;
		} else if (
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches
		) {
			theme = "khadka-dark";
		} else {
			theme = "khadka";
		}
		applyTheme();
	}

	function handleScroll() {
		scrolled = typeof window !== "undefined" ? window.scrollY > 6 : false;
	}

	// Throttled version to prevent excessive updates
	const throttledHandleScroll = throttle(handleScroll, 100);

	onMount(() => {
		initTheme();
		handleScroll();
		let onDocClick: ((e: MouseEvent) => void) | null = null;
		let onKey: ((e: KeyboardEvent) => void) | null = null;
		let onCountriesClick: ((e: MouseEvent) => void) | null = null;
		if (typeof window !== "undefined") {
			window.addEventListener("scroll", throttledHandleScroll, {
				passive: true,
			});
			onDocClick = (e: MouseEvent) => {
				if (!isCountriesOpen) return;
				const target = e.target as Node | null;
				if (
					countriesContainer &&
					target &&
					!countriesContainer.contains(target)
				) {
					isCountriesOpen = false;
				}
			};
			onKey = (e: KeyboardEvent) => {
				if (e.key === "Escape") isCountriesOpen = false;
			};
			onCountriesClick = async (e: MouseEvent) => {
				const el = e.target as HTMLElement | null;
				if (!el) return;
				const anchor = el.closest(
					'a[href^="/collections/"]',
				) as HTMLAnchorElement | null;
				if (anchor) {
					e.preventDefault();
					isCountriesOpen = false;
					const href = anchor.getAttribute("href") || "/collections";

					// Use SvelteKit navigation with invalidateAll to ensure data reloads
					await goto(href, { invalidateAll: true });
				}
			};
			window.addEventListener("click", onDocClick, true);
			window.addEventListener("keydown", onKey);
			countriesContainer?.addEventListener(
				"click",
				onCountriesClick as any,
				true,
			);
		}
		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener("scroll", throttledHandleScroll);
				if (onDocClick)
					window.removeEventListener("click", onDocClick, true);
				if (onKey) window.removeEventListener("keydown", onKey);
				countriesContainer?.removeEventListener(
					"click",
					onCountriesClick as any,
					true,
				);
			}
		};
	});

	let searchInputRef: HTMLInputElement | null = $state(null);
	let overlayRef: HTMLInputElement | null = $state(null);
	let isSearchOpen = $state(false);
	let searchQuery = $state("");
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
		products: {
			id: string;
			title: string;
			handle: string;
			thumbnail: string | null;
		}[];
		categories: {
			id: string;
			name: string;
			handle: string;
			thumbnail: string | null;
		}[];
	} = $state({ products: [], categories: [] });
	async function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		const sanitized = sanitizeSearchQuery(value);
		searchQuery = sanitized;
		if (typingTimer) clearTimeout(typingTimer);
		if (sanitized.trim().length > 0) {
			isSearchOpen = true;
			overlayOpacity = 1;
			typingTimer = setTimeout(async () => {
				try {
					const res = await fetch(
						`/api/search?q=${encodeURIComponent(sanitized)}&limit=6`,
					);
					const data = await res.json();
					searchResults = {
						products: data.products ?? [],
						categories: data.categories ?? [],
					};
				} catch (err) {
					logger.error("Search failed", err);
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
	<!-- Canonical & Icons -->
	<link rel="icon" href={favicon} />
	<link rel="apple-touch-icon" href={favicon} />
	{#if page}
		<link rel="canonical" href={`${page.url.origin}${page.url.pathname}`} />
	{/if}

	<!-- Primary Meta -->
	<title>{storeMetadata.title ?? "Khadka Foods"}</title>
	<meta
		name="description"
		content={storeMetadata.description ??
			"Discover and shop curated products at Khadka Foods. Fast checkout, secure payments, and great collections."}
	/>
	<meta
		name="theme-color"
		content="#111827"
		media="(prefers-color-scheme: dark)"
	/>
	<meta
		name="theme-color"
		content="#ffffff"
		media="(prefers-color-scheme: light)"
	/>

	<!-- Robots (dynamic per-route) -->
	{#if page}
		{#key page.url.pathname}
			{#if (() => {
				const p = page.url.pathname;
				const noindexPaths = ["/cart", "/checkout", "/login", "/register", "/account", "/orders/lookup", "/oauth", "/password-reset", "/reset-password"];
				return noindexPaths.some((x) => p === x || p.startsWith(`${x}/`));
			})()}
				<meta name="robots" content="noindex,nofollow,noarchive" />
			{:else}
				<meta name="robots" content="index,follow" />
			{/if}
		{/key}
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta
		property="og:site_name"
		content={storeMetadata.title ?? "Khadka Foods"}
	/>
	{#if page}
		<meta
			property="og:url"
			content={`${page.url.origin}${page.url.pathname}`}
		/>
	{/if}
	<meta property="og:title" content={storeMetadata.title ?? "Khadka Foods"} />
	<meta
		property="og:description"
		content={storeMetadata.description ??
			"Shop curated collections at Khadka Foods."}
	/>
	<meta property="og:image" content="/hero.png" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	{#if storeMetadata.x}
		<meta name="twitter:site" content={`@${storeMetadata.x}`} />
	{/if}
	<meta
		name="twitter:title"
		content={storeMetadata.title ?? "Khadka Foods"}
	/>
	<meta
		name="twitter:description"
		content={storeMetadata.description ??
			"Shop curated collections at Khadka Foods."}
	/>
	<meta name="twitter:image" content="/hero.png" />

	<!-- JSON-LD: Organization -->
	{#if page}
		{@const org = {
			"@context": "https://schema.org",
			"@type": "Organization",
			name: storeMetadata.title ?? "Khadka Foods",
			url: `${page.url.origin}`,
			logo: "/favicon.svg",
			sameAs: [
				storeMetadata.instagram
					? `https://instagram.com/${storeMetadata.instagram}`
					: null,
				storeMetadata.facebook
					? `https://facebook.com/${storeMetadata.facebook}`
					: null,
				storeMetadata.x ? `https://x.com/${storeMetadata.x}` : null,
			].filter(Boolean),
		}}
		{@html `<script type="application/ld+json">${JSON.stringify(org).replace(/<\/script>/g, "<\\/script>")}</script>`}
	{/if}
</svelte:head>

<div class="flex min-h-svh flex-col max-w-[100vw]">
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
					<img src={logo} alt="Khadka Foods" class="h-30 w-auto" />
				</a>
				<div
					class="relative hidden md:block"
					bind:this={countriesContainer}
				>
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
							animate={isCountriesOpen ? "visible" : "hidden"}
							variants={listVariants}
							initial="hidden"
							let:motion
						>
							<ul
								use:motion
								class={cn(
									"absolute z-50 mt-2 max-h-[70vh] min-w-64 overflow-auto rounded-xl border border-base-300 bg-base-100 p-2 shadow-xl",
									isCountriesOpen
										? "pointer-events-auto"
										: "pointer-events-none",
								)}
							>
								{#each collectionItems as item, i}
									<Motion
										custom={i + 1}
										variants={itemVariants}
										initial="hidden"
										animate={isCountriesOpen
											? "visible"
											: "hidden"}
										let:motion
									>
										<li use:motion>
											<a
												href={`/collections/${item.handle}`}
												class="group flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-base-200"
											>
												<span
													class="flex items-center gap-2"
												>
													<span class="opacity-80"
														>{item.emoji ??
															"🌍"}</span
													>
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
								<NavigationMenuLink
									href={link.href}
									class="rounded-md px-3 py-2 hover:bg-base-200"
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
							if (e.key === "Escape") cartOpen = false;
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
							class="dropdown-content z-[55] mt-2 w-80 sm:w-96 rounded-2xl border-2 border-base-300/50 bg-base-100 shadow-2xl"
							role="dialog"
							tabindex="-1"
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => {
								if (e.key === "Escape") {
									cartOpen = false;
								}
							}}
						>
							<div class="px-4 py-3 border-b border-base-300">
								<h3
									class="text-lg font-bold flex items-center gap-2"
								>
									<ShoppingCart class="size-5 text-primary" />
									Your Cart
									<span class="ml-auto"
										>{$cart?.items?.length ?? 0}</span
									>
								</h3>
							</div>
							<div class="max-h-96 space-y-2 overflow-auto p-3">
								{#if ($cart?.items?.length ?? 0) === 0}
									<div
										class="flex flex-col items-center justify-center py-12 text-center"
									>
										<svg
											class="w-16 h-16 text-base-content/30 mb-3"
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
										<p
											class="text-base-content/60 font-medium"
										>
											Your cart is empty
										</p>
										<a
											href="/products"
											class="btn btn-primary btn-sm rounded-xl mt-4"
											onclick={() => (cartOpen = false)}
											>Start Shopping</a
										>
									</div>
								{:else}
									{#each $cart?.items ?? [] as li}
										<div
											class="flex items-center gap-3 rounded-xl border-2 border-base-300/50 p-3 hover:border-primary/30 transition-all bg-base-100"
										>
											<div
												class="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base-200"
											>
												<img
													src={(li as any)?.variant
														?.metadata?.thumbnail ??
														(li as any)?.variant
															?.product
															?.thumbnail ??
														li.thumbnail ??
														""}
													alt={li.title}
													loading="lazy"
													class="h-full w-full object-contain"
												/>
											</div>
											<div
												class="min-w-0 flex-1 space-y-2"
											>
												<div
													class="font-semibold text-sm line-clamp-2 leading-tight"
												>
													{li.title}
												</div>
												{#if (li as any)?.variant?.title || (li as any)?.variant_title}
													<div
														class="text-xs text-base-content/60"
													>
														{(li as any)?.variant
															?.title ??
															(li as any)
																.variant_title}
													</div>
												{/if}
												<div
													class="flex items-center gap-2"
												>
													<div
														class="stepper join h-8"
														style="--stepper-height: 2rem; --stepper-max-width: 8.25rem;"
													>
														<button
															type="button"
															class="stepper-button join-item flex-1 basis-[2.25rem] text-sm font-bold"
															onclick={async (e) => { e.stopPropagation(); if ((li.quantity ?? 0) > 1) { const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) - 1); } else { const m = await import('$lib/cart'); await m.removeLine(li.id); } }}
															aria-label="Decrease quantity"
														>
															<span
																class="leading-none"
																>−</span
															>
														</button>
														<input
															class="pointer-events-none stepper-input join-item flex-[1.05] basis-[2.4rem] text-sm font-bold"
															value={li.quantity}
															readonly
															aria-live="polite"
															aria-label="Quantity"
														/>
														<button
															type="button"
															class="stepper-button join-item flex-1 basis-[2.25rem] text-sm font-bold"
															onclick={async (e) => { e.stopPropagation(); const m = await import('$lib/cart'); await m.updateLine(li.id, (li.quantity ?? 0) + 1); }}
															aria-label="Increase quantity"
														>
															<span
																class="leading-none"
																>+</span
															>
														</button>
													</div>
													<button
														class="btn btn-ghost btn-xs h-8 w-8 p-0 rounded-lg hover:bg-error/10 hover:text-error transition-all"
														title="Remove"
														aria-label="Remove item"
														onclick={() =>
															removeLine(li.id)}
													>
														<Trash class="size-4" />
													</button>
												</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
							{#if ($cart?.items?.length ?? 0) > 0}
								<div
									class="flex items-center justify-between gap-2 border-t border-base-300 p-4"
								>
									<a
										href="/cart"
										class="btn btn-primary flex-1 rounded-xl hover:shadow-lg transition-all"
										onclick={() => (cartOpen = false)}
									>
										<ShoppingCart class="size-4" />
										View Cart
									</a>
									<button
										class="btn btn-error rounded-xl hover:shadow-lg transition-all"
										aria-label="Clear cart"
										onclick={async () => { const m = await import('$lib/cart'); await m.clearCart(); }}
									>
										<Trash class="size-4" />
									</button>
								</div>
							{/if}
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
					{#if theme === "khadka"}
						<Sun class="size-5" />
					{:else}
						<Moon class="size-5" />
					{/if}
				</Button>

				<div class="md:hidden">
					<Sheet>
						<SheetTrigger>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Open menu"
								class="btn btn-ghost"
							>
								<Menu class="size-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="right" class="w-80">
							<SheetHeader>
								<SheetTitle>
									<div class="flex items-center gap-3">
										<img
											src={logo}
											alt="Khadka Foods"
											class="h-8 w-auto"
										/>
										<span class="font-semibold"
											>Khadka Foods</span
										>
									</div>
								</SheetTitle>
							</SheetHeader>
							<div class="space-y-1 py-4">
								<div
									class="px-3 py-2 text-xs uppercase opacity-60"
								>
									Collections
								</div>
								{#each collectionItems as item}
									<a
										href={`/collections/${item.handle}`}
										class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200"
										onclick={async (e) => {
											e.preventDefault();
											const href = `/collections/${item.handle}`;

											// Track navigation link click
											try {
												trackLinkClick(
													href,
													item.title,
													"mobile_menu",
												);
											} catch (err) {
												logger.warn(
													"Analytics tracking failed:",
													err,
												);
											}

											// Use SvelteKit navigation with invalidateAll to ensure data reloads
											await goto(href, {
												invalidateAll: true,
											});
										}}
									>
										<span class="flex items-center gap-2">
											<span class="opacity-80"
												>{item.emoji ?? "🌍"}</span
											>
											<span>{item.title}</span>
										</span>
										<ChevronRight
											class="size-3 opacity-60"
										/>
									</a>
								{/each}
								<Separator class="my-3" />
								{#each navLinks as link}
									<a
										href={link.href}
										class="flex items-center justify-between rounded-md px-3 py-2 hover:bg-base-200"
									>
										<span>{link.label}</span>
										<ChevronRight
											class="size-4 opacity-60"
										/>
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
									<span class="text-sm opacity-70">Theme</span
									>
									<Button
										variant="ghost"
										size="icon"
										aria-label="Toggle theme"
										class="btn btn-ghost"
										onclick={toggleTheme}
									>
										{#if theme === "khadka"}
											<Sun class="size-5" />
										{:else}
											<Moon class="size-5" />
										{/if}
									</Button>
								</div>
							</div>
							<div class="mt-auto"></div>
							<SheetClose>
								<Button class="btn mt-4 w-full btn-primary"
									>Close</Button
								>
							</SheetClose>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</div>
	</header>

	<main class="flex-1">
		{#key page.url.pathname}
			{@render children?.()}
		{/key}
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
					if (
						e.key === "Escape" ||
						e.key === "Enter" ||
						e.key === " "
					) {
						closeSearch();
					}
				}}
			></div>
			<!-- Dialog -->
			<div
				class="absolute inset-x-0 top-16 mx-auto w-full max-w-2xl px-4"
			>
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
										<h3
											class="px-2 pb-1 text-xs uppercase opacity-60"
										>
											Products
										</h3>
										<ul class="grid gap-2">
											{#each searchResults.products as p, index}
												<li>
													<a
														href={`/products/${p.handle}`}
														class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-base-200"
														onclick={() => {
															try {
																trackSelectItem(
																	{
																		item_id:
																			p.id,
																		item_name:
																			p.title,
																		price: 0,
																		quantity: 1,
																	},
																	"Search Results",
																	index,
																);
																trackLinkClick(
																	`/products/${p.handle}`,
																	p.title,
																	"search_results",
																);
															} catch (e) {
																logger.warn(
																	"Analytics tracking failed:",
																	e,
																);
															}
														}}
													>
														<img
															src={p.thumbnail ??
																""}
															alt={p.title}
															class="h-10 w-10 rounded bg-base-200 object-cover"
														/>
														<div class="min-w-0">
															<p
																class="truncate font-medium"
															>
																{p.title}
															</p>
															<p
																class="truncate text-xs opacity-70"
															>
																/{p.handle}
															</p>
														</div>
													</a>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if searchResults.categories.length > 0}
									<div>
										<h3
											class="px-2 pb-1 text-xs uppercase opacity-60"
										>
											Categories
										</h3>
										<ul class="grid gap-2">
											{#each searchResults.categories as c}
												<li>
													<a
														href={`/categories/${c.handle}`}
														class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-base-200"
														onclick={() => {
															try {
																trackLinkClick(
																	`/categories/${c.handle}`,
																	c.name,
																	"search_results",
																);
															} catch (e) {
																logger.warn(
																	"Analytics tracking failed:",
																	e,
																);
															}
														}}
													>
														<div class="min-w-0">
															<p
																class="truncate font-medium"
															>
																{c.name}
															</p>
															<p
																class="truncate text-xs opacity-70"
															>
																/{c.handle}
															</p>
														</div>
													</a>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if searchResults.products.length === 0 && searchResults.categories.length === 0}
									<div
										class="px-3 py-6 text-center opacity-70"
									>
										No results yet…
									</div>
								{/if}
							{:else}
								<div class="px-3 py-6 text-center opacity-70">
									Start typing to search...
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Footer -->
	<footer class="border-t-2 backdrop-blur-sm">
		<div class="mx-auto max-w-7xl px-4 py-12 md:px-6">
			<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
				<!-- Brand Section -->
				<div class="space-y-4">
					<div class="flex items-center gap-3">
						<img
							src={logo}
							alt="Khadka Foods"
							class="h-10 w-10 rounded-lg shadow-md"
						/>
						<span class="text-xl font-bold text-primary"
							>Khadka Foods</span
						>
					</div>
					<p class="text-sm text-base-content/70 leading-relaxed">
						{storeMetadata.tagline ||
							"Authentic Nepali groceries delivered to your doorstep. Quality products, fresh ingredients."}
					</p>
					<div class="flex gap-2">
						{#if storeMetadata.instagram}
							<a
								href={`https://instagram.com/${storeMetadata.instagram}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-circle btn-sm bg-base-100 hover:bg-primary hover:text-primary-content border-2 border-base-300 transition-all duration-300 hover:scale-110 hover:shadow-lg"
								aria-label="Instagram"
							>
								<SiInstagram size={16} />
							</a>
						{/if}
						{#if storeMetadata.facebook}
							<a
								href={`https://facebook.com/${storeMetadata.facebook}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-circle btn-sm bg-base-100 hover:bg-primary hover:text-primary-content border-2 border-base-300 transition-all duration-300 hover:scale-110 hover:shadow-lg"
								aria-label="Facebook"
							>
								<SiFacebook size={16} />
							</a>
						{/if}
						{#if storeMetadata.x}
							<a
								href={`https://x.com/${storeMetadata.x}`}
								target="_blank"
								rel="noopener noreferrer"
								class="btn btn-circle btn-sm bg-base-100 hover:bg-primary hover:text-primary-content border-2 border-base-300 transition-all duration-300 hover:scale-110 hover:shadow-lg"
								aria-label="X (Twitter)"
							>
								<SiX size={16} />
							</a>
						{/if}
					</div>
				</div>

				<!-- Shop Links -->
				<div>
					<h3
						class="footer-title mb-4 text-base font-bold text-primary"
					>
						Shop
					</h3>
					<ul class="space-y-3 text-sm">
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/products"
								><ChevronRight class="w-3 h-3" />All Products</a
							>
						</li>
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/collections"
								><ChevronRight class="w-3 h-3" />Collections</a
							>
						</li>
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/categories"
								><ChevronRight class="w-3 h-3" />Categories</a
							>
						</li>
					</ul>
				</div>

				<!-- Company Links -->
				<div>
					<h3
						class="footer-title mb-4 text-base font-bold text-primary"
					>
						Company
					</h3>
					<ul class="space-y-3 text-sm">
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/about"
								><ChevronRight class="w-3 h-3" />About Us</a
							>
						</li>
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/orders/lookup"
								><ChevronRight class="w-3 h-3" />Track Order</a
							>
						</li>
						<li>
							<a
								class="link link-hover hover:text-primary transition-colors flex items-center gap-2"
								href="/account"
								><ChevronRight class="w-3 h-3" />My Account</a
							>
						</li>
					</ul>
				</div>

				<!-- Contact Info -->
				<div>
					<h3
						class="footer-title mb-4 text-base font-bold text-primary"
					>
						Contact Us
					</h3>
					<div class="space-y-3 text-sm">
						{#if storeMetadata.phone}
							<p
								class="flex items-center gap-2 hover:text-primary transition-colors"
							>
								<Phone class="w-4 h-4 text-primary" />
								<a
									href={`tel:${storeMetadata.phone}`}
									class="link link-hover"
									>{storeMetadata.phone}</a
								>
							</p>
						{/if}
						{#if storeMetadata.email}
							<p
								class="flex items-center gap-2 hover:text-primary transition-colors"
							>
								<Mail class="w-4 h-4 text-primary" />
								<a
									href={`mailto:${storeMetadata.email}`}
									class="link link-hover"
									>{storeMetadata.email}</a
								>
							</p>
						{/if}
						{#if storeMetadata.address}
							<p
								class="flex items-start gap-2 hover:text-primary transition-colors"
							>
								<MapPin class="w-4 h-4 text-primary mt-0.5" />
								<a
									href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeMetadata.address)}`}
									target="_blank"
									rel="noopener noreferrer"
									class="link link-hover"
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
		<div class="border-t-2">
			<div
				class="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 text-sm md:px-6"
			>
				<span class="text-base-content/70"
					>© {new Date().getFullYear()}
					<span class="font-semibold text-primary">Khadka Foods</span
					>. All rights reserved.</span
				>
				<div class="flex gap-6">
					<a
						href="/privacy"
						class="link link-hover hover:text-primary transition-colors"
						>Privacy Policy</a
					>
					<a
						href="/tos"
						class="link link-hover hover:text-primary transition-colors"
						>Terms of Service</a
					>
				</div>
			</div>
			
			<!-- Credits Section -->
			<div class="border-t border-base-300/50 bg-base">
				<div class="mx-auto max-w-7xl px-4 py-3 text-center">
					<p class="text-xs text-base-content/60">
						Designed & Developed by
						<a
							href="https://devignity.tech/"
							class="font-semibold text-primary hover:text-primary/80 transition-colors duration-200"
							target="_blank"
							rel="noopener noreferrer"
						>Devignity</a>
					</p>
				</div>
			</div>
		</div>
	</footer>

	<!-- Global Components -->
	<ToastContainer />
	{#if !(page.url.pathname.startsWith("/cart") || page.url.pathname.startsWith("/checkout") || page.url.pathname.startsWith("/tos") || page.url.pathname.startsWith("/privacy") || page.url.pathname.startsWith("/about") || page.url.pathname.startsWith("/orders/lookup") || page.url.pathname.startsWith("/account"))}
		<StickyMobileCart />
	{/if}
</div>
