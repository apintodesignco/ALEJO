/**
 * ALEJO Unreal Engine UI Renderer
 * 
 * This module renders UI components using Unreal Engine, creating a seamless
 * integration between 3D content and user interface elements. It supports
 * voice commands and gesture interactions for UI manipulation.
 */

import { publish, subscribe } from '../../core/event-bus.js';

// UI component types
export const UI_COMPONENT_TYPES = {
  PANEL: 'panel',
  BUTTON: 'button',
  SLIDER: 'slider',
  TOGGLE: 'toggle',
  INPUT: 'input',
  DROPDOWN: 'dropdown',
  CARD: 'card',
  MENU: 'menu',
  NOTIFICATION: 'notification',
  CUSTOM: 'custom'
};

// Default configuration
const DEFAULT_CONFIG = {
  theme: 'futuristic',
  animationSpeed: 1.0,
  interactionMode: 'auto', // 'auto', 'touch', 'gesture', 'voice'
  renderQuality: 'high',
  usePhysics: true,
  accessibilityFeatures: {
    highContrast: false,
    largeText: false,
    voiceOver: false,
    reducedMotion: false
  }
};

/**
 * Initializes the Unreal Engine UI renderer
 * @param {Object} unrealSystem - The initialized Unreal Engine system
 * @param {Object} config - UI renderer configuration
 * @returns {Promise<Object>} - Initialized UI renderer
 */
export async function initializeUnrealUIRenderer(unrealSystem, config = {}) {
  console.log('Initializing ALEJO Unreal Engine UI renderer');
  
  // Merge with default configuration
  const rendererConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };
  
  try {
    // Create UI scene in Unreal Engine
    await createUIScene(unrealSystem, rendererConfig);
    
    // Register voice commands for UI interaction
    registerVoiceCommands();
    
    // Register gesture handlers for UI interaction
    registerGestureHandlers();
    
    // Create UI renderer object
    const renderer = {
      // Configuration
      config: rendererConfig,
      
      // Component registry
      components: new Map(),
      
      /**
       * Creates a UI component in the Unreal Engine scene
       * @param {string} id - Component identifier
       * @param {string} type - Component type from UI_COMPONENT_TYPES
       * @param {Object} options - Component options
       * @returns {Promise<Object>} - Created component
       */
      async createComponent(id, type, options = {}) {
        console.log(`Creating Unreal UI component: ${id} (${type})`);
        
        // Check if component already exists
        if (this.components.has(id)) {
          throw new Error(`UI component already exists: ${id}`);
        }
        
        // Create component in Unreal Engine
        const component = await createUIComponent(unrealSystem, id, type, options, rendererConfig);
        
        // Store in component registry
        this.components.set(id, component);
        
        // Publish component created event
        publish('unreal:ui:component:created', { id, type, component });
        
        return component;
      },
      
      /**
       * Updates a UI component
       * @param {string} id - Component identifier
       * @param {Object} updates - Component updates
       * @returns {Promise<Object>} - Updated component
       */
      async updateComponent(id, updates = {}) {
        // Check if component exists
        if (!this.components.has(id)) {
          throw new Error(`UI component not found: ${id}`);
        }
        
        const component = this.components.get(id);
        
        // Update component in Unreal Engine
        await updateUIComponent(unrealSystem, component, updates, rendererConfig);
        
        // Update component in registry
        Object.assign(component, updates);
        
        // Publish component updated event
        publish('unreal:ui:component:updated', { id, component, updates });
        
        return component;
      },
      
      /**
       * Removes a UI component
       * @param {string} id - Component identifier
       * @returns {Promise<boolean>} - Whether component was removed
       */
      async removeComponent(id) {
        // Check if component exists
        if (!this.components.has(id)) {
          return false;
        }
        
        const component = this.components.get(id);
        
        // Remove component from Unreal Engine
        await removeUIComponent(unrealSystem, component);
        
        // Remove from component registry
        this.components.delete(id);
        
        // Publish component removed event
        publish('unreal:ui:component:removed', { id });
        
        return true;
      },
      
      /**
       * Creates a UI layout from a template
       * @param {string} templateId - Template identifier
       * @param {Object} data - Template data
       * @returns {Promise<Array<Object>>} - Created components
       */
      async createLayout(templateId, data = {}) {
        console.log(`Creating Unreal UI layout from template: ${templateId}`);
        
        // Get template definition
        const template = UI_TEMPLATES[templateId];
        if (!template) {
          throw new Error(`UI template not found: ${templateId}`);
        }
        
        // Create components from template
        const components = [];
        for (const componentDef of template.components) {
          // Process template variables
          const processedDef = processTemplateVariables(componentDef, data);
          
          // Create component
          const component = await this.createComponent(
            processedDef.id,
            processedDef.type,
            processedDef.options
          );
          
          components.push(component);
        }
        
        // Publish layout created event
        publish('unreal:ui:layout:created', { templateId, components });
        
        return components;
      },
      
      /**
       * Updates the UI renderer configuration
       * @param {Object} newConfig - New configuration options
       */
      updateConfig(newConfig) {
        Object.assign(rendererConfig, newConfig);
        
        // Apply configuration changes to Unreal Engine
        applyConfigToUnreal(unrealSystem, rendererConfig);
        
        // Update accessibility settings if provided
        if (newConfig.accessibilityFeatures) {
          publish('accessibility:settings:update', {
            settings: rendererConfig.accessibilityFeatures
          });
        }
      },
      
      /**
       * Handles a voice command for UI interaction
       * @param {string} command - Voice command
       * @param {Object} params - Command parameters
       * @returns {Promise<boolean>} - Whether command was handled
       */
      async handleVoiceCommand(command, params = {}) {
        console.log(`Handling UI voice command: ${command}`, params);
        
        // Process voice command in Unreal Engine
        const result = await processVoiceCommand(unrealSystem, command, params, this.components);
        
        // Publish voice command handled event
        publish('unreal:ui:voice:handled', { command, params, result });
        
        return result;
      },
      
      /**
       * Handles a gesture for UI interaction
       * @param {string} gesture - Gesture type
       * @param {Object} params - Gesture parameters
       * @returns {Promise<boolean>} - Whether gesture was handled
       */
      async handleGesture(gesture, params = {}) {
        console.log(`Handling UI gesture: ${gesture}`, params);
        
        // Process gesture in Unreal Engine
        const result = await processGesture(unrealSystem, gesture, params, this.components);
        
        // Publish gesture handled event
        publish('unreal:ui:gesture:handled', { gesture, params, result });
        
        return result;
      },
      
      /**
       * Shuts down the UI renderer
       */
      async shutdown() {
        console.log('Shutting down Unreal Engine UI renderer');
        
        // Remove all components
        for (const id of this.components.keys()) {
          await this.removeComponent(id);
        }
        
        // Clean up UI scene in Unreal Engine
        await cleanupUIScene(unrealSystem);
      }
    };
    
    // Publish initialization success event
    publish('unreal:ui:renderer:initialized', { renderer });
    
    return renderer;
  } catch (error) {
    console.error('Failed to initialize Unreal Engine UI renderer:', error);
    publish('unreal:ui:renderer:error', { error });
    throw error;
  }
}

