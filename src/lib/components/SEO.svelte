<script lang="ts">
  import type { SEOMetadata } from '$lib/seo';

  let {
    title,
    description,
    keywords = [],
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogType = 'website',
    twitterCard = 'summary_large_image',
    twitterTitle,
    twitterDescription,
    twitterImage,
    structuredData,
    noindex = false
  }: SEOMetadata = $props();

  // Generate full title
  const fullTitle = title.includes('KhadkaFoods') ? title : `${title} | KhadkaFoods`;
  
  // Fallbacks for social
  const socialTitle = ogTitle || title;
  const socialDescription = ogDescription || description;
  const socialImage = ogImage || '/logo.png';
</script>

<svelte:head>
  <!-- Primary Meta Tags -->
  <title>{fullTitle}</title>
  <meta name="title" content={fullTitle} />
  <meta name="description" content={description} />
  {#if keywords.length > 0}
    <meta name="keywords" content={keywords.join(', ')} />
  {/if}
  {#if canonical}
    <link rel="canonical" href={canonical} />
  {/if}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={ogType} />
  <meta property="og:title" content={socialTitle} />
  <meta property="og:description" content={socialDescription} />
  <meta property="og:image" content={socialImage} />
  {#if canonical}
    <meta property="og:url" content={canonical} />
  {/if}
  <meta property="og:site_name" content="KhadkaFoods" />

  <!-- Twitter -->
  <meta property="twitter:card" content={twitterCard} />
  <meta property="twitter:title" content={twitterTitle || socialTitle} />
  <meta property="twitter:description" content={twitterDescription || socialDescription} />
  <meta property="twitter:image" content={twitterImage || socialImage} />

  <!-- Additional SEO -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow" />
  <meta name="bingbot" content="index, follow" />
  
  <!-- Mobile -->
  <meta name="theme-color" content="#10b981" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-status-bar-style" content="default" />

  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
  
  <!-- Structured Data -->
  {#if structuredData}
    {@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}
  {/if}
</svelte:head>
