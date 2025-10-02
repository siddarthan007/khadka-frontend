<script lang="ts">
	import { page } from '$app/stores';
	import SEO from '$lib/components/SEO.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Home, Package, ArrowLeft } from '@lucide/svelte';

	// Get error status and message
	$: status = $page.status;
	$: errorMessage = $page.error?.message || 'Something went wrong';

	// Witty messages based on error code
	const errorMessages: Record<number, { title: string; subtitle: string }> = {
		404: {
			title: "Page Not Found",
			subtitle: "The page you're looking for seems to have wandered off our shelves."
		},
		500: {
			title: 'Server Error',
			subtitle: "We're working on fixing this. Please try again in a moment."
		},
		403: {
			title: 'Access Denied',
			subtitle: "You don't have permission to access this page."
		},
		401: {
			title: 'Authentication Required',
			subtitle: 'Please sign in to access this content.'
		}
	};

	$: errorContent = errorMessages[status] || {
		title: 'Something Went Wrong',
		subtitle: 'An unexpected error occurred. Please try again.'
	};
</script>

<SEO
	title={`${status} Error - Khadka Foods`}
	description="Page not found. Return to Khadka Foods to continue shopping for premium groceries."
	noindex={true}
/>

<!-- Clean Error Section - Matching site pattern -->
<section class="w-full py-12 sm:py-16 min-h-[calc(100vh-200px)]">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="max-w-2xl mx-auto text-center">
			
			<!-- Error Code with Minimal Badge -->
			<div class="flex justify-center mb-6">
				<div class="badge badge-lg badge-ghost gap-2 border-base-content/20">
					<span class="text-5xl font-black text-base-content/40">{status}</span>
				</div>
			</div>

			<!-- Simplified Icon Illustration -->
			<div class="flex justify-center mb-8">
				<div class="relative">
					<svg
						class="w-24 h-24 sm:w-32 sm:h-32 text-base-content/30 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						{#if status === 404}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						{:else if status === 500}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						{/if}
					</svg>
				</div>
			</div>

			<!-- Clean Title -->
			<h1 class="text-4xl sm:text-5xl font-bold mb-4 text-base-content">
				{errorContent.title}
			</h1>

			<!-- Subtitle -->
			<p class="text-base sm:text-lg text-base-content/70 mb-10 max-w-md mx-auto">
				{errorContent.subtitle}
			</p>

			<!-- Divider -->
			<div class="divider my-8"></div>

			<!-- Simple Action Buttons -->
			<div class="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8">
				<Button href="/" class="btn-primary gap-2 min-w-[160px]">
					<Home class="w-4 h-4" />
					Go Home
				</Button>

				<Button href="/products" variant="outline" class="gap-2 min-w-[160px]">
					<Package class="w-4 h-4" />
					Browse Products
				</Button>

				<Button onclick={() => history.back()} variant="ghost" class="gap-2 min-w-[160px]">
					<ArrowLeft class="w-4 h-4" />
					Go Back
				</Button>
			</div>

			<!-- Minimal Quick Links -->
			<div class="divider divider-neutral text-xs text-base-content/60">or explore</div>
			
			<div class="flex flex-wrap gap-2 justify-center">
				<a href="/collections" class="link link-hover text-sm">Collections</a>
				<span class="text-base-content/50">•</span>
				<a href="/categories" class="link link-hover text-sm">Categories</a>
				<span class="text-base-content/50">•</span>
				<a href="/cart" class="link link-hover text-sm">Cart</a>
				<span class="text-base-content/50">•</span>
				<a href="/about" class="link link-hover text-sm">About</a>
			</div>

			<!-- Technical Details (minimal, for non-404) -->
			{#if status !== 404 && errorMessage}
				<div class="mt-10">
					<div class="collapse collapse-arrow bg-base-100">
						<input type="checkbox" />
						<div class="collapse-title text-xs font-medium text-base-content/70">
							Technical Details
						</div>
						<div class="collapse-content">
							<div class="text-left text-xs font-mono text-base-content/80 space-y-1">
								<div><span class="font-semibold text-base-content">Status:</span> {status}</div>
								<div><span class="font-semibold text-base-content">Message:</span> {errorMessage}</div>
								<div class="break-all"><span class="font-semibold text-base-content">URL:</span> {$page.url.pathname}</div>
							</div>
						</div>
					</div>
				</div>
			{/if}

		</div>
	</div>
</section>
