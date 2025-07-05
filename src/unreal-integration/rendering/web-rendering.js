/**
 * ALEJO Unreal Engine Web Rendering Integration
 * 
 * This module handles WebGL and WebGPU rendering for the Unreal Engine integration,
 * providing local rendering capabilities for UE content in the browser.
 */

import { publish } from '../../core/event-bus.js';

/**
 * Sets up WebGL rendering for Unreal Engine content
 * @param {Object} config - WebGL rendering configuration
 * @returns {Promise<Object>} - Initialized WebGL rendering system
 */
export async function setupWebGLRendering(config) {
  console.log('Setting up WebGL rendering for Unreal Engine content');
  
  try {
    // Create a canvas element for rendering
    const canvas = document.createElement('canvas');
    canvas.id = 'alejo-unreal-canvas';
    canvas.className = 'alejo-unreal-renderer';
    
    // Apply initial styles
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'auto',
      display: 'block'
    });
    
    // Get WebGL context with appropriate options
    const contextOptions = {
      alpha: true,
      antialias: config.antialias,
      depth: true,
      failIfMajorPerformanceCaveat: false,
      powerPreference: config.powerPreference,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: true
    };
    
    // Try to get WebGL2 context first, fall back to WebGL1 if necessary
    let gl = canvas.getContext('webgl2', contextOptions);
    const isWebGL2 = !!gl;
    
    if (!gl) {
      gl = canvas.getContext('webgl', contextOptions) || 
           canvas.getContext('experimental-webgl', contextOptions);
      
      if (!gl) {
        throw new Error('WebGL not supported');
      }
    }
    
    // Set up initial viewport
    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
    const displayHeight = Math.floor(canvas.clientHeight * devicePixelRatio);
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    gl.viewport(0, 0, displayWidth, displayHeight);
    
    // Clear to black initially
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Load Unreal Engine WebAssembly module if requested
    let unrealModule = null;
    if (config.useWasm) {
      unrealModule = await loadUnrealWasmModule(gl, config);
    }
    
    // Create and return the rendering system
    const renderingSystem = {
      type: 'webgl',
      version: isWebGL2 ? 2 : 1,
      canvas,
      gl,
      unrealModule,
      config,
      
      /**
       * Attaches the rendering canvas to a container element
       * @param {HTMLElement} container - Container element
       */
      attachToContainer(container) {
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        container.appendChild(canvas);
        this.handleResize();
      },
      
      /**
       * Handles window resize events
       */
      handleResize() {
        if (!canvas || !gl) return;
        
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
        const displayHeight = Math.floor(canvas.clientHeight * devicePixelRatio);
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          gl.viewport(0, 0, displayWidth, displayHeight);
          
          if (unrealModule && typeof unrealModule.resizeView === 'function') {
            unrealModule.resizeView(displayWidth, displayHeight);
          }
        }
      },
      
      /**
       * Handles application state changes
       * @param {Object} event - State change event
       */
      handleAppStateChange(event) {
        if (unrealModule && typeof unrealModule.setAppState === 'function') {
          unrealModule.setAppState(event.state);
        }
      },
      
      /**
       * Handles visibility changes
       * @param {string} visibilityState - Document visibility state
       */
      handleVisibilityChange(visibilityState) {
        const isVisible = visibilityState === 'visible';
        
        if (unrealModule && typeof unrealModule.setVisibility === 'function') {
          unrealModule.setVisibility(isVisible);
        }
        
        // Pause rendering when not visible to save resources
        if (!isVisible) {
          this.pauseRendering();
        } else {
          this.resumeRendering();
        }
      },
      
      /**
       * Updates performance settings
       * @param {Object} performanceSettings - New performance settings
       */
      updatePerformanceSettings(performanceSettings) {
        if (unrealModule && typeof unrealModule.updatePerformanceSettings === 'function') {
          unrealModule.updatePerformanceSettings(performanceSettings);
        }
      },
      
      /**
       * Updates accessibility settings
       * @param {Object} accessibilitySettings - New accessibility settings
       */
      updateAccessibilitySettings(accessibilitySettings) {
        if (unrealModule && typeof unrealModule.updateAccessibilitySettings === 'function') {
          unrealModule.updateAccessibilitySettings(accessibilitySettings);
        }
      },
      
      /**
       * Pauses rendering
       */
      pauseRendering() {
        if (unrealModule && typeof unrealModule.pauseRendering === 'function') {
          unrealModule.pauseRendering();
        }
      },
      
      /**
       * Resumes rendering
       */
      resumeRendering() {
        if (unrealModule && typeof unrealModule.resumeRendering === 'function') {
          unrealModule.resumeRendering();
        }
      },
      
      /**
       * Shuts down the rendering system
       * @returns {Promise<void>}
       */
      async shutdown() {
        if (unrealModule && typeof unrealModule.shutdown === 'function') {
          await unrealModule.shutdown();
        }
        
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        // Release WebGL context
        if (gl) {
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      }
    };
    
    publish('unreal:rendering:initialized', { 
      type: renderingSystem.type, 
      version: renderingSystem.version 
    });
    
    return renderingSystem;
  } catch (error) {
    console.error('Failed to set up WebGL rendering:', error);
    publish('unreal:rendering:error', { error });
    throw error;
  }
}

/**
 * Sets up WebGPU rendering for Unreal Engine content
 * @param {Object} config - WebGPU rendering configuration
 * @returns {Promise<Object>} - Initialized WebGPU rendering system
 */
