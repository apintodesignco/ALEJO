/**
 * Extended Accessibility Module for ALEJO Gesture System
 *
 * Provides advanced keyboard navigation among interactive elements, dynamic focus management,
 * and enhanced ARIA announcements. This module builds upon the core accessibility module
 * to support robust, production-grade accessibility features.
 *
 * @module gesture-accessibility-enhanced
 * @requires gesture-accessibility-core.js
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};

    /**
     * GestureAccessibilityEnhanced class extends the core GestureAccessibility
     * to add focus management and improved keyboard navigation.
     */
    class GestureAccessibilityEnhanced extends ALEJO.GestureAccessibility {
        /**
         * Creates a new instance
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            super(options);
            // Array to hold focusable elements
            this.focusableElements = [];
            this.currentFocusIndex = 0;
        }

        /**
         * Updates the list of focusable elements in the document.
         * Looks for elements with tabindex attribute that are not disabled.
         */
        updateFocusableElements() {
            this.focusableElements = Array.from(document.querySelectorAll('[tabindex]'))
                .filter(el => !el.disabled);
            if (this.config.debug) {
                console.log('Updated focusable elements:', this.focusableElements);
            }
        }

        /**
         * Moves focus to the next focusable element.
         */
        focusNext() {
            if (!this.focusableElements.length) {
                this.updateFocusableElements();
            }
            if (!this.focusableElements.length) return;
            this.currentFocusIndex = (this.currentFocusIndex + 1) % this.focusableElements.length;
            const element = this.focusableElements[this.currentFocusIndex];
            element.focus();
            this.announce(`Focused on element ${element.getAttribute('aria-label') || element.id}`);
        }

        /**
         * Moves focus to the previous focusable element.
         */
        focusPrevious() {
            if (!this.focusableElements.length) {
                this.updateFocusableElements();
            }
            if (!this.focusableElements.length) return;
            this.currentFocusIndex = (this.currentFocusIndex - 1 + this.focusableElements.length) % this.focusableElements.length;
            const element = this.focusableElements[this.currentFocusIndex];
            element.focus();
            this.announce(`Focused on element ${element.getAttribute('aria-label') || element.id}`);
        }

        /**
         * Handles keyboard events, adding navigation support for Tab and Shift+Tab.
         * @param {KeyboardEvent} e - The keyboard event
         */
        handleKeyboardEvent(e) {
            // Manage Tab navigation explicitly
            if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault();
                this.focusNext();
                return;
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.focusPrevious();
                return;
            }
            // For other keys, fall back to core handler
            super.handleKeyboardEvent(e);
        }

        /**
         * Attaches enhanced keyboard listeners for accessibility features.
         */
        attachEnhancedKeyboardListeners() {
            window.addEventListener('keydown', (e) => this.handleKeyboardEvent(e));
            if (this.config.debug) {
                console.log('Enhanced keyboard listeners attached for GestureAccessibilityEnhanced');
            }
        }
    }

    // Export the enhanced class to the ALEJO namespace
    ALEJO.GestureAccessibilityEnhanced = GestureAccessibilityEnhanced;
})();
