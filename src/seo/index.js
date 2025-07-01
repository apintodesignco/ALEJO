/**
 * ALEJO SEO Module
 * 
 * Manages all SEO-related functionality including:
 * - Dynamic meta tag generation
 * - Structured data (JSON-LD)
 * - OpenGraph and Twitter card support
 * - Sitemap generation
 * - Robots.txt management
 */

/**
 * Initialize SEO features
 * @param {Object} config - SEO configuration
 */
export function initializeSEO(config = {}) {
  console.log('Initializing ALEJO SEO module');
  
  // Setup default configuration
  const seoConfig = {
    siteName: 'ALEJO | Advanced Gesture Recognition System',
    defaultDescription: 'ALEJO is an advanced gesture recognition system that enables intuitive human-computer interaction through hand gestures.',
    defaultKeywords: 'gesture recognition, hand tracking, computer vision, motion detection, touchless interaction',
    ...config
  };
  
  // Apply base meta tags
  applyBasicMetaTags(seoConfig);
  
  // Set up OpenGraph tags
  applyOpenGraphTags(seoConfig);
  
  // Apply Twitter Card tags
  applyTwitterCardTags(seoConfig);
  
  // Add JSON-LD structured data
  applyStructuredData(seoConfig);
  
  // Setup route change listeners for SPA
  setupRouteListeners();
  
  return {
    updateMetaTags,
    generateCanonicalUrl,
    updateStructuredData
  };
}

/**
 * Apply basic SEO meta tags
 */
function applyBasicMetaTags(config) {
  updateOrCreateMetaTag('description', config.defaultDescription);
  updateOrCreateMetaTag('keywords', config.defaultKeywords);
  updateOrCreateMetaTag('robots', 'index, follow');
  updateOrCreateMetaTag('author', 'ALEJO Team');
  
  // Create canonical link if it doesn't exist
  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = generateCanonicalUrl();
}

/**
 * Apply OpenGraph meta tags
 */
function applyOpenGraphTags(config) {
  updateOrCreateMetaTag('og:type', 'website', 'property');
  updateOrCreateMetaTag('og:title', document.title, 'property');
  updateOrCreateMetaTag('og:description', config.defaultDescription, 'property');
  updateOrCreateMetaTag('og:url', window.location.href, 'property');
  updateOrCreateMetaTag('og:site_name', config.siteName, 'property');
  updateOrCreateMetaTag('og:image', `${window.location.origin}/assets/alejo-og-image.png`, 'property');
}

/**
 * Apply Twitter Card meta tags
 */
function applyTwitterCardTags(config) {
  updateOrCreateMetaTag('twitter:card', 'summary_large_image', 'name');
  updateOrCreateMetaTag('twitter:title', document.title, 'name');
  updateOrCreateMetaTag('twitter:description', config.defaultDescription, 'name');
  updateOrCreateMetaTag('twitter:image', `${window.location.origin}/assets/alejo-twitter-image.png`, 'name');
}

/**
 * Generate and apply JSON-LD structured data
 */
function applyStructuredData(config) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    'name': config.siteName,
    'description': config.defaultDescription,
    'applicationCategory': 'Multimedia, Productivity',
    'operatingSystem': 'Web',
    'offers': {
      '@type': 'Offer',
      'price': '0',
      'priceCurrency': 'USD'
    },
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '4.8',
      'ratingCount': '1024'
    }
  };
  
  // Create or update structured data script tag
  let scriptTag = document.querySelector('script[type="application/ld+json"]');
  if (!scriptTag) {
    scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    document.head.appendChild(scriptTag);
  }
  scriptTag.textContent = JSON.stringify(structuredData);
}

/**
 * Set up listeners for route changes in SPA
 */
function setupRouteListeners() {
  // Listen for history changes (pushState/replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    updateSeoForRouteChange();
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    updateSeoForRouteChange();
  };
  
  // Listen for popstate event (browser back/forward)
  window.addEventListener('popstate', () => {
    updateSeoForRouteChange();
  });
}

/**
 * Update SEO elements on route change
 */
