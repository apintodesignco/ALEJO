/**
 * ALEJO Gesture Arpeggiator - Particles Visualization
 * 
 * Audio-reactive particle system visualization
 */

class ParticlesVisualization extends VisualizationMode {
    /**
     * Initialize the particles visualization
     * @param {Visualizer} visualizer - Parent visualizer
     */
    constructor(visualizer) {
        super(visualizer);
        
        // Particle system properties
        this.particleCount = 1000;
        this.particles = null;
        this.particleSystem = null;
        
        // Physics properties
        this.velocities = [];
        this.accelerations = [];
        
        // Audio reactivity
        this.baseSize = 0.05;
        this.baseSpeed = 0.2;
        this.audioInfluence = 0.5;
        
        // Gesture reactivity
        this.handInfluence = 0.3;
        this.handAttraction = 0.2;
        
        // Time-based properties
        this.time = 0;
    }
    
    /**
     * Initialize the particle system
     */
    init() {
        // Create particle geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        
        // Initialize particles
        for (let i = 0; i < this.particleCount; i++) {
            // Position (random in sphere)
            const radius = 2 + Math.random() * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Color (from current palette)
            const colorIndex = Math.floor(Math.random() * this.visualizer.getColorPalette().length);
            const color = new THREE.Color(this.visualizer.getColorPalette()[colorIndex]);
            
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            // Size
            sizes[i] = this.baseSize * (0.5 + Math.random() * 0.5);
            
            // Physics
            this.velocities.push(new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            ));
            
            this.accelerations.push(new THREE.Vector3(0, 0, 0));
        }
        
        // Set attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create material
        const material = new THREE.PointsMaterial({
            size: this.baseSize,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        });
        
        // Create particle system
        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
        this.objects.push(this.particleSystem);
        
