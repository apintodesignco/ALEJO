"""
ALEJO Brain Integration Module

Connects and orchestrates all brain components including:
- Core ALEJOBrain
- Darwin Gödel Machine
- Robotics Gateway
- Formal Verification
"""

import asyncio
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime

from .alejo_brain import ALEJOBrain
from .neuromorphic.darwin_godel_machine import DarwinGodelMachine
from ..robotics.gateway import RoboticsGateway, RoboticsProtocol
from ..core.self_evolution.godel_verification import GodelVerificationSystem
from ..core.self_evolution import get_evolution_manager
from ..emotional_intelligence.emotional_core import EmotionalCore
from ..config import ConfigManager

logger = logging.getLogger(__name__)

class BrainIntegration:
    """
    Integrates all brain components into a cohesive system with:
    - Self-evolution with formal verification
    - Robotic control with emotional intelligence
    - Neural processing with Gödel machine optimization
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.brain = ALEJOBrain(config)
        self.darwin_godel = DarwinGodelMachine()
        self.robotics = RoboticsGateway()
        self.godel_verification = GodelVerificationSystem()
        self.evolution_manager = get_evolution_manager()
        self.emotional_core = EmotionalCore()
        
    async def initialize(self):
        """Initialize all brain components"""
        # Initialize core brain
        if not getattr(self.brain, 'initialized', False):
            await self.brain.setup()
            
        # Initialize Darwin Gödel Machine
        await self.darwin_godel.initialize()
        
        # Initialize robotics with supported protocols
        await self.robotics.initialize([
            RoboticsProtocol.ROS2,
            RoboticsProtocol.LEROBOT
        ])
        
        # Register components with evolution manager
        self._register_components()
        
    def _register_components(self):
        """Register all components for evolution tracking"""
        components = {
            'brain': self.brain,
            'darwin_godel': self.darwin_godel,
            'robotics': self.robotics,
            'emotional_core': self.emotional_core
        }
        
        for name, component in components.items():
            self.evolution_manager.register_component(name, component)
            
    async def process_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process input through all brain components
        
        Args:
            input_data: Dict containing input type and data
            
        Returns:
            Dict containing processed results and actions
        """
        # Process through core brain
        brain_response = await self.brain.process_input(input_data)
        
        # Verify response with Gödel machine
        verification = await self.godel_verification.verify_evolution_task({
            'task_type': 'response_generation',
            'description': 'Verify brain response',
            'data': brain_response
        })
        
        if verification.is_valid:
            # Update emotional state
            await self.emotional_core.update_from_response(brain_response)
            
            # Check for robotic actions
            if 'robotic_action' in brain_response:
                await self.robotics.execute_action(brain_response['robotic_action'])
                
            # Allow Darwin Gödel Machine to optimize
            optimization = await self.darwin_godel.propose_optimization(
                'response_generation',
                str(brain_response)
            )
            
            if optimization:
                # Log optimization for future learning
                self.evolution_manager.add_task(
                    task_type="optimization",
                    description=f"Apply DGM optimization to response generation",
                    priority="medium"
                )
        
        return {
            'response': brain_response,
            'verification': verification,
            'emotional_state': await self.emotional_core.get_current_state()
        }
        
    async def optimize_system(self):
        """
        Trigger system-wide optimization using Darwin Gödel Machine
        and formal verification
        """
        while True:
            # Get current system state
            system_state = await self._get_system_state()
            
            # Look for optimization opportunities
            optimization = await self.darwin_godel.propose_optimization(
                'system',
                str(system_state)
            )
            
            if optimization:
                # Verify optimization
                verification = await self.godel_verification.verify_evolution_task({
                    'task_type': 'system_optimization',
                    'description': str(optimization),
                    'data': optimization
                })
                
                if verification.is_valid:
                    # Apply optimization
                    self.evolution_manager.add_task(
                        task_type="system_optimization",
                        description=f"Apply system-wide optimization",
                        priority="high"
                    )
            
            await asyncio.sleep(3600)  # Check hourly
            
    async def _get_system_state(self) -> Dict[str, Any]:
        """Get current state of all system components"""
        return {
            'brain_state': self.brain.get_state(),
            'emotional_state': await self.emotional_core.get_current_state(),
            'evolution_status': self.evolution_manager.get_evolution_status(),
            'robotics_status': self.robotics.active_protocols
        }
