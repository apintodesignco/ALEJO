/**
 * ALEJO Gesture Detection Module
 * 
 * Provides core gesture detection capabilities for the ALEJO system.
 * This module handles the low-level detection of various gesture types
 * including swipes, pinches, rotations, and multi-touch gestures.
 * 
 * @module gesture-detection
 * @requires event-bus
 * @author ALEJO Team
 * @version 1.0.0
 */

(function() {
    'use strict';

    // Ensure ALEJO namespace exists
    window.ALEJO = window.ALEJO || {};
    
    /**
     * GestureDetector class for identifying and tracking gestures
     */
    class GestureDetector {
        /**
         * Create a new GestureDetector
         * @param {Object} options - Configuration options
         */
        constructor(options = {}) {
            // Configuration with defaults
            this.config = {
                minSwipeDistance: options.minSwipeDistance || 40,
                minSwipeVelocity: options.minSwipeVelocity || 0.3,
                maxTapDistance: options.maxTapDistance || 10,
                maxTapDuration: options.maxTapDuration || 300,
                holdDuration: options.holdDuration || 500,
                doubleTapInterval: options.doubleTapInterval || 300,
                rotationThreshold: options.rotationThreshold || 15,
                pinchThreshold: options.pinchThreshold || 0.1,
                debug: options.debug || false
            };
            
            // State tracking
            this.touchPoints = new Map();
            this.gestureState = {
                active: false,
                startTime: 0,
                type: null,
                points: [],
                lastTap: null,
                lastPosition: null
            };
            
            // Event callbacks
            this.callbacks = {
                onSwipe: options.onSwipe || null,
                onTap: options.onTap || null,
                onDoubleTap: options.onDoubleTap || null,
                onHold: options.onHold || null,
                onPinch: options.onPinch || null,
                onRotate: options.onRotate || null,
                onGestureStart: options.onGestureStart || null,
                onGestureEnd: options.onGestureEnd || null
            };
            
            // Bind methods to preserve context
            this.handlePointerDown = this.handlePointerDown.bind(this);
            this.handlePointerMove = this.handlePointerMove.bind(this);
            this.handlePointerUp = this.handlePointerUp.bind(this);
            this.handlePointerCancel = this.handlePointerCancel.bind(this);
            
            // Initialize
            this.init();
        }
        
        /**
         * Initialize the detector
         */
        init() {
            this.attachEventListeners();
            if (this.config.debug) {
                console.log('ALEJO GestureDetector initialized');
            }
        }
        
        /**
         * Attach event listeners for pointer events
         */
        attachEventListeners() {
            document.addEventListener('pointerdown', this.handlePointerDown, { passive: false });
            document.addEventListener('pointermove', this.handlePointerMove, { passive: false });
            document.addEventListener('pointerup', this.handlePointerUp, { passive: false });
            document.addEventListener('pointercancel', this.handlePointerCancel, { passive: false });
        }
        
        /**
         * Remove event listeners
         */
        detachEventListeners() {
            document.removeEventListener('pointerdown', this.handlePointerDown);
            document.removeEventListener('pointermove', this.handlePointerMove);
            document.removeEventListener('pointerup', this.handlePointerUp);
            document.removeEventListener('pointercancel', this.handlePointerCancel);
        }
        
        /**
         * Handle pointer down events
         * @param {PointerEvent} event - The pointer event
         */
        handlePointerDown(event) {
            // Store the touch point
            this.touchPoints.set(event.pointerId, {
                id: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                currentX: event.clientX,
                currentY: event.clientY,
                startTime: Date.now(),
                element: event.target
            });
            
            // Start gesture tracking if this is the first touch
            if (this.touchPoints.size === 1) {
                this.gestureState.active = true;
                this.gestureState.startTime = Date.now();
                this.gestureState.points = Array.from(this.touchPoints.values());
                
                // Start hold timer
                this.holdTimer = setTimeout(() => {
                    this.recognizeHold();
                }, this.config.holdDuration);
                
                // Notify gesture start
                if (this.callbacks.onGestureStart) {
                    this.callbacks.onGestureStart({
                        type: 'gesture_start',
                        points: this.gestureState.points,
                        target: event.target
                    });
                }
            } else {
                // Clear hold timer for multi-touch
                if (this.holdTimer) {
                    clearTimeout(this.holdTimer);
                    this.holdTimer = null;
                }
                
                // Update points for multi-touch gestures
                this.gestureState.points = Array.from(this.touchPoints.values());
            }
            
            // Prevent default behavior for gesture-enabled elements
            if (this.isGestureEnabledElement(event.target)) {
                event.preventDefault();
            }
        }
        
        /**
         * Handle pointer move events
         * @param {PointerEvent} event - The pointer event
         */
        handlePointerMove(event) {
            // Ignore if not tracking this pointer
            if (!this.touchPoints.has(event.pointerId)) return;
            
            // Update the touch point
            const point = this.touchPoints.get(event.pointerId);
            point.currentX = event.clientX;
            point.currentY = event.clientY;
            
            // Calculate distance moved
            const deltaX = point.currentX - point.startX;
            const deltaY = point.currentY - point.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Clear hold timer if moved too far
            if (this.holdTimer && distance > this.config.maxTapDistance) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            // Update gesture state
            this.gestureState.points = Array.from(this.touchPoints.values());
            
            // Detect multi-touch gestures
            if (this.touchPoints.size >= 2) {
                this.detectMultiTouchGestures();
            }
            
            // Prevent default for gesture-enabled elements
            if (this.isGestureEnabledElement(event.target) && distance > this.config.maxTapDistance) {
                event.preventDefault();
            }
        }
        
        /**
         * Handle pointer up events
         * @param {PointerEvent} event - The pointer event
         */
        handlePointerUp(event) {
            // Ignore if not tracking this pointer
            if (!this.touchPoints.has(event.pointerId)) return;
            
            // Get the touch point
            const point = this.touchPoints.get(event.pointerId);
            
            // Calculate gesture properties
            const deltaX = event.clientX - point.startX;
            const deltaY = event.clientY - point.startY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const duration = Date.now() - point.startTime;
            const velocity = distance / duration;
            
            // Clear hold timer
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            // Detect tap if movement was minimal
            if (distance < this.config.maxTapDistance && duration < this.config.maxTapDuration) {
                this.recognizeTap(point);
            }
            // Detect swipe if movement was significant
            else if (distance > this.config.minSwipeDistance && velocity > this.config.minSwipeVelocity) {
                this.recognizeSwipe(point, deltaX, deltaY);
            }
            
            // Remove the touch point
            this.touchPoints.delete(event.pointerId);
            
            // End gesture tracking if no more touches
            if (this.touchPoints.size === 0) {
                this.endGestureTracking();
            } else {
                // Update points for remaining touches
                this.gestureState.points = Array.from(this.touchPoints.values());
            }
        }
        
        /**
         * Handle pointer cancel events
         * @param {PointerEvent} event - The pointer event
         */
        handlePointerCancel(event) {
            // Clear hold timer
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            // Remove the touch point
            this.touchPoints.delete(event.pointerId);
            
            // End gesture tracking if no more touches
            if (this.touchPoints.size === 0) {
                this.endGestureTracking();
            } else {
                // Update points for remaining touches
                this.gestureState.points = Array.from(this.touchPoints.values());
            }
        }
        
        /**
         * End gesture tracking and notify listeners
         */
        endGestureTracking() {
            if (!this.gestureState.active) return;
            
            this.gestureState.active = false;
            
            // Notify gesture end
            if (this.callbacks.onGestureEnd) {
                this.callbacks.onGestureEnd({
                    type: 'gesture_end',
                    duration: Date.now() - this.gestureState.startTime
                });
            }
        }
        
        /**
         * Recognize a tap gesture
         * @param {Object} point - The touch point
         */
        recognizeTap(point) {
            const now = Date.now();
            const tapEvent = {
                type: 'tap',
                x: point.currentX,
                y: point.currentY,
                target: point.element
            };
            
            // Check for double tap
            if (this.gestureState.lastTap && 
                (now - this.gestureState.lastTap.time) < this.config.doubleTapInterval) {
                
                // Ensure taps are close together
                const lastTap = this.gestureState.lastTap;
                const dx = point.currentX - lastTap.x;
                const dy = point.currentY - lastTap.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.config.maxTapDistance) {
                    const doubleTapEvent = {
                        type: 'double_tap',
                        x: point.currentX,
                        y: point.currentY,
                        target: point.element
                    };
                    
                    if (this.callbacks.onDoubleTap) {
                        this.callbacks.onDoubleTap(doubleTapEvent);
                    }
                    
                    // Reset last tap
                    this.gestureState.lastTap = null;
                    return;
                }
            }
            
            // Store for double tap detection
            this.gestureState.lastTap = {
                time: now,
                x: point.currentX,
                y: point.currentY
            };
            
            // Notify tap
            if (this.callbacks.onTap) {
                this.callbacks.onTap(tapEvent);
            }
        }
        
        /**
         * Recognize a hold gesture
         */
        recognizeHold() {
            if (this.touchPoints.size !== 1) return;
            
            const point = Array.from(this.touchPoints.values())[0];
            const holdEvent = {
                type: 'hold',
                x: point.currentX,
                y: point.currentY,
                duration: this.config.holdDuration,
                target: point.element
            };
            
            if (this.callbacks.onHold) {
                this.callbacks.onHold(holdEvent);
            }
        }
        
        /**
         * Recognize a swipe gesture
         * @param {Object} point - The touch point
         * @param {number} deltaX - X distance moved
         * @param {number} deltaY - Y distance moved
         */
        recognizeSwipe(point, deltaX, deltaY) {
            // Determine direction
            let direction;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                direction = deltaX > 0 ? 'right' : 'left';
            } else {
                direction = deltaY > 0 ? 'down' : 'up';
            }
            
            const swipeEvent = {
                type: 'swipe',
                direction: direction,
                distance: Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                deltaX: deltaX,
                deltaY: deltaY,
                duration: Date.now() - point.startTime,
                target: point.element
            };
            
            if (this.callbacks.onSwipe) {
                this.callbacks.onSwipe(swipeEvent);
            }
        }
        
        /**
         * Detect multi-touch gestures like pinch and rotate
         */
        detectMultiTouchGestures() {
            if (this.touchPoints.size < 2) return;
            
            const points = Array.from(this.touchPoints.values());
            
            // We need at least two points
            if (points.length < 2) return;
            
            const p1 = points[0];
            const p2 = points[1];
            
            // Calculate current distance between points
            const currentDx = p2.currentX - p1.currentX;
            const currentDy = p2.currentY - p1.currentY;
            const currentDistance = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
            
            // Calculate starting distance between points
            const startDx = p2.startX - p1.startX;
            const startDy = p2.startY - p1.startY;
            const startDistance = Math.sqrt(startDx * startDx + startDy * startDy);
            
            // Detect pinch/zoom
            const scaleFactor = currentDistance / startDistance;
            if (Math.abs(1 - scaleFactor) > this.config.pinchThreshold) {
                const pinchEvent = {
                    type: scaleFactor > 1 ? 'pinch_out' : 'pinch_in',
                    scale: scaleFactor,
                    centerX: (p1.currentX + p2.currentX) / 2,
                    centerY: (p1.currentY + p2.currentY) / 2,
                    target: this.findCommonAncestor(p1.element, p2.element)
                };
                
                if (this.callbacks.onPinch) {
                    this.callbacks.onPinch(pinchEvent);
                }
            }
            
            // Detect rotation
            const startAngle = Math.atan2(startDy, startDx) * (180 / Math.PI);
            const currentAngle = Math.atan2(currentDy, currentDx) * (180 / Math.PI);
            let rotation = currentAngle - startAngle;
            
            // Normalize rotation to -180 to 180
            if (rotation > 180) rotation -= 360;
            if (rotation < -180) rotation += 360;
            
            if (Math.abs(rotation) > this.config.rotationThreshold) {
                const rotateEvent = {
                    type: 'rotate',
                    rotation: rotation,
                    centerX: (p1.currentX + p2.currentX) / 2,
                    centerY: (p1.currentY + p2.currentY) / 2,
                    target: this.findCommonAncestor(p1.element, p2.element)
                };
                
                if (this.callbacks.onRotate) {
                    this.callbacks.onRotate(rotateEvent);
                }
            }
        }
        
        /**
         * Find the common ancestor of two DOM elements
         * @param {Element} el1 - First element
         * @param {Element} el2 - Second element
         * @returns {Element} Common ancestor element
         */
        findCommonAncestor(el1, el2) {
            if (el1 === el2) return el1;
            
            const path1 = this.getElementPath(el1);
            const path2 = this.getElementPath(el2);
            
            let commonAncestor = document.body;
            
            for (let i = 0; i < path1.length && i < path2.length; i++) {
                if (path1[i] === path2[i]) {
                    commonAncestor = path1[i];
                } else {
                    break;
                }
            }
            
            return commonAncestor;
        }
        
        /**
         * Get the path from root to element
         * @param {Element} element - DOM element
         * @returns {Array<Element>} Path from root to element
         */
        getElementPath(element) {
            const path = [];
            let current = element;
            
            while (current) {
                path.unshift(current);
                current = current.parentElement;
            }
            
            return path;
        }
        
        /**
         * Check if an element is gesture-enabled
         * @param {Element} element - DOM element to check
         * @returns {boolean} True if the element is gesture-enabled
         */
        isGestureEnabledElement(element) {
            let current = element;
            
            while (current && current !== document.body) {
                if (current.classList.contains('gesture-enabled') || 
                    current.hasAttribute('data-gesture-action')) {
                    return true;
                }
                current = current.parentElement;
            }
            
            return false;
        }
        
        /**
         * Destroy the detector and clean up resources
         */
        destroy() {
            this.detachEventListeners();
            
            if (this.holdTimer) {
                clearTimeout(this.holdTimer);
                this.holdTimer = null;
            }
            
            this.touchPoints.clear();
            this.gestureState.active = false;
            
            if (this.config.debug) {
                console.log('ALEJO GestureDetector destroyed');
            }
        }
    }
    
    // Export to ALEJO namespace
    ALEJO.GestureDetector = GestureDetector;
})();
