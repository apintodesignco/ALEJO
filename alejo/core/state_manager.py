"""
State management and recovery system for ALEJO
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class SystemState(Enum):
    INITIALIZING = "initializing"
    READY = "ready"
    PROCESSING = "processing"
    DEGRADED = "degraded"
    ERROR = "error"
    RECOVERING = "recovering"
    MAINTENANCE = "maintenance"

@dataclass
class ServiceHealth:
    """Health status of a service"""
    status: bool
    last_check: float
    error_count: int
    response_time: float
    memory_usage: float
    cpu_usage: float

class StateManager:
    """
    Manages ALEJO's system state, health monitoring, and recovery
    """
    
    def __init__(self):
        self.current_state = SystemState.INITIALIZING
        self.service_health: Dict[str, ServiceHealth] = {}
        self.state_history: List[Dict[str, Any]] = []
        self.error_threshold = 5
        self.recovery_attempts = 0
        self.max_recovery_attempts = 3
        self._lock = asyncio.Lock()
        
    async def transition_state(self, new_state: SystemState, reason: str = None):
        """
        Safely transition system state with logging and validation
        """
        async with self._lock:
            old_state = self.current_state
            self.current_state = new_state
            
            # Record state transition
            transition = {
                "timestamp": datetime.utcnow().isoformat(),
                "from_state": old_state.value,
                "to_state": new_state.value,
                "reason": reason
            }
            self.state_history.append(transition)
            
            logger.info(f"State transition: {old_state.value} -> {new_state.value} ({reason})")
            
            # Trigger recovery if entering error state
            if new_state == SystemState.ERROR:
                await self._trigger_recovery()
    
    async def update_service_health(self, service_name: str, health_data: Dict[str, Any]):
        """
        Update health status for a service
        """
        async with self._lock:
            self.service_health[service_name] = ServiceHealth(
                status=health_data.get("status", False),
                last_check=datetime.utcnow().timestamp(),
                error_count=health_data.get("error_count", 0),
                response_time=health_data.get("response_time", 0.0),
                memory_usage=health_data.get("memory_usage", 0.0),
                cpu_usage=health_data.get("cpu_usage", 0.0)
            )
            
            # Check for degraded state
            unhealthy_services = [
                s for s in self.service_health.values()
                if not s.status or s.error_count > self.error_threshold
            ]
            
            if unhealthy_services and self.current_state != SystemState.ERROR:
                await self.transition_state(
                    SystemState.DEGRADED,
                    f"Unhealthy services: {len(unhealthy_services)}"
                )
    
    async def _trigger_recovery(self):
        """
        Attempt system recovery when in error state
        """
        if self.recovery_attempts >= self.max_recovery_attempts:
            logger.error("Max recovery attempts reached, manual intervention required")
            await self.transition_state(
                SystemState.MAINTENANCE,
                "Max recovery attempts exceeded"
            )
            return
        
        self.recovery_attempts += 1
        await self.transition_state(
            SystemState.RECOVERING,
            f"Recovery attempt {self.recovery_attempts}"
        )
        
        try:
            # Reset error counters
            for service in self.service_health:
                self.service_health[service].error_count = 0
            
            # Wait for services to stabilize
            await asyncio.sleep(5)
            
            # Check system health
            unhealthy_services = [
                s for s in self.service_health.values()
                if not s.status
            ]
            
            if not unhealthy_services:
                await self.transition_state(
                    SystemState.READY,
                    "Recovery successful"
                )
                self.recovery_attempts = 0
            else:
                await self.transition_state(
                    SystemState.ERROR,
                    f"Recovery failed: {len(unhealthy_services)} services still unhealthy"
                )
                
        except Exception as e:
            logger.error(f"Recovery failed: {e}")
            await self.transition_state(
                SystemState.ERROR,
                f"Recovery error: {str(e)}"
            )
    
    def get_system_status(self) -> Dict[str, Any]:
        """
        Get current system status and health metrics
        """
        return {
            "state": self.current_state.value,
            "service_health": {
                name: {
                    "status": health.status,
                    "last_check": health.last_check,
                    "error_count": health.error_count,
                    "response_time": health.response_time,
                    "memory_usage": health.memory_usage,
                    "cpu_usage": health.cpu_usage
                }
                for name, health in self.service_health.items()
            },
            "recovery_attempts": self.recovery_attempts,
            "state_history": self.state_history[-10:]  # Last 10 transitions
        }
    
    async def start(self):
        """
        Initialize the state manager
        """
        await self.transition_state(SystemState.READY, "System startup complete")
    
    async def stop(self):
        """
        Clean shutdown of state manager
        """
        await self.transition_state(SystemState.MAINTENANCE, "System shutdown")
