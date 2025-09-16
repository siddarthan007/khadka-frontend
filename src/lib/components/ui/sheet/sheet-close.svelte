<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { ref = $bindable(null), children, ...restProps }: SheetPrimitive.CloseProps & { children?: any } = $props();
</script>

<SheetPrimitive.Close asChild bind:ref data-slot="sheet-close" {...restProps}>
	{@render children?.()}
</SheetPrimitive.Close>
