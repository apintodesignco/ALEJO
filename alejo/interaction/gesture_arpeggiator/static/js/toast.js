/**
 * Simple Toast / Notification utility for ALEJO UI
 * ------------------------------------------------
 * Type-safe toast notifications with automatic stacking, appearance/dismissal
 * animations, and accessibility ARIA-live announcements.  No external CSS is
 * required – the component injects minimal styles on first use.
 */

export default class Toast {
    static _ensureContainer () {
        if (this._container) return;
        this._container = document.createElement('div');
        this._container.id = 'toastContainer';
        document.body.appendChild(this._container);
        // Inject base styles once -------------------------------------
        const style = document.createElement('style');
        style.textContent = `
#toastContainer { position: fixed; z-index: 9999; top: 1rem; right: 1rem; display: flex; flex-direction: column; gap: .5rem; pointer-events: none; }
.toast { min-width: 200px; max-width: 360px; padding: .75rem 1rem; border-radius: 4px; color: #fff; font-family: sans-serif; font-size: .9rem; box-shadow: 0 2px 6px rgba(0,0,0,.2); opacity: 0; transform: translateY(-10px); transition: opacity .3s ease, transform .3s ease; pointer-events: auto; }
.toast.show { opacity: 1; transform: translateY(0); }
.toast.info { background:#2196f3; }
.toast.success { background:#4caf50; }
.toast.error { background:#f44336; }
.toast.warn { background:#ff9800; }
`;
        document.head.appendChild(style);
    }

    /**
     * Display a toast.
     * @param {string} message - body text
     * @param {('info'|'success'|'error'|'warn')} [type]
     * @param {number} [duration] - ms before auto-dismiss (0 = sticky)
     */
    static show (message, type='info', duration=4000) {
        this._ensureContainer();
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.setAttribute('role','alert');
        div.setAttribute('aria-live','assertive');
        div.textContent = message;
        // Click to dismiss -------------------------------------------
        div.addEventListener('click', () => this._dismiss(div));
        this._container.appendChild(div);
        // Force reflow, then animate ---------------------------------
        window.getComputedStyle(div).opacity;
        div.classList.add('show');
        // Auto-dismiss ----------------------------------------------
        if (duration>0) {
            setTimeout(()=> this._dismiss(div), duration);
        }
    }

    static _dismiss (el) {
        el.classList.remove('show');
        el.addEventListener('transitionend', ()=> el.remove(), { once:true });
    }
}
