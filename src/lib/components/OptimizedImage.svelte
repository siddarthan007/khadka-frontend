<script lang="ts">
  import { onMount } from 'svelte';

  let {
    src,
    alt,
    width,
    height,
    class: className = '',
    loading = 'lazy',
    decoding = 'async',
    sizes = '100vw',
    priority = false
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    class?: string;
    loading?: 'lazy' | 'eager';
    decoding?: 'async' | 'sync' | 'auto';
    sizes?: string;
    priority?: boolean;
  } = $props();

  let loaded = $state(false);
  let error = $state(false);

  /**
   * Generate WebP source if original is not WebP
   */
  function getWebPSource(originalSrc: string): string | null {
    if (originalSrc.includes('.webp')) return null;
    
    // For external URLs, we can't convert
    if (originalSrc.startsWith('http')) return null;
    
    // Replace extension with .webp
    return originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  }

  /**
   * Generate srcset for responsive images
   */
  function generateSrcSet(originalSrc: string): string {
    if (originalSrc.startsWith('http')) {
      // For external URLs, don't add query params as they may not support it
      // Just return the original URL
      return '';
    }
    
    // Generate multiple sizes for local images
    const widths = [320, 640, 960, 1280, 1920];
    return widths
      .map(w => `${originalSrc}?w=${w} ${w}w`)
      .join(', ');
  }

  const webpSrc = getWebPSource(src);
  const srcSet = generateSrcSet(src);
  const webpSrcSet = webpSrc ? generateSrcSet(webpSrc) : null;

  onMount(() => {
    // Preload priority images
    if (priority && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      if (webpSrc) {
        link.type = 'image/webp';
      }
      document.head.appendChild(link);
    }
  });
</script>

<picture>
  {#if webpSrcSet}
    <source
      type="image/webp"
      srcset={webpSrcSet}
      sizes={sizes}
    />
  {/if}
  <img
    {src}
    {alt}
    {width}
    {height}
    class="{className} {loaded ? 'loaded' : 'loading'} {error ? 'error' : ''}"
    loading={priority ? 'eager' : loading}
    {decoding}
    srcset={srcSet || undefined}
    sizes={srcSet ? sizes : undefined}
    onload={() => loaded = true}
    onerror={() => error = true}
  />
</picture>

<style>
  img {
    transition: opacity 0.3s ease-in-out;
  }

  img.loading {
    opacity: 0.5;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: loading 1.5s ease-in-out infinite;
  }

  img.loaded {
    opacity: 1;
  }

  img.error {
    opacity: 0.3;
    background: #f5f5f5;
  }

  @keyframes loading {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
