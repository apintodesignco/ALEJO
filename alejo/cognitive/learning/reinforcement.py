"""
Reinforcement learning system for ALEJO
Inspired by OpenAI's DoctYL approach
"""

import asyncio
import json
import logging
import numpy as np
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger(__name__)

@dataclass
class Experience:
    """Single learning experience"""
    state: Dict[str, Any]
    action: str
    reward: float
    next_state: Dict[str, Any]
    timestamp: float
    metadata: Dict[str, Any]

class ReinforcementLearner:
    """
    Reinforcement learning system using a modified DoctYL approach
    """
    
    def __init__(
        self,
        model_path: str,
        learning_rate: float = 0.001,
        discount_factor: float = 0.99,
        epsilon_start: float = 1.0,
        epsilon_end: float = 0.01,
        epsilon_decay: float = 0.995,
        batch_size: int = 64,
        memory_size: int = 10000,
        update_frequency: int = 100
    ):
        self.model_path = Path(model_path)
        self.learning_rate = learning_rate
        self.discount_factor = discount_factor
        self.epsilon = epsilon_start
        self.epsilon_end = epsilon_end
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.update_frequency = update_frequency
        
        self.experience_buffer: List[Experience] = []
        self.max_experiences = memory_size
        self.training_steps = 0
        
        # Initialize neural network for Q-learning
        self.q_network = self._build_network()
        self.target_network = self._build_network()
        self._update_target_network()
        
        # Load existing model if available
        self._load_model()
    
    def _build_network(self):
        """
        Build neural network for Q-learning
        Using a simplified architecture similar to DoctYL
        """
        try:
            import tensorflow as tf
            
            model = tf.keras.Sequential([
                tf.keras.layers.Dense(256, activation='relu'),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(128, activation='relu'),
                tf.keras.layers.Dropout(0.2),
                tf.keras.layers.Dense(64, activation='relu'),
                tf.keras.layers.Dense(32)  # Output layer for action values
            ])
            
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=self.learning_rate),
                loss='mse'
            )
            
            return model
            
        except ImportError:
            logger.error("TensorFlow not available, using dummy network")
            return DummyNetwork()
    
    def _update_target_network(self):
        """Update target network weights from Q-network"""
        self.target_network.set_weights(self.q_network.get_weights())
    
    def _load_model(self):
        """Load existing model if available"""
        try:
            if self.model_path.exists():
                self.q_network.load_weights(str(self.model_path))
                self._update_target_network()
                logger.info("Loaded existing model")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
    
    def _save_model(self):
        """Save current model"""
        try:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            self.q_network.save_weights(str(self.model_path))
            logger.info("Saved model")
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    def _encode_state(self, state: Dict[str, Any]) -> np.ndarray:
        """
        Encode state dictionary into vector
        Using similar approach to DoctYL's state encoding
        """
        # Extract relevant features
        features = []
        
        # Emotional state features
        emotional_state = state.get('emotional_state', {})
        features.extend([
            emotional_state.get('valence', 0.0),
            emotional_state.get('arousal', 0.0),
            emotional_state.get('dominance', 0.0)
        ])
        
        # Memory state features
        memory_state = state.get('memory_state', {})
        features.extend([
            memory_state.get('working_memory_load', 0.0),
            memory_state.get('long_term_memory_access', 0.0)
        ])
        
        # Task context features
        task_context = state.get('task_context', {})
        features.extend([
            task_context.get('complexity', 0.0),
            task_context.get('urgency', 0.0),
            task_context.get('importance', 0.0)
        ])
        
        # Convert to numpy array
        return np.array(features, dtype=np.float32)
    
    def _decode_action(self, action_values: np.ndarray) -> str:
        """Decode network output into action"""
        # Map to predefined actions
        actions = [
            'process_normally',
            'request_clarification',
            'delegate_subtask',
            'optimize_resource_usage',
            'engage_safety_protocol'
        ]
        
        return actions[np.argmax(action_values)]
    
    async def add_experience(
        self,
        state: Dict[str, Any],
        action: str,
        reward: float,
        next_state: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Add new experience to memory"""
        experience = Experience(
            state=state,
            action=action,
            reward=reward,
            next_state=next_state,
            timestamp=datetime.now().timestamp(),
            metadata=metadata or {}
        )
        
        self.experience_buffer.append(experience)
        
        # Maintain buffer size
        if len(self.experience_buffer) > self.max_experiences:
            self.experience_buffer.pop(0)
    
    async def train(self) -> Dict[str, float]:
        """
        Train on batch of experiences
        Returns training metrics
        """
        if len(self.experience_buffer) < self.batch_size:
            return {'loss': 0.0, 'epsilon': self.epsilon}
        
        # Sample batch
        batch = np.random.choice(
            self.experience_buffer,
            size=self.batch_size,
            replace=False
        )
        
        # Prepare training data
        states = np.array([self._encode_state(exp.state) for exp in batch])
        next_states = np.array([self._encode_state(exp.next_state) for exp in batch])
        
        # Get Q-values
        current_q_values = self.q_network.predict(states)
        next_q_values = self.target_network.predict(next_states)
        
        # Update Q-values with rewards
        for i, experience in enumerate(batch):
            action_idx = self._get_action_index(experience.action)
            current_q_values[i][action_idx] = (
                experience.reward
                + self.discount_factor * np.max(next_q_values[i])
            )
        
        # Train network
        loss = self.q_network.train_on_batch(states, current_q_values)
        
        # Update target network periodically
        self.training_steps += 1
        if self.training_steps % self.update_frequency == 0:
            self._update_target_network()
            self._save_model()
        
        # Update exploration rate
        self.epsilon = max(
            self.epsilon_end,
            self.epsilon * self.epsilon_decay
        )
        
        return {
            'loss': float(loss),
            'epsilon': self.epsilon
        }
    
    def _get_action_index(self, action: str) -> int:
        """Get index for action string"""
        actions = [
            'process_normally',
            'request_clarification',
            'delegate_subtask',
            'optimize_resource_usage',
            'engage_safety_protocol'
        ]
        return actions.index(action)
    
    async def get_action(self, state: Dict[str, Any]) -> str:
        """
        Get action for state using epsilon-greedy policy
        """
        if np.random.random() < self.epsilon:
            # Explore: random action
            return np.random.choice([
                'process_normally',
                'request_clarification',
                'delegate_subtask',
                'optimize_resource_usage',
                'engage_safety_protocol'
            ])
        
        # Exploit: use network
        state_vector = self._encode_state(state)
        action_values = self.q_network.predict(
            np.array([state_vector])
        )[0]
        
        return self._decode_action(action_values)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get learning statistics"""
        return {
            'experiences': len(self.experience_buffer),
            'training_steps': self.training_steps,
            'epsilon': self.epsilon,
            'model_path': str(self.model_path)
        }

class DummyNetwork:
    """Dummy network when TensorFlow is not available"""
    
    def predict(self, x: np.ndarray) -> np.ndarray:
        return np.zeros((x.shape[0], 32))
    
    def train_on_batch(self, x: np.ndarray, y: np.ndarray) -> float:
        return 0.0
    
    def set_weights(self, weights: List[np.ndarray]):
        pass
    
    def get_weights(self) -> List[np.ndarray]:
        return []
    
    def save_weights(self, path: str):
        pass
    
    def load_weights(self, path: str):
        pass
