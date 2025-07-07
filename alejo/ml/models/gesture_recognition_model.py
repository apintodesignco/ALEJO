"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
Gesture Recognition Model - Custom TensorFlow model for gesture recognition
"""

import os
import logging
import numpy as np
from typing import Dict, Any, Optional, List, Union, Tuple

from alejo.ml.models.model_base import ModelBase

logger = logging.getLogger("alejo.ml.gesture")

class GestureRecognitionModel(ModelBase):
    """
    Custom gesture recognition model for ALEJO.
    
    This model takes hand landmarks as input and classifies gestures.
    It supports both static gestures (poses) and dynamic gestures (movements over time).
    """
    
    # Default gestures supported by the model
    DEFAULT_GESTURES = [
        "open_hand",
        "closed_fist",
        "pointing",
        "victory",
        "thumbs_up",
        "wave",
        "pinch",
        "swipe_left",
        "swipe_right",
        "swipe_up",
        "swipe_down",
        "rotate_clockwise",
        "rotate_counterclockwise",
        "zoom_in",
        "zoom_out"
    ]
    
    # Landmark indices for specific fingers
    FINGER_INDICES = {
        "thumb": [1, 2, 3, 4],
        "index": [5, 6, 7, 8],
        "middle": [9, 10, 11, 12],
        "ring": [13, 14, 15, 16],
        "pinky": [17, 18, 19, 20]
    }
    
    def __init__(
        self, 
        model_id: str = "alejo_gesture_recognition", 
        framework: str = "tensorflow",
        config: Dict[str, Any] = None,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize the gesture recognition model.
        
        Args:
            model_id: Unique identifier for the model
            framework: Framework identifier (should be "tensorflow")
            config: Model-specific configuration
            cache_dir: Directory for model caching
        """
        super().__init__(model_id, framework, config, cache_dir)
        
        # Configuration
        self.config = config or {}
        self.use_dynamic_gestures = self.config.get("use_dynamic_gestures", True)
        self.temporal_window = self.config.get("temporal_window", 10)  # Number of frames to consider for dynamic gestures
        self.confidence_threshold = self.config.get("confidence_threshold", 0.7)
        self.custom_gestures_enabled = self.config.get("custom_gestures_enabled", True)
        
        # Lazy import TensorFlow to avoid loading it unnecessarily
        self.tf = None
        self.model = None
        self.dynamic_model = None
        
        # Gesture history for dynamic gesture recognition
        self.landmark_history = []
        
        # Custom gesture definitions
        self.custom_gestures = {}
        
        # Metadata
        self.metadata.update({
            "supported_gestures": self.DEFAULT_GESTURES.copy(),
            "custom_gestures": [],
            "dynamic_gestures_enabled": self.use_dynamic_gestures
        })
    
    def _import_tensorflow(self) -> bool:
        """
        Import TensorFlow and configure it.
        
        Returns:
            True if import was successful, False otherwise
        """
        if self.tf is not None:
            return True
            
        try:
            # Configure TensorFlow before importing
            os.environ["TF_CPP_MIN_LOG_LEVEL"] = str(self.config.get("log_level", 3))
            
            if not self.config.get("allow_gpu", True):
                os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
                
            # Import TensorFlow
            import tensorflow as tf
            self.tf = tf
            
            logger.info(f"TensorFlow {tf.__version__} imported successfully for gesture recognition")
            return True
        except ImportError as e:
            logger.error(f"Failed to import TensorFlow: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error configuring TensorFlow: {str(e)}")
            return False
    
    def load(self) -> bool:
        """
        Load the gesture recognition model.
        
        Returns:
            True if loading was successful, False otherwise
        """
        if self.is_loaded:
            return True
            
        try:
            if not self._import_tensorflow():
                return False
                
            tf = self.tf
            
            # Define model path from config or use default
            model_path = self.config.get("model_path")
            
            if model_path and os.path.exists(model_path):
                # Load pre-trained model if available
                logger.info(f"Loading gesture model from {model_path}")
                self.model = tf.keras.models.load_model(model_path)
            else:
                # Create a new model
                logger.info("Creating new gesture recognition model")
                self.model = self._create_static_gesture_model()
                
            # Load or create dynamic gesture model if enabled
            if self.use_dynamic_gestures:
                dynamic_model_path = self.config.get("dynamic_model_path")
                
                if dynamic_model_path and os.path.exists(dynamic_model_path):
                    logger.info(f"Loading dynamic gesture model from {dynamic_model_path}")
                    self.dynamic_model = tf.keras.models.load_model(dynamic_model_path)
                else:
                    logger.info("Creating new dynamic gesture recognition model")
                    self.dynamic_model = self._create_dynamic_gesture_model()
            
            # Load custom gestures if available
            custom_gestures_path = self.config.get("custom_gestures_path")
            if custom_gestures_path and os.path.exists(custom_gestures_path):
                self._load_custom_gestures(custom_gestures_path)
            
            self.is_loaded = True
            logger.info("Gesture recognition model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load gesture recognition model: {str(e)}")
            return False
    
    def _create_static_gesture_model(self):
        """
        Create a new static gesture recognition model.
        
        Returns:
            TensorFlow model for static gesture recognition
        """
        tf = self.tf
        
        # Input: 21 hand landmarks with 3 coordinates (x, y, z) each
        inputs = tf.keras.Input(shape=(21, 3))
        
        # Flatten the landmarks
        x = tf.keras.layers.Flatten()(inputs)
        
        # Add dense layers
        x = tf.keras.layers.Dense(128, activation='relu')(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        x = tf.keras.layers.Dense(64, activation='relu')(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        
        # Output layer with one neuron per gesture
        outputs = tf.keras.layers.Dense(len(self.DEFAULT_GESTURES), activation='softmax')(x)
        
        # Create and compile the model
        model = tf.keras.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def _create_dynamic_gesture_model(self):
        """
        Create a new dynamic gesture recognition model.
        
        Returns:
            TensorFlow model for dynamic gesture recognition
        """
        tf = self.tf
        
        # Input: Sequence of hand landmarks
        # Shape: (temporal_window, 21, 3) - frames, landmarks, coordinates
        inputs = tf.keras.Input(shape=(self.temporal_window, 21, 3))
        
        # Use LSTM layers for sequence processing
        x = tf.keras.layers.TimeDistributed(tf.keras.layers.Flatten())(inputs)
        x = tf.keras.layers.LSTM(128, return_sequences=True)(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        x = tf.keras.layers.LSTM(64)(x)
        x = tf.keras.layers.Dropout(0.2)(x)
        
        # Output layer with one neuron per dynamic gesture
        # We focus on dynamic gestures like swipes, circles, etc.
        dynamic_gestures = [g for g in self.DEFAULT_GESTURES if g.startswith(("swipe", "rotate", "zoom"))]
        outputs = tf.keras.layers.Dense(len(dynamic_gestures), activation='softmax')(x)
        
        # Create and compile the model
        model = tf.keras.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def unload(self) -> bool:
        """
        Unload the model from memory.
        
        Returns:
            True if unloading was successful, False otherwise
        """
        if not self.is_loaded:
            return True
            
        try:
            # Clear TensorFlow models
            self.model = None
            self.dynamic_model = None
            
            # Clear history
            self.landmark_history = []
            
            # Clear TensorFlow session
            if self.tf:
                self.tf.keras.backend.clear_session()
            
            self.is_loaded = False
            logger.info("Gesture recognition model unloaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to unload gesture recognition model: {str(e)}")
            return False
    
    def predict(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Recognize gestures from hand landmarks.
        
        Args:
            landmarks: Hand landmarks from hand detection model (21 landmarks with x, y, z coordinates)
            
        Returns:
            Dictionary with recognized gesture, confidence, and metadata
        """
        if not self.is_loaded:
            if not self.load():
                return {"gesture": None, "confidence": 0.0, "error": "Model not loaded"}
        
        try:
            # Ensure landmarks are in the right format
            if landmarks.shape != (21, 3):
                landmarks = np.reshape(landmarks, (21, 3))
            
            # Normalize landmarks to improve robustness
            landmarks = self._normalize_landmarks(landmarks)
            
            # Add to history for dynamic gesture recognition
            self.landmark_history.append(landmarks)
            if len(self.landmark_history) > self.temporal_window:
                self.landmark_history.pop(0)
            
            # Recognize static gesture
            static_result = self._recognize_static_gesture(landmarks)
            
            # Recognize dynamic gesture if enabled and we have enough history
            dynamic_result = None
            if self.use_dynamic_gestures and len(self.landmark_history) == self.temporal_window:
                dynamic_result = self._recognize_dynamic_gesture(np.array(self.landmark_history))
            
            # Combine results
            if dynamic_result and dynamic_result["confidence"] > static_result["confidence"]:
                result = dynamic_result
                result["type"] = "dynamic"
            else:
                result = static_result
                result["type"] = "static"
            
            # Check for custom gestures
            if self.custom_gestures_enabled:
                custom_result = self._check_custom_gestures(landmarks)
                if custom_result and custom_result["confidence"] > result["confidence"]:
                    result = custom_result
                    result["type"] = "custom"
            
            # Add metadata
            result["timestamp"] = self.tf.timestamp() if self.tf else 0
            
            return result
        except Exception as e:
            logger.error(f"Error during gesture recognition: {str(e)}")
            return {"gesture": None, "confidence": 0.0, "error": str(e)}
    
    def _normalize_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """
        Normalize landmarks to make recognition more robust to hand size and position.
        
        Args:
            landmarks: Hand landmarks array
            
        Returns:
            Normalized landmarks
        """
        # Center landmarks around the wrist
        wrist = landmarks[0]
        centered = landmarks - wrist
        
        # Scale to unit size
        max_dist = np.max(np.linalg.norm(centered, axis=1))
        if max_dist > 0:
            normalized = centered / max_dist
        else:
            normalized = centered
            
        return normalized
    
    def _recognize_static_gesture(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Recognize static gestures from hand landmarks.
        
        Args:
            landmarks: Normalized hand landmarks
            
        Returns:
            Dictionary with recognized gesture and confidence
        """
        # If model is not trained yet, use rule-based recognition
        if not self.model or self.model.layers[-1].units == 0:
            return self._rule_based_recognition(landmarks)
        
        # Prepare input for the model
        input_data = np.expand_dims(landmarks, axis=0)
        
        # Get predictions
        predictions = self.model.predict(input_data, verbose=0)[0]
        
        # Get the most likely gesture
        gesture_idx = np.argmax(predictions)
        confidence = float(predictions[gesture_idx])
        
        # Only return if confidence is above threshold
        if confidence >= self.confidence_threshold:
            return {
                "gesture": self.DEFAULT_GESTURES[gesture_idx],
                "confidence": confidence,
                "all_confidences": {self.DEFAULT_GESTURES[i]: float(predictions[i]) for i in range(len(self.DEFAULT_GESTURES))}
            }
        else:
            return {"gesture": "unknown", "confidence": confidence}
    
    def _recognize_dynamic_gesture(self, landmark_history: np.ndarray) -> Dict[str, Any]:
        """
        Recognize dynamic gestures from a sequence of hand landmarks.
        
        Args:
            landmark_history: Sequence of hand landmarks
            
        Returns:
            Dictionary with recognized dynamic gesture and confidence
        """
        if not self.dynamic_model:
            return None
        
        # Prepare input for the model
        input_data = np.expand_dims(landmark_history, axis=0)
        
        # Get predictions
        predictions = self.dynamic_model.predict(input_data, verbose=0)[0]
        
        # Get the most likely gesture
        dynamic_gestures = [g for g in self.DEFAULT_GESTURES if g.startswith(("swipe", "rotate", "zoom"))]
        gesture_idx = np.argmax(predictions)
        confidence = float(predictions[gesture_idx])
        
        # Only return if confidence is above threshold
        if confidence >= self.confidence_threshold:
            return {
                "gesture": dynamic_gestures[gesture_idx],
                "confidence": confidence,
                "all_confidences": {dynamic_gestures[i]: float(predictions[i]) for i in range(len(dynamic_gestures))}
            }
        else:
            return None
    
    def _rule_based_recognition(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Rule-based gesture recognition as a fallback when the model is not trained.
        
        Args:
            landmarks: Normalized hand landmarks
            
        Returns:
            Dictionary with recognized gesture and confidence
        """
        # Extract finger states (extended or not)
        thumb_extended = self._is_finger_extended(landmarks, "thumb")
        index_extended = self._is_finger_extended(landmarks, "index")
        middle_extended = self._is_finger_extended(landmarks, "middle")
        ring_extended = self._is_finger_extended(landmarks, "ring")
        pinky_extended = self._is_finger_extended(landmarks, "pinky")
        
        # Count extended fingers
        extended_fingers = sum([thumb_extended, index_extended, middle_extended, ring_extended, pinky_extended])
        
        # Recognize gestures based on finger states
        if extended_fingers == 5:
            return {"gesture": "open_hand", "confidence": 0.9}
        elif extended_fingers == 0:
            return {"gesture": "closed_fist", "confidence": 0.9}
        elif index_extended and not middle_extended and not ring_extended and not pinky_extended:
            return {"gesture": "pointing", "confidence": 0.85}
        elif index_extended and middle_extended and not ring_extended and not pinky_extended:
            return {"gesture": "victory", "confidence": 0.85}
        elif thumb_extended and not index_extended and not middle_extended and not ring_extended and not pinky_extended:
            return {"gesture": "thumbs_up", "confidence": 0.8}
        else:
            return {"gesture": "unknown", "confidence": 0.5}
    
    def _is_finger_extended(self, landmarks: np.ndarray, finger: str) -> bool:
        """
        Check if a finger is extended.
        
        Args:
            landmarks: Normalized hand landmarks
            finger: Finger name ("thumb", "index", "middle", "ring", "pinky")
            
        Returns:
            True if the finger is extended, False otherwise
        """
        if finger not in self.FINGER_INDICES:
            return False
            
        indices = self.FINGER_INDICES[finger]
        
        # Get finger tip and base
        tip_idx = indices[-1]
        base_idx = indices[0]
        
        # For thumb, compare with wrist
        if finger == "thumb":
            wrist_idx = 0
            return landmarks[tip_idx][0] > landmarks[wrist_idx][0]
        
        # For other fingers, check if tip is higher than base
        return landmarks[tip_idx][1] < landmarks[base_idx][1]
    
    def _check_custom_gestures(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """
        Check if the hand pose matches any custom gesture.
        
        Args:
            landmarks: Normalized hand landmarks
            
        Returns:
            Dictionary with recognized custom gesture and confidence, or None if no match
        """
        if not self.custom_gestures:
            return None
            
        # TODO: Implement custom gesture matching
        # This would compare the current landmarks with stored custom gesture templates
        # using techniques like Dynamic Time Warping (DTW) or template matching
        
        return None
    
    def _load_custom_gestures(self, path: str) -> bool:
        """
        Load custom gestures from a file.
        
        Args:
            path: Path to the custom gestures file
            
        Returns:
            True if loading was successful, False otherwise
        """
        try:
            import json
            
            with open(path, 'r') as f:
                data = json.load(f)
                
            self.custom_gestures = data.get("gestures", {})
            
            # Update metadata
            self.metadata["custom_gestures"] = list(self.custom_gestures.keys())
            
            logger.info(f"Loaded {len(self.custom_gestures)} custom gestures from {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to load custom gestures: {str(e)}")
            return False
    
    def save_custom_gesture(self, name: str, landmarks: List[np.ndarray]) -> bool:
        """
        Save a custom gesture.
        
        Args:
            name: Name of the custom gesture
            landmarks: List of hand landmarks representing the gesture
            
        Returns:
            True if saving was successful, False otherwise
        """
        try:
            # Normalize landmarks
            normalized_landmarks = [self._normalize_landmarks(lm) for lm in landmarks]
            
            # Convert to list for JSON serialization
            landmark_list = [lm.tolist() for lm in normalized_landmarks]
            
            # Store the custom gesture
            self.custom_gestures[name] = {
                "landmarks": landmark_list,
                "created_at": time.time()
            }
            
            # Update metadata
            if name not in self.metadata["custom_gestures"]:
                self.metadata["custom_gestures"].append(name)
            
            # Save to file if path is specified
            custom_gestures_path = self.config.get("custom_gestures_path")
            if custom_gestures_path:
                self._save_custom_gestures(custom_gestures_path)
            
            logger.info(f"Custom gesture '{name}' saved successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to save custom gesture: {str(e)}")
            return False
    
    def _save_custom_gestures(self, path: str) -> bool:
        """
        Save all custom gestures to a file.
        
        Args:
            path: Path to save the custom gestures
            
        Returns:
            True if saving was successful, False otherwise
        """
        try:
            import json
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(path), exist_ok=True)
            
            # Save to file
            with open(path, 'w') as f:
                json.dump({"gestures": self.custom_gestures}, f, indent=2)
            
            logger.info(f"Saved {len(self.custom_gestures)} custom gestures to {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save custom gestures: {str(e)}")
            return False
    
    def train(self, training_data: Dict[str, List[np.ndarray]], epochs: int = 50) -> Dict[str, Any]:
        """
        Train the gesture recognition model with new data.
        
        Args:
            training_data: Dictionary mapping gesture names to lists of landmark arrays
            epochs: Number of training epochs
            
        Returns:
            Dictionary with training results
        """
        if not self._import_tensorflow():
            return {"success": False, "error": "TensorFlow not available"}
            
        try:
            tf = self.tf
            
            # Prepare training data
            X = []
            y = []
            gesture_names = list(training_data.keys())
            
            for i, gesture in enumerate(gesture_names):
                for landmarks in training_data[gesture]:
                    normalized = self._normalize_landmarks(landmarks)
                    X.append(normalized)
                    
                    # One-hot encoding
                    label = [0] * len(gesture_names)
                    label[i] = 1
                    y.append(label)
            
            X = np.array(X)
            y = np.array(y)
            
            # Create a new model if necessary
            if not self.model or self.model.layers[-1].units != len(gesture_names):
                # Input: 21 hand landmarks with 3 coordinates (x, y, z) each
                inputs = tf.keras.Input(shape=(21, 3))
                
                # Flatten the landmarks
                x = tf.keras.layers.Flatten()(inputs)
                
                # Add dense layers
                x = tf.keras.layers.Dense(128, activation='relu')(x)
                x = tf.keras.layers.Dropout(0.2)(x)
                x = tf.keras.layers.Dense(64, activation='relu')(x)
                x = tf.keras.layers.Dropout(0.2)(x)
                
                # Output layer with one neuron per gesture
                outputs = tf.keras.layers.Dense(len(gesture_names), activation='softmax')(x)
                
                # Create and compile the model
                self.model = tf.keras.Model(inputs=inputs, outputs=outputs)
                self.model.compile(
                    optimizer='adam',
                    loss='categorical_crossentropy',
                    metrics=['accuracy']
                )
            
            # Train the model
            history = self.model.fit(
                X, y,
                epochs=epochs,
                batch_size=32,
                validation_split=0.2,
                verbose=1
            )
            
            # Update metadata
            self.metadata["supported_gestures"] = gesture_names
            
            # Save model if path is specified
            model_path = self.config.get("model_path")
            if model_path:
                os.makedirs(os.path.dirname(model_path), exist_ok=True)
                self.model.save(model_path)
                logger.info(f"Model saved to {model_path}")
            
            # Return training results
            return {
                "success": True,
                "accuracy": float(history.history['accuracy'][-1]),
                "val_accuracy": float(history.history['val_accuracy'][-1]) if 'val_accuracy' in history.history else None,
                "loss": float(history.history['loss'][-1]),
                "val_loss": float(history.history['val_loss'][-1]) if 'val_loss' in history.history else None,
                "epochs": epochs,
                "gestures": gesture_names
            }
        except Exception as e:
            logger.error(f"Failed to train gesture recognition model: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_memory_usage(self) -> int:
        """
        Get the estimated memory usage of the model in bytes.
        
        Returns:
            Estimated memory usage in bytes
        """
        if not self.is_loaded:
            return 0
            
        # Rough estimate based on model parameters
        memory_usage = 0
        
        if self.model:
            memory_usage += sum(np.prod(p.shape) * 4 for p in self.model.weights)  # 4 bytes per float32
            
        if self.dynamic_model:
            memory_usage += sum(np.prod(p.shape) * 4 for p in self.dynamic_model.weights)
            
        # Add memory for landmark history
        if self.landmark_history:
            memory_usage += len(self.landmark_history) * 21 * 3 * 4  # 4 bytes per float32
            
        return memory_usage
