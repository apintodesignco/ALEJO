"""
Self-healing system for ALEJO's core functionality.
Provides automated error recovery, adaptation, and system repair capabilities.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum

from alejo.core.event_bus import EventBus
from alejo.utils.error_handling import ErrorTracker
from alejo.services.self_improvement_service import SelfImprovementService

logger = logging.getLogger(__name__)

class HealingStrategy(Enum):
    """Types of healing strategies available"""
    RETRY = "retry"  # Simple retry with backoff
    FAILOVER = "failover"  # Switch to backup component
    RECONFIGURE = "reconfigure"  # Adjust configuration
    RESTART = "restart"  # Restart component
    DEGRADE = "degrade"  # Gracefully degrade functionality

@dataclass
class ComponentHealth:
    """Health status of a system component"""
    name: str
    status: str
    last_error: Optional[str] = None
    error_count: int = 0
    last_recovery: Optional[datetime] = None
    recovery_attempts: int = 0

class SelfHealingSystem:
    """
    Central system for managing ALEJO's self-healing capabilities.
    
    Features:
    - Automated error recovery
    - Component health monitoring
    - Adaptive healing strategies
    - Error pattern analysis
    - Graceful degradation
    """
    
    def __init__(self, event_bus: EventBus, improvement_service: Optional[SelfImprovementService] = None):
        """Initialize the self-healing system"""
        self.event_bus = event_bus
        self.improvement_service = improvement_service
        self.error_tracker = ErrorTracker()
        self.component_health: Dict[str, ComponentHealth] = {}
        self.healing_strategies: Dict[str, List[HealingStrategy]] = {}
        self.recovery_history: List[Dict[str, Any]] = []
        self._monitoring_task: Optional[asyncio.Task] = None
        
        # Register default healing strategies
        self._register_default_strategies()
    
    def _register_default_strategies(self):
        """Register default healing strategies for known components"""
        # LLM service strategies
        self.healing_strategies["llm_service"] = [
            HealingStrategy.RETRY,
            HealingStrategy.FAILOVER,
            HealingStrategy.DEGRADE
        ]
        
        # Database strategies
        self.healing_strategies["database"] = [
            HealingStrategy.RETRY,
            HealingStrategy.RECONFIGURE,
            HealingStrategy.RESTART
        ]
        
        # Event bus strategies
        self.healing_strategies["event_bus"] = [
            HealingStrategy.RETRY,
            HealingStrategy.RESTART,
            HealingStrategy.DEGRADE
        ]
    
    async def start_monitoring(self):
        """Start the health monitoring loop"""
        if self._monitoring_task:
            return
            
        async def monitor_loop():
            while True:
                try:
                    await self._check_component_health()
                    await asyncio.sleep(30)  # Check every 30 seconds
                except Exception as e:
                    logger.error(f"Error in health monitoring loop: {e}")
                    await asyncio.sleep(60)  # Back off on error
        
        self._monitoring_task = asyncio.create_task(monitor_loop())
    
    async def stop_monitoring(self):
        """Stop the health monitoring loop"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
            self._monitoring_task = None
    
    async def _check_component_health(self):
        """Check health of all registered components"""
        for component_id, health in self.component_health.items():
            if health.error_count > 0:
                await self._attempt_recovery(component_id)
    
    async def _attempt_recovery(self, component_id: str) -> bool:
        """
        Attempt to recover a failing component
        
        Args:
            component_id: ID of the component to recover
            
        Returns:
            bool: True if recovery was successful
        """
        health = self.component_health[component_id]
        
        # Don't attempt recovery too frequently
        if (health.last_recovery and 
            datetime.now() - health.last_recovery < timedelta(minutes=5)):
            return False
            
        # Get available strategies
        strategies = self.healing_strategies.get(component_id, [])
        if not strategies:
            logger.warning(f"No healing strategies registered for {component_id}")
            return False
            
        # Try each strategy in order
        for strategy in strategies:
            try:
                success = await self._apply_strategy(component_id, strategy)
                if success:
                    # Update health status
                    health.status = "healthy"
                    health.error_count = 0
                    health.last_recovery = datetime.now()
                    health.recovery_attempts += 1
                    
                    # Record successful recovery
                    self.recovery_history.append({
                        "component": component_id,
                        "strategy": strategy.value,
                        "timestamp": datetime.now(),
                        "success": True
                    })
                    
                    # Notify improvement service
                    if self.improvement_service:
                        await self.improvement_service.record_adaptation(
                            component=component_id,
                            trigger_type="recovery",
                            strategy=strategy.value
                        )
                    
                    return True
                    
            except Exception as e:
                logger.error(f"Recovery strategy {strategy} failed for {component_id}: {e}")
                continue
        
        return False
    
    async def _apply_strategy(self, component_id: str, strategy: HealingStrategy) -> bool:
        """
        Apply a healing strategy to a component
        
        Args:
            component_id: ID of the component to heal
            strategy: Strategy to apply
            
        Returns:
            bool: True if strategy was successfully applied
        """
        logger.info(f"Applying {strategy.value} strategy to {component_id}")
        
        if strategy == HealingStrategy.RETRY:
            # Implement exponential backoff retry
            return await self._retry_with_backoff(component_id)
            
        elif strategy == HealingStrategy.FAILOVER:
            # Switch to backup if available
            return await self._failover_component(component_id)
            
        elif strategy == HealingStrategy.RECONFIGURE:
            # Attempt to reconfigure the component
            return await self._reconfigure_component(component_id)
            
        elif strategy == HealingStrategy.RESTART:
            # Restart the component
            return await self._restart_component(component_id)
            
        elif strategy == HealingStrategy.DEGRADE:
            # Gracefully degrade functionality
            return await self._degrade_component(component_id)
            
        return False
    
    async def _retry_with_backoff(self, component_id: str) -> bool:
        """Implement retry with exponential backoff"""
        health = self.component_health[component_id]
        retry_count = 0
        max_retries = 3
        
        while retry_count < max_retries:
            try:
                # Attempt operation
                await self._test_component(component_id)
                return True
            except Exception as e:
                retry_count += 1
                if retry_count == max_retries:
                    logger.error(f"Max retries reached for {component_id}")
                    return False
                    
                # Exponential backoff
                await asyncio.sleep(2 ** retry_count)
        
        return False
    
    async def _failover_component(self, component_id: str) -> bool:
        """Switch to backup component if available"""
        # Implementation depends on component type
        if component_id == "llm_service":
            return await self._failover_llm()
        elif component_id == "database":
            return await self._failover_database()
        return False
    
    async def _reconfigure_component(self, component_id: str) -> bool:
        """Attempt to reconfigure a component with new settings"""
        try:
            if self.improvement_service:
                # Get new configuration from improvement service
                new_config = await self.improvement_service.get_component_config(component_id)
                if new_config:
                    # Apply new configuration
                    await self.event_bus.emit(
                        f"{component_id}_reconfigure",
                        {"config": new_config}
                    )
                    return True
        except Exception as e:
            logger.error(f"Reconfiguration failed for {component_id}: {e}")
        return False
    
    async def _restart_component(self, component_id: str) -> bool:
        """Restart a component"""
        try:
            # Signal component to shut down
            await self.event_bus.emit(f"{component_id}_shutdown", {})
            await asyncio.sleep(2)  # Wait for shutdown
            
            # Signal component to start
            await self.event_bus.emit(f"{component_id}_start", {})
            await asyncio.sleep(2)  # Wait for startup
            
            # Test component
            await self._test_component(component_id)
            return True
        except Exception as e:
            logger.error(f"Restart failed for {component_id}: {e}")
            return False
    
    async def _degrade_component(self, component_id: str) -> bool:
        """Gracefully degrade component functionality"""
        try:
            # Signal component to enter degraded mode
            await self.event_bus.emit(
                f"{component_id}_degrade",
                {"reason": "recovery_action"}
            )
            return True
        except Exception as e:
            logger.error(f"Degradation failed for {component_id}: {e}")
            return False
    
    async def _test_component(self, component_id: str) -> bool:
        """Test if a component is functioning"""
        try:
            # Emit test event and wait for response
            response = await self.event_bus.emit_and_wait(
                f"{component_id}_test",
                {},
                timeout=5.0
            )
            return response.get("status") == "ok"
        except Exception:
            return False
    
    async def _failover_llm(self) -> bool:
        """Implement LLM service failover"""
        try:
            await self.event_bus.emit("llm_failover", {})
            return True
        except Exception:
            return False
    
    async def _failover_database(self) -> bool:
        """Implement database failover"""
        try:
            await self.event_bus.emit("database_failover", {})
            return True
        except Exception:
            return False
    
    def register_component(self, component_id: str, strategies: Optional[List[HealingStrategy]] = None):
        """
        Register a component for health monitoring
        
        Args:
            component_id: ID of the component to monitor
            strategies: Optional list of healing strategies for this component
        """
        self.component_health[component_id] = ComponentHealth(
            name=component_id,
            status="healthy"
        )
        
        if strategies:
            self.healing_strategies[component_id] = strategies
    
    def report_error(self, component_id: str, error: Exception):
        """
        Report an error for a component
        
        Args:
            component_id: ID of the component that experienced the error
            error: The error that occurred
        """
        if component_id not in self.component_health:
            self.register_component(component_id)
            
        health = self.component_health[component_id]
        health.error_count += 1
        health.last_error = str(error)
        health.status = "error"
        
        # Track error pattern
        self.error_tracker.track_error(
            component_id,
            "component_error",
            error,
            {"health": health.__dict__}
        )
    
    def get_component_health(self, component_id: str) -> Optional[ComponentHealth]:
        """Get health status for a component"""
        return self.component_health.get(component_id)
    
    def get_all_health(self) -> Dict[str, ComponentHealth]:
        """Get health status for all components"""
        return self.component_health.copy()
    
    def get_recovery_history(self) -> List[Dict[str, Any]]:
        """Get history of recovery attempts"""
        return self.recovery_history.copy()
