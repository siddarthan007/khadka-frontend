<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { ref = $bindable(null), children, ...restProps }: SheetPrimitive.TriggerProps & { children?: any } = $props();
</script>

<SheetPrimitive.Trigger asChild bind:ref data-slot="sheet-trigger" {...restProps}>
	{@render children?.()}
</SheetPrimitive.Trigger>
