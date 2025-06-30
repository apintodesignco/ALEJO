"""
Ethical Integration module for ALEJO

Provides a dedicated interface for ethical decision making capabilities
and integration with the broader ALEJO system.
"""

import os
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
import time
import json

from ..core.event_bus import EventBus
from ..core.brain import ALEJOBrain
from ..database.memory_store import MemoryStore
from .ethics import (
    EthicalFramework, EthicalDecision, EmotionalEthicsEvaluation,
    EthicalPrinciple, EmotionalRiskLevel, EmotionalRisk
)
from ..utils.error_handling import handle_errors
from ..utils.exceptions import EthicalEvaluationError

logger = logging.getLogger("alejo.emotional_intelligence.ethical_integration")


class EthicalIntegration:
    """
    Dedicated interface for ethical decision making capabilities
    
    This class provides a comprehensive integration of the ethical framework
    with the rest of the ALEJO system, enabling ethical evaluation of actions,
    emotional responses, and decision making.
    """
    
    def __init__(
        self,
        brain: Optional[ALEJOBrain] = None,
        event_bus: Optional[EventBus] = None,
        memory_store: Optional[MemoryStore] = None,
        ethical_framework: Optional[EthicalFramework] = None,
        config_path: Optional[str] = None,
        db_path: Optional[str] = None
    ):
        """
        Initialize the ethical integration
        
        Args:
            brain: ALEJOBrain instance
            event_bus: EventBus instance for system-wide communication
            memory_store: Memory store for persistent storage
            ethical_framework: EthicalFramework instance
            config_path: Path to configuration file
            db_path: Path to ethics database file
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.memory_store = memory_store or (brain.memory_store if brain else None)
        
        # Initialize ethical framework
        self.ethical_framework = ethical_framework or EthicalFramework()
        if db_path:
            self.ethical_framework.initialize_database(db_path)
        
        # Configuration
        self.config = self._load_config(config_path)
        
        # Register event handlers
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Ethical Integration initialized")
    
    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        config = {
            "ethical_evaluation_threshold": 0.8,  # Threshold for ethical evaluations
            "ethical_logging_enabled": True,      # Whether to log ethical decisions
            "ethical_principles_weights": {       # Weights for different principles
                "AUTONOMY": 1.0,
                "BENEFICENCE": 1.0,
                "NON_MALEFICENCE": 1.2,          # Slightly higher weight for avoiding harm
                "JUSTICE": 1.0,
                "PRIVACY": 1.1,                  # Slightly higher weight for privacy
                "TRANSPARENCY": 1.0,
                "EMOTIONAL_HONESTY": 0.9,
                "EMOTIONAL_RESPECT": 1.0,
                "PROPORTIONALITY": 0.9,
                "CULTURAL_SENSITIVITY": 1.1       # Slightly higher weight for cultural sensitivity
            },
            "risk_level_thresholds": {           # Thresholds for different risk levels
                "LOW": 0.3,
                "MODERATE": 0.5,
                "HIGH": 0.7,
                "CRITICAL": 0.9
            },
            "export_path": "ethics_exports",      # Path for exporting ethics data
            "history_capacity": 1000             # Number of decisions/evaluations to keep in memory
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    loaded_config = json.load(f)
                    # Update nested dictionaries properly
                    for key, value in loaded_config.items():
                        if isinstance(value, dict) and key in config and isinstance(config[key], dict):
                            config[key].update(value)
                        else:
                            config[key] = value
            except Exception as e:
                logger.error(f"Failed to load config from {config_path}: {e}")
        
        return config
    
    def _register_event_handlers(self):
        """Register event handlers with the event bus"""
        self.event_bus.subscribe("brain.evaluate_ethics", self._handle_evaluate_ethics)
        self.event_bus.subscribe("brain.evaluate_decision", self._handle_evaluate_decision)
        self.event_bus.subscribe("brain.evaluate_emotional_response", self._handle_evaluate_emotional_response)
        self.event_bus.subscribe("brain.get_ethical_stats", self._handle_get_ethical_stats)
    
    async def initialize(self) -> None:
        """Initialize ethical integration components asynchronously"""
        logger.info("Initializing ethical integration components...")
        
        # Set up event listeners
        if self.event_bus:
            self._register_event_handlers()
            
        logger.info("Ethical integration components initialized successfully")
    
    @handle_errors(EthicalEvaluationError)
    async def _handle_evaluate_ethics(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle ethical evaluation events
        
        Args:
            event_data: Event data containing emotional state and context
            
        Returns:
            Dictionary with ethical evaluation results
        """
        emotional_state = event_data.get("emotional_state", {})
        context = event_data.get("context", {})
        
        evaluation = self.ethical_framework.evaluate_emotional_ethics(emotional_state, context)
        
        return {
            "evaluation": {
                "overall_score": evaluation.overall_ethical_score,
                "identified_risks": [
                    {
                        "type": risk.risk_type,
                        "description": risk.description,
                        "level": risk.level.name,
                        "mitigation": risk.mitigation_strategy
                    } for risk in evaluation.identified_risks
                ],
                "recommendations": evaluation.recommendations,
                "transparency_report": evaluation.transparency_report,
                "timestamp": evaluation.timestamp.isoformat()
            }
        }
    
    @handle_errors(EthicalEvaluationError)
    async def _handle_evaluate_decision(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle decision evaluation events
        
        Args:
            event_data: Event data containing action, context, and emotional context
            
        Returns:
            Dictionary with decision evaluation results
        """
        action = event_data.get("action", "")
        context = event_data.get("context", {})
        emotional_context = event_data.get("emotional_context", {})
        
        decision = self.ethical_framework.evaluate_decision(action, context, emotional_context)
        
        return {
            "decision": {
                "action": decision.action,
                "overall_score": decision.overall_score,
                "reasoning": decision.reasoning,
                "recommendation": decision.recommendation,
                "principles_evaluation": decision.principles_evaluation,
                "timestamp": decision.timestamp.isoformat()
            }
        }
    
    @handle_errors(EthicalEvaluationError)
    async def _handle_evaluate_emotional_response(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle emotional response evaluation events
        
        Args:
            event_data: Event data containing response text, emotional state, and context
            
        Returns:
            Dictionary with emotional response evaluation results
        """
        response_text = event_data.get("response_text", "")
        emotional_state = event_data.get("emotional_state", {})
        context = event_data.get("context", {})
        
        evaluation = self.ethical_framework.evaluate_emotional_response(
            response_text, emotional_state, context
        )
        
        return {"evaluation": evaluation}
    
    @handle_errors(EthicalEvaluationError)
    async def _handle_get_ethical_stats(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle requests for ethical statistics
        
        Args:
            event_data: Event data containing optional filters
            
        Returns:
            Dictionary with ethical statistics
        """
        stats = self.ethical_framework.get_ethical_principle_stats()
        
        # Get recent decisions and evaluations
        limit = event_data.get("limit", 10)
        recent_decisions = self.ethical_framework.get_recent_decisions(limit)
        recent_evaluations = self.ethical_framework.get_recent_evaluations(limit)
        
        return {
            "stats": stats,
            "recent_decisions": [
                {
                    "action": decision.action,
                    "overall_score": decision.overall_score,
                    "timestamp": decision.timestamp.isoformat()
                } for decision in recent_decisions
            ],
            "recent_evaluations": [
                {
                    "overall_score": eval.overall_ethical_score,
                    "timestamp": eval.timestamp.isoformat()
                } for eval in recent_evaluations
            ]
        }
    
    @handle_errors(EthicalEvaluationError)
    async def evaluate_ethics(
        self,
        emotional_state: Dict[str, float],
        context: Dict[str, Any]
    ) -> EmotionalEthicsEvaluation:
        """
        Evaluate the ethical implications of an emotional state
        
        Args:
            emotional_state: Dictionary mapping emotions to intensity values
            context: Dictionary with contextual information
            
        Returns:
            EmotionalEthicsEvaluation object with evaluation results
        """
        return self.ethical_framework.evaluate_emotional_ethics(emotional_state, context)
    
    @handle_errors(EthicalEvaluationError)
    async def evaluate_decision(
        self,
        action: str,
        context: Dict[str, Any],
        emotional_context: Optional[Dict[str, Any]] = None
    ) -> EthicalDecision:
        """
        Evaluate an action for ethical alignment
        
        Args:
            action: Description of the action to evaluate
            context: Dictionary with contextual information
            emotional_context: Optional emotional context
            
        Returns:
            EthicalDecision object with evaluation results
        """
        return self.ethical_framework.evaluate_decision(action, context, emotional_context)
    
    @handle_errors(EthicalEvaluationError)
    async def evaluate_emotional_response(
        self,
        response_text: str,
        emotional_state: Dict[str, float],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluate an emotional response for ethical considerations
        
        Args:
            response_text: Text of the response to evaluate
            emotional_state: Dictionary mapping emotions to intensity values
            context: Dictionary with contextual information
            
        Returns:
            Dictionary with evaluation results
        """
        return self.ethical_framework.evaluate_emotional_response(
            response_text, emotional_state, context
        )
    
    async def export_ethics_data(self, export_dir: Optional[str] = None) -> Tuple[bool, str]:
        """
        Export ethics data for analysis
        
        Args:
            export_dir: Directory to export data to
            
        Returns:
            Tuple of (success, message)
        """
        export_dir = export_dir or self.config.get("export_path", "ethics_exports")
        
        # Create export directory if it doesn't exist
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Export decision history
        decision_path = os.path.join(export_dir, f"decisions_{timestamp}.json")
        decision_success = self.ethical_framework.export_decision_history(decision_path)
        
        # Export evaluation history
        eval_path = os.path.join(export_dir, f"evaluations_{timestamp}.json")
        eval_success = self.ethical_framework.export_ethics_evaluation_history(eval_path)
        
        if decision_success and eval_success:
            return True, f"Ethics data exported successfully to {export_dir}"
        elif decision_success:
            return True, f"Decision history exported successfully, but evaluation export failed"
        elif eval_success:
            return True, f"Evaluation history exported successfully, but decision export failed"
        else:
            return False, "Failed to export ethics data"
    
    async def get_ethical_principle_stats(self) -> Dict[str, Dict[str, float]]:
        """
        Get statistics on ethical principle evaluations
        
        Returns:
            Dictionary with statistics for each principle
        """
        return self.ethical_framework.get_ethical_principle_stats()
    
    async def get_recent_decisions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent ethical decisions
        
        Args:
            limit: Maximum number of decisions to retrieve
            
        Returns:
            List of recent decisions as dictionaries
        """
        decisions = self.ethical_framework.get_recent_decisions(limit)
        return [
            {
                "action": decision.action,
                "context": decision.context,
                "overall_score": decision.overall_score,
                "reasoning": decision.reasoning,
                "recommendation": decision.recommendation,
                "timestamp": decision.timestamp.isoformat()
            }
            for decision in decisions
        ]
    
    async def get_recent_evaluations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent emotional ethics evaluations
        
        Args:
            limit: Maximum number of evaluations to retrieve
            
        Returns:
            List of recent evaluations as dictionaries
        """
        evaluations = self.ethical_framework.get_recent_evaluations(limit)
        return [
            {
                "overall_score": eval.overall_ethical_score,
                "context": eval.context,
                "recommendations": eval.recommendations,
                "timestamp": eval.timestamp.isoformat()
            }
            for eval in evaluations
        ]
