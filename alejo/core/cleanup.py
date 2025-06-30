"""
Automated cleanup and maintenance system for ALEJO
"""

import asyncio
import logging
import os
import psutil
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Optional

logger = logging.getLogger(__name__)

class SystemCleaner:
    """
    Manages automated cleanup of system resources
    """
    
    def __init__(
        self,
        base_dir: str,
        max_log_age_days: int = 7,
        max_cache_size_mb: int = 1000,
        cleanup_interval: int = 3600  # 1 hour
    ):
        self.base_dir = Path(base_dir)
        self.max_log_age = timedelta(days=max_log_age_days)
        self.max_cache_size = max_cache_size_mb * 1024 * 1024  # Convert to bytes
        self.cleanup_interval = cleanup_interval
        self.last_cleanup = datetime.now()
        self._running = False
        self._lock = asyncio.Lock()
        
    async def start(self):
        """Start automated cleanup"""
        self._running = True
        asyncio.create_task(self._cleanup_loop())
        
    async def stop(self):
        """Stop automated cleanup"""
        self._running = False
        
    async def _cleanup_loop(self):
        """Main cleanup loop"""
        while self._running:
            try:
                await self.run_cleanup()
                await asyncio.sleep(self.cleanup_interval)
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
                await asyncio.sleep(60)  # Wait before retry
    
    async def run_cleanup(self):
        """Run all cleanup tasks"""
        async with self._lock:
            logger.info("Starting system cleanup")
            
            try:
                # Clean old log files
                await self._cleanup_logs()
                
                # Clean cache
                await self._cleanup_cache()
                
                # Clean temp files
                await self._cleanup_temp()
                
                # Clean processes
                await self._cleanup_processes()
                
                self.last_cleanup = datetime.now()
                logger.info("System cleanup completed successfully")
                
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")
                raise
    
    async def _cleanup_logs(self):
        """Clean old log files"""
        log_dir = self.base_dir / "logs"
        if not log_dir.exists():
            return
            
        cutoff = datetime.now() - self.max_log_age
        
        for log_file in log_dir.glob("*.log"):
            try:
                mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                if mtime < cutoff:
                    log_file.unlink()
                    logger.info(f"Removed old log file: {log_file}")
            except Exception as e:
                logger.error(f"Error cleaning log file {log_file}: {e}")
    
    async def _cleanup_cache(self):
        """Clean cache directory"""
        cache_dir = self.base_dir / "cache"
        if not cache_dir.exists():
            return
            
        total_size = sum(f.stat().st_size for f in cache_dir.glob('**/*') if f.is_file())
        
        if total_size > self.max_cache_size:
            # Get files sorted by access time
            cache_files = [
                (f, f.stat().st_atime)
                for f in cache_dir.glob('**/*')
                if f.is_file()
            ]
            cache_files.sort(key=lambda x: x[1])
            
            # Remove oldest files until under limit
            for file_path, _ in cache_files:
                if total_size <= self.max_cache_size:
                    break
                    
                size = file_path.stat().st_size
                try:
                    file_path.unlink()
                    total_size -= size
                    logger.info(f"Removed cache file: {file_path}")
                except Exception as e:
                    logger.error(f"Error removing cache file {file_path}: {e}")
    
    async def _cleanup_temp(self):
        """Clean temporary files"""
        temp_dir = self.base_dir / "temp"
        if not temp_dir.exists():
            return
            
        try:
            shutil.rmtree(temp_dir)
            temp_dir.mkdir(exist_ok=True)
            logger.info("Cleaned temporary directory")
        except Exception as e:
            logger.error(f"Error cleaning temp directory: {e}")
    
    async def _cleanup_processes(self):
        """Clean up stray processes"""
        process_names = {
            "alejo-brain",
            "alejo-emotional",
            "alejo-worker"
        }
        
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                # Check if process belongs to ALEJO
                if any(name in str(proc.info['name']).lower() for name in process_names):
                    # Check if process is orphaned or zombie
                    if proc.status() in ['zombie', 'dead']:
                        proc.kill()
                        logger.info(f"Cleaned up process {proc.pid}")
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
    
    def get_status(self) -> Dict:
        """Get cleanup status"""
        return {
            "last_cleanup": self.last_cleanup.isoformat(),
            "next_cleanup": (self.last_cleanup + timedelta(seconds=self.cleanup_interval)).isoformat(),
            "running": self._running,
            "base_dir": str(self.base_dir),
            "max_log_age_days": self.max_log_age.days,
            "max_cache_size_mb": self.max_cache_size // (1024 * 1024)
        }
