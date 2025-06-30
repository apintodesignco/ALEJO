/**
 * ALEJO Gesture Element Registry Module
 * 
 * Handles the registration and management of gesture-enabled DOM elements.
 * This module scans the DOM for elements with gesture attributes, tracks their
 * state, and provides an interface for interacting with gesture-enabled elements.
 * 
 * @module gesture-element-registry
 * @requires gesture-controller-core
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureElementRegistry class for managing gesture-enabled elements
     */
    class GestureElementRegistry {
        /**
         * Create a new GestureElementRegistry
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                gestureEnabledClass: options.gestureEnabledClass || 'gesture-enabled',
                gestureActionAttr: options.gestureActionAttr || 'data-gesture-action',
                gestureParamsAttr: options.gestureParamsAttr || 'data-gesture-params',
                gestureContextAttr: options.gestureContextAttr || 'data-gesture-context',
                autoScan: options.autoScan !== undefined ? options.autoScan : true,
                observeDom: options.observeDom !== undefined ? options.observeDom : true,
                debug: options.debug || false
            };
            
            // State tracking
            this.elements = new Map();
            this.observer = null;
            
            // Event callbacks
            this.callbacks = {
                onElementRegistered: options.onElementRegistered || null,
                onElementUnregistered: options.onElementUnregistered || null,
                onRegistryUpdated: options.onRegistryUpdated || null
            };
            
            // Initialize
            this.init();
        }
        
        /**
         * Initialize the registry
         */
        init() {
            // Scan for elements if auto-scan is enabled
            if (this.config.autoScan) {
                this.scanElements();
            }
            
            // Set up mutation observer if enabled
            if (this.config.observeDom) {
                this._setupObserver();
            }
            
            if (this.config.debug) {
                console.log('ALEJO GestureElementRegistry initialized');
            }
        }
        
        /**
         * Scan the DOM for gesture-enabled elements
         * @param {Element} [root=document.body] - Root element to scan from
         */
        scanElements(root = document.body) {
            try {
                // Find all elements with the gesture-enabled class
                const selector = `.${this.config.gestureEnabledClass}, [${this.config.gestureActionAttr}]`;
                const elements = root.querySelectorAll(selector);
                
                // Register each element
                elements.forEach(element => {
                    this.registerElement(element);
                });
                
                // Notify registry updated
                this._notifyRegistryUpdated();
                
                if (this.config.debug) {
                    console.log(`Scanned for gesture elements, found ${elements.length}`);
                }
            } catch (error) {
                if (this.config.debug) {
                    console.error('Error scanning for gesture elements:', error);
                }
            }
        }
        
        /**
         * Register a single element
         * @param {Element} element - DOM element to register
         * @returns {string|null} Element ID if registered, null if already registered
         */
        registerElement(element) {
            if (!element) return null;
            
            // Generate a unique ID if the element doesn't have one
            let elementId = element.id;
            if (!elementId) {
                elementId = `gesture-element-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                element.id = elementId;
            }
            
            // Skip if already registered
            if (this.elements.has(elementId)) {
                return null;
            }
            
            // Get gesture action from attribute or default
            const action = element.getAttribute(this.config.gestureActionAttr) || null;
            
            // Get gesture parameters
            let params = {};
            const paramsAttr = element.getAttribute(this.config.gestureParamsAttr);
            if (paramsAttr) {
                try {
                    params = JSON.parse(paramsAttr);
                } catch (error) {
                    if (this.config.debug) {
                        console.error(`Error parsing gesture params for ${elementId}:`, error);
                    }
                }
            }
            
            // Get gesture context
            const context = element.getAttribute(this.config.gestureContextAttr) || 'default';
            
            // Create element data
            const elementData = {
                id: elementId,
                element: element,
                action: action,
                params: params,
                context: context,
                enabled: true,
                registeredAt: Date.now()
            };
            
            // Store in registry
            this.elements.set(elementId, elementData);
            
            // Add data attribute for tracking
            element.setAttribute('data-gesture-registered', 'true');
            
            // Notify element registered
            if (this.callbacks.onElementRegistered) {
                this.callbacks.onElementRegistered(elementData);
            }
            
            if (this.config.debug) {
                console.log(`Registered gesture element: ${elementId}`, elementData);
            }
            
            return elementId;
        }
        
        /**
         * Unregister an element
         * @param {string|Element} elementOrId - Element or element ID to unregister
         * @returns {boolean} True if unregistered, false if not found
         */
        unregisterElement(elementOrId) {
            let elementId;
            
            if (typeof elementOrId === 'string') {
                elementId = elementOrId;
            } else if (elementOrId instanceof Element) {
                elementId = elementOrId.id;
            } else {
                return false;
            }
            
            // Skip if not registered
            if (!this.elements.has(elementId)) {
                return false;
            }
            
            // Get element data
            const elementData = this.elements.get(elementId);
            
            // Remove from registry
            this.elements.delete(elementId);
            
            // Remove data attribute
            if (elementData.element) {
                elementData.element.removeAttribute('data-gesture-registered');
            }
            
            // Notify element unregistered
            if (this.callbacks.onElementUnregistered) {
                this.callbacks.onElementUnregistered(elementData);
            }
            
            if (this.config.debug) {
                console.log(`Unregistered gesture element: ${elementId}`);
            }
            
            return true;
        }
        
        /**
         * Get an element by ID
         * @param {string} elementId - Element ID
         * @returns {Object|null} Element data or null if not found
         */
        getElement(elementId) {
            return this.elements.has(elementId) ? this.elements.get(elementId) : null;
        }
        
        /**
         * Get all registered elements
         * @returns {Array} Array of element data objects
         */
        getAllElements() {
            return Array.from(this.elements.values());
        }
        
        /**
         * Get elements by context
         * @param {string} context - Context to filter by
         * @returns {Array} Array of element data objects
         */
        getElementsByContext(context) {
            return Array.from(this.elements.values())
                .filter(element => element.context === context);
        }
        
        /**
         * Get elements by action
         * @param {string} action - Action to filter by
         * @returns {Array} Array of element data objects
         */
        getElementsByAction(action) {
            return Array.from(this.elements.values())
                .filter(element => element.action === action);
        }
        
        /**
         * Update an element's properties
         * @param {string} elementId - Element ID
         * @param {Object} properties - Properties to update
         * @returns {boolean} True if updated, false if not found
         */
        updateElement(elementId, properties) {
            if (!this.elements.has(elementId)) {
                return false;
            }
            
            // Get element data
            const elementData = this.elements.get(elementId);
            
            // Update properties
            Object.assign(elementData, properties);
            
            // Update action attribute if changed
            if (properties.action !== undefined && elementData.element) {
                if (properties.action) {
                    elementData.element.setAttribute(this.config.gestureActionAttr, properties.action);
                } else {
                    elementData.element.removeAttribute(this.config.gestureActionAttr);
                }
            }
            
            // Update params attribute if changed
            if (properties.params !== undefined && elementData.element) {
                if (properties.params && Object.keys(properties.params).length > 0) {
                    elementData.element.setAttribute(
                        this.config.gestureParamsAttr, 
                        JSON.stringify(properties.params)
                    );
                } else {
                    elementData.element.removeAttribute(this.config.gestureParamsAttr);
                }
            }
            
            // Update context attribute if changed
            if (properties.context !== undefined && elementData.element) {
                if (properties.context && properties.context !== 'default') {
                    elementData.element.setAttribute(this.config.gestureContextAttr, properties.context);
                } else {
                    elementData.element.removeAttribute(this.config.gestureContextAttr);
                }
            }
            
            if (this.config.debug) {
                console.log(`Updated gesture element: ${elementId}`, elementData);
            }
            
            return true;
        }
        
        /**
         * Enable an element
         * @param {string} elementId - Element ID
         * @returns {boolean} True if enabled, false if not found
         */
        enableElement(elementId) {
            return this.updateElement(elementId, { enabled: true });
        }
        
        /**
         * Disable an element
         * @param {string} elementId - Element ID
         * @returns {boolean} True if disabled, false if not found
         */
        disableElement(elementId) {
            return this.updateElement(elementId, { enabled: false });
        }
        
        /**
         * Get element data for WebSocket registration
         * @returns {Array} Array of element data for registration
         */
        getElementsForRegistration() {
            return Array.from(this.elements.values())
                .filter(element => element.enabled)
                .map(element => ({
                    id: element.id,
                    action: element.action,
                    context: element.context,
                    params: element.params
                }));
        }
        
        /**
         * Set up mutation observer to track DOM changes
         * @private
         */
        _setupObserver() {
            if (!window.MutationObserver) return;
            
            this.observer = new MutationObserver(mutations => {
                let shouldScan = false;
                
                // Check for relevant mutations
                for (const mutation of mutations) {
                    // Added nodes
                    if (mutation.addedNodes.length > 0) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Check if the added node or its children might be gesture-enabled
                                if (node.classList && node.classList.contains(this.config.gestureEnabledClass) ||
                                    node.hasAttribute && node.hasAttribute(this.config.gestureActionAttr) ||
                                    node.querySelector && node.querySelector(`.${this.config.gestureEnabledClass}, [${this.config.gestureActionAttr}]`)) {
                                    shouldScan = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Removed nodes
                    if (mutation.removedNodes.length > 0) {
                        for (const node of mutation.removedNodes) {
                            if (node.nodeType === Node.ELEMENT_NODE && node.id && this.elements.has(node.id)) {
                                this.unregisterElement(node.id);
                            }
                        }
                    }
                    
                    // Attribute changes
                    if (mutation.type === 'attributes' && 
                        (mutation.attributeName === this.config.gestureActionAttr ||
                         mutation.attributeName === this.config.gestureParamsAttr ||
                         mutation.attributeName === this.config.gestureContextAttr ||
                         mutation.attributeName === 'class')) {
                        
                        const target = mutation.target;
                        
                        // Check if element is or should be gesture-enabled
                        const isGestureEnabled = target.classList.contains(this.config.gestureEnabledClass) ||
                                                target.hasAttribute(this.config.gestureActionAttr);
                        
                        // If already registered, update it
                        if (target.id && this.elements.has(target.id)) {
                            if (isGestureEnabled) {
                                // Update properties
                                this.updateElement(target.id, {
                                    action: target.getAttribute(this.config.gestureActionAttr) || null,
                                    context: target.getAttribute(this.config.gestureContextAttr) || 'default'
                                });
                            } else {
                                // Unregister if no longer gesture-enabled
                                this.unregisterElement(target.id);
                            }
                        } else if (isGestureEnabled) {
                            // Register if newly gesture-enabled
                            this.registerElement(target);
                        }
                    }
                    
                    if (shouldScan) break;
                }
                
                // Scan for new elements if needed
                if (shouldScan) {
                    this.scanElements();
                }
            });
            
            // Start observing
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: [
                    'class', 
                    this.config.gestureActionAttr, 
                    this.config.gestureParamsAttr, 
                    this.config.gestureContextAttr
                ]
            });
            
            if (this.config.debug) {
                console.log('DOM observer started');
            }
        }
        
        /**
         * Notify registry updated
         * @private
         */
        _notifyRegistryUpdated() {
            if (this.callbacks.onRegistryUpdated) {
                this.callbacks.onRegistryUpdated({
                    count: this.elements.size,
                    elements: this.getElementsForRegistration()
                });
            }
        }
        
        /**
         * Reset the registry
         */
        reset() {
            this.elements.clear();
            
            if (this.config.autoScan) {
                this.scanElements();
            }
            
            if (this.config.debug) {
                console.log('GestureElementRegistry reset');
            }
        }
        
        /**
         * Destroy the registry and clean up resources
         */
        destroy() {
            // Stop observer
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            
            // Clear elements
            this.elements.clear();
            
            if (this.config.debug) {
                console.log('ALEJO GestureElementRegistry destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureElementRegistry = GestureElementRegistry;
})();
