"""
Advanced cleanup and maintenance system for ALEJO
Includes predictive cleanup, resource optimization, and system health monitoring
"""

import asyncio
import logging
import os
import psutil
import shutil
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Optional, Any, Tuple
import numpy as np

from alejo.core.memory_analyzer import MemoryLeakDetector
from alejo.core.io_optimizer import IOOptimizer

logger = logging.getLogger(__name__)

class ResourcePredictor:
    """Predicts resource usage trends"""
    
    def __init__(self, history_size: int = 1000):
        self.history_size = history_size
        self.cpu_history: List[float] = []
        self.memory_history: List[float] = []
        self.disk_history: List[float] = []
        self.timestamps: List[float] = []
    
    def add_measurement(
        self,
        cpu_usage: float,
        memory_usage: float,
        disk_usage: float
    ):
        """Add new resource measurement"""
        self.cpu_history.append(cpu_usage)
        self.memory_history.append(memory_usage)
        self.disk_history.append(disk_usage)
        self.timestamps.append(time.time())
        
        # Maintain history size
        if len(self.cpu_history) > self.history_size:
            self.cpu_history = self.cpu_history[-self.history_size:]
            self.memory_history = self.memory_history[-self.history_size:]
            self.disk_history = self.disk_history[-self.history_size:]
            self.timestamps = self.timestamps[-self.history_size:]
    
    def predict_usage(self, hours_ahead: float = 1.0) -> Dict[str, float]:
        """Predict resource usage in the future"""
        if not self.cpu_history:
            return {
                'cpu': 0.0,
                'memory': 0.0,
                'disk': 0.0
            }
        
        # Simple linear regression for prediction
        x = np.array(self.timestamps)
        future_time = time.time() + (hours_ahead * 3600)
        
        predictions = {}
        for resource, history in [
            ('cpu', self.cpu_history),
            ('memory', self.memory_history),
            ('disk', self.disk_history)
        ]:
            y = np.array(history)
            coeffs = np.polyfit(x, y, deg=1)
            pred = np.polyval(coeffs, future_time)
            predictions[resource] = max(0.0, min(100.0, pred))
        
        return predictions

