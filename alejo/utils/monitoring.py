"""
Monitoring and logging configuration for ALEJO error handling
"""

import os
import json
import logging
import logging.handlers
from typing import Dict, Any, Optional
from datetime import datetime
from pathlib import Path

class ErrorMonitor:
    """Configures and manages error monitoring and logging."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.log_dir = Path(self.config.get('log_dir', 'logs'))
        self.log_dir.mkdir(exist_ok=True)
        
        # Configure logging
        self._setup_logging()
        
        # Initialize state
        self.alert_thresholds = self.config.get('alert_thresholds', {
            'critical': 1,    # Alert on first critical error
            'system': 3,      # Alert after 3 system errors
            'operational': 5,  # Alert after 5 operational errors
            'recoverable': 10  # Alert after 10 recoverable errors
        })
        
        self.error_counts: Dict[str, int] = {}
        self.last_alert: Dict[str, datetime] = {}
    
    def _setup_logging(self):
        """Configure logging handlers and formatters."""
        # Create formatters
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        json_formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "logger": "%(name)s", '
            '"level": "%(levelname)s", "message": "%(message)s"}'
        )
        
        # File handler for regular logs
        file_handler = logging.handlers.RotatingFileHandler(
            self.log_dir / 'error.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(file_formatter)
        
        # File handler for JSON logs (for analytics)
        json_handler = logging.handlers.RotatingFileHandler(
            self.log_dir / 'error.json',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        json_handler.setFormatter(json_formatter)
        
        # Get the logger
        logger = logging.getLogger('alejo.error_handling')
        logger.setLevel(logging.INFO)
        
        # Add handlers
        logger.addHandler(file_handler)
        logger.addHandler(json_handler)
    
    def should_alert(self, error_type: str, count: int) -> bool:
        """Determine if an alert should be triggered."""
        if error_type not in self.alert_thresholds:
            return False
        
        threshold = self.alert_thresholds[error_type]
        if count >= threshold:
            # Check if enough time has passed since last alert
            last_alert = self.last_alert.get(error_type)
            if not last_alert or (datetime.now() - last_alert).total_seconds() > 3600:
                self.last_alert[error_type] = datetime.now()
                return True
        return False
    
    def log_error(self, error_data: Dict[str, Any]):
        """Log an error and trigger alerts if necessary."""
        logger = logging.getLogger('alejo.error_handling')
        
        # Log the error
        logger.error(json.dumps(error_data))
        
        # Update error counts
        error_type = error_data.get('category', 'unknown')
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Check if alert should be triggered
        if self.should_alert(error_type, self.error_counts[error_type]):
            self._trigger_alert(error_type, error_data)
    
    def _trigger_alert(self, error_type: str, error_data: Dict[str, Any]):
        """Trigger an alert for critical errors."""
        logger = logging.getLogger('alejo.alerts')
        alert_data = {
            'timestamp': datetime.now().isoformat(),
            'error_type': error_type,
            'count': self.error_counts[error_type],
            'error_data': error_data
        }
        logger.critical(f"ALERT: {json.dumps(alert_data)}")
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get current error statistics."""
        return {
            'counts': self.error_counts.copy(),
            'last_alerts': {
                k: v.isoformat() 
                for k, v in self.last_alert.items()
            }
        }

# Singleton instance
_monitor_instance = None

def get_monitor(config: Optional[Dict[str, Any]] = None) -> ErrorMonitor:
    """Get or create the error monitor instance."""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = ErrorMonitor(config)
    return _monitor_instance
