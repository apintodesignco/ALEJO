/**
 * ALEJO System Profiler
 * 
 * Detects and analyzes the user's system capabilities to inform
 * optimal configuration decisions. This module provides information about:
 * - Hardware specifications (CPU, GPU, memory)
 * - Storage availability and constraints
 * - Network capabilities
 * - Browser/environment features
 */

// System profile cache
let systemProfile = null;
let profilePromise = null;

/**
 * Get comprehensive information about the user's system
 * @param {Object} options - Profiling options
 * @param {boolean} options.forceRefresh - Force a refresh of cached data
 * @returns {Promise<Object>} - System profile data
 */
export async function getSystemProfile(options = {}) {
  // Return cached profile if available and refresh not forced
  if (systemProfile && !options.forceRefresh) {
    return systemProfile;
  }
  
  // If profiling is already in progress, return that promise
  if (profilePromise && !options.forceRefresh) {
    return profilePromise;
  }
  
  // Start profiling
  profilePromise = profileSystem();
  
  try {
    systemProfile = await profilePromise;
    return systemProfile;
  } catch (error) {
    console.error('Error profiling system:', error);
    // Return a minimal profile with default values
    return createMinimalProfile();
  } finally {
    profilePromise = null;
  }
}

/**
 * Create a comprehensive profile of the user's system
 * @private
 * @returns {Promise<Object>} - System profile
 */
async function profileSystem() {
  console.log('Profiling system capabilities...');
  
  try {
    // Gather all system information in parallel
    const [
      hardwareInfo,
      storageInfo,
      networkInfo,
      browserInfo,
      gpuInfo
    ] = await Promise.all([
      detectHardware(),
      detectStorage(),
      detectNetwork(),
      detectBrowser(),
      detectGPU()
    ]);
    
    // Combine all information into a single profile
    const profile = {
      hardware: hardwareInfo,
      storage: storageInfo,
      network: networkInfo,
      browser: browserInfo,
      gpu: gpuInfo,
      timestamp: Date.now(),
      
      // Calculate overall capability scores
      capabilities: {
        computeScore: calculateComputeScore(hardwareInfo, gpuInfo),
        storageScore: calculateStorageScore(storageInfo),
        networkScore: calculateNetworkScore(networkInfo),
        browserScore: calculateBrowserScore(browserInfo),
        gpuScore: calculateGPUScore(gpuInfo)
      }
    };
    
    console.log('System profiling complete:', profile);
    return profile;
  } catch (error) {
    console.error('Error during system profiling:', error);
    throw error;
  }
}

/**
 * Detect hardware capabilities (CPU, memory)
 * @private
 * @returns {Promise<Object>} - Hardware information
 */
async function detectHardware() {
  const hardwareInfo = {
    // CPU information
    cpu: {
      cores: navigator.hardwareConcurrency || 1,
      architecture: detectCPUArchitecture()
    },
    
    // Memory information
    memory: {
      deviceMemory: navigator.deviceMemory || 4, // in GB, default to 4GB if not available
      estimatedTotal: null,
      estimatedFree: null
    },
    
    // Device type detection
    deviceType: detectDeviceType(),
    isMobile: detectIsMobile(),
    isLowEndDevice: detectIsLowEndDevice()
  };
  
  // Try to get more detailed memory information if available
  try {
    if (performance && performance.memory) {
      hardwareInfo.memory.estimatedTotal = performance.memory.jsHeapSizeLimit;
      hardwareInfo.memory.estimatedFree = 
        performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
    }
  } catch (e) {
    // Memory API might not be available or might throw security exceptions
    console.warn('Could not access detailed memory information:', e);
  }
  
  return hardwareInfo;
}

/**
 * Detect storage capabilities and availability
 * @private
 * @returns {Promise<Object>} - Storage information
 */
async function detectStorage() {
  const storageInfo = {
    persistent: {
      available: false,
      granted: false,
      quota: 0,
      usage: 0
    },
    temporary: {
      available: false,
      quota: 0,
      usage: 0
    },
    indexedDB: {
      available: !!window.indexedDB
    },
    localStorage: {
      available: !!window.localStorage,
      estimatedSize: 0
    },
    cacheAPI: {
      available: !!(window.caches && window.caches.open)
    }
  };
  
  // Check persistent storage support
  try {
    if (navigator.storage && navigator.storage.persist) {
      storageInfo.persistent.available = true;
      storageInfo.persistent.granted = await navigator.storage.persisted();
      
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        storageInfo.persistent.quota = estimate.quota || 0;
        storageInfo.persistent.usage = estimate.usage || 0;
      }
    }
  } catch (e) {
    console.warn('Error checking persistent storage:', e);
  }
  
  // Check localStorage size
  try {
    if (window.localStorage) {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        totalSize += (key.length + value.length) * 2; // UTF-16 uses 2 bytes per character
      }
      storageInfo.localStorage.estimatedSize = totalSize;
    }
  } catch (e) {
    console.warn('Error estimating localStorage size:', e);
  }
  
  return storageInfo;
}