/**
 * Creates the UI scene in Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {Object} config - UI renderer configuration
 * @returns {Promise<void>}
 */
async function createUIScene(unrealSystem, config) {
  console.log('Creating UI scene in Unreal Engine');
  
  // Send command to Unreal Engine to create UI scene
  await unrealSystem.sendCommand('ui.createScene', {
    theme: config.theme,
    renderQuality: config.renderQuality,
    usePhysics: config.usePhysics,
    accessibilityFeatures: config.accessibilityFeatures
  });
}

/**
 * Creates a UI component in Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {string} id - Component identifier
 * @param {string} type - Component type
 * @param {Object} options - Component options
 * @param {Object} config - UI renderer configuration
 * @returns {Promise<Object>} - Created component
 */
async function createUIComponent(unrealSystem, id, type, options, config) {
  // Send command to Unreal Engine to create UI component
  const result = await unrealSystem.sendCommand('ui.createComponent', {
    id,
    type,
    options,
    animationSpeed: config.animationSpeed,
    accessibilityFeatures: config.accessibilityFeatures
  });
  
  // Create component object
  return {
    id,
    type,
    ...options,
    unrealId: result.unrealId,
    
    /**
     * Updates the component state
     * @param {Object} state - New state
     * @returns {Promise<void>}
     */
    async setState(state) {
      await unrealSystem.sendCommand('ui.updateComponentState', {
        id: this.id,
        unrealId: this.unrealId,
        state
      });
      
      // Update local state
      Object.assign(this, state);
    },
    
    /**
     * Shows the component
     * @returns {Promise<void>}
     */
    async show() {
      await unrealSystem.sendCommand('ui.showComponent', {
        id: this.id,
        unrealId: this.unrealId
      });
      
      this.visible = true;
    },
    
    /**
     * Hides the component
     * @returns {Promise<void>}
     */
    async hide() {
      await unrealSystem.sendCommand('ui.hideComponent', {
        id: this.id,
        unrealId: this.unrealId
      });
      
      this.visible = false;
    },
    
    /**
     * Animates the component
     * @param {string} animation - Animation name
     * @param {Object} params - Animation parameters
     * @returns {Promise<void>}
     */
    async animate(animation, params = {}) {
      await unrealSystem.sendCommand('ui.animateComponent', {
        id: this.id,
        unrealId: this.unrealId,
        animation,
        params,
        speed: config.animationSpeed
      });
    }
  };
}

