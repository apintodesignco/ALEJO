/**
 * ALEJO Unreal Engine Asset Manager
 * 
 * This module handles loading, caching, and managing assets for the Unreal Engine integration,
 * including 3D models, textures, materials, animations, and UI elements.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// Asset types
export const ASSET_TYPES = {
  MODEL: 'model',
  TEXTURE: 'texture',
  MATERIAL: 'material',
  ANIMATION: 'animation',
  AUDIO: 'audio',
  UI_ELEMENT: 'ui-element',
  ICON: 'icon',
  FONT: 'font'
};

// Asset cache
const assetCache = new Map();

// Loading queue
const loadingQueue = [];
let isProcessingQueue = false;

// Default configuration
const DEFAULT_CONFIG = {
  cachingEnabled: true,
  maxCacheSize: 500 * 1024 * 1024, // 500 MB
  concurrentLoads: 5,
  retryAttempts: 3,
  retryDelay: 1000,
  preloadPriority: 'high', // 'high', 'medium', 'low'
  loadTimeout: 30000 // 30 seconds
};

// Current configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Initializes the asset manager
 * @param {Object} options - Configuration options
 * @returns {Object} - Asset manager API
 */
export function initializeAssetManager(options = {}) {
  console.log('Initializing ALEJO Unreal Engine Asset Manager');
  
  // Merge with default configuration
  config = {
    ...DEFAULT_CONFIG,
    ...options
  };
  
  // Set up event listeners
  setupEventListeners();
  
  // Return public API
  return {
    loadAsset,
    preloadAssets,
    getAsset,
    releaseAsset,
    clearCache,
    getStats
  };
}

/**
 * Sets up event listeners
 */
