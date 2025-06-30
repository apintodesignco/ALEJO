"""
ALEJO Microservices Stopper

This script stops any running ALEJO microservices by identifying and terminating
their processes based on port numbers or process names.
"""

import os
import sys
import psutil
import argparse
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("alejo.stopper")

# Default ports for ALEJO services
DEFAULT_PORTS = [8000, 8001]

# Service names to search for
default_service_names = ["brain_service", "emotional_intelligence_service", "uvicorn", "fastapi"]

def find_service_processes(ports=None, service_names=None):
    """Find processes that might be ALEJO services based on ports or names"""
    if ports is None:
        ports = DEFAULT_PORTS
    if service_names is None:
        service_names = default_service_names
    
    service_processes = []
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'connections']):
        try:
            proc_info = proc.as_dict(attrs=['pid', 'name', 'cmdline', 'connections'])
            process_name = proc_info['name'].lower()
            cmdline = ' '.join(proc_info['cmdline']).lower() if proc_info['cmdline'] else ''
            
            # Check if process name or command line matches service names
            matches_name = any(sn in process_name or sn in cmdline for sn in service_names)
            
            # Check if process is listening on any of the specified ports
            matches_port = False
            if proc_info['connections']:
                for conn in proc_info['connections']:
                    if conn.status == psutil.CONN_LISTEN and conn.laddr.port in ports:
                        matches_port = True
                        break
            
            if matches_name or matches_port:
                service_processes.append({
                    'pid': proc_info['pid'],
                    'name': proc_info['name'],
                    'cmdline': cmdline,
                    'port': conn.laddr.port if matches_port else None
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return service_processes

def stop_process(pid, name, timeout=5):
    """Attempt to terminate a process gracefully, then forcefully if needed"""
    try:
        proc = psutil.Process(pid)
        logger.info(f"Terminating process {name} (PID: {pid})")
        proc.terminate()
        
        try:
            proc.wait(timeout=timeout)
            logger.info(f"Process {name} (PID: {pid}) terminated successfully")
            return True
        except psutil.TimeoutExpired:
            logger.warning(f"Process {name} (PID: {pid}) did not terminate within {timeout} seconds, killing...")
            proc.kill()
            logger.info(f"Process {name} (PID: {pid}) killed")
            return True
    except psutil.NoSuchProcess:
        logger.warning(f"Process {name} (PID: {pid}) no longer exists")
        return True
    except psutil.AccessDenied:
        logger.error(f"Access denied when trying to terminate process {name} (PID: {pid})")
        return False
    except Exception as e:
        logger.error(f"Error terminating process {name} (PID: {pid}): {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Stop ALEJO Microservices")
    parser.add_argument("--ports", type=int, nargs='*', help="Ports to search for services on (default: 8000, 8001)")
    parser.add_argument("--force", action="store_true", help="Force kill processes immediately without graceful termination")
    parser.add_argument("--timeout", type=int, default=5, help="Timeout in seconds for graceful termination")
    args = parser.parse_args()
    
    ports = args.ports if args.ports else DEFAULT_PORTS
    logger.info(f"Searching for ALEJO services on ports: {ports}")
    
    # Find potential service processes
    processes = find_service_processes(ports=ports)
    
    if not processes:
        logger.info("No ALEJO services found running on specified ports or with matching names")
        return
    
    logger.info(f"Found {len(processes)} potential ALEJO service processes")
    for proc in processes:
        port_info = f" on port {proc['port']}" if proc['port'] else ""
        logger.info(f"- PID: {proc['pid']}, Name: {proc['name']}{port_info}")
    
    # Stop the processes
    successful = 0
    for proc in processes:
        if args.force:
            logger.info(f"Force killing process {proc['name']} (PID: {proc['pid']})")
            try:
                psutil.Process(proc['pid']).kill()
                successful += 1
            except Exception as e:
                logger.error(f"Failed to kill process {proc['name']} (PID: {proc['pid']}): {e}")
        else:
            if stop_process(proc['pid'], proc['name'], timeout=args.timeout):
                successful += 1
    
    logger.info(f"Successfully stopped {successful} out of {len(processes)} processes")

if __name__ == "__main__":
    try:
        import psutil
        main()
    except ImportError:
        logger.error("psutil is required to stop services. Install with: pip install psutil")
        sys.exit(1)