/**
 * Updates a UI component in Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {Object} component - Component to update
 * @param {Object} updates - Component updates
 * @param {Object} config - UI renderer configuration
 * @returns {Promise<void>}
 */
async function updateUIComponent(unrealSystem, component, updates, config) {
  // Send command to Unreal Engine to update UI component
  await unrealSystem.sendCommand('ui.updateComponent', {
    id: component.id,
    unrealId: component.unrealId,
    updates,
    animationSpeed: config.animationSpeed
  });
}

/**
 * Removes a UI component from Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {Object} component - Component to remove
 * @returns {Promise<void>}
 */
async function removeUIComponent(unrealSystem, component) {
  // Send command to Unreal Engine to remove UI component
  await unrealSystem.sendCommand('ui.removeComponent', {
    id: component.id,
    unrealId: component.unrealId
  });
}

/**
 * Cleans up the UI scene in Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @returns {Promise<void>}
 */
async function cleanupUIScene(unrealSystem) {
  // Send command to Unreal Engine to clean up UI scene
  await unrealSystem.sendCommand('ui.cleanupScene', {});
}

/**
 * Applies configuration changes to Unreal Engine
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {Object} config - UI renderer configuration
 * @returns {Promise<void>}
 */
async function applyConfigToUnreal(unrealSystem, config) {
  // Send command to Unreal Engine to update UI configuration
  await unrealSystem.sendCommand('ui.updateConfig', {
    theme: config.theme,
    animationSpeed: config.animationSpeed,
    renderQuality: config.renderQuality,
    usePhysics: config.usePhysics,
    accessibilityFeatures: config.accessibilityFeatures
  });
}

/**
 * Processes a voice command for UI interaction
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {string} command - Voice command
 * @param {Object} params - Command parameters
 * @param {Map<string, Object>} components - UI components
 * @returns {Promise<boolean>} - Whether command was handled
 */
async function processVoiceCommand(unrealSystem, command, params, components) {
  // Send command to Unreal Engine to process voice command
  const result = await unrealSystem.sendCommand('ui.processVoiceCommand', {
    command,
    params,
    componentIds: Array.from(components.keys())
  });
  
  return result.handled;
}

/**
 * Processes a gesture for UI interaction
 * @param {Object} unrealSystem - Unreal Engine system
 * @param {string} gesture - Gesture type
 * @param {Object} params - Gesture parameters
 * @param {Map<string, Object>} components - UI components
 * @returns {Promise<boolean>} - Whether gesture was handled
 */
async function processGesture(unrealSystem, gesture, params, components) {
  // Send command to Unreal Engine to process gesture
  const result = await unrealSystem.sendCommand('ui.processGesture', {
    gesture,
    params,
    componentIds: Array.from(components.keys())
  });
  
  return result.handled;
}

/**
 * Registers voice commands for UI interaction
 */
function registerVoiceCommands() {
  // Subscribe to voice command events
  subscribe('voice:command:detected', async (event) => {
    // UI-related voice commands
    const uiCommands = [
      'open menu',
      'close menu',
      'show panel',
      'hide panel',
      'select',
      'click',
      'scroll up',
      'scroll down',
      'go back',
      'change theme',
      'increase size',
      'decrease size'
    ];
    
    // Check if command is UI-related
    const command = event.command.toLowerCase();
    if (uiCommands.some(cmd => command.includes(cmd))) {
      publish('unreal:ui:voice:command', {
        command,
        params: event.params || {}
      });
    }
  });
}

/**
 * Registers gesture handlers for UI interaction
 */
function registerGestureHandlers() {
  // Subscribe to gesture events
  subscribe('gesture:detected', async (event) => {
    // UI-related gestures
    const uiGestures = [
      'swipe_left',
      'swipe_right',
      'swipe_up',
      'swipe_down',
      'tap',
      'double_tap',
      'pinch',
      'spread',
      'rotate'
    ];
    
    // Check if gesture is UI-related
    if (uiGestures.includes(event.gesture)) {
      publish('unreal:ui:gesture', {
        gesture: event.gesture,
        params: event.params || {}
      });
    }
  });
}

