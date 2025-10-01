<script lang="ts">
  import { cn } from "$lib/utils";

  let {
    class: className = "",
    width = "w-full",
    height = "h-4",
    rounded = "rounded-md",
  }: {
    class?: string;
    width?: string;
    height?: string;
    rounded?: string;
  } = $props();
</script>

<div
  class={cn("animate-pulse bg-base-300", width, height, rounded, className)}
  role="status"
  aria-label="Loading..."
>
  <span class="sr-only">Loading...</span>
</div>
