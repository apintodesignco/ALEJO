/**
 * ALEJO Component Recovery System Demo
 * 
 * This file demonstrates the component recovery system functionality
 * with intentional failures and recovery attempts.
 */

import { 
  registerComponent, 
  initializeSystem,
  checkForPreviousFailures,
  recoverAllFailedComponents
} from './initialization-manager.js';
import { initializeRecoveryStatusUI } from './recovery-status-ui.js';
import { publishEvent } from '../neural-architecture/neural-event-bus.js';

// Demo components to demonstrate success and failure scenarios
const demoComponents = [
  {
    id: 'demo-component-success',
    name: 'Demo Success Component',
    description: 'Always initializes successfully',
    initFunction: async () => {
      console.log('Demo success component initializing...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Demo success component initialized');
      return { success: true };
    },
    isEssential: false,
    accessibility: false
  },
  {
    id: 'demo-component-fail',
    name: 'Demo Failure Component',
    description: 'Always fails on first attempt but succeeds on recovery',
    initFunction: async () => {
      console.log('Demo failure component initializing...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // On first attempt, throw an error
      if (!localStorage.getItem('demo-component-fail-attempts')) {
        localStorage.setItem('demo-component-fail-attempts', '1');
        throw new Error('Simulated initialization failure');
      }
      
      // On recovery attempts, succeed
      console.log('Demo failure component initialized (recovery successful)');
      localStorage.removeItem('demo-component-fail-attempts');
      return { success: true };
    },
    isEssential: true,
    accessibility: false
  },
  {
    id: 'demo-component-accessibility',
    name: 'Demo Accessibility Component',
    description: 'Accessibility component that fails first time',
    initFunction: async () => {
      console.log('Demo accessibility component initializing...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // On first attempt, throw an error
      if (!localStorage.getItem('demo-component-accessibility-attempts')) {
        localStorage.setItem('demo-component-accessibility-attempts', '1');
        throw new Error('Simulated accessibility component failure');
      }
      
      // On recovery attempts, succeed
      console.log('Demo accessibility component initialized (recovery successful)');
      localStorage.removeItem('demo-component-accessibility-attempts');
      return { success: true };
    },
    isEssential: false,
    accessibility: true
  },
  {
    id: 'demo-component-terminal',
    name: 'Demo Terminal Failure Component',
    description: 'Always fails on all attempts',
    initFunction: async () => {
      console.log('Demo terminal failure component initializing...');
      await new Promise(resolve => setTimeout(resolve, 500));
      throw new Error('Simulated terminal failure - will never recover');
    },
    fallbackFunction: async () => {
      console.log('Using fallback for terminal failure component');
      return { success: true, fallback: true };
    },
    isEssential: false,
    accessibility: false
  }
];

/**
 * Initialize the recovery system demo
 * 
 * @param {HTMLElement} container - Container for the demo UI
 */
export async function initializeRecoveryDemo(container) {
  // Create UI container
  const demoContainer = document.createElement('div');
  demoContainer.classList.add('alejo-recovery-demo');
  container.appendChild(demoContainer);
  
  // Create controls
  demoContainer.innerHTML = `
    <div class="alejo-recovery-demo-header">
      <h2>Component Recovery System Demo</h2>
    </div>
    
    <div class="alejo-recovery-demo-controls">
      <button id="btn-register-components" class="alejo-btn">Register Components</button>
      <button id="btn-initialize-system" class="alejo-btn">Initialize System</button>
      <button id="btn-check-previous-failures" class="alejo-btn">Check Previous Failures</button>
      <button id="btn-recover-all" class="alejo-btn">Recover All Failed Components</button>
      <button id="btn-show-recovery-ui" class="alejo-btn">Toggle Recovery UI</button>
      <button id="btn-reset-demo" class="alejo-btn">Reset Demo</button>
    </div>
    
    <div class="alejo-recovery-demo-log">
      <h3>Demo Log</h3>
      <div id="recovery-demo-log" class="alejo-recovery-demo-log-content"></div>
    </div>
  `;
  
  // Initialize the recovery status UI
  const recoveryUI = initializeRecoveryStatusUI({
    parentElement: document.body
  });
  
  // Set up log function
  const log = (message, type = 'info') => {
    const logContainer = document.getElementById('recovery-demo-log');
    const logEntry = document.createElement('div');
    logEntry.classList.add('alejo-recovery-demo-log-entry', `alejo-log-${type}`);
    
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span class="alejo-log-timestamp">[${timestamp}]</span> ${message}`;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  };
  
  // Set up event listeners
  document.addEventListener('system:component:registered', (event) => {
    const { component } = event.detail;
    log(`Component registered: ${component.id}`, 'success');
  });
  
  document.addEventListener('system:initialization:started', () => {
    log('System initialization started', 'info');
  });
  
  document.addEventListener('system:initialization:completed', (event) => {
    const { successful, failed } = event.detail;
    log(`System initialization completed: ${successful.length} successful, ${failed.length} failed`, 
      failed.length > 0 ? 'warning' : 'success');
  });
  
  document.addEventListener('system:component:failed', (event) => {
    const { component, error } = event.detail;
    log(`Component failed: ${component.id} - ${error.message}`, 'error');
  });
  
  document.addEventListener('system:recovery:registered', (event) => {
    const { componentId } = event.detail;
    log(`Component registered for recovery: ${componentId}`, 'info');
  });
  
  document.addEventListener('system:recovery:attempt', (event) => {
    const { componentId, attemptNumber, maxAttempts } = event.detail;
    log(`Recovery attempt ${attemptNumber}/${maxAttempts} for component ${componentId}`, 'info');
  });
  
  document.addEventListener('system:recovery:success', (event) => {
    const { componentId } = event.detail;
    log(`Component recovered successfully: ${componentId}`, 'success');
  });
  
  document.addEventListener('system:recovery:failure', (event) => {
    const { componentId, error } = event.detail;
    log(`Recovery attempt failed for component ${componentId}: ${error.message}`, 'error');
  });
  
  document.addEventListener('system:recovery:terminal', (event) => {
    const { componentId } = event.detail;
    log(`Component reached terminal failure state: ${componentId}`, 'error');
  });
  
  // Set up button handlers
  document.getElementById('btn-register-components').addEventListener('click', () => {
    demoComponents.forEach(component => {
      registerComponent(component);
    });
    log(`Registered ${demoComponents.length} demo components`, 'success');
  });
  
  document.getElementById('btn-initialize-system').addEventListener('click', async () => {
    try {
      const result = await initializeSystem({
        components: demoComponents.map(c => c.id)
      });
      
      log(`Initialization results: ${result.successful.length} successful, ${result.failed.length} failed`, 
        result.failed.length > 0 ? 'warning' : 'success');
    } catch (error) {
      log(`Initialization error: ${error.message}`, 'error');
    }
  });
  
  document.getElementById('btn-check-previous-failures').addEventListener('click', () => {
    const recoveredFailures = checkForPreviousFailures();
    log(`Found ${recoveredFailures.length} persistent failures from previous sessions`, 
      recoveredFailures.length > 0 ? 'warning' : 'info');
  });
  
  document.getElementById('btn-recover-all').addEventListener('click', async () => {
    try {
      const results = await recoverAllFailedComponents();
      const successCount = Object.values(results).filter(r => r.state === 'SUCCESS').length;
      const failureCount = Object.values(results).filter(r => r.state === 'FAILURE' || r.state === 'TERMINAL_FAILURE').length;
      
      log(`Recovery results: ${successCount} components recovered successfully, ${failureCount} components failed`, 
        failureCount > 0 ? 'warning' : 'success');
    } catch (error) {
      log(`Recovery error: ${error.message}`, 'error');
    }
  });
  
  document.getElementById('btn-show-recovery-ui').addEventListener('click', () => {
    recoveryUI.toggle();
    log('Toggled recovery UI', 'info');
  });
  
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    localStorage.removeItem('demo-component-fail-attempts');
    localStorage.removeItem('demo-component-accessibility-attempts');
    localStorage.removeItem('alejo-failed-components');
    
    log('Demo reset. All persistence cleared.', 'info');
  });
  
  // Log ready message
  log('Recovery System Demo initialized', 'success');
}

/**
 * Add stylesheet for the demo
 */
function addDemoStyles() {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .alejo-recovery-demo {
      font-family: var(--alejo-font-family, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .alejo-recovery-demo-header {
      margin-bottom: 20px;
    }
    
    .alejo-recovery-demo-header h2 {
      margin: 0;
      color: var(--alejo-primary-color, #007acc);
    }
    
    .alejo-recovery-demo-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .alejo-recovery-demo-log {
      border: 1px solid var(--alejo-border-color, #e0e0e0);
      border-radius: 4px;
      padding: 10px;
      background-color: var(--alejo-card-bg, #f8f8f8);
    }
    
    .alejo-recovery-demo-log h3 {
      margin-top: 0;
      font-size: 1rem;
    }
    
    .alejo-recovery-demo-log-content {
      height: 300px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    
    .alejo-recovery-demo-log-entry {
      padding: 4px 0;
      border-bottom: 1px solid var(--alejo-border-color, #e0e0e0);
    }
    
    .alejo-log-timestamp {
      font-weight: bold;
      margin-right: 8px;
    }
    
    .alejo-log-info {
      color: var(--alejo-text-color, #333333);
    }
    
    .alejo-log-success {
      color: var(--alejo-success-color, #43a047);
    }
    
    .alejo-log-warning {
      color: var(--alejo-warning-color, #ff9800);
    }
    
    .alejo-log-error {
      color: var(--alejo-error-color, #e53935);
    }
  `;
  
  document.head.appendChild(styleElement);
}

// Auto-add demo styles when imported
addDemoStyles();