/**
 * Processes template variables in component definition
 * @param {Object} componentDef - Component definition
 * @param {Object} data - Template data
 * @returns {Object} - Processed component definition
 */
function processTemplateVariables(componentDef, data) {
  // Create a deep copy of the component definition
  const processed = JSON.parse(JSON.stringify(componentDef));
  
  // Process ID
  if (processed.id.includes('{{')) {
    processed.id = processTemplateString(processed.id, data);
  }
  
  // Process options recursively
  if (processed.options) {
    processed.options = processTemplateObject(processed.options, data);
  }
  
  return processed;
}

/**
 * Processes template variables in a string
 * @param {string} str - Template string
 * @param {Object} data - Template data
 * @returns {string} - Processed string
 */
function processTemplateString(str, data) {
  return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const keys = key.trim().split('.');
    let value = data;
    
    for (const k of keys) {
      if (value === undefined || value === null) {
        return match;
      }
      value = value[k];
    }
    
    return value !== undefined && value !== null ? value : match;
  });
}

/**
 * Processes template variables in an object
 * @param {Object} obj - Template object
 * @param {Object} data - Template data
 * @returns {Object} - Processed object
 */
function processTemplateObject(obj, data) {
  const processed = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.includes('{{')) {
      processed[key] = processTemplateString(value, data);
    } else if (typeof value === 'object' && value !== null) {
      processed[key] = processTemplateObject(value, data);
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
}

// UI Templates
const UI_TEMPLATES = {
  // Main menu template
  'main-menu': {
    components: [
      {
        id: 'main-menu-panel',
        type: UI_COMPONENT_TYPES.PANEL,
        options: {
          title: 'ALEJO Menu',
          position: { x: 0, y: 0, z: 10 },
          size: { width: 400, height: 600 },
          style: {
            backgroundColor: 'rgba(10, 20, 40, 0.8)',
            borderRadius: 20,
            glow: true,
            glowColor: '#4080ff'
          }
        }
      },
      {
        id: 'menu-button-{{item.id}}',
        type: UI_COMPONENT_TYPES.BUTTON,
        options: {
          text: '{{item.label}}',
          icon: '{{item.icon}}',
          position: { x: 0, y: '{{item.index * 80}}', z: 11 },
          size: { width: 360, height: 70 },
          parent: 'main-menu-panel',
          style: {
            backgroundColor: 'rgba(20, 40, 80, 0.6)',
            textColor: '#ffffff',
            borderRadius: 10,
            glow: false
          },
          hoverEffect: 'pulse',
          clickEffect: 'ripple'
        }
      }
    ]
  },
  
  // Dashboard template
  'dashboard': {
    components: [
      {
        id: 'dashboard-panel',
        type: UI_COMPONENT_TYPES.PANEL,
        options: {
          title: '{{title}}',
          position: { x: 0, y: 0, z: 5 },
          size: { width: 800, height: 600 },
          style: {
            backgroundColor: 'rgba(5, 15, 30, 0.85)',
            borderRadius: 15,
            glow: true,
            glowColor: '#2060cc'
          }
        }
      },
      {
        id: 'dashboard-card-{{index}}',
        type: UI_COMPONENT_TYPES.CARD,
        options: {
          title: '{{card.title}}',
          content: '{{card.content}}',
          position: { x: '{{card.x}}', y: '{{card.y}}', z: 6 },
          size: { width: '{{card.width}}', height: '{{card.height}}' },
          parent: 'dashboard-panel',
          style: {
            backgroundColor: 'rgba(15, 30, 60, 0.7)',
            textColor: '#ffffff',
            borderRadius: 10,
            glow: false
          },
          hoverEffect: 'highlight'
        }
      }
    ]
  },
  
  // Notification template
  'notification': {
    components: [
      {
        id: 'notification-{{id}}',
        type: UI_COMPONENT_TYPES.NOTIFICATION,
        options: {
          title: '{{title}}',
          message: '{{message}}',
          type: '{{type}}',
          position: { x: 0, y: 0, z: 100 },
          size: { width: 400, height: 100 },
          style: {
            backgroundColor: 'rgba(10, 20, 40, 0.9)',
            textColor: '#ffffff',
            borderRadius: 10,
            glow: true,
            glowColor: '{{glowColor}}'
          },
          duration: '{{duration}}',
          animation: 'slide-in'
        }
      }
    ]
  }
};

export default {
  initializeUnrealUIRenderer,
  UI_COMPONENT_TYPES
};