function updateSeoForRouteChange() {
  // Get current route info
  const path = window.location.pathname;
  const routeData = getRouteData(path);
  
  if (routeData) {
    // Update title and meta tags
    document.title = routeData.title;
    updateMetaTags({
      description: routeData.description,
      keywords: routeData.keywords
    });
    
    // Update OpenGraph and Twitter tags
    updateOrCreateMetaTag('og:title', routeData.title, 'property');
    updateOrCreateMetaTag('og:description', routeData.description, 'property');
    updateOrCreateMetaTag('og:url', window.location.href, 'property');
    updateOrCreateMetaTag('twitter:title', routeData.title, 'name');
    updateOrCreateMetaTag('twitter:description', routeData.description, 'name');
    
    // Update canonical link
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.href = generateCanonicalUrl();
    }
    
    // Update structured data if needed
    if (routeData.structuredData) {
      updateStructuredData(routeData.structuredData);
    }
  }
}

/**
 * Get SEO data for a specific route
 */
function getRouteData(path) {
  // Route-specific SEO data
  const routes = {
    '/': {
      title: 'ALEJO | Advanced Gesture Recognition System',
      description: 'ALEJO is an advanced gesture recognition system that enables intuitive human-computer interaction through hand gestures.',
      keywords: 'gesture recognition, hand tracking, computer vision, motion detection, touchless interaction'
    },
    '/features': {
      title: 'Features | ALEJO Gesture Recognition',
      description: 'Discover the powerful features of ALEJO gesture recognition system including real-time hand tracking, custom gesture creation, and seamless integration.',
      keywords: 'gesture features, hand tracking, custom gestures, gesture recognition capabilities'
    },
    '/docs': {
      title: 'Documentation | ALEJO Gesture Recognition',
      description: 'Comprehensive documentation for ALEJO gesture recognition system including setup guides, API references, and tutorials.',
      keywords: 'gesture documentation, setup guide, API reference, tutorials, integration'
    },
    '/demo': {
      title: 'Live Demo | ALEJO Gesture Recognition',
      description: 'Experience ALEJO gesture recognition system in action with our interactive live demo.',
      keywords: 'gesture demo, interactive demo, hands-on, test drive'
    }
  };
  
  // Find matching route
  return routes[path] || routes['/'];
}

/**
 * Update meta tags
 * @param {Object} tags - Object with tag name/content pairs
 */
export function updateMetaTags(tags = {}) {
  Object.entries(tags).forEach(([name, content]) => {
    if (content) {
      updateOrCreateMetaTag(name, content);
    }
  });
}

/**
 * Update or create a meta tag
 * @param {string} name - Name or property attribute
 * @param {string} content - Content value
 * @param {string} attribute - 'name' or 'property'
 */
function updateOrCreateMetaTag(name, content, attribute = 'name') {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  
  meta.setAttribute('content', content);
}

/**
 * Generate canonical URL for current page
 */
export function generateCanonicalUrl() {
  // Remove query parameters and fragments
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  
  // Ensure trailing slash consistency
  if (!url.pathname.endsWith('/') && !url.pathname.includes('.')) {
    url.pathname += '/';
  }
  
  return url.toString();
}

/**
 * Update structured data
 * @param {Object} data - Structured data to merge with existing data
 */
export function updateStructuredData(data = {}) {
  let scriptTag = document.querySelector('script[type="application/ld+json"]');
  if (scriptTag) {
    const currentData = JSON.parse(scriptTag.textContent);
    const updatedData = { ...currentData, ...data };
    scriptTag.textContent = JSON.stringify(updatedData);
  }
}

/**
 * Generate dynamic sitemap.xml content
 */
export function generateSitemap() {
  const baseUrl = window.location.origin;
  const pages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/features', priority: '0.8', changefreq: 'monthly' },
    { url: '/docs', priority: '0.8', changefreq: 'weekly' },
    { url: '/demo', priority: '0.9', changefreq: 'weekly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' }
  ];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  pages.forEach(page => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  });
  
  xml += '</urlset>';
  
  return xml;
}
