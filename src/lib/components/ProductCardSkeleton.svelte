<script lang="ts">
  import Skeleton from "./ui/Skeleton.svelte";
</script>

<div class="card overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-lg">
  <div class="relative">
    <!-- Image skeleton -->
    <Skeleton width="w-full" height="h-64" rounded="rounded-none" />
  </div>

  <div class="card-body gap-3 p-4">
    <!-- Badge skeleton -->
    <div class="flex gap-2">
      <Skeleton width="w-16" height="h-5" rounded="rounded-full" />
    </div>

    <!-- Title skeleton -->
    <Skeleton width="w-3/4" height="h-6" />

    <!-- Price skeleton -->
    <Skeleton width="w-24" height="h-7" />

    <!-- Button skeleton -->
    <Skeleton width="w-full" height="h-10" />
  </div>
</div>
