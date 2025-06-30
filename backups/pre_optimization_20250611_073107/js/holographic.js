/**
 * ALEJO Holographic UI - JavaScript Implementation
 * Advanced 3D holographic interface for ALEJO AI Assistant
 */

// Initialize Three.js components
let scene, camera, renderer, composer;
let holoElements = [];
let animationFrame;
let isHolographicActive = false;

// Initialize the holographic UI
function initHolographic() {
    if (!document.getElementById('holographic-container')) {
        console.error('Holographic container not found');
        return;
    }
    
    if (isHolographicActive) {
        return; // Already initialized
    }
    
    isHolographicActive = true;
    
    // Create Three.js scene
    scene = new THREE.Scene();
    
    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    
    // Add renderer to DOM
    const container = document.getElementById('holographic-container');
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Add post-processing effects
    setupPostProcessing();
    
    // Add holographic elements
    createHolographicElements();
    
    // Add event listeners
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    // Add DOM elements for 2D holographic effects
    createDOMHolographicElements();
    
    console.log('Holographic UI initialized');
}

// Set up post-processing effects
function setupPostProcessing() {
    composer = new THREE.EffectComposer(renderer);
    
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,  // strength
        0.4,  // radius
        0.85  // threshold
    );
    composer.addPass(bloomPass);
    
    const glitchPass = new THREE.GlitchPass();
    glitchPass.goWild = false;
    glitchPass.enabled = false;
    composer.addPass(glitchPass);
    
    // Occasionally trigger glitch effect
    setInterval(() => {
        if (Math.random() > 0.7) {
            glitchPass.enabled = true;
            setTimeout(() => {
                glitchPass.enabled = false;
            }, 200 + Math.random() * 400);
        }
    }, 5000);
}

