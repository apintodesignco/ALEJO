/**
 * ALEJO Gesture Arpeggiator – Geometric / Fluid Visualization
 * -----------------------------------------------------------
 * Instanced icosahedra orbiting in a curl-noise flow field.  Audio RMS drives
 * size & orbital radius, hand position perturbs field, and color palette maps
 * across instances.  Highly GPU-efficient (InstancedMesh + vertex colors).
 */

class GeometricVisualization extends VisualizationMode {
    constructor (visualizer) {
        super(visualizer);
        // Config ---------------------------------------------------------
        this.count        = 800;      // number of instances
        this.baseRadius   = 3;
        this.noiseScale   = 0.8;      // flow-field granularity
        this.speedFactor  = 0.6;      // global motion speed
        this.mesh         = null;     // THREE.InstancedMesh
        this.time         = 0;
        this._dummy       = new THREE.Object3D();
    }

    /* ------------------------------------------------------------------ */
    /* Simple curl-noise util (returns Vec3)                              */
    /* ------------------------------------------------------------------ */
    _curlNoise (x,y,z) {
        // Adapted from Inigo Quilez – analytical curl of Perlin noise.
        const eps = 0.0005;
        const noise = (nx,ny,nz) => {
            return THREE.MathUtils.perlin3(nx,ny,nz); // using Three.js' Simplex noise addon
        };
        const dx = noise(x+eps,y,z) - noise(x-eps,y,z);
        const dy = noise(x,y+eps,z) - noise(x,y-eps,z);
        const dz = noise(x,y,z+eps) - noise(x,y,z-eps);
        return new THREE.Vector3(dy - dz, dz - dx, dx - dy);
    }

    /* --------------------------------------------------------------- */
    /* Initialisation                                                  */
    /* --------------------------------------------------------------- */
    init () {
        // Geometry & material ----------------------------------------
        const geometry = new THREE.IcosahedronGeometry(0.1, 0);
        const material = new THREE.MeshPhongMaterial({ vertexColors:true, shininess:40 });

        // Instanced mesh ---------------------------------------------
        this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.count*3), 3);
        this.scene.add(this.mesh);
        this.objects.push(this.mesh);

        // Initial placement ------------------------------------------
        const palette = this.visualizer.getColorPalette();
        for (let i=0;i<this.count;i++) {
            const angle = Math.random()*Math.PI*2;
            const radius= this.baseRadius + (Math.random()-0.5);
            const y     = (Math.random()-0.5)*2;
            this._dummy.position.set(Math.cos(angle)*radius, y, Math.sin(angle)*radius);
            this._dummy.scale.setScalar(1);
            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this._dummy.matrix);
            // color gradient by index
            const c = new THREE.Color(palette[i % palette.length]);
            this.mesh.instanceColor.setXYZ(i, c.r,c.g,c.b);
        }
    }

    /* --------------------------------------------------------------- */
    /* Per-frame Update                                                 */
    /* --------------------------------------------------------------- */
    update (elapsed) {
        if (!this.mesh) return;
        this.time += elapsed * this.speedFactor;

        const rms      = this.visualizer.audioData.rms;
        const intensity= this.visualizer.options.intensity;
        const handData = this.visualizer.handData;

        // optional hand influence point (average)
        let handInfluence = new THREE.Vector3();
        if (handData && handData.length) {
            for (const h of handData) {
                handInfluence.x += (h.position.x-0.5)*10;
                handInfluence.y += -(h.position.y-0.5)*10;
                handInfluence.z +=  h.position.z*5;
            }
            handInfluence.multiplyScalar(1/handData.length);
        }

        for (let i=0;i<this.count;i++) {
            this.mesh.getMatrixAt(i, this._dummy.matrix);
            this._dummy.matrix.decompose(this._dummy.position, this._dummy.quaternion, this._dummy.scale);

            // Curl-noise flow field ----------------------------------
            const p = this._dummy.position.clone().multiplyScalar(this.noiseScale);
            const curl = this._curlNoise(p.x+this.time, p.y, p.z);

            // Move ---------------------------------------------------
            this._dummy.position.addScaledVector(curl, elapsed * this.speedFactor);

            // Audio RMS expands/ contracts radius --------------------
            const dir = this._dummy.position.clone().normalize();
            const targetRad = this.baseRadius + rms*intensity*4;
            this._dummy.position.lerp(dir.multiplyScalar(targetRad), 0.05);

            // Hand attraction ---------------------------------------
            if (handData && handData.length) {
                const toHand = handInfluence.clone().sub(this._dummy.position);
                this._dummy.position.addScaledVector(toHand, 0.02*intensity);
            }

            // Rotation jitter ---------------------------------------
            this._dummy.rotation.x += 0.5*elapsed;
            this._dummy.rotation.y += 0.3*elapsed;

            // Scale pulsate -----------------------------------------
            const s = 0.5 + rms*intensity*2;
            this._dummy.scale.setScalar(s);

            this._dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this._dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    updateColors () {
        const palette = this.visualizer.getColorPalette();
        for (let i=0;i<this.count;i++) {
            const c = new THREE.Color(palette[i % palette.length]);
            this.mesh.instanceColor.setXYZ(i, c.r,c.g,c.b);
        }
        this.mesh.instanceColor.needsUpdate = true;
    }

    updateOptions () {
        const { speed, complexity } = this.visualizer.options;
        this.speedFactor = 0.2 + speed*1.2;
        this.count       = Math.floor(400 + complexity*1200); // 400-1600
        // Re-init if count changed drastically (skip for now)
    }
}

if (typeof window !== 'undefined') {
    window.GeometricVisualization = GeometricVisualization;
}

if (typeof module !== 'undefined') {
    module.exports = GeometricVisualization;
}
