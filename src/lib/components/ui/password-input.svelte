<script lang="ts">
	import { Eye, EyeOff } from '@lucide/svelte';

	let {
		value = $bindable(''),
		placeholder = 'Password',
		name = 'password',
		autocomplete = 'current-password',
		disabled = false
	} = $props<{
		value?: string;
		placeholder?: string;
		name?: string;
		autocomplete?: string;
		disabled?: boolean;
	}>();

	let visible: boolean = $state(false);
	function toggle() {
		visible = !visible;
	}
</script>

<div class="join w-full">
	<input
		class="input input-bordered input-primary join-item w-full bg-base-100 border-2 focus:border-primary focus:outline-none transition-all rounded-l-xl"
		type={visible ? 'text' : 'password'}
		bind:value
		{name}
		{placeholder}
		{autocomplete}
		{disabled}
	/>
	<button
		type="button"
		class="btn join-item btn-ghost rounded-r-xl border-2 border-l-0 border-base-300 hover:border-primary hover:bg-primary/10 transition-all"
		onclick={toggle}
		aria-label={visible ? 'Hide password' : 'Show password'}
	>
		{#if visible}
			<EyeOff class="size-4" />
		{:else}
			<Eye class="size-4" />
		{/if}
	</button>
</div>