// Create holographic elements using Three.js
function createHolographicElements() {
    // Clear existing elements
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    holoElements = [];
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0x3498db, 1);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    // Create core sphere
    const coreGeometry = new THREE.SphereGeometry(1, 32, 32);
    const coreMaterial = new THREE.MeshPhongMaterial({
        color: 0x3498db,
        emissive: 0x3498db,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.7
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);
    holoElements.push({
        mesh: core,
        animation: (mesh, time) => {
            mesh.scale.x = 0.8 + Math.sin(time * 0.5) * 0.1;
            mesh.scale.y = 0.8 + Math.sin(time * 0.5) * 0.1;
            mesh.scale.z = 0.8 + Math.sin(time * 0.5) * 0.1;
            mesh.rotation.y += 0.005;
        }
    });
    
    // Create rings
    for (let i = 0; i < 3; i++) {
        const ringGeometry = new THREE.TorusGeometry(1.5 + i * 0.5, 0.05, 16, 100);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: 0x3498db,
            emissive: 0x3498db,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.5 - i * 0.1,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2 + i * Math.PI / 6;
        scene.add(ring);
        holoElements.push({
            mesh: ring,
            animation: (mesh, time) => {
                mesh.rotation.z += 0.005 * (i % 2 === 0 ? 1 : -1);
                mesh.rotation.y += 0.003;
            }
        });
    }
    
    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particleCount = 200;
    const posArray = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
        // Create particles in a spherical distribution
        const radius = 2 + Math.random() * 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        posArray[i] = radius * Math.sin(phi) * Math.cos(theta);
        posArray[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        posArray[i + 2] = radius * Math.cos(phi);
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x3498db,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    holoElements.push({
        mesh: particles,
        animation: (mesh, time) => {
            mesh.rotation.y += 0.001;
        }
    });
    
    // Create data streams (lines)
    for (let i = 0; i < 10; i++) {
        const points = [];
        const segments = 10;
        for (let j = 0; j < segments; j++) {
            const x = (Math.random() - 0.5) * 5;
            const y = (Math.random() - 0.5) * 5;
            const z = (Math.random() - 0.5) * 5;
            points.push(new THREE.Vector3(x, y, z));
        }
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x3498db,
            transparent: true,
            opacity: 0.5
        });
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(line);
        holoElements.push({
            mesh: line,
            points: points.map(p => ({
                x: p.x,
                y: p.y,
                z: p.z,
                vx: (Math.random() - 0.5) * 0.01,
                vy: (Math.random() - 0.5) * 0.01,
                vz: (Math.random() - 0.5) * 0.01
            })),
            animation: (mesh, time, data) => {
                const positions = mesh.geometry.attributes.position.array;
                
                for (let j = 0; j < data.points.length; j++) {
                    const point = data.points[j];
                    
                    // Update position with velocity
                    point.x += point.vx;
                    point.y += point.vy;
                    point.z += point.vz;
                    
                    // Boundary check and bounce
                    if (Math.abs(point.x) > 2.5) point.vx *= -1;
                    if (Math.abs(point.y) > 2.5) point.vy *= -1;
                    if (Math.abs(point.z) > 2.5) point.vz *= -1;
                    
                    // Update geometry
                    positions[j * 3] = point.x;
                    positions[j * 3 + 1] = point.y;
                    positions[j * 3 + 2] = point.z;
                }
                
                mesh.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
}

// Create DOM-based holographic elements
function createDOMHolographicElements() {
    const container = document.getElementById('holographic-container');
    
    // Create holographic rings
    for (let i = 0; i < 3; i++) {
        const ring = document.createElement('div');
        ring.className = 'hologram-ring';
        ring.style.width = `${200 + i * 50}px`;
        ring.style.height = `${200 + i * 50}px`;
        container.appendChild(ring);
    }
    
    // Create holographic grid
    const grid = document.createElement('div');
    grid.className = 'holo-grid';
    container.appendChild(grid);
    
    // Create voice visualization bars
    const voiceViz = document.createElement('div');
    voiceViz.className = 'holo-voice-viz';
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'holo-voice-bar';
        voiceViz.appendChild(bar);
    }
    container.appendChild(voiceViz);
    
    // Animate voice bars
    animateVoiceBars();
}

// Animate voice visualization bars
function animateVoiceBars() {
    const bars = document.querySelectorAll('.holo-voice-bar');
    
    function updateBars() {
        if (!isHolographicActive) return;
        
        const isActive = document.getElementById('voice-status-indicator')?.classList.contains('active');
        
        bars.forEach(bar => {
            if (isActive) {
                const height = 10 + Math.random() * 40;
                bar.style.height = `${height}px`;
            } else {
                const height = 5 + Math.random() * 10;
                bar.style.height = `${height}px`;
            }
        });
        
        requestAnimationFrame(updateBars);
    }
    
    updateBars();
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    if (!isHolographicActive) return;
    
    const time = performance.now() * 0.001; // time in seconds
    
    // Animate holographic elements
    holoElements.forEach(element => {
        if (element.animation) {
            element.animation(element.mesh, time, element);
        }
    });
    
    // Render scene with post-processing
    composer.render();
    
    // Request next frame
    animationFrame = requestAnimationFrame(animate);
}

// Stop holographic UI
function stopHolographic() {
    if (!isHolographicActive) return;
    
    isHolographicActive = false;
    
    // Stop animation loop
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    
    // Remove event listeners
    window.removeEventListener('resize', onWindowResize);
    
    // Clear container
    const container = document.getElementById('holographic-container');
    if (container) {
        container.innerHTML = '';
    }
    
    // Dispose of Three.js resources
    holoElements.forEach(element => {
        if (element.mesh) {
            if (element.mesh.geometry) element.mesh.geometry.dispose();
            if (element.mesh.material) {
                if (Array.isArray(element.mesh.material)) {
                    element.mesh.material.forEach(material => material.dispose());
                } else {
                    element.mesh.material.dispose();
                }
            }
        }
    });
    
    if (renderer) renderer.dispose();
    if (composer) composer.dispose();
    
    scene = null;
    camera = null;
    renderer = null;
    composer = null;
    holoElements = [];
    
    console.log('Holographic UI stopped');
}

// Show a holographic notification
function showHoloNotification(message, duration = 3000) {
    const container = document.getElementById('holographic-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = 'holo-notification';
    notification.innerHTML = message;
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, duration);
}

// Export functions
window.initHolographic = initHolographic;
window.stopHolographic = stopHolographic;
window.showHoloNotification = showHoloNotification;
