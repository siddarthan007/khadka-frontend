<script lang="ts">
	import { page } from '$app/stores';
	import SEO from '$lib/components/SEO.svelte';
	import LabeledSeparator from '$lib/components/LabeledSeparator.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Home, Package, ArrowLeft, Search, ShoppingCart } from '@lucide/svelte';

	// Get error status and message
	$: status = $page.status;
	$: errorMessage = $page.error?.message || 'Something went wrong';

	// Witty messages based on error code
	const errorMessages: Record<number, { title: string; subtitle: string; emoji: string }> = {
		404: {
			title: "Oops! This Aisle Doesn't Exist",
			subtitle: "Looks like this product got eaten before we could stock it!",
			emoji: '🛒'
		},
		500: {
			title: 'Our Kitchen is On Fire!',
			subtitle: "We're cooking up a fix. Please check back in a moment!",
			emoji: '🔥'
		},
		403: {
			title: 'Access Denied!',
			subtitle: "Sorry, but you can't peek into the secret recipe vault!",
			emoji: '🚫'
		},
		401: {
			title: 'Who Goes There?',
			subtitle: 'You need to sign in to access this delicious content!',
			emoji: '🔒'
		}
	};

	$: errorContent = errorMessages[status] || {
		title: 'Something Went Wrong',
		subtitle: 'Our groceries got a bit scrambled. Let us clean this up!',
		emoji: '⚠️'
	};

	// Fun facts to display
	const funFacts = [
		'Did you know? The average grocery store has about 40,000 products! 🏪',
		"Fun fact: Bananas are berries, but strawberries aren't! 🍌",
		'Random tidbit: Honey never spoils! Archaeologists found 3000-year-old honey that was still edible! 🍯',
		'Grocery trivia: The first shopping cart was invented in 1937! 🛒',
		"Food fact: Apples float in water because they're 25% air! 🍎"
	];

	const randomFact = funFacts[Math.floor(Math.random() * funFacts.length)];
</script>

<SEO
	title={`${status} Error - Khadka Foods`}
	description="Page not found. Return to Khadka Foods to continue shopping for premium groceries."
	noindex={true}
/>

