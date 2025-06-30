/**
 * ALEJO Gesture Arpeggiator – Comprehensive UI Controller
 * -------------------------------------------------------
 * Manages all DOM-level interactions for the gesture arpeggiator web client.
 * Coordinates with App, AudioEngine, HandTracking, Visualizer and WebSocketManager.
 *
 * Design goals:
 *   • Strict separation of presentation and business logic.
 *   • All DOM queries cached for performance.
 *   • Robust error handling and graceful degradation.
 *   • Easily extensible – individual sections factored into helper methods.
 */

class UIController {
    /**
     * @param {object} app  – Reference to the parent App singleton
     */
    constructor (app) {
        this.app = app;
        // DOM caches --------------------------------------------------------
        this.dom = {
            // Status / indicators
            connection      : document.getElementById('connectionStatus'),
            fps             : document.getElementById('fpsCounter'),
            leftGesture     : document.getElementById('leftHandGesture'),
            rightGesture    : document.getElementById('rightHandGesture'),
            // Primary controls
            startBtn        : document.getElementById('startButton'),
            stopBtn         : document.getElementById('stopButton'),
            settingsBtn     : document.getElementById('settingsButton'),
            // Settings modal & fields
            modal           : document.getElementById('settingsModal'),
            modalClose      : document.querySelector('#settingsModal .close-button'),
            saveSettings    : document.getElementById('saveSettingsButton'),
            resetSettings   : document.getElementById('resetSettingsButton'),
            // Settings ‑ General audio
            fieldBpm        : document.getElementById('bpmSlider'),
            fieldBpmLabel   : document.getElementById('bpmValue'),
            fieldMasterVol  : document.getElementById('masterVolume'),
            fieldArpVol     : document.getElementById('arpeggioVolume'),
            fieldDrumVol    : document.getElementById('drumVolume'),
            // Settings ‑ Arpeggiator
            fieldRootNote   : document.getElementById('rootNote'),
            fieldScale      : document.getElementById('scale'),
            fieldPattern    : document.getElementById('arpeggioPattern'),
            // Settings ‑ Drums
            fieldDrumPattern: document.getElementById('drumPattern'),
            // Settings ‑ Visualizer
            fieldVisMode    : document.getElementById('visualizerMode'),
            fieldColorScheme: document.getElementById('colorScheme')
        };
    }

    /* ---------------------------------------------------------------------
     * Public lifecycle ----------------------------------------------------
     * ------------------------------------------------------------------ */

    init () {
        this._bindUIEvents();
        this.updateSettingsUI();
        this.updateConnectionStatus('disconnected');
    }

    /**
     * Called every animation frame by App.animate()
     * @param {Array}  handData
     * @param {object} audioState
     */
    update (handData, audioState) {
        // Gestures ---------------------------------------------------------
        if (handData && handData.length) {
            const left  = handData.find(h => h.isLeft);
            const right = handData.find(h => !h.isLeft);
            if (left)  { this.dom.leftGesture .textContent = `Left : ${left.gesture}`; }
            if (right) { this.dom.rightGesture.textContent = `Right: ${right.gesture}`; }
        } else {
            this.dom.leftGesture .textContent = 'Left : None';
            this.dom.rightGesture.textContent = 'Right: None';
        }

        // FPS is updated inside App; nothing else required here currently.
    }

    /* ---------------------------------------------------------------------
     * UI state helpers ----------------------------------------------------
     * ------------------------------------------------------------------ */

    updateConnectionStatus (state) {
        this.dom.connection.textContent = state;
        this.dom.connection.className   = `status ${state}`;  // e.g. .status.connected
    }

    showError (title, message) {
        alert(`${title}: ${message}`); // TODO Replace with custom toast system.
    }

    /* ---------------------------------------------------------------------
     * Settings modal ------------------------------------------------------
     * ------------------------------------------------------------------ */

    openSettingsModal ()  { this.dom.modal.style.display = 'block'; }
    closeSettingsModal () { this.dom.modal.style.display = 'none';  }