function setupEventListeners() {
  // Listen for low memory warnings
  subscribe('system:memory:low', handleLowMemory);
  
  // Listen for visibility changes to pause/resume loading
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Handles low memory warnings
 */
function handleLowMemory() {
  console.warn('Low memory warning received, clearing non-essential assets');
  
  // Clear non-essential assets from cache
  const essentialAssets = new Set();
  
  // Keep only assets marked as essential
  for (const [key, asset] of assetCache.entries()) {
    if (!asset.essential) {
      assetCache.delete(key);
    }
  }
  
  // Force garbage collection if possible
  if (window.gc) {
    window.gc();
  }
}

/**
 * Handles visibility changes
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Pause loading when tab is not visible
    pauseLoading();
  } else {
    // Resume loading when tab becomes visible again
    resumeLoading();
  }
}

/**
 * Pauses asset loading
 */
function pauseLoading() {
  isProcessingQueue = false;
}

/**
 * Resumes asset loading
 */
function resumeLoading() {
  if (!isProcessingQueue && loadingQueue.length > 0) {
    processQueue();
  }
}

/**
 * Loads an asset
 * @param {string} url - Asset URL
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} - Loaded asset
 */
export async function loadAsset(url, options = {}) {
  const {
    type = detectAssetType(url),
    priority = 'medium',
    essential = false,
    timeout = config.loadTimeout
  } = options;
  
  // Check if asset is already cached
  const cacheKey = `${type}:${url}`;
  if (config.cachingEnabled && assetCache.has(cacheKey)) {
    const cachedAsset = assetCache.get(cacheKey);
    
    // If asset is already loaded, return it
    if (cachedAsset.status === 'loaded') {
      return cachedAsset.data;
    }
    
    // If asset is loading, wait for it to complete
    if (cachedAsset.status === 'loading') {
      return cachedAsset.promise;
    }
  }
  
  // Create a promise for this asset
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  
  // Add timeout if specified
  const timeoutId = timeout > 0 ? setTimeout(() => {
    rejectPromise(new Error(`Asset loading timed out: ${url}`));
  }, timeout) : null;
  
  // Create asset entry
  const assetEntry = {
    url,
    type,
    status: 'loading',
    priority: getPriorityValue(priority),
    essential,
    promise,
    resolve: (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolvePromise(data);
    },
    reject: (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      rejectPromise(error);
    },
    retryCount: 0,
    data: null
  };
  
  // Add to cache
  if (config.cachingEnabled) {
    assetCache.set(cacheKey, assetEntry);
  }
  
  // Add to loading queue
  addToLoadingQueue(assetEntry);
  
  // Return the promise
  return promise;
}

/**
 * Preloads multiple assets
 * @param {Array<Object>} assets - Assets to preload
 * @returns {Promise<Array<Object>>} - Loaded assets
 */
export async function preloadAssets(assets) {
  if (!Array.isArray(assets) || assets.length === 0) {
    return [];
  }
  
  // Sort assets by priority
  const sortedAssets = [...assets].sort((a, b) => {
    const priorityA = getPriorityValue(a.priority || 'medium');
    const priorityB = getPriorityValue(b.priority || 'medium');
    return priorityB - priorityA; // Higher priority first
  });
  
  // Load all assets in parallel
  const promises = sortedAssets.map(asset => 
    loadAsset(asset.url, {
      type: asset.type,
      priority: asset.priority || 'medium',
      essential: asset.essential || false
    })
  );
  
  // Wait for all assets to load
  return Promise.all(promises);
}

/**
 * Gets an asset from the cache
 * @param {string} url - Asset URL
 * @param {string} type - Asset type
 * @returns {Object|null} - Cached asset or null if not found
 */
export function getAsset(url, type = null) {
  if (!type) {
    type = detectAssetType(url);
  }
  
  const cacheKey = `${type}:${url}`;
  const asset = assetCache.get(cacheKey);
  
  if (asset && asset.status === 'loaded') {
    return asset.data;
  }
  
  return null;
}

/**
 * Releases an asset from the cache
 * @param {string} url - Asset URL
 * @param {string} type - Asset type
 * @returns {boolean} - Whether the asset was released
 */
export function releaseAsset(url, type = null) {
  if (!type) {
    type = detectAssetType(url);
  }
  
  const cacheKey = `${type}:${url}`;
  
  if (assetCache.has(cacheKey)) {
    const asset = assetCache.get(cacheKey);
    
    // If asset is essential, don't release it
    if (asset.essential) {
      return false;
    }
    
    // Remove from cache
    assetCache.delete(cacheKey);
    
    // Force garbage collection if possible
    if (window.gc) {
      window.gc();
    }
    
    return true;
  }
  
  return false;
}

/**
 * Clears the asset cache
 * @param {boolean} keepEssential - Whether to keep essential assets
 * @returns {number} - Number of assets cleared
 */
export function clearCache(keepEssential = true) {
  let clearedCount = 0;
  
  for (const [key, asset] of assetCache.entries()) {
    if (!keepEssential || !asset.essential) {
      assetCache.delete(key);
      clearedCount++;
    }
  }
  
  // Force garbage collection if possible
  if (window.gc) {
    window.gc();
  }
  
  return clearedCount;
}

/**
 * Gets asset manager statistics
 * @returns {Object} - Asset manager statistics
 */
export function getStats() {
  let totalSize = 0;
  let assetCount = 0;
  let loadingCount = 0;
  let essentialCount = 0;
  
  const typeStats = {};
  
  for (const asset of assetCache.values()) {
    assetCount++;
    
    if (asset.status === 'loading') {
      loadingCount++;
    }
    
    if (asset.essential) {
      essentialCount++;
    }
    
    if (asset.data && asset.data.byteLength) {
      totalSize += asset.data.byteLength;
    }
    
    // Track by type
    if (!typeStats[asset.type]) {
      typeStats[asset.type] = {
        count: 0,
        size: 0
      };
    }
    
    typeStats[asset.type].count++;
    
    if (asset.data && asset.data.byteLength) {
      typeStats[asset.type].size += asset.data.byteLength;
    }
  }
  
  return {
    totalSize,
    assetCount,
    loadingCount,
    essentialCount,
    queueLength: loadingQueue.length,
    typeStats,
    cacheEnabled: config.cachingEnabled,
    maxCacheSize: config.maxCacheSize
  };
}

/**
 * Adds an asset to the loading queue
 * @param {Object} assetEntry - Asset entry
 */
function addToLoadingQueue(assetEntry) {
  // Add to queue
  loadingQueue.push(assetEntry);
  
  // Sort queue by priority
  loadingQueue.sort((a, b) => b.priority - a.priority);
  
  // Start processing queue if not already processing
  if (!isProcessingQueue) {
    processQueue();
  }
}

/**
 * Processes the loading queue
 */
function processQueue() {
  if (loadingQueue.length === 0) {
    isProcessingQueue = false;
    return;
  }
  
  isProcessingQueue = true;
  
  // Count active loads
  let activeLoads = 0;
  for (const asset of assetCache.values()) {
    if (asset.status === 'loading' && asset.loading) {
      activeLoads++;
    }
  }
  
  // Process as many items as we can
  while (activeLoads < config.concurrentLoads && loadingQueue.length > 0) {
    const asset = loadingQueue.shift();
    
    // Mark as actively loading
    asset.loading = true;
    
    // Load the asset
    loadAssetData(asset)
      .then(() => {
        // Check if we can process more from the queue
        setTimeout(processQueue, 0);
      })
      .catch(() => {
        // Check if we can process more from the queue
        setTimeout(processQueue, 0);
      });
    
    activeLoads++;
  }
  
  // If we couldn't process all items, check again later
  if (loadingQueue.length > 0) {
    setTimeout(processQueue, 100);
  } else {
    isProcessingQueue = false;
  }
}

/**
 * Loads asset data
 * @param {Object} asset - Asset entry
 * @returns {Promise<void>}
 */
async function loadAssetData(asset) {
  try {
    let data;
    
    // Load based on asset type
    switch (asset.type) {
      case ASSET_TYPES.MODEL:
        data = await loadModel(asset.url);
        break;
        
      case ASSET_TYPES.TEXTURE:
        data = await loadTexture(asset.url);
        break;
        
      case ASSET_TYPES.MATERIAL:
        data = await loadMaterial(asset.url);
        break;
        
      case ASSET_TYPES.ANIMATION:
        data = await loadAnimation(asset.url);
        break;
        
      case ASSET_TYPES.AUDIO:
        data = await loadAudio(asset.url);
        break;
        
      case ASSET_TYPES.UI_ELEMENT:
      case ASSET_TYPES.ICON:
        data = await loadImage(asset.url);
        break;
        
      case ASSET_TYPES.FONT:
        data = await loadFont(asset.url);
        break;
        
      default:
        data = await loadGenericAsset(asset.url);
    }
    
    // Update asset entry
    asset.status = 'loaded';
    asset.data = data;
    asset.loading = false;
    
    // Resolve promise
    asset.resolve(data);
    
    // Publish event
    publish('unreal:asset:loaded', {
      url: asset.url,
      type: asset.type
    });
    
    return data;
  } catch (error) {
    console.error(`Failed to load asset: ${asset.url}`, error);
    
    // Increment retry count
    asset.retryCount++;
    
    // Check if we should retry
    if (asset.retryCount < config.retryAttempts) {
      console.log(`Retrying asset load (${asset.retryCount}/${config.retryAttempts}): ${asset.url}`);
      
      // Add back to queue after delay
      asset.loading = false;
      setTimeout(() => {
        addToLoadingQueue(asset);
      }, config.retryDelay * asset.retryCount);
    } else {
      // Mark as failed
      asset.status = 'error';
      asset.error = error;
      asset.loading = false;
      
      // Reject promise
      asset.reject(error);
      
      // Publish event
      publish('unreal:asset:error', {
        url: asset.url,
        type: asset.type,
        error
      });
    }
    
    throw error;
  }
}

/**
 * Loads a 3D model
 * @param {string} url - Model URL
 * @returns {Promise<Object>} - Loaded model
 */
async function loadModel(url) {
  // This would use appropriate loaders based on file extension
  // For example, GLTFLoader for .glb/.gltf files
  return new Promise((resolve, reject) => {
    // Placeholder for actual model loading
    // In a real implementation, this would use appropriate loaders
    setTimeout(() => {
      resolve({
        type: 'model',
        url,
        // Model data would go here
      });
    }, 100);
  });
}

/**
 * Loads a texture
 * @param {string} url - Texture URL
 * @returns {Promise<Object>} - Loaded texture
 */
async function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    
    image.onload = () => {
      resolve({
        type: 'texture',
        url,
        image,
        width: image.width,
        height: image.height
      });
    };
    
    image.onerror = () => {
      reject(new Error(`Failed to load texture: ${url}`));
    };
    
    image.src = url;
  });
}

