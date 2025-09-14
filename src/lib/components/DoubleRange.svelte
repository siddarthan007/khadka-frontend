<script lang="ts">
    import { writable, type Writable } from 'svelte/store';
    import { createSlider, melt } from '@melt-ui/svelte';
    import { formatCurrency } from '$lib/utils';
  
    export let min = 0;
    export let max = 100;
    export let step = 1;
    export let value: [number, number] = [0, 100];
    export let prefix = '$';
    export let minGap = 0;
    export let currency: string | undefined;
    export let locale: string | undefined;
    export let onInput: ((v: [number, number]) => void) | undefined;
    export let onChange: ((v: [number, number]) => void) | undefined;
  
    const storeValue: Writable<[number, number]> = writable(value);
  
    const slider = createSlider({
      defaultValue: Array.isArray(value) && value.length === 2 ? value : [min, max],
      value: storeValue,
      min,
      max,
      step,
      orientation: 'horizontal',
      autoSort: true,
      onValueChange: (args: any) => {
        const next = Array.isArray(args) ? (args as number[]) : (args?.next as number[]);
        if (Array.isArray(next)) onInput?.(next as [number, number]);
        return next;
      },
      onValueCommitted: (args: any) => {
        const next = Array.isArray(args) ? (args as number[]) : (args?.next as number[]);
        if (Array.isArray(next)) onChange?.(next as [number, number]);
        return next;
      }
    });
  
    const {
      elements: { root, range, thumbs },
      states: { value: sliderValue },
    } = slider;
  
    // Keep internal store in sync with external prop
    $: if (Array.isArray(value) && value.length === 2) {
      storeValue.update((curr) => (JSON.stringify(curr) !== JSON.stringify(value) ? value : curr));
    }

    // Guarantee two thumbs; if a single value sneaks in, expand to a range
    $: {
      const v = $sliderValue as unknown as number[];
      if (Array.isArray(v) && v.length < 2) {
        const lo = typeof v[0] === 'number' ? v[0] : min;
        const hi = typeof v[1] === 'number' ? v[1] : max;
        const next: [number, number] = [lo, hi];
        storeValue.update((curr) => (JSON.stringify(curr) !== JSON.stringify(next) ? next : curr));
      }
    }

    // Enforce minimum gap between thumbs (in major units)
    $: {
      const v = $sliderValue as unknown as [number, number];
      if (minGap > 0 && Array.isArray(v) && v[0] + minGap > v[1]) {
        storeValue.update(([lo, hi]) => {
          const newHi = Math.min(max, lo + minGap);
          return [lo, newHi] as [number, number];
        });
      }
    }

    function fmt(v: number) {
      return formatCurrency(v, currency, locale);
    }
  </script>
  
  <div
    class="double-range relative flex h-6 w-full select-none items-center"
    use:melt={$root}
    role="group"
    aria-label="Price range"
  >
    <div class="relative w-full h-[3px] rounded-full bg-base-300">
      <div
        use:melt={$range}
        class="absolute h-[3px] rounded-full bg-primary transition-all"
        aria-hidden="true"
      ></div>
    </div>
  
    {#each $thumbs as thumb, i}
      <span
        use:melt={thumb}
        class="absolute z-10 grid place-items-center"
      >
        <span
          class="block h-5 w-5 rounded-full border-2 border-primary bg-base-100 shadow-md focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2"
        ></span>
        <span
          class="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 scale-90 rounded-md bg-base-100 px-2 py-0.5 text-xs text-base-content opacity-0 shadow transition-all group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:scale-100 group-hover:opacity-100"
        >
          {fmt($sliderValue[i])}
        </span>
      </span>
    {/each}
  </div>
  
  <div class="mt-2 flex justify-between text-xs text-base-content/80">
    <div>Min: ${($sliderValue[0])}</div>
    <div>Max: ${($sliderValue[1])}</div>
  </div>
  