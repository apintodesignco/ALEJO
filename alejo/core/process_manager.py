"""
Process Manager for ALEJO

This module provides functionality to manage ALEJO-related processes,
including identifying, monitoring, and safely terminating redundant processes.
"""

import os
import sys
import psutil
import logging
import time
import signal
import subprocess
from typing import List, Dict, Optional, Set, Tuple
import threading

logger = logging.getLogger(__name__)

class ProcessManager:
    """
    Manages ALEJO-related processes to ensure efficient resource usage
    
    This class provides functionality to:
    1. Identify ALEJO-related processes
    2. Monitor process resource usage
    3. Safely terminate redundant or resource-intensive processes
    4. Prevent duplicate instances of critical components
    """
    
    def __init__(self):
        """Initialize the process manager"""
        self.critical_processes = set()
        self.managed_processes = {}
        self.monitoring_thread = None
        self.running = False
        self._lock = threading.RLock()
        
    def start_monitoring(self, interval: float = 10.0):
        """
        Start monitoring ALEJO processes
        
        Args:
            interval: Time between monitoring checks in seconds
        """
        if self.running:
            return
            
        self.running = True
        self.monitoring_thread = threading.Thread(
            target=self._monitor_processes,
            args=(interval,),
            daemon=True,
            name="ALEJO-ProcessMonitor"
        )
        self.monitoring_thread.start()
        logger.info("Process monitoring started")
        
    def stop_monitoring(self):
        """Stop monitoring ALEJO processes"""
        self.running = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=2.0)
            self.monitoring_thread = None
        logger.info("Process monitoring stopped")
        
    def _monitor_processes(self, interval: float):
        """
        Monitor ALEJO processes in a background thread
        
        Args:
            interval: Time between checks in seconds
        """
        while self.running:
            try:
                # Find all ALEJO processes
                alejo_processes = self.find_alejo_processes()
                
                # Check for redundant processes
                redundant = self.identify_redundant_processes(alejo_processes)
                
                # Check for resource-intensive processes
                intensive = self.identify_resource_intensive_processes(alejo_processes)
                
                # Log findings
                if redundant:
                    logger.warning(f"Found {len(redundant)} redundant ALEJO processes")
                    
                if intensive:
                    logger.warning(f"Found {len(intensive)} resource-intensive ALEJO processes")
                    
                # Sleep until next check
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in process monitoring: {e}")
                time.sleep(interval)
                
    def find_alejo_processes(self) -> List[psutil.Process]:
        """
        Find all ALEJO-related processes
        
        Returns:
            List of psutil.Process objects for ALEJO-related processes
        """
        alejo_processes = []
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_percent']):
            try:
                # Check if process name or command line contains ALEJO-related keywords
                if proc.info['cmdline']:
                    cmdline = ' '.join(proc.info['cmdline']).lower()
                    if any(keyword in cmdline for keyword in ['alejo', 'gaze', 'test_', 'pytest']):
                        # Skip this process manager itself
                        if 'process_manager.py' in cmdline or 'stop_processes.py' in cmdline:
                            continue
                        alejo_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        return alejo_processes
        
    def identify_redundant_processes(self, processes: List[psutil.Process]) -> List[psutil.Process]:
        """
        Identify redundant ALEJO processes
        
        Args:
            processes: List of processes to check
            
        Returns:
            List of redundant processes
        """
        # Group processes by their command line
        grouped_processes = {}
        for proc in processes:
            try:
                cmdline = ' '.join(proc.info['cmdline'])
                grouped_processes.setdefault(cmdline, []).append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        # Find groups with more than one process
        redundant = []
        for cmdline, procs in grouped_processes.items():
            if len(procs) > 1:
                # Keep the oldest process (lowest PID) and mark the rest as redundant
                procs.sort(key=lambda p: p.pid)
                redundant.extend(procs[1:])
                
        return redundant
        
    def identify_resource_intensive_processes(self, processes: List[psutil.Process], 
                                             cpu_threshold: float = 50.0,
                                             memory_threshold: float = 30.0) -> List[Tuple[psutil.Process, str]]:
        """
        Identify resource-intensive ALEJO processes
        
        Args:
            processes: List of processes to check
            cpu_threshold: CPU usage threshold percentage
            memory_threshold: Memory usage threshold percentage
            
        Returns:
            List of tuples (process, reason) for resource-intensive processes
        """
        intensive = []
        
        for proc in processes:
            try:
                # Update CPU and memory usage
                with proc.oneshot():
                    cpu_percent = proc.cpu_percent(interval=0.1)
                    memory_percent = proc.memory_percent()
                    
                    if cpu_percent > cpu_threshold:
                        intensive.append((proc, f"High CPU usage: {cpu_percent:.1f}%"))
                    elif memory_percent > memory_threshold:
                        intensive.append((proc, f"High memory usage: {memory_percent:.1f}%"))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        return intensive
        
    def register_critical_process(self, pid: int):
        """
        Register a process as critical (should not be terminated)
        
        Args:
            pid: Process ID to register
        """
        with self._lock:
            self.critical_processes.add(pid)
            
    def unregister_critical_process(self, pid: int):
        """
        Unregister a process as critical
        
        Args:
            pid: Process ID to unregister
        """
        with self._lock:
            if pid in self.critical_processes:
                self.critical_processes.remove(pid)
                
    def terminate_processes(self, processes: List[psutil.Process], force: bool = False) -> int:
        """
        Terminate the given processes
        
        Args:
            processes: List of processes to terminate
            force: Whether to force termination (kill)
            
        Returns:
            Number of processes successfully terminated
        """
        terminated_count = 0
        
        for proc in processes:
            try:
                # Skip critical processes
                if proc.pid in self.critical_processes:
                    logger.info(f"Skipping critical process {proc.pid}")
                    continue
                    
                logger.info(f"Terminating process {proc.pid}: {' '.join(proc.info['cmdline'])}")
                
                if force:
                    proc.kill()
                else:
                    proc.terminate()
                    
                # Wait for process to terminate
                gone, alive = psutil.wait_procs([proc], timeout=3)
                if proc in gone:
                    terminated_count += 1
                    logger.info(f"Process {proc.pid} terminated")
                else:
                    # Force kill if still alive
                    logger.warning(f"Process {proc.pid} did not terminate gracefully, killing...")
                    proc.kill()
                    terminated_count += 1
                    
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                logger.warning(f"Could not terminate process {proc.pid}")
                
        return terminated_count
        
    def terminate_redundant_processes(self) -> int:
        """
        Find and terminate redundant ALEJO processes
        
        Returns:
            Number of processes terminated
        """
        # Find ALEJO processes
        alejo_processes = self.find_alejo_processes()
        
        # Identify redundant processes
        redundant = self.identify_redundant_processes(alejo_processes)
        
        # Terminate redundant processes
        return self.terminate_processes(redundant)
        
    def terminate_resource_intensive_processes(self, cpu_threshold: float = 50.0,
                                              memory_threshold: float = 30.0) -> int:
        """
        Find and terminate resource-intensive ALEJO processes
        
        Args:
            cpu_threshold: CPU usage threshold percentage
            memory_threshold: Memory usage threshold percentage
            
        Returns:
            Number of processes terminated
        """
        # Find ALEJO processes
        alejo_processes = self.find_alejo_processes()
        
        # Identify resource-intensive processes
        intensive = self.identify_resource_intensive_processes(
            alejo_processes, cpu_threshold, memory_threshold)
        
        # Log reasons
        for proc, reason in intensive:
            logger.warning(f"Process {proc.pid} is resource-intensive: {reason}")
            
        # Extract just the processes
        intensive_procs = [p for p, _ in intensive]
        
        # Terminate resource-intensive processes
        return self.terminate_processes(intensive_procs)
        
    def terminate_all_test_processes(self) -> int:
        """
        Find and terminate all ALEJO test processes
        
        Returns:
            Number of processes terminated
        """
        test_processes = []
        
        for proc in self.find_alejo_processes():
            try:
                cmdline = ' '.join(proc.info['cmdline']).lower()
                if any(keyword in cmdline for keyword in ['test_', 'pytest', 'unittest']):
                    test_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        return self.terminate_processes(test_processes)
        
    def get_process_info(self) -> List[Dict]:
        """
        Get information about all ALEJO processes
        
        Returns:
            List of dictionaries with process information
        """
        result = []
        
        for proc in self.find_alejo_processes():
            try:
                with proc.oneshot():
                    info = {
                        'pid': proc.pid,
                        'name': proc.name(),
                        'cmdline': ' '.join(proc.cmdline()),
                        'cpu_percent': proc.cpu_percent(interval=0.1),
                        'memory_percent': proc.memory_percent(),
                        'create_time': proc.create_time(),
                        'status': proc.status(),
                        'is_critical': proc.pid in self.critical_processes,
                    }
                    result.append(info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        return result

# Singleton instance
_process_manager = None

def get_process_manager() -> ProcessManager:
    """Get the singleton process manager instance"""
    global _process_manager
    if _process_manager is None:
        _process_manager = ProcessManager()
    return _process_manager