/**
 * Loads a material
 * @param {string} url - Material URL
 * @returns {Promise<Object>} - Loaded material
 */
async function loadMaterial(url) {
  // This would load material definition files
  return loadGenericAsset(url);
}

/**
 * Loads an animation
 * @param {string} url - Animation URL
 * @returns {Promise<Object>} - Loaded animation
 */
async function loadAnimation(url) {
  // This would load animation data
  return loadGenericAsset(url);
}

/**
 * Loads an audio file
 * @param {string} url - Audio URL
 * @returns {Promise<Object>} - Loaded audio
 */
async function loadAudio(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.oncanplaythrough = () => {
      resolve({
        type: 'audio',
        url,
        audio,
        duration: audio.duration
      });
    };
    
    audio.onerror = () => {
      reject(new Error(`Failed to load audio: ${url}`));
    };
    
    audio.src = url;
    audio.load();
  });
}

/**
 * Loads an image
 * @param {string} url - Image URL
 * @returns {Promise<Object>} - Loaded image
 */
async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    
    image.onload = () => {
      resolve({
        type: 'image',
        url,
        image,
        width: image.width,
        height: image.height
      });
    };
    
    image.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    
    image.src = url;
  });
}

/**
 * Loads a font
 * @param {string} url - Font URL
 * @returns {Promise<Object>} - Loaded font
 */
