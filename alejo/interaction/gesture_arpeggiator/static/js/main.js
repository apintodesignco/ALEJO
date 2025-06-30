/**
 * ALEJO Gesture Arpeggiator – Application Entry Point
 * ---------------------------------------------------
 * Bootstraps all client-side components, maintains global state, and bridges
 * communication between UI, AudioEngine, HandTracking, Visualizer, and backend.
 */

import WebSocketManager from './websocket.js';
import HandTracking     from './hand-tracking.js';
import AudioEngine      from './audio-engine.js';
import Visualizer       from './visualizer-core.js';
import UIController     from './ui-controller.js';

/* -------------------------------------------------------------------------- */
/* Global Singleton                                                           */
/* -------------------------------------------------------------------------- */

export const App = {
    // Components -----------------------------------------------------------
    websocket  : null,
    handTrack  : null,
    audio      : null,
    vis        : null,
    ui         : null,

    // Runtime state --------------------------------------------------------
    isRunning  : false,
    fps        : 0,
    _frameCnt  : 0,
    _lastFPS   : 0,

    /* ------------------------------------------------------------------ */
    /* Initialisation                                                     */
    /* ------------------------------------------------------------------ */
    async init () {
        this._setupSettingsDefaults();
        this._initComponents();
        this._bindVisibilityEvents();
    },

    async start () {
        if (this.isRunning) return;
        await this.websocket.connect();
        await this.handTrack.start();
        await this.audio.start();
        this.vis.start();
        this.isRunning = true;
        requestAnimationFrame(this._animate.bind(this));
        this.sendCommand('start', {});
        this.ui.updateConnectionStatus('connected');
    },

    stop () {
        if (!this.isRunning) return;
        this.isRunning = false;
        this.handTrack.stop();
        this.audio.stop();
        this.vis.stop();
        this.websocket.close();
        this.ui.updateConnectionStatus('disconnected');
    },

    /* ------------------------------------------------------------------ */
    /* Settings & Persistence                                             */
    /* ------------------------------------------------------------------ */
    settings : {},

    _setupSettingsDefaults () {
        // cloned defaults
        this.settings = {
            audio : {
                bpm            : 120,
                masterVolume   : 0.8,
                arpeggioVolume : 0.8,
                drumVolume     : 0.8
            },
            visualizer : {
                mode        : 'particles',
                colorScheme : 'rainbow',
                intensity   : 0.8,
                complexity  : 0.6,
                speed       : 0.5
            },
            handTracking : {
                maxHands              : 2,
                minDetectionConfidence: 0.7,
                minTrackingConfidence : 0.5
            },
            arpeggiator : {
                rootNote    : 60,
                scale       : 'major',
                pattern     : 'up',
                octaveRange : 2
            },
            drums : {
                patternId : 0
            }
        };
        // TODO: load persisted profile from localStorage / backend
    },

    /* ------------------------------------------------------------------ */
    /* Component Factory                                                  */
    /* ------------------------------------------------------------------ */

    _initComponents () {
        // WebSocket ------------------------------------------------------
        const proto   = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL   = `${proto}//${window.location.host}/ws`;
        this.websocket= new WebSocketManager(wsURL);
        this.websocket.onMessage = this._onServerMessage.bind(this);
        this.websocket.onClose   = () => this.ui.updateConnectionStatus('disconnected');

        // Hand Tracking --------------------------------------------------
        this.handTrack = new HandTracking('inputVideo', 'handCanvas', this.settings.handTracking);

        // Audio Engine ---------------------------------------------------
        this.audio = new AudioEngine(this);

        // Visualizer -----------------------------------------------------
        this.vis   = new Visualizer('visualizerContainer', this.settings.visualizer);

        // UI -------------------------------------------------------------
        this.ui    = new UIController(this);
        this.ui.init();
    },

    /* ------------------------------------------------------------------ */
    /* Animation Loop                                                    */
    /* ------------------------------------------------------------------ */
    _animate (ts) {
        if (!this.isRunning) return;
        requestAnimationFrame(this._animate.bind(this));

        // FPS calc -------------------------------------------------------
        if (!this._lastFPS) this._lastFPS = ts;
        this._frameCnt++;
        if (ts - this._lastFPS >= 1000) {
            this.fps = this._frameCnt;
            this.ui.dom.fps.textContent = this.fps;
            this._frameCnt = 0;
            this._lastFPS  = ts;
        }

        // Update sub-systems -------------------------------------------
        const handData  = this.handTrack.update();
        const audioData = this.audio.update(16); // elapsed not critical here
        this.vis.update(audioData, handData, 16);
        this.ui.update(handData, audioData);

        // Flush hand landmarks to server every frame --------------------
        if (handData && handData.length) {
            this.sendCommand('hand_data', { hands: handData });
        }
    },

    /* ------------------------------------------------------------------ */
    /* Backend Comms                                                     */
    /* ------------------------------------------------------------------ */

    /** Send raw pre-formatted message string/object */
    send (msg) { this.websocket.send(msg); },

    /** Helper: send protocol JSON */
    sendCommand (type, payload) { this.send({ type, payload }); },

    sendSettings () { this.sendCommand('settings_update', this.settings); },

    _onServerMessage (msg) {
        let data;
        try { data = (typeof msg === 'string') ? JSON.parse(msg) : msg; }
        catch { console.warn('Malformed WS message'); return; }
        if (data.type === 'error') {
            this.ui.showError('Server', data.payload.message || 'Unknown');
        }
        // TODO: handle future message types (state sync, heartbeat etc.)
    },

    /* ------------------------------------------------------------------ */
    /* Housekeeping                                                      */
    /* ------------------------------------------------------------------ */

    _bindVisibilityEvents () {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isRunning) {
                this.audio.setMasterVolume(0); // mute when hidden
            } else if (!document.hidden) {
                this.audio.setMasterVolume(this.settings.audio.masterVolume);
            }
        });
    }
};

/* -------------------------------------------------------------------------- */
/* Boot                                                                        */
/* -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
