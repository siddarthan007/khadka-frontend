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
    noindex = false,
    // Enhanced properties
    ogLocale = 'en_US',
    ogSiteName = 'Khadka Foods',
    fbAppId = '',
    twitterSite = '@khadkafoods',
    twitterCreator = '@khadkafoods',
    productPrice,
    productCurrency,
    productAvailability,
    productBrand,
    productCondition = 'new',
    languageAlternates = [],
    maxImagePreview = 'large',
    maxSnippet = -1,
    maxVideoPreview = -1
  }: SEOMetadata = $props();

  // Generate full title (optimized for CTR)
  const fullTitle = title.includes('Khadka Foods') ? title : `${title} | Khadka Foods`;
  
  // Fallbacks for social
  const socialTitle = ogTitle || title;
  const socialDescription = ogDescription || description;
  const socialImage = ogImage || '/logo.png';
  
  // Generate robots content with advanced directives
  const robotsContent = noindex 
    ? 'noindex, nofollow' 
    : `index, follow, max-image-preview:${maxImagePreview}, max-snippet:${maxSnippet}, max-video-preview:${maxVideoPreview}`;
  
  /**
   * Safely serialize structured data to JSON-LD
   * - Handles arrays and single objects
   * - Escapes closing script tags to prevent injection
   * - Removes undefined values for clean JSON
   */
  function safeJsonLd(data: any): string {
    if (!data) return '';
    
    try {
      // Convert to plain object/array (strips reactivity, proxies, etc.)
      const plainData = JSON.parse(JSON.stringify(data));
      
      // Stringify with clean formatting (no extra whitespace)
      const jsonString = JSON.stringify(plainData, null, 0);
      
      // Escape closing script tags to prevent injection attacks
      return jsonString.replace(/<\/script>/gi, '<\\/script>');
    } catch (error) {
      console.error('Failed to serialize structured data:', error);
      return '';
    }
  }
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
  <meta property="og:image:alt" content={socialTitle} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  {#if canonical}
    <meta property="og:url" content={canonical} />
  {/if}
  <meta property="og:site_name" content={ogSiteName} />
  <meta property="og:locale" content={ogLocale} />
  
  <!-- Product-specific Open Graph tags -->
  {#if ogType === 'product' && productPrice}
    <meta property="product:price:amount" content={productPrice} />
    <meta property="product:price:currency" content={productCurrency || 'USD'} />
    <meta property="og:price:amount" content={productPrice} />
    <meta property="og:price:currency" content={productCurrency || 'USD'} />
  {/if}
  {#if ogType === 'product' && productAvailability}
    <meta property="product:availability" content={productAvailability} />
    <meta property="og:availability" content={productAvailability} />
  {/if}
  {#if ogType === 'product' && productBrand}
    <meta property="product:brand" content={productBrand} />
  {/if}
  {#if ogType === 'product' && productCondition}
    <meta property="product:condition" content={productCondition} />
  {/if}
  
  <!-- Facebook App ID -->
  {#if fbAppId}
    <meta property="fb:app_id" content={fbAppId} />
  {/if}

  <!-- Twitter -->
  <meta property="twitter:card" content={twitterCard} />
  <meta property="twitter:site" content={twitterSite} />
  <meta property="twitter:creator" content={twitterCreator} />
  <meta property="twitter:title" content={twitterTitle || socialTitle} />
  <meta property="twitter:description" content={twitterDescription || socialDescription} />
  <meta property="twitter:image" content={twitterImage || socialImage} />
  <meta property="twitter:image:alt" content={socialTitle} />
  
  <!-- Twitter Product Labels -->
  {#if ogType === 'product' && productPrice}
    <meta property="twitter:label1" content="Price" />
    <meta property="twitter:data1" content={`${productCurrency || 'USD'} ${productPrice}`} />
  {/if}
  {#if ogType === 'product' && productAvailability}
    <meta property="twitter:label2" content="Availability" />
    <meta property="twitter:data2" content={productAvailability === 'instock' ? 'In Stock' : productAvailability} />
  {/if}

  <!-- Additional SEO -->
  <meta name="robots" content={robotsContent} />
  <meta name="googlebot" content="index, follow" />
  <meta name="bingbot" content="index, follow" />
  <meta name="google" content="notranslate" />
  <meta name="format-detection" content="telephone=no" />
  
  <!-- Language Alternates -->
  {#each languageAlternates as alt}
    <link rel="alternate" hreflang={alt.hreflang} href={alt.href} />
  {/each}
  
  <!-- Mobile -->
  <meta name="theme-color" content="#10b981" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Khadka Foods" />
</svelte:head>

<!-- Structured Data - Safely serialized JSON-LD -->
{#if structuredData}
  {#if Array.isArray(structuredData)}
    {#each structuredData as schema}
      {#if schema}
        <script type="application/ld+json">
          {safeJsonLd(schema)}
        </script>
      {/if}
    {/each}
  {:else}
    <script type="application/ld+json">
      {safeJsonLd(structuredData)}
    </script>
  {/if}
{/if}
