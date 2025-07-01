/**
 * ALEJO Configuration Module
 * 
 * Manages application configuration with smart caching and defaults.
 * Supports environment-specific configuration and feature flags.
 */

// Default configuration
const DEFAULT_CONFIG = {
  // Feature flags
  features: {
    gestures: true,
    voice: false,
    analytics: true,
    darkMode: false
  },
  
  // Performance settings
  performance: {
    animationQuality: 'high', // 'low', 'medium', 'high'
    cacheDuration: 1800, // seconds
    prefetchAssets: true,
    idleTimeout: 300 // seconds
  },
  
  // UI settings
  ui: {
    theme: 'light',
    animations: true,
    notifications: true,
    accessibility: {
      highContrast: false,
      reduceMotion: false,
      largeText: false
    }
  },
  
  // API endpoints
  api: {
    baseUrl: '/api',
    timeout: 30000 // ms
  }
};

// Cache key for LocalStorage
const CONFIG_CACHE_KEY = 'alejo_config';

/**
 * Initialize the application configuration
 * Merges default config with cached config and remote config
 */
export async function initializeConfig() {
  console.log('Initializing configuration...');
  
  try {
    // Start with default configuration
    let config = { ...DEFAULT_CONFIG };
    
    // Try to get cached configuration from localStorage
    try {
      const cachedConfig = localStorage.getItem(CONFIG_CACHE_KEY);
      if (cachedConfig) {
        const parsedCache = JSON.parse(cachedConfig);
        
        // Check if cache is still valid (24 hour TTL)
        const cacheTimestamp = parsedCache._timestamp || 0;
        const cacheTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (Date.now() - cacheTimestamp < cacheTTL) {
          console.log('Using cached configuration');
          config = mergeConfigs(config, parsedCache);
        } else {
          console.log('Cached configuration expired');
        }
      }
    } catch (cacheError) {
      console.warn('Failed to load cached configuration:', cacheError);
    }
    
    // Try to fetch remote configuration if online
    if (navigator.onLine) {
      try {
        const remoteConfig = await fetchRemoteConfig();
        if (remoteConfig) {
          console.log('Loaded remote configuration');
          config = mergeConfigs(config, remoteConfig);
        }
      } catch (fetchError) {
        console.warn('Failed to fetch remote configuration:', fetchError);
      }
    } else {
      console.log('Offline mode: using cached configuration only');
    }
    
    // Apply environment-specific overrides
    config = applyEnvironmentOverrides(config);
    
    // Update the cache with the new configuration
    saveConfigToCache(config);
    
    // Return the final configuration
    return config;
  } catch (error) {
    console.error('Configuration initialization failed:', error);
    
    // If all else fails, return default config
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Merge configurations, with new config overriding base config
 */
function mergeConfigs(baseConfig, newConfig) {
  // Create a deep clone of the base config
  const result = JSON.parse(JSON.stringify(baseConfig));
  
  // Helper function to recursively merge objects
  const mergeObjects = (target, source) => {
    Object.keys(source).forEach(key => {
      // Skip internal keys that start with underscore
      if (key.startsWith('_')) return;
      
      if (source[key] instanceof Object && key in target) {
        mergeObjects(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
  };
  
  // Merge the new config into the result
  mergeObjects(result, newConfig);
  return result;
}

/**
 * Fetch remote configuration from the server
 */
async function fetchRemoteConfig() {
  try {
    // Add a short timeout for quick failure if server is unreachable
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch('/api/config', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return await response.json();
    }
    
    return null;
  } catch (error) {
    console.warn('Remote config fetch failed:', error.message);
    return null;
  }
}

/**
 * Apply environment-specific configuration overrides
 */
function applyEnvironmentOverrides(config) {
  // Clone the config to avoid mutations
  const result = { ...config };
  
  // Apply development-specific settings
  if (import.meta.env.DEV) {
    console.log('Applying development configuration overrides');
    result.performance.animationQuality = 'high';
    result.features.debugMode = true;
  }
  
  // Apply production-specific settings
  if (import.meta.env.PROD) {
    console.log('Applying production configuration overrides');
    result.features.debugMode = false;
  }
  
  // Apply feature flags from URL parameters (useful for testing)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('features')) {
    try {
      const featuresParam = urlParams.get('features');
      const features = featuresParam.split(',');
      
      features.forEach(feature => {
        const [name, value] = feature.split(':');
        if (name && value && result.features.hasOwnProperty(name)) {
          result.features[name] = value === 'true';
          console.log(`Override feature flag from URL: ${name} = ${result.features[name]}`);
        }
      });
    } catch (error) {
      console.warn('Failed to parse feature flags from URL:', error);
    }
  }
  
  return result;
}

/**
 * Save the configuration to localStorage cache
 */
function saveConfigToCache(config) {
  try {
    // Add a timestamp for cache invalidation
    const configToCache = {
      ...config,
      _timestamp: Date.now()
    };
    
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(configToCache));
    console.log('Configuration saved to cache');
  } catch (error) {
    console.warn('Failed to cache configuration:', error);
  }
}
