/**
 * ALEJO Event System
 * 
 * A lightweight pub/sub event system for communication between components.
 * This decouples different parts of the application and makes code splitting easier.
 */

// Event registry
const eventRegistry = {};

/**
 * Subscribe to an event
 * 
 * @param {string} event - The event name to subscribe to
 * @param {Function} callback - Function to call when event is triggered
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(event, callback) {
  if (!eventRegistry[event]) {
    eventRegistry[event] = [];
  }
  
  eventRegistry[event].push(callback);
  
  // Return an unsubscribe function
  return () => {
    eventRegistry[event] = eventRegistry[event].filter(cb => cb !== callback);
  };
}

/**
 * Publish an event with data
 * 
 * @param {string} event - Event name to publish
 * @param {any} data - Data to pass to subscribers
 */
export function publish(event, data) {
  if (eventRegistry[event]) {
    eventRegistry[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

/**
 * Set up core event listeners
 */
export function setupEventListeners() {
  // Listen for system events
  window.addEventListener('online', () => publish('system:online', true));
  window.addEventListener('offline', () => publish('system:online', false));
  
  // Handle page visibility changes to optimize performance
  document.addEventListener('visibilitychange', () => {
    const isHidden = document.hidden;
    publish('system:visibility', !isHidden);
    
    // Pause intensive operations when page is not visible
    if (isHidden) {
      publish('system:pause', true);
    } else {
      publish('system:resume', true);
    }
  });
  
  // Setup resize throttling for performance
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      publish('ui:resize', {
        width: window.innerWidth,
        height: window.innerHeight
      });
    }, 250); // Throttle resize events
  });
}