async function loadFont(url) {
  return new Promise((resolve, reject) => {
    const fontFace = new FontFace('custom-font', `url(${url})`);
    
    fontFace.load()
      .then(loadedFace => {
        // Add to document fonts
        document.fonts.add(loadedFace);
        
        resolve({
          type: 'font',
          url,
          fontFace: loadedFace
        });
      })
      .catch(error => {
        reject(new Error(`Failed to load font: ${url}`));
      });
  });
}

/**
 * Loads a generic asset
 * @param {string} url - Asset URL
 * @returns {Promise<Object>} - Loaded asset
 */
async function loadGenericAsset(url) {
  return fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load asset: ${url} (${response.status})`);
      }
      
      // Check content type to determine how to process the response
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else if (contentType && contentType.includes('text/')) {
        return response.text();
      } else {
        return response.arrayBuffer();
      }
    })
    .then(data => {
      return {
        type: 'generic',
        url,
        data,
        contentType: typeof data
      };
    });
}

/**
 * Detects asset type from URL
 * @param {string} url - Asset URL
 * @returns {string} - Asset type
 */
function detectAssetType(url) {
  const extension = url.split('.').pop().toLowerCase();
  
  // Map extensions to asset types
  switch (extension) {
    case 'gltf':
    case 'glb':
    case 'obj':
    case 'fbx':
    case '3ds':
      return ASSET_TYPES.MODEL;
      
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'avif':
      return ASSET_TYPES.TEXTURE;
      
    case 'mtl':
    case 'mat':
      return ASSET_TYPES.MATERIAL;
      
    case 'anim':
    case 'fbx':
      return ASSET_TYPES.ANIMATION;
      
    case 'mp3':
    case 'wav':
    case 'ogg':
      return ASSET_TYPES.AUDIO;
      
    case 'svg':
      return ASSET_TYPES.ICON;
      
    case 'ttf':
    case 'woff':
    case 'woff2':
    case 'otf':
      return ASSET_TYPES.FONT;
      
    default:
      return ASSET_TYPES.UI_ELEMENT;
  }
}

/**
 * Gets priority value
 * @param {string} priority - Priority string
 * @returns {number} - Priority value
 */
function getPriorityValue(priority) {
  switch (priority) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 2;
  }
}

export default {
  initializeAssetManager,
  loadAsset,
  preloadAssets,
  getAsset,
  releaseAsset,
  clearCache,
  getStats,
  ASSET_TYPES
};
