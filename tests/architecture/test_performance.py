"""
Architecture-level performance tests for ALEJO

This module provides comprehensive performance testing for:
1. Inter-service communication latency
2. Resource usage monitoring
3. Event processing throughput
4. Memory system performance
"""

import asyncio
import logging
import time
import psutil
import pytest
import pytest_asyncio
from typing import Dict, List, Any
from dataclasses import dataclass
from alejo.core.event_bus import EventBus, Event, EventType
from alejo.core.service_mesh import ServiceMesh
from alejo.services.memory_service import MemoryService
from alejo.cognitive.memory.working_memory import WorkingMemory
from alejo.brain.alejo_brain import ALEJOBrain
import secrets  # More secure for cryptographic purposes

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class PerformanceMetrics:
    """Container for performance test results"""
    avg_latency: float  # Average latency in milliseconds
    max_latency: float  # Maximum latency observed
    events_per_second: float  # Event processing throughput
    memory_usage: float  # Memory usage in MB
    cpu_usage: float  # CPU usage percentage
    service_latencies: Dict[str, float]  # Per-service latencies

class PerformanceMonitor:
    """Monitors and records system performance metrics"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.start_time = time.time()
        self.event_count = 0
        self.latencies: List[float] = []
        self.service_latencies: Dict[str, List[float]] = {}
        
    def record_latency(self, service_name: str, latency: float):
        """Record a service operation latency"""
        self.latencies.append(latency)
        if service_name not in self.service_latencies:
            self.service_latencies[service_name] = []
        self.service_latencies[service_name].append(latency)
        
    def record_event(self):
        """Record an event being processed"""
        self.event_count += 1
        
    def get_metrics(self) -> PerformanceMetrics:
        """Calculate current performance metrics"""
        elapsed_time = time.time() - self.start_time
        
        # Calculate average latencies per service
        service_avg_latencies = {
            name: sum(latencies) / len(latencies)
            for name, latencies in self.service_latencies.items()
        }
        
        return PerformanceMetrics(
            avg_latency=sum(self.latencies) / len(self.latencies) if self.latencies else 0,
            max_latency=max(self.latencies) if self.latencies else 0,
            events_per_second=self.event_count / elapsed_time if elapsed_time > 0 else 0,
            memory_usage=self.process.memory_info().rss / 1024 / 1024,  # Convert to MB
            cpu_usage=self.process.cpu_percent(),
            service_latencies=service_avg_latencies
        )

@pytest.fixture
def performance_monitor():
    """Create a performance monitor instance"""
    return PerformanceMonitor()

@pytest.fixture
async def test_brain(event_bus, working_memory):
    """Create a test ALEJO brain instance"""
    brain = ALEJOBrain({
        'llm': {'provider': 'mock'},
        'vision': {'provider': 'mock'},
        'emotional': {'provider': 'mock'}
    })
    await brain.initialize()
    yield brain

@pytest.mark.asyncio
async def test_event_processing_performance(
    event_bus: EventBus,
    performance_monitor: PerformanceMonitor
):
    """Test event processing performance"""
    EVENT_COUNT = 1000
    
    async def event_handler(event: Event):
        start_time = time.time()
        # Simulate some processing
        await asyncio.sleep(0.001)
        latency = (time.time() - start_time) * 1000  # Convert to ms
        performance_monitor.record_latency('event_processing', latency)
        performance_monitor.record_event()
    
    # Register test event handler
    event_bus.subscribe(EventType.BRAIN_THOUGHT, event_handler)
    
    # Send test events
    for i in range(EVENT_COUNT):
        await event_bus.publish(Event(
            type=EventType.BRAIN_THOUGHT,
            data={'thought': f'Test thought {i}'}
        ))
    
    # Wait for all events to be processed
    await asyncio.sleep(2)
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.avg_latency < 10, f"Average latency too high: {metrics.avg_latency}ms"
    assert metrics.events_per_second > 100, f"Event throughput too low: {metrics.events_per_second}/s"
    
    logger.info("Event Processing Performance:")
    logger.info(f"Average Latency: {metrics.avg_latency:.2f}ms")
    logger.info(f"Max Latency: {metrics.max_latency:.2f}ms")
    logger.info(f"Events/second: {metrics.events_per_second:.2f}")
    logger.info(f"Memory Usage: {metrics.memory_usage:.2f}MB")
    logger.info(f"CPU Usage: {metrics.cpu_usage:.2f}%")

@pytest.mark.asyncio
async def test_memory_system_performance(
    working_memory: WorkingMemory,
    performance_monitor: PerformanceMonitor
):
    """Test memory system performance"""
    MEMORY_COUNT = 100
    
    # Test memory storage performance
    for i in range(MEMORY_COUNT):
        start_time = time.time()
        await working_memory.store_memory({
            'type': 'test',
            'content': f'Test memory {i}',
            'context': {'test': True}
        })
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('memory_storage', latency)
    
    # Test memory retrieval performance
    for i in range(MEMORY_COUNT):
        start_time = time.time()
        memories = await working_memory.retrieve_relevant({'test': True})
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('memory_retrieval', latency)
        assert len(memories) > 0, "No memories retrieved"
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.service_latencies['memory_storage'] < 5, "Memory storage too slow"
    assert metrics.service_latencies['memory_retrieval'] < 10, "Memory retrieval too slow"
    
    logger.info("Memory System Performance:")
    logger.info(f"Storage Latency: {metrics.service_latencies['memory_storage']:.2f}ms")
    logger.info(f"Retrieval Latency: {metrics.service_latencies['memory_retrieval']:.2f}ms")

async def test_service_mesh_performance(
    service_mesh: ServiceMesh,
    performance_monitor: PerformanceMonitor
):
    """Test service mesh performance"""
    pass

@pytest.mark.asyncio
class TestComponentPerformance:
    """Component-level performance tests for ALEJO"""
    
    @pytest_asyncio.fixture
    async def setup_test(self):
        """Set up test environment"""
        # Initialize core components
        event_bus = EventBus()
        working_memory = WorkingMemory()
        brain = ALEJOBrain({
            'llm': {'provider': 'mock'},
            'vision': {'provider': 'mock'},
            'emotional': {'provider': 'mock'}
        })
        await brain.initialize()
        
        # Set up performance monitoring
        performance_monitor = PerformanceMonitor()
        
        yield {
            'event_bus': event_bus,
            'working_memory': working_memory,
            'brain': brain,
            'performance_monitor': performance_monitor
        }
        
    async def test_command_throughput(self, setup_test):
        """Test command processing throughput"""
        brain = setup_test['brain']
        performance_monitor = setup_test['performance_monitor']
        
        num_commands = 100
        start_time = time.time()
        
        for _ in range(num_commands):
            await brain.process_command("test command")
        
        duration = time.time() - start_time
        throughput = num_commands / duration
        
        # Record metrics
        performance_monitor.record_latency('command_processing', duration / num_commands)
        
        # Should handle at least 10 commands per second
        assert throughput > 10.0, f"Command throughput {throughput:.2f} commands/sec below threshold"
    
    async def test_memory_stability(self, setup_test):
        """Test memory usage stability under load"""
        brain = setup_test['brain']
        
        process = psutil.Process()
        initial_memory = process.memory_info().rss
        
        # Process many commands
        num_iterations = 1000
        for _ in range(num_iterations):
            await brain.process_command("test command")
        
        # Check memory usage
        final_memory = process.memory_info().rss
        memory_growth = final_memory - initial_memory
        
        # Memory growth should be reasonable (50MB)
        max_allowed_growth = 50 * 1024 * 1024
        assert memory_growth < max_allowed_growth, \
            f"Memory growth {memory_growth / 1024 / 1024:.1f}MB exceeds limit {max_allowed_growth / 1024 / 1024:.1f}MB"
    
    async def test_emotional_processor_performance(self, setup_test):
        """Test emotional processor performance"""
        brain = setup_test['brain']
        performance_monitor = setup_test['performance_monitor']
        
        num_iterations = 100
        start_time = time.time()
        
        for _ in range(num_iterations):
            await brain.emotional_processor.analyze_sentiment("test input")
        
        duration = time.time() - start_time
        throughput = num_iterations / duration
        
        # Record metrics
        performance_monitor.record_latency('emotional_processing', duration / num_iterations)
        
        # Should handle at least 50 sentiment analyses per second
        assert throughput > 50.0, f"Emotional processing throughput {throughput:.2f} ops/sec below threshold"


@pytest.mark.asyncio
async def test_service_mesh_performance(
    service_mesh: ServiceMesh,
    performance_monitor: PerformanceMonitor
):
    """Test service mesh performance"""
    REQUEST_COUNT = 500
    
    class TestService:
        async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
            await asyncio.sleep(0.001)  # Simulate processing
            return {'response': 'ok'}
    
    # Register test service
    service_mesh.register_service('test_service', TestService())
    
    # Test service request performance
    for i in range(REQUEST_COUNT):
        start_time = time.time()
        response = await service_mesh.send_request(
            'test_service',
            'handle_request',
            {'test': True}
        )
        latency = (time.time() - start_time) * 1000
        performance_monitor.record_latency('service_request', latency)
        assert response['response'] == 'ok'
    
    metrics = performance_monitor.get_metrics()
    
    # Assert performance requirements
    assert metrics.service_latencies['service_request'] < 5, "Service requests too slow"
    
    logger.info("Service Mesh Performance:")
    logger.info(f"Request Latency: {metrics.service_latencies['service_request']:.2f}ms")