<!-- Error Page Container - Matching site design -->
<div class="w-full min-h-[calc(100vh-200px)] py-8 sm:py-12 lg:py-16">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		
		<!-- Error Content Card -->
		<div class="max-w-4xl mx-auto">
			
			<!-- Error Status Badge -->
			<div class="flex justify-center mb-6">
				<div class="badge badge-error badge-lg gap-2 px-6 py-4 text-lg font-bold shadow-lg">
					<span class="text-2xl">{errorContent.emoji}</span>
					Error {status}
				</div>
			</div>

			<!-- Main Error Card -->
			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body p-6 sm:p-8 lg:p-12">
					
					<!-- Animated Shopping Cart Illustration -->
					<div class="flex justify-center mb-8">
						<div class="relative">
							<!-- SVG Shopping Cart -->
							<svg
								class="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 text-primary animate-float"
								viewBox="0 0 200 200"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<!-- Cart Body Background -->
								<path
									d="M50 50 L60 90 L140 90 L150 50 Z"
									stroke="currentColor"
									stroke-width="4"
									fill="currentColor"
									opacity="0.1"
								/>
								<!-- Cart Frame -->
								<path
									d="M40 50 L50 90 L150 90 L160 50"
									stroke="currentColor"
									stroke-width="6"
									stroke-linecap="round"
									stroke-linejoin="round"
									fill="none"
								/>
								<!-- Cart Handle -->
								<path
									d="M160 50 L170 30 L180 20"
									stroke="currentColor"
									stroke-width="6"
									stroke-linecap="round"
									fill="none"
								/>
								<!-- Left Wheel -->
								<circle cx="70" cy="100" r="12" fill="currentColor" />
								<circle cx="70" cy="100" r="6" fill="white" />
								<!-- Right Wheel -->
								<circle cx="130" cy="100" r="12" fill="currentColor" />
								<circle cx="130" cy="100" r="6" fill="white" />
								<!-- Empty Cart Indicator Lines -->
								<line x1="70" y1="65" x2="80" y2="75" stroke="currentColor" stroke-width="3" opacity="0.4" />
								<line x1="90" y1="65" x2="100" y2="75" stroke="currentColor" stroke-width="3" opacity="0.4" />
								<line x1="110" y1="65" x2="120" y2="75" stroke="currentColor" stroke-width="3" opacity="0.4" />
								<!-- Question Mark -->
								<text x="100" y="145" font-size="32" fill="currentColor" text-anchor="middle" font-weight="bold">?</text>
							</svg>
							
							<!-- Floating Emoji Badge -->
							<div class="absolute -top-2 -right-2 sm:-top-4 sm:-right-4 bg-primary rounded-full p-2 sm:p-3 shadow-lg animate-pulse-slow">
								<span class="text-3xl sm:text-4xl">{errorContent.emoji}</span>
							</div>
						</div>
					</div>

					<!-- Error Title -->
					<h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-center text-primary mb-4 tracking-tight">
						{errorContent.title}
					</h1>

					<!-- Error Subtitle -->
					<p class="text-base sm:text-lg lg:text-xl text-center text-base-content/70 mb-8 max-w-2xl mx-auto">
						{errorContent.subtitle}
					</p>

					<LabeledSeparator class="my-6" />

					<!-- Fun Fact Alert -->
					<div class="alert bg-primary/10 border-2 border-primary/20 mb-8">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-primary shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
						<div class="flex-1">
							<h3 class="font-semibold text-primary mb-1">While you're here...</h3>
							<p class="text-sm text-base-content/80">{randomFact}</p>
						</div>
					</div>

					<!-- Action Buttons Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
						<Button href="/" class="btn-primary gap-2 h-auto py-4 rounded-xl shadow-lg hover:shadow-xl transition-all">
							<Home class="w-5 h-5" />
							<span class="flex flex-col items-start">
								<span class="font-bold">Back to Home</span>
								<span class="text-xs opacity-80">Start fresh</span>
							</span>
						</Button>

						<Button href="/products" variant="outline" class="gap-2 h-auto py-4 rounded-xl shadow-md hover:shadow-lg transition-all">
							<Package class="w-5 h-5" />
							<span class="flex flex-col items-start">
								<span class="font-bold">Browse Products</span>
								<span class="text-xs opacity-70">Explore our catalog</span>
							</span>
						</Button>

						<Button onclick={() => history.back()} variant="ghost" class="gap-2 h-auto py-4 rounded-xl hover:bg-base-200 transition-all sm:col-span-2 lg:col-span-1">
							<ArrowLeft class="w-5 h-5" />
							<span class="flex flex-col items-start">
								<span class="font-bold">Go Back</span>
								<span class="text-xs opacity-70">Previous page</span>
							</span>
						</Button>
					</div>

					<LabeledSeparator class="my-6" />

					<!-- Quick Links Section -->
					<div class="text-center">
						<p class="text-sm font-semibold text-base-content/60 mb-4 uppercase tracking-wide">
							Popular Sections
						</p>
						<div class="flex flex-wrap gap-2 sm:gap-3 justify-center">
							<a href="/collections" class="btn btn-sm btn-outline rounded-xl gap-2 hover:btn-primary transition-colors">
								🌍 Collections
							</a>
							<a href="/categories" class="btn btn-sm btn-outline rounded-xl gap-2 hover:btn-primary transition-colors">
								📦 Categories
							</a>
							<a href="/cart" class="btn btn-sm btn-outline rounded-xl gap-2 hover:btn-primary transition-colors">
								<ShoppingCart class="w-4 h-4" />
								My Cart
							</a>
							<a href="/about" class="btn btn-sm btn-outline rounded-xl gap-2 hover:btn-primary transition-colors">
								ℹ️ About
							</a>
						</div>
					</div>

				</div>
			</div>

			<!-- Technical Details (collapsible, for non-404 errors) -->
			{#if status !== 404}
				<div class="mt-6">
					<details class="collapse collapse-arrow bg-base-200 rounded-xl shadow-md">
						<summary class="collapse-title text-sm font-medium text-base-content/70 cursor-pointer">
							Technical Details
						</summary>
						<div class="collapse-content">
							<div class="p-4 bg-base-300 rounded-lg font-mono text-xs space-y-2">
								<div><span class="font-bold text-primary">Status:</span> {status}</div>
								<div><span class="font-bold text-primary">Message:</span> {errorMessage}</div>
								<div class="break-all"><span class="font-bold text-primary">URL:</span> {$page.url.pathname}</div>
								<div><span class="font-bold text-primary">Timestamp:</span> {new Date().toISOString()}</div>
							</div>
						</div>
					</details>
				</div>
			{/if}

		</div>
	</div>
</div>

<style>
	/* Custom animations matching site design */
	@keyframes float {
		0%, 100% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-15px);
		}
	}

	.animate-float {
		animation: float 3s ease-in-out infinite;
	}

	@keyframes pulse-slow {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.05);
		}
	}

	.animate-pulse-slow {
		animation: pulse-slow 3s ease-in-out infinite;
	}
</style>
