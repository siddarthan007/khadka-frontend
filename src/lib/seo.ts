/**
 * SEO utilities and helpers for e-commerce optimization
 */

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogLocale?: string;
  ogSiteName?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterSite?: string;
  twitterCreator?: string;
  fbAppId?: string;
  // Product-specific metadata
  productPrice?: string;
  productCurrency?: string;
  productAvailability?: 'instock' | 'outofstock' | 'preorder';
  productBrand?: string;
  productCondition?: 'new' | 'refurbished' | 'used';
  // Advanced SEO
  structuredData?: Record<string, any> | Array<Record<string, any>>;
  languageAlternates?: Array<{ hreflang: string; href: string }>;
  noindex?: boolean;
  maxImagePreview?: 'none' | 'standard' | 'large';
  maxSnippet?: number;
  maxVideoPreview?: number;
}

export interface ProductSEO {
  name: string;
  description: string;
  image: string;
  price: number;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Discontinued' | 'LimitedAvailability';
  brand?: string;
  sku?: string;
  gtin?: string;
  mpn?: string;
  rating?: {
    value: number;
    count: number;
    bestRating?: number;
    worstRating?: number;
  };
  reviews?: Array<{
    author: string;
    datePublished: string;
    reviewBody: string;
    reviewRating: number;
  }>;
  // For variants/multiple offers
  lowPrice?: number;
  highPrice?: number;
  offerCount?: number;
}

/**
 * Generate structured data for a product (Schema.org)
 */
