/**
 * ALEJO Gesture Arpeggiator – Spectrum Visualization
 * --------------------------------------------------
 * Displays FFT spectrum as animated 3-D bars with peak fall-off, reacting to
 * intensity / complexity options and color palette.
 */

class SpectrumVisualization extends VisualizationMode {
    constructor (visualizer) {
        super(visualizer);
        // Config ---------------------------------------------------------
        this.bars        = 64;     // number of bars (grouped bins)
        this.maxHeight   = 4;      // Y scale cap
        this.decaySpeed  = 6;      // peak fall-off per second
        this.instances   = null;   // THREE.InstancedMesh
        this.peakValues  = new Float32Array(this.bars);
        this._dummy      = new THREE.Object3D();
    }

    /* --------------------------------------------------------------- */
    /* Init                                                            */
    /* --------------------------------------------------------------- */
    init () {
        const geometry = new THREE.BoxGeometry(0.2, 1, 0.2);
        const material = new THREE.MeshBasicMaterial({ vertexColors:true });
        // Instanced mesh ---------------------------------------------
        this.instances = new THREE.InstancedMesh(geometry, material, this.bars);
        this.instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instances.instanceColor  = new THREE.InstancedBufferAttribute(new Float32Array(this.bars*3), 3);

        // Initial placement ------------------------------------------
        const palette = this.visualizer.getColorPalette();
        for (let i=0;i<this.bars;i++) {
            const x = (i - (this.bars-1)/2) * 0.25;
            this._dummy.position.set(x, 0, 0);
            this._dummy.scale.set(1, 0.001, 1); // collapsed
            this._dummy.updateMatrix();
            this.instances.setMatrixAt(i, this._dummy.matrix);
            // color gradient left->right
            const c = new THREE.Color(palette[Math.floor(i/palette.length) % palette.length]);
            this.instances.instanceColor.setXYZ(i, c.r,c.g,c.b);
            this.peakValues[i] = 0;
        }
        this.scene.add(this.instances);
        this.objects.push(this.instances);
    }

    /* --------------------------------------------------------------- */
    /* Frame Update                                                    */
    /* --------------------------------------------------------------- */
    update (elapsed) {
        const spectrum = this.visualizer.audioData.spectrum;
        if (!spectrum || spectrum.length===0) return;

        const binsPerBar = Math.floor(spectrum.length / this.bars);
        const intensity  = this.visualizer.options.intensity;
        const speed      = this.visualizer.options.speed;

        for (let i=0;i<this.bars;i++) {
            // avg amplitude per bar ----------------------------------
            let sum = 0;
            for (let j=0;j<binsPerBar;j++) {
                sum += spectrum[i*binsPerBar + j];
            }
            const amp = Math.max(sum / binsPerBar / 100, 0); // normalize
            // peak hold ---------------------------------------------
            this.peakValues[i] = Math.max(amp, this.peakValues[i] - this.decaySpeed*elapsed);
            const barHeight = THREE.MathUtils.clamp(this.peakValues[i]*this.maxHeight*intensity*4, 0.05, this.maxHeight);

            // update instance matrix ---------------------------------
            this._dummy.position.set((i - (this.bars-1)/2)*0.25, barHeight/2, 0);
            this._dummy.scale.set(1, barHeight, 1);
            this._dummy.updateMatrix();
            this.instances.setMatrixAt(i, this._dummy.matrix);
        }
        this.instances.instanceMatrix.needsUpdate = true;
    }

    /* --------------------------------------------------------------- */
    updateColors () {
        const palette = this.visualizer.getColorPalette();
        for (let i=0;i<this.bars;i++) {
            const c = new THREE.Color(palette[i % palette.length]);
            this.instances.instanceColor.setXYZ(i, c.r,c.g,c.b);
        }
        this.instances.instanceColor.needsUpdate = true;
    }

    updateOptions () {
        const { complexity } = this.visualizer.options;
        // complexity affects bar count? (stay constant to avoid rebuild)
        this.decaySpeed = 4 + complexity*6; // 4-10.
    }
}

if (typeof window !== 'undefined') {
    window.SpectrumVisualization = SpectrumVisualization;
}

if (typeof module !== 'undefined') {
    module.exports = SpectrumVisualization;
}
