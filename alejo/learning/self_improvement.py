"""
Self-improvement system for ALEJO that coordinates learning, error recovery, and adaptation
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from alejo.utils.error_handling import ErrorTracker
from alejo.learning.interactive_learner import InteractiveLearner
from alejo.emotional_intelligence.emotional_core import EmotionalCore
from alejo.emotional_intelligence.models.emotional_memory import EmotionalMemoryService
from alejo.core.event_bus import EventBus, Event, EventType

logger = logging.getLogger(__name__)

@dataclass
class ImprovementMetrics:
    """Metrics tracking ALEJO's self-improvement progress"""
    error_recovery_rate: float  # Percentage of errors successfully recovered from
    learning_efficiency: float  # Rate of successful pattern recognition
    emotional_adaptation: float  # Effectiveness of emotional response adjustments
    performance_score: float    # Overall system performance metric
    timestamp: datetime

@dataclass
class AdaptationStrategy:
    """Strategy for adapting system behavior"""
    component: str
    trigger_condition: Dict[str, Any]
    adaptation_actions: List[str]
    success_criteria: Dict[str, Any]
    priority: int

class SelfImprovementSystem:
    """
    Coordinates self-improvement across ALEJO's systems
    
    Features:
    - Automated error detection and recovery
    - Pattern-based learning from interactions
    - Emotional intelligence adaptation
    - Performance optimization
    - Code analysis and automated fixes
    """
    
    def __init__(self, 
                 event_bus: EventBus,
                 error_tracker: Optional[ErrorTracker] = None,
                 interactive_learner: Optional[InteractiveLearner] = None,
                 emotional_core: Optional[EmotionalCore] = None,
                 emotional_memory: Optional[EmotionalMemoryService] = None):
        """Initialize the self-improvement system"""
        self.event_bus = event_bus
        self.error_tracker = error_tracker or ErrorTracker()
        self.interactive_learner = interactive_learner or InteractiveLearner()
        self.emotional_core = emotional_core or EmotionalCore()
        self.emotional_memory = emotional_memory or EmotionalMemoryService()
        
        # Initialize improvement tracking
        self.metrics_history: List[ImprovementMetrics] = []
        self.adaptation_strategies: Dict[str, AdaptationStrategy] = {}
        self.active_adaptations: Dict[str, datetime] = {}
        
        # Load initial adaptation strategies
        self._init_adaptation_strategies()
        
        logger.info("Self-improvement system initialized")
    
    def _init_adaptation_strategies(self):
        """Initialize the catalog of adaptation strategies"""
        self.adaptation_strategies.update({
            "error_pattern_adaptation": AdaptationStrategy(
                component="error_handling",
                trigger_condition={
                    "error_type": "recurring",
                    "frequency_threshold": 3,
                    "time_window": 3600  # 1 hour
                },
                adaptation_actions=[
                    "analyze_error_patterns",
                    "update_recovery_strategy",
                    "adjust_monitoring_threshold"
                ],
                success_criteria={
                    "error_reduction": 0.5,  # 50% reduction in error frequency
                    "recovery_rate": 0.8     # 80% successful recovery rate
                },
                priority=1
            ),
            "emotional_response_adaptation": AdaptationStrategy(
                component="emotional_intelligence",
                trigger_condition={
                    "feedback_type": "emotional_mismatch",
                    "mismatch_threshold": 0.3
                },
                adaptation_actions=[
                    "analyze_emotional_patterns",
                    "adjust_response_parameters",
                    "update_emotional_baseline"
                ],
                success_criteria={
                    "response_accuracy": 0.8,
                    "user_satisfaction": 0.7
                },
                priority=2
            ),
            "performance_optimization": AdaptationStrategy(
                component="system",
                trigger_condition={
                    "metric_type": "performance_degradation",
                    "threshold": 0.2  # 20% degradation
                },
                adaptation_actions=[
                    "analyze_performance_bottlenecks",
                    "optimize_resource_usage",
                    "adjust_processing_parameters"
                ],
                success_criteria={
                    "performance_improvement": 0.15,  # 15% improvement
                    "stability_duration": 3600        # 1 hour
                },
                priority=3
            )
        })
    
    async def monitor_and_improve(self):
        """Main improvement loop that monitors system health and triggers adaptations"""
        while True:
            try:
                # Collect current metrics
                metrics = await self._collect_system_metrics()
                self.metrics_history.append(metrics)
                
                # Check for adaptation triggers
                for strategy_id, strategy in self.adaptation_strategies.items():
                    if await self._should_adapt(strategy):
                        await self._apply_adaptation(strategy_id, strategy)
                
                # Evaluate active adaptations
                await self._evaluate_adaptations()
                
                # Emit improvement metrics event
                await self.event_bus.emit(Event(
                    type=EventType.SYSTEM_IMPROVEMENT_UPDATE,
                    data={"metrics": metrics}
                ))
                
                # Sleep before next iteration
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error in improvement loop: {e}")
                await asyncio.sleep(5)  # Brief pause before retry
    
    async def _collect_system_metrics(self) -> ImprovementMetrics:
        """Collect current system performance metrics"""
        error_stats = self.error_tracker.get_statistics()
        learning_stats = self.interactive_learner.get_learning_metrics()
        emotional_stats = await self.emotional_core.get_adaptation_metrics()
        
        return ImprovementMetrics(
            error_recovery_rate=error_stats.get("recovery_rate", 0.0),
            learning_efficiency=learning_stats.get("pattern_recognition_rate", 0.0),
            emotional_adaptation=emotional_stats.get("adaptation_success_rate", 0.0),
            performance_score=self._calculate_performance_score(
                error_stats, learning_stats, emotional_stats
            ),
            timestamp=datetime.now()
        )
    
    def _calculate_performance_score(self, 
                                  error_stats: Dict[str, float],
                                  learning_stats: Dict[str, float],
                                  emotional_stats: Dict[str, float]) -> float:
        """Calculate overall system performance score"""
        # Weighted average of key metrics
        weights = {
            "error_recovery": 0.3,
            "learning": 0.3,
            "emotional": 0.2,
            "resource": 0.2
        }
        
        score = (
            weights["error_recovery"] * error_stats.get("recovery_rate", 0.0) +
            weights["learning"] * learning_stats.get("success_rate", 0.0) +
            weights["emotional"] * emotional_stats.get("accuracy", 0.0) +
            weights["resource"] * (1.0 - error_stats.get("resource_usage", 0.0))
        )
        
        return max(0.0, min(1.0, score))  # Ensure score is between 0 and 1
    
    async def _should_adapt(self, strategy: AdaptationStrategy) -> bool:
        """Determine if an adaptation strategy should be triggered"""
        if strategy.component == "error_handling":
            return await self._check_error_trigger(strategy.trigger_condition)
        elif strategy.component == "emotional_intelligence":
            return await self._check_emotional_trigger(strategy.trigger_condition)
        elif strategy.component == "system":
            return await self._check_performance_trigger(strategy.trigger_condition)
        return False
    
    async def _apply_adaptation(self, strategy_id: str, strategy: AdaptationStrategy):
        """Apply an adaptation strategy"""
        logger.info(f"Applying adaptation strategy: {strategy_id}")
        
        try:
            # Record adaptation start
            self.active_adaptations[strategy_id] = datetime.now()
            
            # Execute adaptation actions
            for action in strategy.adaptation_actions:
                if action == "analyze_error_patterns":
                    await self._analyze_and_update_error_patterns()
                elif action == "analyze_emotional_patterns":
                    await self._analyze_and_update_emotional_patterns()
                elif action == "analyze_performance_bottlenecks":
                    await self._analyze_and_optimize_performance()
                
            # Emit adaptation event
            await self.event_bus.emit(Event(
                type=EventType.SYSTEM_ADAPTATION_APPLIED,
                data={
                    "strategy_id": strategy_id,
                    "component": strategy.component,
                    "actions": strategy.adaptation_actions
                }
            ))
            
        except Exception as e:
            logger.error(f"Error applying adaptation {strategy_id}: {e}")
            self.active_adaptations.pop(strategy_id, None)
    
    async def _evaluate_adaptations(self):
        """Evaluate the success of active adaptations"""
        current_time = datetime.now()
        completed_adaptations = []
        
        for strategy_id, start_time in self.active_adaptations.items():
            strategy = self.adaptation_strategies.get(strategy_id)
            if not strategy:
                completed_adaptations.append(strategy_id)
                continue
                
            # Check if success criteria are met
            if await self._check_adaptation_success(strategy):
                logger.info(f"Adaptation {strategy_id} succeeded")
                completed_adaptations.append(strategy_id)
                
            # Check for timeout (24 hours)
            elif (current_time - start_time).total_seconds() > 86400:
                logger.warning(f"Adaptation {strategy_id} timed out")
                completed_adaptations.append(strategy_id)
        
        # Remove completed adaptations
        for strategy_id in completed_adaptations:
            self.active_adaptations.pop(strategy_id, None)
    
    async def _analyze_and_update_error_patterns(self):
        """Analyze error patterns and update recovery strategies"""
        error_patterns = self.error_tracker.analyze_error_patterns()
        
        for pattern in error_patterns:
            if pattern.frequency > pattern.threshold:
                # Create or update recovery strategy
                recovery_strategy = {
                    "error_type": pattern.error_type,
                    "conditions": pattern.conditions,
                    "actions": pattern.suggested_actions,
                    "priority": pattern.severity
                }
                self.error_tracker.update_recovery_strategy(
                    pattern.error_type, recovery_strategy
                )
    
    async def _analyze_and_update_emotional_patterns(self):
        """Analyze emotional interaction patterns and update response parameters"""
        patterns = await self.emotional_memory.analyze_patterns()
        
        for pattern in patterns:
            if pattern.confidence > 0.7:  # High confidence threshold
                # Update emotional response parameters
                await self.emotional_core.update_response_parameters(
                    pattern.context,
                    pattern.suggested_parameters
                )
    
    async def _analyze_and_optimize_performance(self):
        """Analyze performance bottlenecks and optimize system parameters"""
        # Collect performance data
        metrics = await self._collect_system_metrics()
        
        # Identify bottlenecks
        if metrics.performance_score < 0.7:  # Performance threshold
            # Adjust resource allocation
            if metrics.error_recovery_rate < 0.8:
                self.error_tracker.adjust_monitoring_frequency()
            
            # Optimize learning parameters
            if metrics.learning_efficiency < 0.7:
                self.interactive_learner.optimize_pattern_recognition()
            
            # Tune emotional processing
            if metrics.emotional_adaptation < 0.7:
                await self.emotional_core.optimize_processing_parameters()
    
    async def _check_error_trigger(self, condition: Dict[str, Any]) -> bool:
        """Check if error-related adaptation should be triggered"""
        stats = self.error_tracker.get_statistics()
        return (
            stats.get("error_frequency", 0) > condition["frequency_threshold"] and
            stats.get("time_window", 0) <= condition["time_window"]
        )
    
    async def _check_emotional_trigger(self, condition: Dict[str, Any]) -> bool:
        """Check if emotional adaptation should be triggered"""
        stats = await self.emotional_core.get_adaptation_metrics()
        return stats.get("mismatch_rate", 0) > condition["mismatch_threshold"]
    
    async def _check_performance_trigger(self, condition: Dict[str, Any]) -> bool:
        """Check if performance adaptation should be triggered"""
        if len(self.metrics_history) < 2:
            return False
            
        current = self.metrics_history[-1].performance_score
        baseline = self.metrics_history[-2].performance_score
        
        degradation = (baseline - current) / baseline if baseline > 0 else 0
        return degradation > condition["threshold"]
    
    async def _check_adaptation_success(self, strategy: AdaptationStrategy) -> bool:
        """Check if an adaptation strategy has met its success criteria"""
        if strategy.component == "error_handling":
            stats = self.error_tracker.get_statistics()
            return (
                stats.get("error_reduction", 0) >= strategy.success_criteria["error_reduction"] and
                stats.get("recovery_rate", 0) >= strategy.success_criteria["recovery_rate"]
            )
        elif strategy.component == "emotional_intelligence":
            stats = await self.emotional_core.get_adaptation_metrics()
            return (
                stats.get("response_accuracy", 0) >= strategy.success_criteria["response_accuracy"] and
                stats.get("user_satisfaction", 0) >= strategy.success_criteria["user_satisfaction"]
            )
        elif strategy.component == "system":
            if len(self.metrics_history) < 2:
                return False
                
            improvement = (
                self.metrics_history[-1].performance_score -
                self.metrics_history[-2].performance_score
            )
            return improvement >= strategy.success_criteria["performance_improvement"]
            
        return False
