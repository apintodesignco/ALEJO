"""
ALEJO Monitoring System
Handles system metrics, performance monitoring, and health checks
"""

import logging
import time
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import asyncio
import psutil
import json
from prometheus_client import Counter, Gauge, Histogram, start_http_server
from ..core.event_bus import EventBus, Event, EventType

logger = logging.getLogger(__name__)

@dataclass
class ServiceMetrics:
    """Metrics for a single service"""
    service_name: str
    response_times: List[float]
    error_count: int
    last_error: Optional[str]
    memory_usage: float
    cpu_usage: float
    event_count: int
    last_heartbeat: datetime

class MonitoringSystem:
    """
    Advanced monitoring system for ALEJO
    Handles metrics collection, health checks, and performance monitoring
    """
    
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.metrics: Dict[str, ServiceMetrics] = {}
        
        # Prometheus metrics
        self.response_time = Histogram(
            'alejo_response_time_seconds',
            'Response time in seconds',
            ['service', 'endpoint']
        )
        self.error_count = Counter(
            'alejo_error_total',
            'Total number of errors',
            ['service', 'type']
        )
        self.memory_usage = Gauge(
            'alejo_memory_bytes',
            'Memory usage in bytes',
            ['service']
        )
        self.cpu_usage = Gauge(
            'alejo_cpu_percent',
            'CPU usage percentage',
            ['service']
        )
        self.event_count = Counter(
            'alejo_events_total',
            'Total number of events',
            ['type', 'source']
        )
        
    async def start(self, metrics_port: int = 9090):
        """Start the monitoring system"""
        # Start Prometheus metrics server
        start_http_server(metrics_port)
        
        # Subscribe to system events
        self.event_bus.subscribe(EventType.SYSTEM, self._handle_system_event)
        
        # Start monitoring tasks
        asyncio.create_task(self._collect_system_metrics())
        asyncio.create_task(self._check_service_health())
        
        logger.info(f"Monitoring system started on port {metrics_port}")
        
    def record_request(self, service: str, endpoint: str, duration: float):
        """Record an API request"""
        self.response_time.labels(service=service, endpoint=endpoint).observe(duration)
        
    def record_error(self, service: str, error_type: str, error_msg: str):
        """Record an error occurrence"""
        self.error_count.labels(service=service, type=error_type).inc()
        
        if service in self.metrics:
            self.metrics[service].error_count += 1
            self.metrics[service].last_error = error_msg
            
    def record_event(self, event_type: str, source: str):
        """Record an event occurrence"""
        self.event_count.labels(type=event_type, source=source).inc()
        
    async def _collect_system_metrics(self):
        """Collect system metrics periodically"""
        while True:
            try:
                for service_name, metrics in self.metrics.items():
                    # Update memory usage
                    process = psutil.Process()
                    memory = process.memory_info().rss
                    cpu = process.cpu_percent()
                    
                    metrics.memory_usage = memory
                    metrics.cpu_usage = cpu
                    
                    self.memory_usage.labels(service=service_name).set(memory)
                    self.cpu_usage.labels(service=service_name).set(cpu)
                    
            except Exception as e:
                logger.error(f"Error collecting metrics: {e}")
                
            await asyncio.sleep(15)  # Collect every 15 seconds
            
    async def _check_service_health(self):
        """Check health of all services periodically"""
        while True:
            try:
                current_time = datetime.now()
                
                for service_name, metrics in self.metrics.items():
                    # Check if service is responding
                    if current_time - metrics.last_heartbeat > timedelta(minutes=1):
                        logger.warning(f"Service {service_name} may be down")
                        
                        # Emit system event
                        await self.event_bus.publish(Event.create(
                            type=EventType.SYSTEM,
                            payload={
                                "action": "service_warning",
                                "service": service_name,
                                "reason": "heartbeat_timeout"
                            },
                            source="monitoring"
                        ))
                        
            except Exception as e:
                logger.error(f"Error checking service health: {e}")
                
            await asyncio.sleep(30)  # Check every 30 seconds
            
    def register_service(self, service_name: str):
        """Register a new service for monitoring"""
        self.metrics[service_name] = ServiceMetrics(
            service_name=service_name,
            response_times=[],
            error_count=0,
            last_error=None,
            memory_usage=0,
            cpu_usage=0,
            event_count=0,
            last_heartbeat=datetime.now()
        )
        
    async def _handle_system_event(self, event: Event):
        """Handle system events"""
        if event.payload.get("action") == "heartbeat":
            service_name = event.payload.get("service")
            if service_name in self.metrics:
                self.metrics[service_name].last_heartbeat = datetime.now()
                
        elif event.payload.get("action") == "register":
            service_name = event.payload.get("service")
            self.register_service(service_name)
            
    def get_service_health(self, service_name: str) -> dict:
        """Get health status of a service"""
        if service_name not in self.metrics:
            return {"status": "unknown"}
            
        metrics = self.metrics[service_name]
        current_time = datetime.now()
        
        return {
            "status": "healthy" if current_time - metrics.last_heartbeat < timedelta(minutes=1) else "unhealthy",
            "last_heartbeat": metrics.last_heartbeat.isoformat(),
            "error_count": metrics.error_count,
            "last_error": metrics.last_error,
            "memory_usage_mb": metrics.memory_usage / (1024 * 1024),
            "cpu_usage_percent": metrics.cpu_usage,
            "event_count": metrics.event_count
        }
        
    def get_system_overview(self) -> dict:
        """Get overview of entire system health"""
        return {
            "total_services": len(self.metrics),
            "healthy_services": sum(1 for m in self.metrics.values() 
                                  if datetime.now() - m.last_heartbeat < timedelta(minutes=1)),
            "total_errors": sum(m.error_count for m in self.metrics.values()),
            "total_events": sum(m.event_count for m in self.metrics.values()),
            "services": {name: self.get_service_health(name) 
                        for name in self.metrics}
        }
