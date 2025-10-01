<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toasts, type Toast } from '$lib/stores/toast';
	import { cubicOut } from 'svelte/easing';

	function getIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>`;
			case 'error':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>`;
			case 'info':
				return `<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>`;
			default:
				return '';
		}
	}

	function getAlertClass(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'alert-success';
			case 'error':
				return 'alert-error';
			case 'info':
				return 'alert-info';
			default:
				return 'alert-info';
		}
	}

	function removeToast(id: number) {
		toasts.update((arr) => arr.filter((t) => t.id !== id));
	}
</script>

<div class="toast toast-bottom toast-end z-50 gap-2 p-4">
	{#each $toasts as toast (toast.id)}
		<div
			class="alert shadow-lg {getAlertClass(toast.type)} max-w-md"
			role="alert"
			transition:fly={{ y: 20, duration: 300, easing: cubicOut }}
		>
			<div class="flex items-start gap-3">
				<!-- Icon -->
				<div class="flex-shrink-0">
					{@html getIcon(toast.type)}
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					{#if toast.title}
						<h3 class="font-semibold text-sm">{toast.title}</h3>
					{/if}
					<p class="text-sm {toast.title ? 'opacity-90' : ''}">{toast.message}</p>
				</div>

				<!-- Close button -->
				<button
					type="button"
					class="btn btn-ghost btn-xs btn-circle flex-shrink-0"
					onclick={() => removeToast(toast.id)}
					aria-label="Close notification"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Progress bar -->
			<div
				class="absolute bottom-0 left-0 h-1 bg-current opacity-30 transition-all"
				style="animation: toast-progress {toast.timeout}ms linear; transform-origin: left;"
			></div>
		</div>
	{/each}
</div>

<style>
	@keyframes toast-progress {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}
</style>
