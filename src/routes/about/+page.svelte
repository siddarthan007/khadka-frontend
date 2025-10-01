<script lang="ts">
	import SEO from '$lib/components/SEO.svelte';
	import logo from '$lib/assets/logo.png';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Phone, Mail, MapPin, Instagram, Facebook, Twitter, Heart, Star, Users, Award } from '@lucide/svelte';

	let storeMetadata: Record<string, any> = $state({});

	onMount(async () => {
		// Get store metadata from page data
		const data = page.data;
		storeMetadata = data?.storeMetadata ?? {};
	});
</script>

<SEO
	title="About Us - Khadka Foods"
	description="Learn about Khadka Foods - your trusted source for premium quality groceries and fresh produce. Discover our story, mission, and commitment to excellence."
	keywords={['about', 'company', 'Khadka Foods', 'grocery store', 'about us', 'our story']}
	canonical="https://khadkafoods.com/about"
	ogType="website"
/>

<div class="min-h-screen bg-base-100">
	<!-- Hero Section -->
	<section class="relative overflow-hidden bg-base-200/30 backdrop-blur-sm py-24 border-b-2 border-base-300/50">
		<div class="absolute inset-0 bg-grid-pattern opacity-5"></div>
		<div class="mx-auto max-w-6xl px-4 md:px-6">
			<div class="text-center">
				<div class="mb-8 flex justify-center">
					<div class="relative">
						<div class="absolute inset-0 rounded-full bg-primary/10 opacity-30 blur-xl"></div>
						<img src={logo} alt="Khadka Foods Logo" class="relative h-32 w-32 rounded-full shadow-2xl ring-4 ring-base-100" />
					</div>
				</div>
				<h1 class="mb-6 text-5xl font-bold tracking-tight text-primary md:text-7xl">
					About Khadka Foods
				</h1>
				<p class="mx-auto max-w-3xl text-xl text-base-content/70 md:text-2xl leading-relaxed">
					{storeMetadata.tagline || "Modern, thoughtful experiences for your storefront."}
				</p>
			</div>
		</div>
	</section>

	<!-- About Content -->
	<section class="py-20">
		<div class="mx-auto max-w-4xl px-4 md:px-6">
			<div class="text-center mb-16">
				<div class="prose prose-xl mx-auto max-w-3xl">
					{#if storeMetadata.about}
						<p class="text-lg leading-relaxed text-base-content/70">
							{storeMetadata.about}
						</p>
					{:else}
						<p class="text-lg leading-relaxed text-base-content/70">
							Welcome to Khadka Foods, where we believe in providing exceptional quality products
							with a focus on customer satisfaction. Our mission is to deliver modern, thoughtful
							experiences that make shopping enjoyable and convenient for everyone.
						</p>
					{/if}
				</div>
			</div>

			<!-- Contact Information -->
			{#if storeMetadata.phone || storeMetadata.email || storeMetadata.address}
				<div class="mb-20">
					<h2 class="text-3xl font-bold text-center mb-12 text-primary">Get In Touch</h2>
					<div class="grid gap-8 md:grid-cols-3">
						{#if storeMetadata.phone}
							<div class="group card bg-base-200/50 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-base-300/50 hover:border-primary/40 rounded-2xl">
								<div class="card-body items-center text-center p-8">
									<div class="mb-6 rounded-full bg-primary/20 p-4 group-hover:bg-primary/30 transition-colors duration-300">
										<Phone class="w-10 h-10 text-primary" />
									</div>
									<h3 class="card-title text-xl mb-2">Call Us</h3>
									<p class="text-base text-base-content/60 mb-4">We're here to help</p>
									<a href={`tel:${storeMetadata.phone}`} class="btn btn-primary btn-outline group-hover:btn-primary transition-all duration-300 rounded-xl">
										{storeMetadata.phone}
									</a>
								</div>
							</div>
						{/if}

						{#if storeMetadata.email}
							<div class="group card bg-base-200/50 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-base-300/50 hover:border-secondary/40 rounded-2xl">
								<div class="card-body items-center text-center p-8">
									<div class="mb-6 rounded-full bg-secondary/20 p-4 group-hover:bg-secondary/30 transition-colors duration-300">
										<Mail class="w-10 h-10 text-secondary" />
									</div>
									<h3 class="card-title text-xl mb-2">Email Us</h3>
									<p class="text-base text-base-content/60 mb-4">Send us a message</p>
									<a href={`mailto:${storeMetadata.email}`} class="btn btn-secondary btn-outline group-hover:btn-secondary transition-all duration-300 rounded-xl">
										{storeMetadata.email}
									</a>
								</div>
							</div>
						{/if}

						{#if storeMetadata.address}
							<div class="group card bg-base-200/50 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-base-300/50 hover:border-info/40 rounded-2xl">
								<div class="card-body items-center text-center p-8">
									<div class="mb-6 rounded-full bg-info/20 p-4 group-hover:bg-info/30 transition-colors duration-300">
										<MapPin class="w-10 h-10 text-info" />
									</div>
									<h3 class="card-title text-xl mb-2">Visit Us</h3>
									<p class="text-base text-base-content/60 mb-4">Find our location</p>
									{#if storeMetadata.address}
										<a
											href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeMetadata.address)}`}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-info btn-outline group-hover:btn-info transition-all duration-300 inline-flex items-center gap-2"
											aria-label="Open location in Google Maps"
										>
											<MapPin class="w-4 h-4" />
											{storeMetadata.address}
										</a>
									{:else}
										<p class="text-sm opacity-90 leading-relaxed font-medium">
											Address not available
										</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Social Links -->
			{#if storeMetadata.instagram || storeMetadata.facebook || storeMetadata.x}
				<div class="text-center">
					<h2 class="text-3xl font-bold mb-8">Follow Our Journey</h2>
					<p class="text-lg opacity-70 mb-12 max-w-2xl mx-auto">
						Stay connected and be the first to know about new products, exclusive deals, and behind-the-scenes content.
					</p>
					<div class="flex justify-center gap-6">
						{#if storeMetadata.instagram}
							<a
								href={`https://instagram.com/${storeMetadata.instagram}`}
								target="_blank"
								rel="noopener noreferrer"
								class="group btn btn-circle btn-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
								aria-label="Follow us on Instagram"
							>
								<Instagram class="w-6 h-6" />
							</a>
						{/if}
						{#if storeMetadata.facebook}
							<a
								href={`https://facebook.com/${storeMetadata.facebook}`}
								target="_blank"
								rel="noopener noreferrer"
								class="group btn btn-circle btn-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
								aria-label="Follow us on Facebook"
							>
								<Facebook class="w-6 h-6" />
							</a>
						{/if}
						{#if storeMetadata.x}
							<a
								href={`https://x.com/${storeMetadata.x}`}
								target="_blank"
								rel="noopener noreferrer"
								class="group btn btn-circle btn-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
								aria-label="Follow us on X"
							>
								<Twitter class="w-6 h-6" />
							</a>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Values Section -->
			<div class="mt-20 text-center">
				<h2 class="text-3xl font-bold mb-12">Our Values</h2>
				<div class="grid gap-8 md:grid-cols-3">
					<div class="card bg-base-200/30 shadow-sm">
						<div class="card-body items-center text-center">
							<div class="mb-4 rounded-full bg-primary/10 p-4">
								<Heart class="w-8 h-8 text-primary" />
							</div>
							<h3 class="card-title text-lg">Quality First</h3>
							<p class="text-sm opacity-70">We never compromise on the quality of our products and services.</p>
						</div>
					</div>

					<div class="card bg-base-200/30 shadow-sm">
						<div class="card-body items-center text-center">
							<div class="mb-4 rounded-full bg-secondary/10 p-4">
								<Users class="w-8 h-8 text-secondary" />
							</div>
							<h3 class="card-title text-lg">Customer Focus</h3>
							<p class="text-sm opacity-70">Your satisfaction is our top priority and driving force.</p>
						</div>
					</div>

					<div class="card bg-base-200/30 shadow-sm">
						<div class="card-body items-center text-center">
							<div class="mb-4 rounded-full bg-info/10 p-4">
								<Award class="w-8 h-8 text-info" />
							</div>
							<h3 class="card-title text-lg">Innovation</h3>
							<p class="text-sm opacity-70">We continuously improve and innovate to serve you better.</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</div>