export function generateProductStructuredData(product: ProductSEO) {
  const hasVariants = product.offerCount && product.offerCount > 1;
  const hasReviews = product.reviews && product.reviews.length > 0;
  
  // Ensure we always have valid price values
  const price = product.price || 0;
  const lowPrice = product.lowPrice || price;
  const highPrice = product.highPrice || price;
  
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    brand: product.brand ? {
      '@type': 'Brand',
      name: product.brand
    } : undefined,
    // Always include offers (required by Google)
    offers: hasVariants ? {
      '@type': 'AggregateOffer',
      url: typeof window !== 'undefined' ? window.location.href : '',
      priceCurrency: product.currency,
      lowPrice: lowPrice.toString(),
      highPrice: highPrice.toString(),
      offerCount: product.offerCount,
      availability: `https://schema.org/${product.availability}`,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    } : {
      '@type': 'Offer',
      url: typeof window !== 'undefined' ? window.location.href : '',
      priceCurrency: product.currency,
      price: price.toString(),
      availability: `https://schema.org/${product.availability}`,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      itemCondition: 'https://schema.org/NewCondition'
    },
    sku: product.sku,
    gtin: product.gtin,
    mpn: product.mpn,
    aggregateRating: product.rating ? {
      '@type': 'AggregateRating',
      ratingValue: product.rating.value,
      reviewCount: product.rating.count,
      bestRating: product.rating.bestRating || 5,
      worstRating: product.rating.worstRating || 1
    } : undefined,
    review: hasReviews ? product.reviews!.map(review => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.reviewRating,
        bestRating: 5,
        worstRating: 1
      },
      author: {
        '@type': 'Person',
        name: review.author
      },
      datePublished: review.datePublished,
      reviewBody: review.reviewBody
    })) : undefined
  };
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbStructuredData(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/**
 * Generate organization structured data
 */
export function generateOrganizationStructuredData(config: {
  name: string;
  url: string;
  logo: string;
  description?: string;
  socialLinks?: string[];
  contactPoint?: {
    telephone: string;
    contactType: string;
    email?: string;
  };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: config.url,
    logo: config.logo,
    description: config.description,
    sameAs: config.socialLinks,
    contactPoint: config.contactPoint ? {
      '@type': 'ContactPoint',
      telephone: config.contactPoint.telephone,
      contactType: config.contactPoint.contactType,
      email: config.contactPoint.email
    } : undefined
  };
}

/**
 * Generate WebSite structured data with search action
 */
export function generateWebsiteStructuredData(config: {
  name: string;
  url: string;
  searchUrl: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: config.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${config.searchUrl}?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Generate e-commerce action structured data
 */
export function generateOfferCatalogStructuredData(config: {
  name: string;
  description: string;
  url: string;
  itemListElements: Array<{
    name: string;
    url: string;
    image: string;
    price: number;
    currency: string;
  }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: config.name,
    description: config.description,
    url: config.url,
    itemListElement: config.itemListElements.map((item, index) => ({
      '@type': 'Offer',
      position: index + 1,
      name: item.name,
      url: item.url,
      image: item.image,
      priceCurrency: item.currency,
      price: item.price,
      availability: 'https://schema.org/InStock'
    }))
  };
}

/**
 * Generate canonical URL
 */
export function generateCanonicalUrl(path: string, baseUrl: string): string {
  // Remove trailing slash
  const cleanPath = path.replace(/\/$/, '');
  const cleanBase = baseUrl.replace(/\/$/, '');
  
  // Remove query parameters for canonical
  const pathWithoutQuery = cleanPath.split('?')[0];
  
  return `${cleanBase}${pathWithoutQuery}`;
}

/**
 * Generate meta description from content
 */
export function generateMetaDescription(content: string, maxLength: number = 160): string {
  if (!content) return '';
  
  // Strip HTML tags
  const stripped = content.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  const cleaned = stripped.replace(/\s+/g, ' ').trim();
  
  // Truncate to max length
  if (cleaned.length <= maxLength) return cleaned;
  
  return cleaned.substring(0, maxLength - 3) + '...';
}

/**
 * Generate SEO-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get optimal image size for social sharing
 */
export function getOptimalSocialImage(images: string[]): string {
  // Prefer images with proper aspect ratio for social sharing (1.91:1 or 1:1)
  // Return first image or fallback
  return images[0] || '/logo.png';
}

/**
 * Generate FAQ structured data
 */
export function generateFAQStructuredData(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Generate robots meta content based on conditions
 */
export function generateRobotsTag(config: {
  index?: boolean;
  follow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
}): string {
  const tags: string[] = [];
  
  tags.push(config.index !== false ? 'index' : 'noindex');
  tags.push(config.follow !== false ? 'follow' : 'nofollow');
  
  if (config.noarchive) tags.push('noarchive');
  if (config.nosnippet) tags.push('nosnippet');
  
  return tags.join(', ');
}

/**
 * Generate optimized title for CTR (Click-Through Rate)
 */
export function generateOptimizedTitle(
  productName: string, 
  category?: string, 
  template: 'product' | 'category' | 'collection' | 'home' = 'product'
): string {
  const maxLength = 60;
  const brand = 'Khadka Foods';
  
  switch (template) {
    case 'product':
      const productTitle = category 
        ? `${productName} - ${category} | ${brand}`
        : `${productName} | ${brand}`;
      return productTitle.length > maxLength 
        ? `${productName} | ${brand}` 
        : productTitle;
    
    case 'category':
      return `${productName} - Shop Premium Quality | ${brand}`;
    
    case 'collection':
      return `${productName} Collection - Authentic Products | ${brand}`;
    
    case 'home':
      return `${brand} - Premium Quality Groceries & Fresh Produce Online`;
    
    default:
      return `${productName} | ${brand}`;
  }
}

/**
 * Generate optimized meta description for CTR
 */
export function generateOptimizedDescription(
  productName: string,
  options: {
    price?: string;
    availability?: string;
    category?: string;
    usps?: string[]; // Unique Selling Points
    type?: 'product' | 'category' | 'collection';
  } = {}
): string {
  const maxLength = 155;
  const { price, availability, category, usps = [], type = 'product' } = options;
  
  let description = '';
  
  if (type === 'product') {
    const parts = [`Shop ${productName}`];
    if (category) parts.push(`in ${category}`);
    if (price) parts.push(`for ${price}`);
    parts.push('at Khadka Foods.');
    if (availability === 'instock') parts.push('✓ In Stock');
    if (usps.length > 0) parts.push(usps.join(' • '));
    parts.push('Fast delivery available.');
    
    description = parts.join(' ');
  } else if (type === 'category') {
    description = `Discover premium ${productName.toLowerCase()} at Khadka Foods. ${usps.join(' • ')}. Shop now with fast delivery.`;
  } else {
    description = `Explore our ${productName} collection. Authentic products, premium quality. ${usps.join(' • ')}. Order online today.`;
  }
  
  return description.length > maxLength 
    ? description.substring(0, maxLength - 3) + '...' 
    : description;
}

/**
 * Generate ItemList structured data for product listings
 * Note: Using simple URL references to avoid nested Product schema validation errors
 */
export function generateItemListStructuredData(config: {
  name: string;
  items: Array<{
    position: number;
    name: string;
    url: string;
    image?: string;
  }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.name,
    itemListElement: config.items.map(item => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      item: item.url  // Use URL reference instead of nested Product object
    }))
  };
}

/**
 * Generate CollectionPage structured data
 * Note: Using URL references to avoid nested Product validation issues
 */
export function generateCollectionPageStructuredData(config: {
  name: string;
  description: string;
  url: string;
  hasPart?: Array<{ url: string; name: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: config.name,
    description: config.description,
    url: config.url,
    // Use simple URL array instead of nested Product objects
    hasPart: config.hasPart?.map(part => part.url)
  };
}

/**
 * Generate VideoObject structured data
 */
export function generateVideoStructuredData(config: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  contentUrl?: string;
  embedUrl?: string;
  duration?: string; // ISO 8601 duration (e.g., PT1M30S)
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: config.name,
    description: config.description,
    thumbnailUrl: config.thumbnailUrl,
    uploadDate: config.uploadDate,
    contentUrl: config.contentUrl,
    embedUrl: config.embedUrl,
    duration: config.duration
  };
}