export async function setupWebGPURendering(config) {
  console.log('Setting up WebGPU rendering for Unreal Engine content');
  
  try {
    // Check if WebGPU is available
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }
    
    // Create a canvas element for rendering
    const canvas = document.createElement('canvas');
    canvas.id = 'alejo-unreal-canvas';
    canvas.className = 'alejo-unreal-renderer';
    
    // Apply initial styles
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '0',
      pointerEvents: 'auto',
      display: 'block'
    });
    
    // Get the WebGPU adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: config.powerPreference
    });
    
    if (!adapter) {
      throw new Error('Failed to get WebGPU adapter');
    }
    
    // Get the WebGPU device
    const device = await adapter.requestDevice();
    
    // Configure the canvas context
    const context = canvas.getContext('webgpu');
    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
    const displayHeight = Math.floor(canvas.clientHeight * devicePixelRatio);
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: presentationFormat,
      alphaMode: 'opaque'
    });
    
    // Load Unreal Engine WebAssembly module
    const unrealModule = await loadUnrealWasmModule({ device, context }, config);
    
    // Create and return the rendering system
    const renderingSystem = {
      type: 'webgpu',
      canvas,
      device,
      context,
      unrealModule,
      config,
      
      /**
       * Attaches the rendering canvas to a container element
       * @param {HTMLElement} container - Container element
       */
      attachToContainer(container) {
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        container.appendChild(canvas);
        this.handleResize();
      },
      
      /**
       * Handles window resize events
       */
      handleResize() {
        if (!canvas || !context) return;
        
        const devicePixelRatio = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(canvas.clientWidth * devicePixelRatio);
        const displayHeight = Math.floor(canvas.clientHeight * devicePixelRatio);
        
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          
          if (unrealModule && typeof unrealModule.resizeView === 'function') {
            unrealModule.resizeView(displayWidth, displayHeight);
          }
        }
      },
      
      /**
       * Handles application state changes
       * @param {Object} event - State change event
       */
      handleAppStateChange(event) {
        if (unrealModule && typeof unrealModule.setAppState === 'function') {
          unrealModule.setAppState(event.state);
        }
      },
      
      /**
       * Handles visibility changes
       * @param {string} visibilityState - Document visibility state
       */
      handleVisibilityChange(visibilityState) {
        const isVisible = visibilityState === 'visible';
        
        if (unrealModule && typeof unrealModule.setVisibility === 'function') {
          unrealModule.setVisibility(isVisible);
        }
        
        // Pause rendering when not visible to save resources
        if (!isVisible) {
          this.pauseRendering();
        } else {
          this.resumeRendering();
        }
      },
      
      /**
       * Updates performance settings
       * @param {Object} performanceSettings - New performance settings
       */
      updatePerformanceSettings(performanceSettings) {
        if (unrealModule && typeof unrealModule.updatePerformanceSettings === 'function') {
          unrealModule.updatePerformanceSettings(performanceSettings);
        }
      },
      
      /**
       * Updates accessibility settings
       * @param {Object} accessibilitySettings - New accessibility settings
       */
      updateAccessibilitySettings(accessibilitySettings) {
        if (unrealModule && typeof unrealModule.updateAccessibilitySettings === 'function') {
          unrealModule.updateAccessibilitySettings(accessibilitySettings);
        }
      },
      
      /**
       * Pauses rendering
       */
      pauseRendering() {
        if (unrealModule && typeof unrealModule.pauseRendering === 'function') {
          unrealModule.pauseRendering();
        }
      },
      
      /**
       * Resumes rendering
       */
      resumeRendering() {
        if (unrealModule && typeof unrealModule.resumeRendering === 'function') {
          unrealModule.resumeRendering();
        }
      },
      
      /**
       * Shuts down the rendering system
       * @returns {Promise<void>}
       */
      async shutdown() {
        if (unrealModule && typeof unrealModule.shutdown === 'function') {
          await unrealModule.shutdown();
        }
        
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        // Release WebGPU resources
        if (device) {
          device.destroy();
        }
      }
    };
    
    publish('unreal:rendering:initialized', { 
      type: renderingSystem.type 
    });
    
    return renderingSystem;
  } catch (error) {
    console.error('Failed to set up WebGPU rendering:', error);
    publish('unreal:rendering:error', { error });
    throw error;
  }
}

/**
 * Loads the Unreal Engine WebAssembly module
 * @param {Object} renderContext - Rendering context (WebGL or WebGPU)
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} - Loaded Unreal Engine module
 */
async function loadUnrealWasmModule(renderContext, config) {
  // This is a placeholder for the actual WASM module loading
  // In a real implementation, we would load the compiled Unreal Engine WASM module
  
  console.log('Loading Unreal Engine WebAssembly module (placeholder)');
  
  // Simulate loading delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return a mock module for now
  return {
    resizeView: (width, height) => {
      console.log(`Resizing Unreal Engine view to ${width}x${height}`);
    },
    
    setAppState: (state) => {
      console.log(`Setting Unreal Engine app state to ${state}`);
    },
    
    setVisibility: (isVisible) => {
      console.log(`Setting Unreal Engine visibility to ${isVisible}`);
    },
    
    updatePerformanceSettings: (settings) => {
      console.log('Updating Unreal Engine performance settings:', settings);
    },
    
    updateAccessibilitySettings: (settings) => {
      console.log('Updating Unreal Engine accessibility settings:', settings);
    },
    
    pauseRendering: () => {
      console.log('Pausing Unreal Engine rendering');
    },
    
    resumeRendering: () => {
      console.log('Resuming Unreal Engine rendering');
    },
    
    shutdown: async () => {
      console.log('Shutting down Unreal Engine WebAssembly module');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
}

export default {
  setupWebGLRendering,
  setupWebGPURendering
};
