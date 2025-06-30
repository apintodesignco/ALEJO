"""
ALEJO Logging Utilities Module
Provides enhanced logging capabilities for ALEJO with proper Unicode handling.
"""

import logging
import sys
import io
import platform

class UnicodeStreamHandler(logging.StreamHandler):
    """
    A stream handler that properly handles Unicode characters in Windows environments.
    This prevents UnicodeEncodeError when logging characters not supported by the console's encoding.
    """
    def __init__(self, stream=None):
        super().__init__(stream)
        self.encoding = 'utf-8'
        
    def emit(self, record):
        try:
            msg = self.format(record)
            stream = self.stream
            # Replace unsupported characters with their closest ASCII equivalent or a placeholder
            if platform.system() == 'Windows':
                # Map common Unicode symbols to ASCII equivalents
                msg = msg.replace('✓', '[OK]')
                msg = msg.replace('✗', '[X]')
                msg = msg.replace('→', '->') 
                msg = msg.replace('←', '<-')
                msg = msg.replace('⚠', '[WARNING]')
                msg = msg.replace('⛔', '[ERROR]')
            
            stream.write(msg + self.terminator)
            self.flush()
        except Exception:
            self.handleError(record)

def configure_logging(name=None, level=logging.INFO, log_file=None):
    """
    Configure logging with proper Unicode handling.
    
    Args:
        name: Logger name (optional)
        level: Logging level
        log_file: Optional log file path
    
    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Remove any existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Create formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Create and add stream handler with Unicode support
    stream_handler = UnicodeStreamHandler()
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)
    
    # Add file handler if specified
    if log_file:
        # Use utf-8 encoding for file handler
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

def get_logger(name, level=logging.INFO, log_file=None):
    """
    Get a logger with proper Unicode handling.
    
    Args:
        name: Logger name
        level: Logging level
        log_file: Optional log file path
    
    Returns:
        Configured logger
    """
    return configure_logging(name, level, log_file)
