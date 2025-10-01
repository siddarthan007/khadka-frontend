<script lang="ts" generics="T">
  import { onMount, onDestroy } from 'svelte';
  import { throttle } from '$lib/utils';

  let {
    items,
    itemHeight = 400,
    overscan = 3,
    class: className = '',
    children
  }: {
    items: T[];
    itemHeight?: number;
    overscan?: number;
    class?: string;
    children: (item: T, index: number) => any;
  } = $props();

  let container: HTMLDivElement | null = $state(null);
  let scrollTop = $state(0);
  let containerHeight = $state(0);

  // Calculate visible range
  let visibleRange = $derived(() => {
    if (!containerHeight) return { start: 0, end: items.length };

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return { start, end };
  });

  let visibleItems = $derived(() => {
    const range = visibleRange();
    return items.slice(range.start, range.end).map((item, i) => ({
      item,
      index: range.start + i,
      offset: (range.start + i) * itemHeight
    }));
  });

  const totalHeight = $derived(items.length * itemHeight);

  const handleScroll = throttle(() => {
    if (container) {
      scrollTop = container.scrollTop;
    }
  }, 50);

  function updateHeight() {
    if (container) {
      containerHeight = container.clientHeight;
    }
  }

  onMount(() => {
    updateHeight();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateHeight);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateHeight);
      }
    };
  });
</script>

<div
  bind:this={container}
  class="virtual-scroll-container {className}"
  onscroll={handleScroll}
>
  <div class="virtual-scroll-spacer" style="height: {totalHeight}px;">
    <div class="virtual-scroll-content">
      {#each visibleItems() as { item, index, offset }}
        <div
          class="virtual-scroll-item"
          style="transform: translateY({offset}px); height: {itemHeight}px;"
        >
          {@render children(item, index)}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-scroll-container {
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    height: 100%;
    width: 100%;
    /* Smooth scrolling on iOS */
    -webkit-overflow-scrolling: touch;
  }

  .virtual-scroll-spacer {
    position: relative;
    width: 100%;
  }

  .virtual-scroll-content {
    position: relative;
    width: 100%;
  }

  .virtual-scroll-item {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  }
</style>
