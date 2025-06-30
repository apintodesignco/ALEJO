"""
Circuit breaker implementation for service calls
"""

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

class CircuitState(Enum):
    CLOSED = "closed"  # Normal operation
    OPEN = "open"     # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered

@dataclass
class CircuitStats:
    """Statistics for circuit breaker"""
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0
    last_success_time: float = 0
    total_calls: int = 0
    total_failures: int = 0
    avg_response_time: float = 0.0

class CircuitBreaker:
    """
    Circuit breaker pattern implementation for protecting services
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_timeout: float = 30.0,
        min_throughput: int = 10
    ):
        self.name = name
        self.state = CircuitState.CLOSED
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_timeout = half_open_timeout
        self.min_throughput = min_throughput
        
        self.stats = CircuitStats()
        self._lock = asyncio.Lock()
        self._last_state_change = time.time()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection
        """
        async with self._lock:
            await self._check_state_transition()
            
            if self.state == CircuitState.OPEN:
                raise CircuitBreakerError(
                    message=f"Circuit {self.name} is OPEN. Request rejected.",
                    circuit_name=self.name,
                    state=self.state,
                    stats=self.stats
                )
            
            try:
                start_time = time.time()
                result = await func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                await self._record_success(execution_time)
                return result
                
            except Exception as e:
                await self._record_failure(e)
                raise CircuitBreakerError(
                    message=f"Circuit {self.name} call failed: {str(e)}",
                    circuit_name=self.name,
                    state=self.state,
                    cause=e,
                    stats=self.stats
                ) from e
    
    async def _check_state_transition(self):
        """Check and update circuit state"""
        current_time = time.time()
        time_since_change = current_time - self._last_state_change
        
        if self.state == CircuitState.OPEN:
            if time_since_change >= self.recovery_timeout:
                await self._transition_state(CircuitState.HALF_OPEN)
                
        elif self.state == CircuitState.HALF_OPEN:
            if time_since_change >= self.half_open_timeout:
                if self.stats.success_count > 0:
                    await self._transition_state(CircuitState.CLOSED)
                else:
                    await self._transition_state(CircuitState.OPEN)
    
    async def _record_success(self, execution_time: float):
        """Record successful call"""
        self.stats.success_count += 1
        self.stats.total_calls += 1
        self.stats.last_success_time = time.time()
        
        # Update average response time
        self.stats.avg_response_time = (
            (self.stats.avg_response_time * (self.stats.total_calls - 1) + execution_time)
            / self.stats.total_calls
        )
        
        if self.state == CircuitState.HALF_OPEN:
            await self._transition_state(CircuitState.CLOSED)
    
    async def _record_failure(self, error: Exception):
        """Record failed call"""
        self.stats.failure_count += 1
        self.stats.total_calls += 1
        self.stats.total_failures += 1
        self.stats.last_failure_time = time.time()
        
        if (
            self.state == CircuitState.CLOSED
            and self.stats.total_calls >= self.min_throughput
            and self.stats.failure_count >= self.failure_threshold
        ):
            await self._transition_state(CircuitState.OPEN)
    
    async def _transition_state(self, new_state: CircuitState):
        """Transition circuit state"""
        old_state = self.state
        self.state = new_state
        self._last_state_change = time.time()
        
        # Reset counters on state change
        self.stats.failure_count = 0
        self.stats.success_count = 0
        
        logger.info(
            f"Circuit {self.name} state transition: {old_state.value} -> {new_state.value}"
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current circuit statistics"""
        return {
            "name": self.name,
            "state": self.state.value,
            "stats": {
                "total_calls": self.stats.total_calls,
                "total_failures": self.stats.total_failures,
                "current_failure_count": self.stats.failure_count,
                "current_success_count": self.stats.success_count,
                "avg_response_time": self.stats.avg_response_time,
                "last_failure": self.stats.last_failure_time,
                "last_success": self.stats.last_success_time
            },
            "config": {
                "failure_threshold": self.failure_threshold,
                "recovery_timeout": self.recovery_timeout,
                "half_open_timeout": self.half_open_timeout,
                "min_throughput": self.min_throughput
            }
        }

class CircuitBreakerError(Exception):
    """Error raised when circuit breaker prevents operation.
    
    Attributes:
        circuit_name (str): Name of the circuit breaker that raised the error
        state (CircuitState): State of the circuit breaker when error occurred
        message (str): Error message
        cause (Optional[Exception]): Original exception that caused the circuit breaker to trip
        stats (Optional[CircuitStats]): Circuit breaker statistics at time of error
    """
    
    def __init__(
        self,
        message: str,
        circuit_name: str,
        state: CircuitState,
        cause: Optional[Exception] = None,
        stats: Optional[CircuitStats] = None
    ):
        super().__init__(message)
        self.circuit_name = circuit_name
        self.state = state
        self.cause = cause
        self.stats = stats
        
    def __str__(self) -> str:
        error_parts = [f"Circuit Breaker '{self.circuit_name}' Error:"]
        
        # Add main error message
        error_parts.append(f"- {super().__str__()}")
        
        # Add circuit state
        error_parts.append(f"- Current state: {self.state.value}")
        
        # Add statistics if available
        if self.stats:
            error_parts.extend([
                "- Circuit Statistics:",
                f"  * Total calls: {self.stats.total_calls}",
                f"  * Recent failures: {self.stats.failure_count}",
                f"  * Recent successes: {self.stats.success_count}",
                f"  * Average response time: {self.stats.avg_response_time:.2f}s"
            ])
            
        # Add original error if available
        if self.cause:
            error_parts.append(f"- Original error: {str(self.cause)}")
            
        return '\n'.join(error_parts)
