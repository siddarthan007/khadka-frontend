<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		child,
		children,
		...restProps
	}: SheetPrimitive.TriggerProps & { children?: any } = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...restProps} {child}>
	{#if !child}
		{#snippet child({ props }: { props: Record<string, any> })}
			<span {...props}>
				{@render children?.()}
			</span>
		{/snippet}
	{/if}
</SheetPrimitive.Trigger>