class SystemOptimizer:
    """Optimizes system resources and performance"""
    
    def __init__(self):
        self.process_stats: Dict[int, Dict[str, Any]] = {}
        self.optimization_history: List[Dict[str, Any]] = []
        self.resource_thresholds = {
            'cpu': 80.0,  # percent
            'memory': 85.0,  # percent
            'disk': 90.0  # percent
        }
    
    async def optimize_resources(self) -> Dict[str, Any]:
        """Perform system optimization"""
        optimizations = []
        
        # Get current resource usage
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Check CPU usage
        if cpu_percent > self.resource_thresholds['cpu']:
            opt = await self._optimize_cpu_usage()
            optimizations.append(opt)
        
        # Check memory usage
        if memory.percent > self.resource_thresholds['memory']:
            opt = await self._optimize_memory_usage()
            optimizations.append(opt)
        
        # Check disk usage
        if disk.percent > self.resource_thresholds['disk']:
            opt = await self._optimize_disk_usage()
            optimizations.append(opt)
        
        # Record optimization
        record = {
            'timestamp': datetime.now().isoformat(),
            'optimizations': optimizations,
            'resources': {
                'cpu': cpu_percent,
                'memory': memory.percent,
                'disk': disk.percent
            }
        }
        self.optimization_history.append(record)
        
        return record
    
    async def _optimize_cpu_usage(self) -> Dict[str, Any]:
        """Optimize CPU usage"""
        result = {
            'type': 'cpu',
            'actions': []
        }
        
        # Find CPU-intensive processes
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent']):
            try:
                if proc.info['cpu_percent'] > 50.0:
                    # Reduce priority
                    proc.nice(10)
                    result['actions'].append({
                        'action': 'reduce_priority',
                        'pid': proc.pid,
                        'name': proc.info['name']
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return result
    
    async def _optimize_memory_usage(self) -> Dict[str, Any]:
        """Optimize memory usage"""
        result = {
            'type': 'memory',
            'actions': []
        }
        
        # Clear system caches
        if os.name == 'posix':
            try:
                os.system('sync; echo 3 > /proc/sys/vm/drop_caches')
                result['actions'].append({
                    'action': 'clear_caches',
                    'success': True
                })
            except Exception as e:
                logger.error(f"Failed to clear caches: {e}")
        
        # Find memory-intensive processes
        for proc in psutil.process_iter(['pid', 'name', 'memory_percent']):
            try:
                if proc.info['memory_percent'] > 20.0:
                    # Request memory cleanup
                    proc.memory_info()
                    result['actions'].append({
                        'action': 'request_cleanup',
                        'pid': proc.pid,
                        'name': proc.info['name']
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return result
    
    async def _optimize_disk_usage(self) -> Dict[str, Any]:
        """Optimize disk usage"""
        result = {
            'type': 'disk',
            'actions': []
        }
        
        # Find large files
        large_files = []
        for path in Path('/').rglob('*'):
            try:
                if path.is_file():
                    size = path.stat().st_size
                    if size > 100_000_000:  # 100MB
                        large_files.append((path, size))
            except (PermissionError, OSError):
                continue
        
        # Sort by size and suggest cleanup
        large_files.sort(key=lambda x: x[1], reverse=True)
        for path, size in large_files[:10]:
            result['actions'].append({
                'action': 'suggest_cleanup',
                'path': str(path),
                'size_mb': size / 1_000_000
            })
        
        return result

class AdvancedSystemCleaner:
    """Enhanced system cleaning with predictive maintenance"""
    
    def __init__(
            self,
            base_dir: str,
            config: Optional[Dict[str, Any]] = None
        ):
            self.base_dir = Path(base_dir)
            self.config = config or {}
            
            # Initialize components
            self.resource_predictor = ResourcePredictor()
            self.system_optimizer = SystemOptimizer()
            self.memory_detector = MemoryLeakDetector()
            self.io_optimizer = IOOptimizer(str(base_dir))
            
            # Cleanup state
            self.cleanup_schedule: Dict[str, datetime] = {}
            self.cleanup_history: List[Dict[str, Any]] = []
            self.detected_issues: List[Dict[str, Any]] = []
            self._lock = asyncio.Lock()
            self._running = False
    
    async def start(self):
        """Start advanced cleanup system"""
        self._running = True
        
        # Start monitoring tasks
        monitoring_tasks = [
            self.memory_detector.start_monitoring(),
            self.io_optimizer.start_monitoring(),
            self._monitor_loop()
        ]
        
        await asyncio.gather(*monitoring_tasks)
        
    async def stop(self):
        """Stop advanced cleanup system"""
        self._running = False
        await self.memory_detector.stop_monitoring()
        await self.io_optimizer.stop_monitoring()
        
    async def _monitor_loop(self):
        """Main monitoring loop"""
        while self._running:
            await self._monitor_resources()
            await self._predictive_maintenance()
            await self._run_scheduled_cleanups()
            await self._check_system_health()
            await asyncio.sleep(300)  # 5 minutes
    
    async def _monitor_resources(self):
        """Monitor system resources and detect issues"""
        async with self._lock:
            # Basic resource monitoring
            cpu_percent = psutil.cpu_percent()
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            self.resource_predictor.add_measurement(
                cpu_percent,
                memory.percent,
                disk.percent
            )
            
            # Check for memory leaks
            memory_leaks = self.memory_detector.analyze_leaks()
            if memory_leaks:
                self.detected_issues.extend([
                    {**leak, 'type': 'memory_leak'}
                    for leak in memory_leaks
                ])
                
            # Check for I/O issues
            io_stats = self.io_optimizer.get_io_statistics()
            io_suggestions = self.io_optimizer.get_optimization_suggestions()
            
            if io_suggestions:
                self.detected_issues.extend([
                    {**sugg, 'detection_time': datetime.now().isoformat()}
                    for sugg in io_suggestions
                ])
    
    async def _predictive_maintenance(self):
        """Perform predictive maintenance and issue resolution"""
        async with self._lock:
            # Resource predictions
            predictions = self.resource_predictor.predict_usage(hours_ahead=24)
            
            # Schedule cleanups based on predictions
            if predictions['disk'] > 80.0:
                self._schedule_cleanup('disk')
                
            if predictions['memory'] > 80.0:
                self._schedule_cleanup('memory')
                
            # Handle detected issues
            for issue in self.detected_issues:
                if issue['type'] == 'memory_leak':
                    await self._handle_memory_leak(issue)
                elif issue['type'] in ('high_read_rate', 'high_write_rate', 'hot_path'):
                    await self._handle_io_issue(issue)
                    
            # Clear resolved issues
            self.detected_issues = [
                issue for issue in self.detected_issues
                if not issue.get('resolved', False)
            ]
    
    async def _schedule_cleanup(self, cleanup_type: str):
        """Schedule a cleanup task"""
        next_cleanup = datetime.now() + timedelta(hours=1)
        self.cleanup_schedule[cleanup_type] = next_cleanup
        
        logger.info(f"Scheduled {cleanup_type} cleanup for {next_cleanup}")
    
    async def _run_scheduled_cleanups(self):
        """Run scheduled cleanup tasks"""
        now = datetime.now()
        
        for cleanup_type, scheduled_time in self.cleanup_schedule.items():
            if now >= scheduled_time:
                try:
                    await self._perform_cleanup(cleanup_type)
                    del self.cleanup_schedule[cleanup_type]
                except Exception as e:
                    logger.error(f"Cleanup error: {e}")
    
    async def _perform_cleanup(self, cleanup_type: str):
        """Perform specific cleanup task"""
        async with self._lock:
            start_time = time.time()
            
            try:
                # Optimize system resources
                optimization_result = await self.system_optimizer.optimize_resources()
                
                # Clean temporary files
                temp_files = await self._clean_temp_files()
                
                # Clean old logs
                old_logs = await self._clean_old_logs()
                
                # Record cleanup
                record = {
                    'type': cleanup_type,
                    'timestamp': datetime.now().isoformat(),
                    'duration': time.time() - start_time,
                    'optimization': optimization_result,
                    'temp_files_cleaned': temp_files,
                    'logs_cleaned': old_logs
                }
                self.cleanup_history.append(record)
                
                logger.info(f"Completed {cleanup_type} cleanup")
                
            except Exception as e:
                logger.error(f"Cleanup failed: {e}")
                raise
    
    async def _clean_temp_files(self) -> int:
        """Clean temporary files"""
        count = 0
        temp_dirs = [
            self.base_dir / 'temp',
            Path(os.environ.get('TEMP', '/tmp'))
        ]
        
        for temp_dir in temp_dirs:
            if not temp_dir.exists():
                continue
                
            for item in temp_dir.glob('*'):
                try:
                    if item.is_file():
                        item.unlink()
                        count += 1
                    elif item.is_dir():
                        shutil.rmtree(item)
                        count += 1
                except Exception as e:
                    logger.error(f"Error cleaning {item}: {e}")
        
        return count
    
    async def _clean_old_logs(self) -> int:
        """Clean old log files"""
        count = 0
        log_dir = self.base_dir / 'logs'
        
        if not log_dir.exists():
            return count
        
        # Clean logs older than 7 days
        cutoff = datetime.now() - timedelta(days=7)
        
        for log_file in log_dir.glob('*.log'):
            try:
                if datetime.fromtimestamp(log_file.stat().st_mtime) < cutoff:
                    log_file.unlink()
                    count += 1
            except Exception as e:
                logger.error(f"Error cleaning log {log_file}: {e}")
        
        return count
    
    async def _handle_memory_leak(self, issue: Dict[str, Any]):
        """Handle detected memory leak"""
        pid = issue['pid']
        try:
            proc = psutil.Process(pid)
            
            # Get detailed memory trend
            trend = self.memory_detector.get_process_memory_trend(pid)
            if not trend:
                return
                
            # Take action based on severity
            if trend['trend']['r_squared'] > 0.9:  # Very reliable trend
                if trend['statistics']['avg_memory_mb'] > 1000:  # >1GB
                    # Critical leak - restart process
                    logger.warning(f"Restarting process {pid} due to severe memory leak")
                    proc.kill()
                    issue['resolved'] = True
                    issue['resolution'] = 'process_restarted'
                else:
                    # Significant leak - reduce priority
                    proc.nice(10)
                    issue['resolved'] = True
                    issue['resolution'] = 'priority_reduced'
        except psutil.NoSuchProcess:
            issue['resolved'] = True
            issue['resolution'] = 'process_not_found'
            
    async def _handle_io_issue(self, issue: Dict[str, Any]):
        """Handle detected I/O issue"""
        if issue['type'] == 'hot_path':
            path = Path(issue['path'])
            if path.exists():
                # Implement I/O reduction strategies
                if path.is_file() and path.suffix == '.log':
                    # Rotate large log files
                    if path.stat().st_size > 100 * 1024 * 1024:  # 100MB
                        await self._rotate_log_file(path)
                        issue['resolved'] = True
                        issue['resolution'] = 'log_rotated'
                        
    async def _rotate_log_file(self, path: Path):
        """Rotate a log file to reduce I/O impact"""
        try:
            # Rotate file with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            rotated_path = path.with_suffix(f'.{timestamp}.log')
            shutil.move(str(path), str(rotated_path))
            
            # Compress old log
            asyncio.create_task(self._compress_log(rotated_path))
            
        except (OSError, IOError) as e:
            logger.error(f"Failed to rotate log file {path}: {e}")
            
    async def _compress_log(self, path: Path):
        """Compress a log file in the background"""
        try:
            import gzip
            compressed_path = path.with_suffix('.gz')
            with open(path, 'rb') as f_in:
                with gzip.open(compressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            path.unlink()
        except Exception as e:
            logger.error(f"Failed to compress log file {path}: {e}")
            
    async def _check_system_health(self):
        """Check overall system health"""
        async with self._lock:
            # Get all monitoring data
            resource_stats = self.resource_predictor.predict_usage(hours_ahead=1)
            memory_leaks = self.memory_detector.analyze_leaks()
            io_stats = self.io_optimizer.get_io_statistics()
            
            # Calculate health score (0-100)
            health_score = 100
            
            # Reduce score based on resource usage
            for resource, usage in resource_stats.items():
                if usage > 90:
                    health_score -= 30
                elif usage > 80:
                    health_score -= 20
                elif usage > 70:
                    health_score -= 10
                    
            # Reduce score for memory leaks
            health_score -= len(memory_leaks) * 15
            
            # Reduce score for I/O issues
            for disk, stats in io_stats.items():
                if stats['avg_read_rate_mb_s'] > 100 or stats['avg_write_rate_mb_s'] > 100:
                    health_score -= 10
                    
            health_score = max(0, min(100, health_score))
            
            # Log health status
            logger.info(f"System health score: {health_score}/100")
            if health_score < 50:
                logger.warning("System health is critical - immediate attention required")
                
            return health_score
            
    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        return {
            'last_cleanup': self.cleanup_history[-1] if self.cleanup_history else None,
            'scheduled_cleanups': self.cleanup_schedule,
            'resource_predictions': self.resource_predictor.predict_usage(hours_ahead=24),
            'detected_issues': self.detected_issues,
            'memory_leaks': self.memory_detector.analyze_leaks(),
            'io_statistics': self.io_optimizer.get_io_statistics(),
            'io_suggestions': self.io_optimizer.get_optimization_suggestions()
        }
