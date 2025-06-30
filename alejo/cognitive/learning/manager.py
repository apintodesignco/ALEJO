"""
Learning Manager for ALEJO's cognitive system
Coordinates reinforcement learning and experience collection
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List

from alejo.cognitive.learning.reinforcement import ReinforcementLearner
from alejo.core.event_bus import EventBus, Event, EventType

logger = logging.getLogger(__name__)

class LearningManager:
    """
    Manages ALEJO's learning processes and experience collection
    """
    
    def __init__(
        self,
        event_bus: EventBus,
        base_dir: str,
        config: Optional[Dict[str, Any]] = None
    ):
        self.event_bus = event_bus
        self.base_dir = Path(base_dir)
        self.config = config or {}
        
        # Initialize reinforcement learner
        self.rl = ReinforcementLearner(
            model_path=str(self.base_dir / "models" / "rl_model.h5"),
            learning_rate=self.config.get('learning_rate', 0.001),
            batch_size=self.config.get('batch_size', 64),
            memory_size=self.config.get('memory_size', 10000)
        )
        
        self._running = False
        self._current_state: Optional[Dict[str, Any]] = None
        self._current_action: Optional[str] = None
        self._lock = asyncio.Lock()
        
        # Performance metrics
        self.metrics = {
            'total_experiences': 0,
            'total_rewards': 0.0,
            'avg_reward': 0.0,
            'training_episodes': 0
        }
    
    async def start(self):
        """Start learning system"""
        self._running = True
        
        # Subscribe to events
        await self.event_bus.subscribe(
            EventType.COMMAND,
            self._handle_command
        )
        await self.event_bus.subscribe(
            EventType.RESPONSE,
            self._handle_response
        )
        await self.event_bus.subscribe(
            EventType.ERROR,
            self._handle_error
        )
        
        # Start training loop
        asyncio.create_task(self._training_loop())
        logger.info("Learning manager started")
    
    async def stop(self):
        """Stop learning system"""
        self._running = False
        logger.info("Learning manager stopped")
    
    async def _training_loop(self):
        """Background training loop"""
        while self._running:
            try:
                metrics = await self.rl.train()
                self.metrics['training_episodes'] += 1
                
                # Log progress periodically
                if self.metrics['training_episodes'] % 100 == 0:
                    logger.info(
                        f"Training progress: episodes={self.metrics['training_episodes']}, "
                        f"avg_reward={self.metrics['avg_reward']:.3f}, "
                        f"epsilon={metrics['epsilon']:.3f}"
                    )
                
                await asyncio.sleep(1)  # Prevent CPU overload
                
            except Exception as e:
                logger.error(f"Training error: {e}")
                await asyncio.sleep(5)  # Back off on error
    
    async def _handle_command(self, event: Event):
        """Handle incoming command event"""
        async with self._lock:
            # Build state representation
            self._current_state = self._build_state(event)
            
            # Get action from RL system
            self._current_action = await self.rl.get_action(self._current_state)
            
            # Apply action
            await self._apply_action(self._current_action, event)
    
    async def _handle_response(self, event: Event):
        """Handle response event and calculate reward"""
        if not self._current_state or not self._current_action:
            return
            
        async with self._lock:
            # Build next state
            next_state = self._build_state(event)
            
            # Calculate reward
            reward = self._calculate_reward(event)
            
            # Update metrics
            self.metrics['total_experiences'] += 1
            self.metrics['total_rewards'] += reward
            self.metrics['avg_reward'] = (
                self.metrics['total_rewards'] / self.metrics['total_experiences']
            )
            
            # Add experience
            await self.rl.add_experience(
                state=self._current_state,
                action=self._current_action,
                reward=reward,
                next_state=next_state,
                metadata={
                    'command_id': event.metadata.get('command_id'),
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Reset current state/action
            self._current_state = None
            self._current_action = None
    
    async def _handle_error(self, event: Event):
        """Handle error events"""
        if not self._current_state or not self._current_action:
            return
            
        async with self._lock:
            # Build error state
            error_state = self._build_state(event)
            
            # Add negative experience
            await self.rl.add_experience(
                state=self._current_state,
                action=self._current_action,
                reward=-1.0,  # Penalty for error
                next_state=error_state,
                metadata={
                    'error': str(event.payload.get('error')),
                    'command_id': event.metadata.get('command_id'),
                    'timestamp': datetime.now().isoformat()
                }
            )
            
            # Reset current state/action
            self._current_state = None
            self._current_action = None
    
    def _build_state(self, event: Event) -> Dict[str, Any]:
        """Build state representation from event"""
        return {
            'emotional_state': event.metadata.get('emotional_state', {}),
            'memory_state': {
                'working_memory_load': event.metadata.get('memory_load', 0.0),
                'long_term_memory_access': event.metadata.get('memory_access', 0.0)
            },
            'task_context': {
                'complexity': self._estimate_complexity(event),
                'urgency': event.metadata.get('urgency', 0.5),
                'importance': event.metadata.get('importance', 0.5)
            },
            'performance_metrics': {
                'avg_reward': self.metrics['avg_reward'],
                'total_experiences': self.metrics['total_experiences']
            }
        }
    
    def _estimate_complexity(self, event: Event) -> float:
        """Estimate task complexity from event"""
        payload = event.payload or {}
        
        # Factors that indicate complexity
        factors = [
            len(str(payload.get('command', ''))) / 1000,  # Length of command
            len(payload.get('context', [])) / 10,  # Amount of context
            payload.get('difficulty', 0.0),  # Explicit difficulty
            0.5  # Base complexity
        ]
        
        return min(1.0, sum(factors) / len(factors))
    
    def _calculate_reward(self, event: Event) -> float:
        """Calculate reward from response event"""
        payload = event.payload or {}
        
        # Reward components
        components = [
            payload.get('success', False) * 1.0,  # Success/failure
            payload.get('satisfaction', 0.0),  # User satisfaction
            payload.get('efficiency', 0.0),  # Processing efficiency
            -payload.get('error_count', 0) * 0.1  # Penalties for errors
        ]
        
        # Weighted sum of components
        weights = [0.4, 0.3, 0.2, 0.1]
        reward = sum(c * w for c, w in zip(components, weights))
        
        return max(-1.0, min(1.0, reward))  # Clamp to [-1, 1]
    
    async def _apply_action(self, action: str, event: Event):
        """Apply selected action to event processing"""
        if action == 'request_clarification':
            # Request more information
            await self.event_bus.publish(Event(
                type=EventType.CLARIFICATION,
                payload={'command_id': event.metadata.get('command_id')},
                source='learning_manager'
            ))
            
        elif action == 'delegate_subtask':
            # Break task into subtasks
            await self.event_bus.publish(Event(
                type=EventType.DELEGATE,
                payload={'command_id': event.metadata.get('command_id')},
                source='learning_manager'
            ))
            
        elif action == 'optimize_resource_usage':
            # Adjust resource allocation
            await self.event_bus.publish(Event(
                type=EventType.OPTIMIZE,
                payload={'command_id': event.metadata.get('command_id')},
                source='learning_manager'
            ))
            
        elif action == 'engage_safety_protocol':
            # Enable additional safety checks
            await self.event_bus.publish(Event(
                type=EventType.SAFETY,
                payload={'command_id': event.metadata.get('command_id')},
                source='learning_manager'
            ))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get learning system statistics"""
        return {
            **self.metrics,
            'rl_stats': self.rl.get_stats(),
            'running': self._running,
            'base_dir': str(self.base_dir)
        }