/**
 * Detect network capabilities
 * @private
 * @returns {Promise<Object>} - Network information
 */
async function detectNetwork() {
  const networkInfo = {
    online: navigator.onLine,
    connection: {
      type: 'unknown',
      effectiveType: 'unknown',
      downlinkMax: null,
      downlink: null,
      rtt: null,
      saveData: false
    }
  };
  
  // Use Network Information API if available
  try {
    if (navigator.connection) {
      networkInfo.connection = {
        type: navigator.connection.type || 'unknown',
        effectiveType: navigator.connection.effectiveType || 'unknown',
        downlinkMax: navigator.connection.downlinkMax || null,
        downlink: navigator.connection.downlink || null,
        rtt: navigator.connection.rtt || null,
        saveData: navigator.connection.saveData || false
      };
    }
  } catch (e) {
    console.warn('Error accessing Network Information API:', e);
  }
  
  return networkInfo;
}

/**
 * Detect browser capabilities and features
 * @private
 * @returns {Promise<Object>} - Browser information
 */
async function detectBrowser() {
  const browserInfo = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages || [navigator.language],
    vendor: navigator.vendor,
    platform: navigator.platform,
    features: {
      webGL: detectWebGL(),
      webGL2: detectWebGL2(),
      webWorkers: !!window.Worker,
      serviceWorkers: !!navigator.serviceWorker,
      webAssembly: detectWebAssembly(),
      sharedArrayBuffer: detectSharedArrayBuffer(),
      webRTC: detectWebRTC(),
      webAudio: !!window.AudioContext || !!window.webkitAudioContext,
      webSpeech: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      webXR: !!navigator.xr,
      touchscreen: detectTouchscreen(),
      batteryAPI: !!navigator.getBattery,
      permissions: !!navigator.permissions
    }
  };
  
  return browserInfo;
}

/**
 * Detect GPU capabilities
 * @private
 * @returns {Promise<Object>} - GPU information
 */
async function detectGPU() {
  const gpuInfo = {
    webGL: {
      supported: false,
      renderer: null,
      vendor: null,
      version: null,
      shadingLanguageVersion: null,
      extensions: []
    },
    webGPU: {
      supported: !!navigator.gpu
    }
  };
  
  // Try to get WebGL information
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      gpuInfo.webGL.supported = true;
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuInfo.webGL.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        gpuInfo.webGL.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      }
      
      gpuInfo.webGL.version = gl.getParameter(gl.VERSION);
      gpuInfo.webGL.shadingLanguageVersion = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
      
      // Get supported extensions
      gpuInfo.webGL.extensions = gl.getSupportedExtensions();
    }
  } catch (e) {
    console.warn('Error detecting WebGL capabilities:', e);
  }
  
  return gpuInfo;
}

/**
 * Create a minimal profile with default values
 * @private
 * @returns {Object} - Minimal system profile
 */
function createMinimalProfile() {
  return {
    hardware: {
      cpu: {
        cores: 2,
        architecture: 'unknown'
      },
      memory: {
        deviceMemory: 4,
        estimatedTotal: null,
        estimatedFree: null
      },
      deviceType: 'desktop',
      isMobile: false,
      isLowEndDevice: false
    },
    storage: {
      persistent: {
        available: false,
        granted: false,
        quota: 0,
        usage: 0
      },
      indexedDB: {
        available: true
      },
      localStorage: {
        available: true,
        estimatedSize: 0
      }
    },
    network: {
      online: true,
      connection: {
        type: 'unknown',
        effectiveType: '4g',
        saveData: false
      }
    },
    browser: {
      features: {
        webGL: true,
        webWorkers: true,
        webAssembly: true
      }
    },
    gpu: {
      webGL: {
        supported: true
      }
    },
    timestamp: Date.now(),
    capabilities: {
      computeScore: 0.5,
      storageScore: 0.5,
      networkScore: 0.5,
      browserScore: 0.5,
      gpuScore: 0.5
    }
  };
}

// Helper functions for detecting specific capabilities

function detectCPUArchitecture() {
  const ua = navigator.userAgent;
  if (ua.includes('ARM') || ua.includes('arm')) return 'arm';
  if (ua.includes('x86_64') || ua.includes('x64') || ua.includes('WOW64')) return 'x86_64';
  if (ua.includes('x86') || ua.includes('Intel')) return 'x86';
  return 'unknown';
}

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) {
      return 'tablet';
    }
    return 'mobile';
  }
  return 'desktop';
}

function detectIsMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function detectIsLowEndDevice() {
  // Consider a device low-end if it has 2 or fewer CPU cores or less than 4GB of RAM
  const lowCores = (navigator.hardwareConcurrency || 4) <= 2;
  const lowMemory = (navigator.deviceMemory || 4) < 4;
  return lowCores || lowMemory;
}

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

function detectWebGL2() {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch (e) {
    return false;
  }
}

function detectWebAssembly() {
  try {
    return typeof WebAssembly === 'object' && 
           typeof WebAssembly.compile === 'function';
  } catch (e) {
    return false;
  }
}

function detectSharedArrayBuffer() {
  try {
    return typeof SharedArrayBuffer === 'function';
  } catch (e) {
    return false;
  }
}

function detectWebRTC() {
  return !!(navigator.mediaDevices && 
           navigator.mediaDevices.getUserMedia);
}

function detectTouchscreen() {
  return 'ontouchstart' in window || 
         navigator.maxTouchPoints > 0 || 
         navigator.msMaxTouchPoints > 0;
}

// Capability scoring functions

function calculateComputeScore(hardware, gpu) {
  // Score from 0-1 based on CPU cores and memory
  const coreScore = Math.min(1, (hardware.cpu.cores || 1) / 8);
  const memoryScore = Math.min(1, (hardware.memory.deviceMemory || 4) / 8);
  
  // Penalize for low-end devices
  const devicePenalty = hardware.isLowEndDevice ? 0.3 : 0;
  
  // Combine scores (CPU is weighted more heavily)
  return Math.max(0, Math.min(1, (coreScore * 0.6 + memoryScore * 0.4) - devicePenalty));
}

function calculateStorageScore(storage) {
  // Base score on available persistent storage
  let score = 0.5; // Default middle score
  
  if (storage.persistent.available) {
    // Calculate based on quota (normalize to 1GB max)
    const quotaGB = (storage.persistent.quota || 0) / (1024 * 1024 * 1024);
    score = Math.min(1, quotaGB / 1);
    
    // Adjust based on usage
    if (storage.persistent.quota > 0) {
      const usageRatio = (storage.persistent.usage || 0) / storage.persistent.quota;
      if (usageRatio > 0.9) score *= 0.7; // Heavy penalty for nearly full storage
      else if (usageRatio > 0.7) score *= 0.9; // Small penalty for mostly full storage
    }
  } else if (storage.indexedDB.available) {
    score = 0.4; // IndexedDB but no persistent storage
  } else if (storage.localStorage.available) {
    score = 0.2; // Only localStorage
  } else {
    score = 0; // No storage available
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculateNetworkScore(network) {
  // Base score on connection type
  let score = 0.5; // Default middle score
  
  if (!network.online) return 0;
  
  // Adjust based on connection type
  switch (network.connection.effectiveType) {
    case 'slow-2g':
      score = 0.1;
      break;
    case '2g':
      score = 0.3;
      break;
    case '3g':
      score = 0.6;
      break;
    case '4g':
      score = 0.9;
      break;
    default:
      // Keep default score
      break;
  }
  
  // Adjust for save-data mode
  if (network.connection.saveData) {
    score *= 0.7;
  }
  
  // Adjust based on RTT if available
  if (network.connection.rtt) {
    // RTT under 50ms is excellent, over 300ms is poor
    const rttScore = Math.max(0, Math.min(1, 1 - (network.connection.rtt - 50) / 250));
    score = (score + rttScore) / 2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculateBrowserScore(browser) {
  // Score based on supported features
  let featureCount = 0;
  let totalFeatures = 0;
  
  for (const feature in browser.features) {
    totalFeatures++;
    if (browser.features[feature]) featureCount++;
  }
  
  return featureCount / totalFeatures;
}

function calculateGPUScore(gpu) {
  // Base score on WebGL support
  let score = 0.5; // Default middle score
  
  if (!gpu.webGL.supported) {
    return 0.1; // Very low score without WebGL
  }
  
  // Bonus for WebGL2
  if (gpu.webGL.extensions && gpu.webGL.extensions.includes('WEBGL_draw_buffers')) {
    score += 0.2;
  }
  
  // Bonus for WebGPU
  if (gpu.webGPU.supported) {
    score += 0.3;
  }
  
  // Adjust based on renderer if available
  if (gpu.webGL.renderer) {
    const renderer = gpu.webGL.renderer.toLowerCase();
    
    // Penalty for integrated graphics
    if (renderer.includes('intel') && !renderer.includes('iris')) {
      score *= 0.8;
    }
    
    // Bonus for dedicated GPUs
    if (renderer.includes('nvidia') || renderer.includes('amd') || renderer.includes('radeon')) {
      score *= 1.2;
    }
  }
  
  return Math.max(0, Math.min(1, score));
}
