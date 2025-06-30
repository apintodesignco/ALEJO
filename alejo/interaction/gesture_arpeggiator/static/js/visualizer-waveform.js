/**
 * ALEJO Gesture Arpeggiator – Waveform Visualization
 * --------------------------------------------------
 * Renders a real-time, high-performance audio waveform using Three.js.
 */

class WaveformVisualization extends VisualizationMode {
    constructor (visualizer) {
        super(visualizer);
        this.pointCount   = 1024; // Should match analyser size
        this.amplitude    = 1.5;  // Vertical scale
        this.line         = null;
    }

    /* --------------------------------------------------------------- */
    /* Initialisation                                                  */
    /* --------------------------------------------------------------- */
    init () {
        const positions = new Float32Array(this.pointCount * 3);
        const geometry  = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, this.pointCount);

        const material  = new THREE.LineBasicMaterial({
            color       : this.visualizer.getColor(0),
            transparent : true,
            opacity     : 0.9,
            linewidth   : 2
        });

        this.line = new THREE.Line(geometry, material);
        this.scene.add(this.line);
        this.objects.push(this.line);

        this._updateColors();
    }

    /* --------------------------------------------------------------- */
    /* Frame Update                                                    */
    /* --------------------------------------------------------------- */
    update (elapsed) {
        if (!this.line) return;
        const waveform = this.visualizer.audioData.waveform;
        if (!waveform || waveform.length === 0) return;

        const positions = this.line.geometry.attributes.position.array;
        const len       = Math.min(waveform.length, this.pointCount);
        const half      = (this.pointCount-1)/2;

        for (let i = 0; i < len; i++) {
            const xNorm = (i - half) / half;           // ‑1 … 1
            positions[i*3    ] = xNorm * 5;            // X axis scaled to span viewport
            positions[i*3 + 1] = waveform[i] * this.amplitude; // Y amplitude
            positions[i*3 + 2] = 0;                    // Z flat plane
        }
        this.line.geometry.attributes.position.needsUpdate = true;
    }

    /* --------------------------------------------------------------- */
    /* Theme / palette change                                          */
    /* --------------------------------------------------------------- */
    updateColors () { this._updateColors(); }

    _updateColors () {
        if (!this.line) return;
        this.line.material.color.setHex(this.visualizer.getColor(0.25));
    }

    /* --------------------------------------------------------------- */
    updateOptions () {
        // Could expose amplitude scaling via complexity/intensity
        const { complexity, intensity } = this.visualizer.options;
        this.amplitude = 0.5 + intensity * 2; // 0.5 – 2.5
        this.line.material.opacity = 0.5 + complexity * 0.5;
    }
}

// Export for module environments
if (typeof module !== 'undefined') {
    module.exports = WaveformVisualization;
}
