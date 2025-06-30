import os
import sys
import subprocess
import time
import psutil
import logging
import signal
import argparse
import asyncio

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('alejo.runner')

# Set PYTHONPATH to include the root directory
os.environ['PYTHONPATH'] = os.path.abspath(os.path.dirname(os.path.dirname(__file__))) + os.pathsep + os.environ.get('PYTHONPATH', '')

# Service configurations
SERVICES = [
    {
        'name': 'Brain Service',
        'module': 'alejo.services.brain_service',
        'port': 8000
    },
    {
        'name': 'Emotional Intelligence Service',
        'module': 'alejo.services.emotional_intelligence_service',
        'port': 8001
    }
]

# Store subprocesses
processes = []

def check_port(port):
    """Check if a port is in use"""
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr.port == port:
            return conn.pid
    return None

def kill_process(pid):
    """Kill a process by PID"""
    try:
        process = psutil.Process(pid)
        process.terminate()
        process.wait(timeout=3)
        logger.info(f"Killed process with PID {pid}")
        return True
    except psutil.NoSuchProcess:
        logger.warning(f"Process with PID {pid} not found")
        return False
    except psutil.TimeoutExpired:
        logger.warning(f"Timeout while waiting for process {pid} to terminate")
        process.kill()
        return True
    except Exception as e:
        logger.error(f"Error killing process {pid}: {e}")
        return False

def start_service(service):
    """Start a single service"""
    port = service['port']
    pid = check_port(port)
    if pid:
        logger.warning(f"Port {port} is already in use by PID {pid}")
        if input(f"Kill process on port {port}? (y/n): ").lower() == 'y':
            if not kill_process(pid):
                logger.error(f"Failed to kill process on port {port}")
                return None
        else:
            logger.error(f"Cannot start {service['name']} - port in use")
            return None

    cmd = [sys.executable, '-m', service['module'], '--port', str(port)]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=os.environ
    )
    logger.info(f"Started {service['name']} on port {port} with PID {process.pid}")
    return process

def monitor_processes():
    """Monitor subprocess output"""
    while processes:
        for proc in processes[:]:
            if proc.poll() is not None:
                logger.warning(f"{SERVICES[processes.index(proc)]['name']} has stopped with return code {proc.returncode}")
                processes.remove(proc)
            else:
                # Read output
                stdout_line = proc.stdout.readline() if proc.stdout else ''
                stderr_line = proc.stderr.readline() if proc.stderr else ''
                if stdout_line:
                    logger.info(f"[{SERVICES[processes.index(proc)]['name']}] {stdout_line.strip()}")
                if stderr_line:
                    logger.error(f"[{SERVICES[processes.index(proc)]['name']}] {stderr_line.strip()}")
        time.sleep(0.1)

def signal_handler(sig, frame):
    """Handle Ctrl+C"""
    logger.info("Shutting down services...")
    for proc in processes:
        proc.terminate()
    for proc in processes:
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
    sys.exit(0)

async def main():
    # Initialize core components
    from alejo.core.event_bus import EventBus
    from alejo.health_monitor import HealthMonitor
    from alejo.service_registry import ServiceRegistry

    event_bus = EventBus()
    await event_bus.start()

    health_monitor = HealthMonitor(event_bus=event_bus, check_interval=30)
    service_registry = ServiceRegistry(event_bus=event_bus)

    # Example service registration
    await service_registry.register_service('ExampleService')

    # Start health monitoring
    health_monitor_task = asyncio.create_task(health_monitor.monitor())

    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_running_loop()
    shutdown_event = asyncio.Event()

    def shutdown_handler():
        logging.info("Shutdown signal received")
        shutdown_event.set()

    loop.add_signal_handler(signal.SIGINT, shutdown_handler)
    loop.add_signal_handler(signal.SIGTERM, shutdown_handler)

    logging.info("Services are running. Press Ctrl+C to exit.")
    await shutdown_event.wait()

    # Clean up tasks and stop all services
    health_monitor.stop()
    health_monitor_task.cancel()
    try:
        await health_monitor_task
    except asyncio.CancelledError:
        pass

    await event_bus.stop()

async def run_proactive_prompts():
    from alejo.proactive_prompts import ProactivePrompts
    import asyncio
    prompts = ProactivePrompts()
    while True:
        prompt = prompts.get_prompt()
        print(f"Proactive prompt: {prompt}")
        await asyncio.sleep(60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run ALEJO Microservices')
    parser.add_argument('--host', default='0.0.0.0', help='Host to run services on')
    args = parser.parse_args()

    logger.info("Starting ALEJO Microservices...")

    signal.signal(signal.SIGINT, signal_handler)

    for service in SERVICES:
        proc = start_service(service)
        if proc:
            processes.append(proc)

    if not processes:
        logger.error("No services started. Exiting.")
        sys.exit(1)

    logger.info(f"Started {len(processes)} services. Use Ctrl+C to stop.")
    monitor_processes()
