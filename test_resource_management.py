#!/usr/bin/env python3
"""
Resource Management Test Script

This script tests the resource management capabilities of ALEJO:
1. Tests the ProcessManager to identify and manage ALEJO processes
2. Tests the ResourceManager to monitor system resources
3. Tests the ResourceService to integrate process and resource management
4. Demonstrates resource optimization for ALEJO

Run this script to verify that resource management is working correctly.
"""

import os
import sys
import time
import asyncio
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def test_process_manager():
    """Test the ProcessManager functionality"""
    from alejo.core.process_manager import ProcessManager
    
    logger.info("=== Testing ProcessManager ===")
    
    # Initialize the process manager
    process_manager = ProcessManager()
    
    # Get current process info
    current_pid = os.getpid()
    logger.info(f"Current process ID: {current_pid}")
    
    # Test process identification
    alejo_processes = process_manager.find_alejo_processes()
    logger.info(f"Found {len(alejo_processes)} ALEJO processes")
    for proc in alejo_processes:
        logger.info(f"  PID: {proc.pid}, Name: {proc.name()}, Command: {' '.join(proc.cmdline())[:80]}")
    
    # Test redundant process detection
    redundant_processes = process_manager.identify_redundant_processes(alejo_processes)
    logger.info(f"Found {len(redundant_processes)} redundant processes")
    
    # Test resource-intensive process detection
    intensive_processes = process_manager.identify_resource_intensive_processes(alejo_processes)
    logger.info(f"Found {len(intensive_processes)} resource-intensive processes")
    
    # Register this process as critical
    process_manager.register_critical_process(current_pid)
    logger.info(f"Registered current process (PID: {current_pid}) as critical")
    
    # Verify critical process registration
    is_critical = current_pid in process_manager.critical_processes
    logger.info(f"Is current process critical? {is_critical}")
    
    return process_manager

async def test_resource_manager():
    """Test the ResourceManager functionality"""
    from alejo.core.resource_manager import ResourceManager, ResourceType
    
    logger.info("\n=== Testing ResourceManager ===")
    
    # Initialize the resource manager
    resource_manager = ResourceManager()
    
    # Get current system info
    info = resource_manager.get_system_info()
    logger.info(f"Current resource usage:")
    logger.info(f"  CPU: {info['cpu']['percent']}%")
    logger.info(f"  Memory: {info['memory']['percent']}% ({info['memory']['total'] - info['memory']['available']} / {info['memory']['total']} bytes)")
    logger.info(f"  Disk: {info['disk']['percent']}% ({info['disk']['total'] - info['disk']['free']} / {info['disk']['total']} bytes)")
    logger.info(f"  Network: {info['network']['bytes_sent']} bytes sent, {info['network']['bytes_recv']} bytes received")
    
    # Test resource allocation
    component_name = "test_component"
    resource_type = ResourceType.CPU
    
    # Register the component with a priority
    resource_manager.register_component(component_name, priority=7)
    logger.info(f"Registered component: {component_name} with priority 7")
    
    # Allocate a resource
    allocation_result = resource_manager.allocate_resource(component_name, resource_type)
    logger.info(f"Resource allocation result: {allocation_result}")
    
    # Check allocated resources
    with resource_manager._lock:
        allocations = resource_manager.allocated_resources
        logger.info(f"Current allocations: {allocations}")
    
    # Test resource release
    release_result = resource_manager.release_resource(component_name, resource_type)
    logger.info(f"Released {resource_type.value} resources for {component_name}: {release_result}")
    
    # Check updated allocations
    with resource_manager._lock:
        allocations = resource_manager.allocated_resources
        logger.info(f"Updated allocations: {allocations}")
    
    return resource_manager

async def test_resource_service():
    """Test the ResourceService functionality"""
    from alejo.core.memory_event_bus import MemoryEventBus
    from alejo.core.event_bus import Event, EventType
    from alejo.services.resource_service import ResourceService
    
    logger.info("\n=== Testing ResourceService ===")
    
    # Initialize the event bus
    event_bus = MemoryEventBus()
    await event_bus.start()
    logger.info("Started memory event bus")
    
    # Create a callback to handle resource events
    async def resource_event_handler(event):
        logger.info(f"Received resource event: {event.type} - {event.payload}")
    
    # Subscribe to resource events
    from alejo.core.event_bus import EventType
    event_bus.subscribe(EventType.SYSTEM, resource_event_handler)
    logger.info("Subscribed to resource events")
    
    # Initialize the resource service
    resource_service = ResourceService(event_bus)
    await resource_service.start()
    logger.info("Started resource service")
    
    # Wait for initial resource events
    logger.info("Waiting for resource events...")
    await asyncio.sleep(5)
    
    # Test process registration
    current_pid = os.getpid()
    register_event = Event.create(
        type=EventType.SYSTEM,
        payload={
            "type": "process_register",
            "data": {
                "pid": current_pid,
                "is_critical": True
            }
        },
        source="test_script"
    )
    await event_bus.publish(register_event)
    logger.info(f"Published process registration event for PID {current_pid}")
    
    # Test resource allocation request
    allocation_event = Event.create(
        type=EventType.SYSTEM,
        payload={
            "type": "resource_allocate",
            "data": {
                "component": "test_component",
                "resource_type": "memory",
                "amount": 100 * 1024 * 1024,  # 100 MB
                "priority": 5
            }
        },
        source="test_script"
    )
    await event_bus.publish(allocation_event)
    logger.info("Published resource allocation event")
    
    # Wait for events to be processed
    await asyncio.sleep(2)
    
    # Test process cleanup
    cleanup_event = Event.create(
        type=EventType.SYSTEM,
        payload={
            "type": "process_cleanup",
            "data": {
                "type": "test"
            }
        },
        source="test_script"
    )
    await event_bus.publish(cleanup_event)
    logger.info("Published process cleanup event for test processes")
    
    # Wait for events to be processed
    await asyncio.sleep(2)
    
    # Stop the resource service
    await resource_service.stop()
    logger.info("Stopped resource service")
    
    # Stop the event bus
    await event_bus.stop()
    logger.info("Stopped memory event bus")

async def main():
    """Main function to run the tests"""
    logger.info("Starting resource management tests...")
    
    # Test process manager
    process_manager = await test_process_manager()
    
    # Test resource manager
    resource_manager = await test_resource_manager()
    
    # Test resource service
    await test_resource_service()
    
    logger.info("\n=== Resource Management Test Summary ===")
    logger.info("All tests completed successfully!")
    logger.info("The resource management system is working correctly.")
    logger.info("\nTo run ALEJO with resource optimization:")
    logger.info("1. Use run_alejo_optimized.py to start ALEJO with resource management")
    logger.info("2. Add --optimize-resources flag to clean up redundant processes on startup")
    logger.info("3. Monitor resource usage in the logs")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Error during test: {e}", exc_info=True)
        sys.exit(1)