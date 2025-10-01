<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import SEO from '$lib/components/SEO.svelte';
</script>

<SEO
	title="Payment Failed • Khadka Foods"
	description="Payment could not be processed. Please try again or use a different payment method."
	canonical="https://khadkafoods.com/checkout/failed"
	ogType="website"
/>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="w-full py-16">
	<div class="container mx-auto max-w-lg px-4 text-center">
		<h1 class="text-3xl font-bold">Payment failed</h1>
		<p class="mt-2 opacity-80">
			We couldn’t confirm your payment. You can try again or use a different method.
		</p>
		<div class="mt-6 flex items-center justify-center gap-2">
			<a href="/checkout" class="btn btn-primary">Try again</a>
			<a href="/cart" class="btn">Back to cart</a>
		</div>
	</div>
</section>
