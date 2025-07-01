/**
 * ALEJO Core Module
 * 
 * This module contains core functionality that is needed right away.
 * It's separated from other modules for better code organization and performance.
 */

import { setupEventListeners } from './events.js';
import { initializeConfig } from './config.js';

/**
 * Initialize the core functionality of ALEJO
 */
export async function initializeCore() {
  console.log('Initializing ALEJO Core...');
  
  // Initialize configuration with defaults
  const config = await initializeConfig();
  
  // Set up core event listeners
  setupEventListeners();
  
  // Return the initialized configuration
  return config;
}

/**
 * Load resources needed by the core system
 * This is an async operation that can happen in parallel with other initialization
 */
export async function loadCoreResources() {
  return new Promise(resolve => {
    console.log('Loading core resources...');
    
    // Simulate loading resources (replace with actual resource loading)
    setTimeout(() => {
      console.log('Core resources loaded');
      resolve(true);
    }, 100);
  });
}
