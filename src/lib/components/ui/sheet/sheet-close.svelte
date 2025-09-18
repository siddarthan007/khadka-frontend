<script lang="ts">
	import { Dialog as SheetPrimitive } from 'bits-ui';

	let {
		ref = $bindable(null),
		child,
		children,
		...restProps
	}: SheetPrimitive.CloseProps & { children?: any } = $props();
</script>

<SheetPrimitive.Close bind:ref data-slot="sheet-close" {...restProps} {child}>
	{#if !child}
		{#snippet child({ props }: { props: Record<string, any> })}
			<span {...props}>
				{@render children?.()}
			</span>
		{/snippet}
	{/if}
</SheetPrimitive.Close>