    /**
     * Push current slider / select values back into App.settings.
     * Called from Save button.
     */
    saveSettings () {
        const s = this.app.settings;
        // Audio -----------------------------------------------------------
        s.audio.bpm           = parseInt(this.dom.fieldBpm       .value);
        s.audio.masterVolume  = parseFloat(this.dom.fieldMasterVol.value);
        s.audio.arpeggioVolume= parseFloat(this.dom.fieldArpVol   .value);
        s.audio.drumVolume    = parseFloat(this.dom.fieldDrumVol  .value);

        // Arpeggiator -----------------------------------------------------
        s.arpeggiator.rootNote= parseInt(this.dom.fieldRootNote.value);
        s.arpeggiator.scale   = this.dom.fieldScale   .value;
        s.arpeggiator.pattern = this.dom.fieldPattern .value;

        // Drums -----------------------------------------------------------
        s.drums.patternId     = parseInt(this.dom.fieldDrumPattern.value);

        // Visualizer ------------------------------------------------------
        s.visualizer.mode        = this.dom.fieldVisMode   .value;
        s.visualizer.colorScheme = this.dom.fieldColorScheme.value;

        this.app.sendSettings();            // Notify backend
        this.updateSettingsUI();            // Sync labels etc.
    }

    /**
     * Reset in-memory settings back to defaults defined in App.settings
     * without altering persistent store.
     */
    resetSettings () {
        this.app.settings = JSON.parse(JSON.stringify(App.settings));
        this.updateSettingsUI();
        this.app.sendSettings();
    }

    /** Sync DOM controls -> current settings values */
    updateSettingsUI () {
        const s = this.app.settings;
        // Audio -----------------------------------------------------------
        this.dom.fieldBpm .value = s.audio.bpm;                       this.dom.fieldBpmLabel.textContent = s.audio.bpm;
        this.dom.fieldMasterVol.value = s.audio.masterVolume;
        this.dom.fieldArpVol   .value = s.audio.arpeggioVolume;
        this.dom.fieldDrumVol  .value = s.audio.drumVolume;
        // Arpeggiator -----------------------------------------------------
        this.dom.fieldRootNote .value = s.arpeggiator.rootNote;
        this.dom.fieldScale    .value = s.arpeggiator.scale;
        this.dom.fieldPattern  .value = s.arpeggiator.pattern;
        // Drums -----------------------------------------------------------
        this.dom.fieldDrumPattern.value = s.drums.patternId;
        // Visualizer ------------------------------------------------------
        this.dom.fieldVisMode   .value = s.visualizer.mode;
        this.dom.fieldColorScheme.value = s.visualizer.colorScheme;
    }

    /* ---------------------------------------------------------------------
     * Private helpers ----------------------------------------------------
     * ------------------------------------------------------------------ */

    _bindUIEvents () {
        // Start / Stop buttons -------------------------------------------
        this.dom.startBtn .addEventListener('click', () => this.app.start());
        this.dom.stopBtn  .addEventListener('click', ()  => this.app.stop());
        // Open / close settings modal ------------------------------------
        this.dom.settingsBtn.addEventListener('click', () => this.openSettingsModal());
        this.dom.modalClose .addEventListener('click', () => this.closeSettingsModal());
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { this.closeSettingsModal(); }
        });
        // Save / reset ----------------------------------------------------
        this.dom.saveSettings .addEventListener('click', () => { this.saveSettings(); this.closeSettingsModal(); });
        this.dom.resetSettings.addEventListener('click', () => this.resetSettings());
        // Immediate feedback for certain sliders -------------------------
        this.dom.fieldBpm.addEventListener('input', (e) => { this.dom.fieldBpmLabel.textContent = e.target.value; });
    }
}

// Export for modules that use ES6 import syntax (if bundler present)
if (typeof module !== 'undefined') {
    module.exports = UIController;
}