        // Store reference to positions and sizes
        this.particles = {
            positions: this.particleSystem.geometry.attributes.position.array,
            colors: this.particleSystem.geometry.attributes.color.array,
            sizes: this.particleSystem.geometry.attributes.size.array
        };
    }
    
    /**
     * Update the particle system
     * @param {number} elapsed - Elapsed time since last update
     */
    update(elapsed) {
        if (!this.particleSystem) return;
        
        // Update time
        this.time += elapsed;
        
        // Get audio data
        const audioData = this.visualizer.audioData;
        const rms = audioData.rms;
        
        // Get hand data
        const handData = this.visualizer.handData;
        
        // Get options
        const intensity = this.visualizer.options.intensity;
        const speed = this.visualizer.options.speed;
        
        // Update particles
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Current position
            const x = this.particles.positions[i3];
            const y = this.particles.positions[i3 + 1];
            const z = this.particles.positions[i3 + 2];
            
            // Reset acceleration
            this.accelerations[i].set(0, 0, 0);
            
            // Apply forces
            
            // 1. Center attraction/repulsion (based on audio)
            const distToCenter = Math.sqrt(x * x + y * y + z * z);
            const centerForce = 0.01 * (1 + rms * 2);
            
            // Alternate between attraction and repulsion based on time and audio
            const attractionFactor = Math.sin(this.time * 0.2 + i * 0.01) * 0.5 + 0.5;
            const centerDirection = attractionFactor > 0.5 ? -1 : 1;
            
            this.accelerations[i].x += centerDirection * centerForce * x / distToCenter;
            this.accelerations[i].y += centerDirection * centerForce * y / distToCenter;
            this.accelerations[i].z += centerDirection * centerForce * z / distToCenter;
            
            // 2. Hand attraction (if hands detected)
            for (const hand of handData) {
                if (hand && hand.position) {
                    // Convert hand position to 3D space
                    const handX = (hand.position.x - 0.5) * 10;
                    const handY = -(hand.position.y - 0.5) * 10;
                    const handZ = hand.position.z * 5;
                    
                    // Calculate distance to hand
                    const dx = handX - x;
                    const dy = handY - y;
                    const dz = handZ - z;
                    const distToHand = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Apply attraction force
                    if (distToHand > 0.1) {
                        const handForce = this.handAttraction / (distToHand * distToHand);
                        this.accelerations[i].x += handForce * dx;
                        this.accelerations[i].y += handForce * dy;
                        this.accelerations[i].z += handForce * dz;
                    }
                }
            }
            
            // 3. Random jitter (based on audio)
            const jitter = 0.002 * rms * intensity;
            this.accelerations[i].x += (Math.random() - 0.5) * jitter;
            this.accelerations[i].y += (Math.random() - 0.5) * jitter;
            this.accelerations[i].z += (Math.random() - 0.5) * jitter;
            
            // 4. Note events
            for (const event of this.visualizer.noteEvents) {
                if (event.age < 0.5) {
                    const noteForce = 0.05 * (1 - event.age * 2) * intensity;
                    const noteDirection = new THREE.Vector3(
                        Math.sin(event.note * 0.1),
                        Math.cos(event.note * 0.1),
                        Math.sin(event.note * 0.05)
                    ).normalize();
                    
                    this.accelerations[i].x += noteDirection.x * noteForce;
                    this.accelerations[i].y += noteDirection.y * noteForce;
                    this.accelerations[i].z += noteDirection.z * noteForce;
                }
            }
            
            // 5. Drum events
            for (const event of this.visualizer.drumEvents) {
                if (event.age < 0.2) {
                    const drumForce = 0.1 * (1 - event.age * 5) * intensity;
                    
                    // Different drums affect different axes
                    if (event.step % 4 === 0) { // Kick
                        this.accelerations[i].y -= drumForce;
                    } else if (event.step % 4 === 2) { // Snare
                        this.accelerations[i].x += (Math.random() - 0.5) * drumForce * 2;
                    } else { // Hi-hat
                        this.accelerations[i].z += (Math.random() - 0.5) * drumForce;
                    }
                }
            }
            
            // Apply acceleration to velocity
            this.velocities[i].x += this.accelerations[i].x;
            this.velocities[i].y += this.accelerations[i].y;
            this.velocities[i].z += this.accelerations[i].z;
            
            // Apply damping
            this.velocities[i].multiplyScalar(0.98);
            
            // Apply velocity to position
            this.particles.positions[i3] += this.velocities[i].x * speed * this.baseSpeed;
            this.particles.positions[i3 + 1] += this.velocities[i].y * speed * this.baseSpeed;
            this.particles.positions[i3 + 2] += this.velocities[i].z * speed * this.baseSpeed;
            
            // Update size based on audio
            this.particles.sizes[i] = this.baseSize * (0.5 + rms * 2 * intensity);
            
            // Boundary check - if particle goes too far, reset it
            const maxDist = 10;
            if (distToCenter > maxDist) {
                // Reset position
                const radius = 2 + Math.random() * 3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                
                this.particles.positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
                this.particles.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
                this.particles.positions[i3 + 2] = radius * Math.cos(phi);
                
                // Reset velocity
                this.velocities[i].set(
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01,
                    (Math.random() - 0.5) * 0.01
                );
            }
        }
        
        // Update geometry
        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.size.needsUpdate = true;
        
        // Rotate particle system slowly
        this.particleSystem.rotation.y += 0.001 * speed;
        this.particleSystem.rotation.x += 0.0005 * speed;
    }
    
    /**
     * Update colors based on current color scheme
     */
    updateColors() {
        if (!this.particleSystem) return;
        
        const palette = this.visualizer.getColorPalette();
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Get color from palette
            const colorIndex = Math.floor(Math.random() * palette.length);
            const color = new THREE.Color(palette[colorIndex]);
            
            // Update color
            this.particles.colors[i3] = color.r;
            this.particles.colors[i3 + 1] = color.g;
            this.particles.colors[i3 + 2] = color.b;
        }
        
        // Update geometry
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
    }
    
    /**
     * Update options
     */
    updateOptions() {
        if (!this.particleSystem) return;
        
        // Update based on complexity
        const complexity = this.visualizer.options.complexity;
        this.particleSystem.material.opacity = 0.5 + complexity * 0.5;
        
        // Update base size and speed
        this.baseSize = 0.03 + complexity * 0.07;
        this.baseSpeed = 0.1 + this.visualizer.options.speed * 0.4;
        
        // Update audio influence
        this.audioInfluence = 0.3 + this.visualizer.options.intensity * 0.7;
    }
}
