<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Stripe, StripeElements, StripeElementsOptions } from '@stripe/stripe-js';

	export let stripe: Stripe | null = null;
	export let clientSecret: string | null = null;
	export let elements: StripeElements | null = null; // bindable outward
	export let paymentElementRef: any = null; // bindable outward to know mount
	export let ready: boolean = false; // bindable readiness
	export let appearance: StripeElementsOptions['appearance'] = { theme: 'stripe' };
	export let layout: any = { layout: 'accordion' };

	const dispatch = createEventDispatcher();
	let container: HTMLDivElement | null = null;
	let paymentElement: any = null;
	let initializing = false;

	async function tryMount() {
		if (initializing) return;
		if (!stripe || !clientSecret || !container) return;
		if (paymentElement) return;

		initializing = true;
		try {
			if (!elements) {
				elements = stripe.elements({ clientSecret, appearance });
				dispatch('ready', { elements });
			}
			if (elements && !paymentElement) {
				paymentElement = elements.create('payment', layout);
				paymentElement.mount(container);
				paymentElementRef = paymentElement;
				ready = true;
				paymentElement.on('change', (ev: any) => dispatch('change', ev));
			}
		} catch (e) {
			console.error('[StripePaymentElement] mount error', e);
			dispatch('error', e);
		} finally {
			initializing = false;
		}
	}

	// react when inputs or container become available
	$: tryMount();
	onMount(() => {
		tryMount();
	});

	onDestroy(() => {
		try {
			paymentElement?.unmount();
		} catch {}
	});
</script>

{#if !stripe || !clientSecret}
	<div class="text-sm opacity-70">Preparing payment...</div>
{:else}
	<div bind:this={container} class="min-h-20"></div>
{/if}
