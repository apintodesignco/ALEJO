/**
 * Visualization Component
 * 
 * Renders the 3D visualization for ALEJO using Three.js.
 * Implements performance optimizations like:
 * - Lazy loading of 3D assets
 * - Level of detail (LOD) rendering
 * - Frame rate throttling when inactive
 */

import { publish, subscribe } from '../../core/events.js';

// Renderer state
let renderer = null;
let scene = null;
let camera = null;
let animationFrame = null;
let isActive = false;
let performanceLevel = 'high';

/**
 * Render the visualization component
 */
export async function renderVisualization() {
  console.log('Initializing visualization component');
  
  const container = document.getElementById('visualization-container');
  if (!container) return false;
  
  // Show loading indicator
  container.innerHTML = '<div class="loader">Loading visualization...</div>';
  
  try {
    // Dynamically import Three.js only when needed (code splitting)
    const THREE = await import('three');
    
    // Initialize the renderer
    renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    // Clear the container and append the canvas
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Create scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
      75, // FOV
      container.clientWidth / container.clientHeight, // Aspect ratio
      0.1, // Near clipping plane
      1000 // Far clipping plane
    );
    camera.position.z = 5;
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add a simple placeholder shape
    const geometry = new THREE.IcosahedronGeometry(2, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff,
      wireframe: false,
      roughness: 0.5,
      metalness: 0.8
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    // Start animation loop
    isActive = true;
    
    // Start with appropriate quality based on device
    setQualityLevel(detectOptimalQuality());
    
    // Animation function
    function animate() {
      if (!isActive) return;
      
      // Rotate the mesh
      if (mesh) {
        mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.01;
      }
      
      // Render the scene
      renderer.render(scene, camera);
      
      // Request next frame with appropriate throttling based on performance level
      if (performanceLevel === 'high' || document.hasFocus()) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // Throttle frame rate when in low performance mode or window not focused
        animationFrame = setTimeout(() => requestAnimationFrame(animate), 100);
      }
    }
    
    // Start animation
    animate();
    
    // Handle resize events
    subscribe('ui:resize', handleResize);
    
    // Handle visibility changes
    subscribe('system:visibility', handleVisibilityChange);
    
    // Handle performance mode changes
    subscribe('settings:updated', (settings) => {
      if (settings.performance) {
        setQualityLevel(settings.performance);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Failed to initialize visualization:', error);
    container.innerHTML = `
      <div class="visualization-error">
        <p>Failed to load visualization</p>
        <button id="retry-viz-button">Retry</button>
      </div>
    `;
    
    // Add retry button handler
    document.getElementById('retry-viz-button')?.addEventListener('click', () => {
      renderVisualization();
    });
    
    return false;
  }
}

/**
 * Handle window resize events
 */
function handleResize(dimensions) {
  if (!renderer || !camera) return;
  
  const container = document.getElementById('visualization-container');
  if (!container) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // Update camera aspect ratio
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update renderer size
  renderer.setSize(width, height);
}

/**
 * Handle visibility changes to optimize performance
 */
function handleVisibilityChange(isVisible) {
  // Pause animation when not visible
  isActive = isVisible;
  
  if (isVisible && !animationFrame) {
    // Restart animation when becoming visible again
    requestAnimationFrame(animate);
  } else if (!isVisible && animationFrame) {
    // Cancel animation when becoming hidden
    if (typeof animationFrame === 'number') {
      cancelAnimationFrame(animationFrame);
    } else {
      clearTimeout(animationFrame);
    }
    animationFrame = null;
  }
}

/**
 * Set the quality level for the visualization
 */
function setQualityLevel(level) {
  performanceLevel = level;
  
  if (!renderer) return;
  
  switch (level) {
    case 'low':
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      break;
      
    case 'balanced':
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      break;
      
    case 'high':
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      break;
  }
  
  // Publish quality change event
  publish('visualization:quality', { level });
}

/**
 * Detect optimal quality settings based on device capabilities
 */
function detectOptimalQuality() {
  // Check for low-end devices
  const isLowEndDevice = 
    navigator.deviceMemory < 4 || // Less than 4GB RAM
    navigator.hardwareConcurrency < 4; // Less than 4 cores
  
  if (isLowEndDevice) {
    return 'low';
  }
  
  // Check for high-end devices
  const isHighEndDevice =
    navigator.deviceMemory >= 8 || // 8GB+ RAM
    navigator.hardwareConcurrency >= 8; // 8+ cores
  
  if (isHighEndDevice) {
    return 'high';
  }
  
  // Default to balanced
  return 'balanced';
}

/**
 * Create a dynamic LOD (Level of Detail) object for efficient rendering
 */
export async function createLODObject(objectOptions) {
  // This function would be called when we need to add complex objects with LOD
  
  // Dynamically import Three.js LOD components only when needed
  const THREE = await import('three');
  const { LOD } = THREE;
  
  const lod = new LOD();
  
  // Add different detail levels
  // High detail (close distance)
  const highDetailGeometry = new THREE.IcosahedronGeometry(2, 3); // More subdivisions
  const highDetailMesh = new THREE.Mesh(
    highDetailGeometry,
    new THREE.MeshStandardMaterial({ color: objectOptions.color || 0x00ffff })
  );
  lod.addLevel(highDetailMesh, 0); // Visible from distance 0-10
  
  // Medium detail (medium distance)
  const mediumDetailGeometry = new THREE.IcosahedronGeometry(2, 2); // Fewer subdivisions
  const mediumDetailMesh = new THREE.Mesh(
    mediumDetailGeometry,
    new THREE.MeshStandardMaterial({ color: objectOptions.color || 0x00ffff })
  );
  lod.addLevel(mediumDetailMesh, 10); // Visible from distance 10-20
  
  // Low detail (far distance)
  const lowDetailGeometry = new THREE.IcosahedronGeometry(2, 1); // Minimal subdivisions
  const lowDetailMesh = new THREE.Mesh(
    lowDetailGeometry,
    new THREE.MeshStandardMaterial({ color: objectOptions.color || 0x00ffff })
  );
  lod.addLevel(lowDetailMesh, 20); // Visible from distance 20+
  
  return lod;
}
