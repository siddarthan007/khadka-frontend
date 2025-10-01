<script lang="ts">
	import type { Stripe, StripeElements, StripeElementsOptions } from '@stripe/stripe-js';
	import { logger } from '$lib/logger';

	let {
		stripe = $bindable(null),
		clientSecret = $bindable(null),
		elements = $bindable(null),
		paymentElementRef = $bindable(null),
		ready = $bindable(false),
		appearance = { theme: 'stripe' as const },
		layout = { layout: 'accordion' },
		onready,
		onchange,
		onerror
	}: {
		stripe?: Stripe | null;
		clientSecret?: string | null;
		elements?: StripeElements | null;
		paymentElementRef?: any;
		ready?: boolean;
		appearance?: StripeElementsOptions['appearance'];
		layout?: any;
		onready?: (ev: CustomEvent<{ elements: StripeElements }>) => void;
		onchange?: (ev: CustomEvent<any>) => void;
		onerror?: (ev: CustomEvent<any>) => void;
	} = $props();

	let container = $state<HTMLDivElement | null>(null);
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
				onready?.(new CustomEvent('ready', { detail: { elements } }));
			}
			if (elements && !paymentElement) {
				paymentElement = elements.create('payment', layout);
				paymentElement.mount(container);
				paymentElementRef = paymentElement;
				ready = true;
				paymentElement.on('change', (ev: any) => onchange?.(new CustomEvent('change', { detail: ev })));
			}
		} catch (e) {
			logger.error('[StripePaymentElement] mount error', e);
			onerror?.(new CustomEvent('error', { detail: e }));
		} finally {
			initializing = false;
		}
	}

	// React when inputs or container become available with $effect
	$effect(() => {
		tryMount();
	});

	// Cleanup on component destruction
	$effect(() => {
		return () => {
			try {
				paymentElement?.unmount();
			} catch {}
		};
	});
</script>

{#if !stripe || !clientSecret}
	<div class="text-sm opacity-70">Preparing payment...</div>
{:else}
	<div bind:this={container} class="min-h-20"></div>
{/if}
