"""
ALEJO Command Processor Module
Provides direct command execution capabilities for ALEJO without requiring LLM processing.
This module handles file operations, web browsing, media editing, and system commands.
"""

import logging
import os
import sys
import subprocess
import webbrowser
import re
import time
import json
import threading
import platform
import datetime
import functools
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union, Callable

# Import utilities
try:
    from alejo.utils.logging_utils import get_logger
    from alejo.utils.exceptions import CommandError
    logger = get_logger('alejo.commands')
except ImportError:
    # Fall back to standard logging if the module isn't available
    logger = logging.getLogger('alejo.commands')
    
    # Define a basic CommandError if exceptions module not available
    class CommandError(Exception):
        """Exception raised when a command fails to execute"""
        pass

# Optional imports with fallbacks
try:
    import pyautogui
    PYAUTOGUI_AVAILABLE = True
except ImportError:
    PYAUTOGUI_AVAILABLE = False
    logger.warning("pyautogui not available, some features will be limited")

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not available, system monitoring will be limited")

# Setup logging
logger = logging.getLogger("alejo.commands")

# Import utility modules if available
try:
    from ..utils.error_handling import handle_errors, get_error_tracker
    from ..utils.performance import track_performance, get_performance_monitor
    ERROR_HANDLING_AVAILABLE = True
    PERFORMANCE_MONITORING_AVAILABLE = True
except ImportError:
    ERROR_HANDLING_AVAILABLE = False
    PERFORMANCE_MONITORING_AVAILABLE = False
    logger.warning("Error handling or performance monitoring modules not available")
    
    # Create dummy decorators if modules not available
    def handle_errors(component, error_type=None):
        def decorator(func):
            return func
        return decorator
    
    def track_performance(func):
        return func

__all__ = ['CommandProcessor', 'get_command_processor']

class CommandProcessor:
    """
    Command processor for ALEJO that handles direct task execution
    without requiring LLM processing
    
    Features:
    - Direct execution of file operations
    - Web browsing and search capabilities
    - Media operations (screenshots, image editing)
    - System monitoring and information
    - Natural language command parsing
    - Error handling and recovery
    - Performance monitoring
    """
    
    def __init__(self, config=None):
        """
        Initialize the command processor
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or {}
        self.initialized = False
        self.last_command_time = 0
        self.command_history = []
        self.max_history = self.config.get('max_command_history', 100)
        self.command_lock = threading.RLock()  # Thread-safe lock for command history
        
        # Initialize error tracking
        if "error_tracker" in self.config:
            self.error_tracker = self.config["error_tracker"]
        else:
            self.error_tracker = get_error_tracker(self.config)
            
        if not self.error_tracker:
            logger.error("Error tracking is required for CommandProcessor")
            raise CommandError("Error tracking is required for CommandProcessor")
        
        # Initialize performance tracking if available
        if PERFORMANCE_MONITORING_AVAILABLE:
            self.performance_monitor = get_performance_monitor(self.config)
        
        # Define command patterns for natural language processing
        self.command_patterns = {
            'file_operations': [
                r'(open|edit|create|delete|rename|copy|move|list)\s+(file|document|folder|directory)',
                r'(show|list)\s+(files|documents|folders|directories)',
                r'(find|search)\s+(file|document|folder|directory)',
            ],
            'web_operations': [
                r'(open|visit|browse|go\s+to)\s+(website|site|page|url)',
                r'(search|look\s+up|find)\s+(online|web|internet)',
                r'(play|watch)\s+(video|youtube)',
                r'(download)\s+(file|video|image|content)',
            ],
            'media_operations': [
                r'(take|capture)\s+(screenshot|screen\s+shot|photo|picture)',
                r'(record|capture)\s+(screen|video)',
                r'(edit|modify)\s+(image|picture|photo)',
                r'(post|upload)\s+(video|image|photo|content)',
            ],
            'system_operations': [
                r'(check|show|display)\s+(system|status|time|date|memory|cpu|disk|battery|network)',
                r'(what\s+is|tell\s+me)\s+(time|date)',
                r'(how\s+much|how)\s+(memory|cpu|disk|battery)',
            ]
        }
        
        self._register_handlers()
        
        self.initialized = True
        logger.info("CommandProcessor initialized with enhanced capabilities")
    
    @track_performance
    def execute_command(self, command: str, args: Dict[str, Any] = None) -> str:
        """Execute a command with the given arguments.
        
        Args:
            command: The command to execute
            args: Optional arguments for the command
            
        Returns:
            The command's output
            
        Raises:
            CommandError: If the command fails to execute
        """
        if not command:
            error = CommandError("No command provided")
            self.error_tracker.track_error('command_processor', 'command_execution', error)
            raise error
            
        # Get the handler for this command
        handler = self.command_handlers.get(command)
        if not handler:
            error = CommandError(f"Unknown command: {command}")
            self.error_tracker.track_error('command_processor', 'command_execution', error)
            raise error
            
        try:
            # Execute the command
            return handler(args or {})
            
        except CommandError as e:
            # Re-raise command errors after tracking
            self.error_tracker.track_error('command_processor', 'command_execution', e)
            raise
            
        except Exception as e:
            # Wrap other errors
            error = CommandError(f"Failed to execute command '{command}': {str(e)}")
            self.error_tracker.track_error('command_processor', 'command_execution', error)
            raise error
            
    def _register_handlers(self):
        """Register command handlers"""
        # Create a wrapper that ensures handlers raise CommandError
        def wrap_handler(handler):
            @functools.wraps(handler)
            def wrapper(*args, **kwargs):
                try:
                    return handler(*args, **kwargs)
                except Exception as e:
                    if isinstance(e, CommandError):
                        raise
                    raise CommandError(str(e)) from e
            return wrapper
            
        self.command_handlers = {
            # File operations
            "open file": wrap_handler(self._handle_open_file),
            "edit file": wrap_handler(self._handle_edit_file),
            "create file": wrap_handler(self._handle_create_file),
            "delete file": wrap_handler(self._handle_delete_file),
            "rename file": wrap_handler(self._handle_rename_file),
            "copy file": wrap_handler(self._handle_copy_file),
            "move file": wrap_handler(self._handle_move_file),
            "list files": wrap_handler(self._handle_list_files),
            
            # Web operations
            "open website": wrap_handler(self._handle_open_website),
            "search for": wrap_handler(self._handle_search_web),
            "play video": wrap_handler(self._handle_play_video),
            "download": wrap_handler(self._handle_download),
            "browse": wrap_handler(self._handle_browse),
            
            # Media operations
            "take screenshot": wrap_handler(self._handle_screenshot),
            "edit image": wrap_handler(self._handle_edit_image),
            "post video": wrap_handler(self._handle_post_video),
            "record screen": wrap_handler(self._handle_screenshot),  # Alias for screenshot
            "capture photo": wrap_handler(self._handle_screenshot),  # Alias for screenshot
            
            # System operations
            "check system": wrap_handler(self._handle_system_check),
            "show time": wrap_handler(self._handle_show_time),
            "show date": wrap_handler(self._handle_show_date),
            "check memory": wrap_handler(self._handle_check_memory),
            "check cpu": wrap_handler(self._handle_check_cpu),
            "check disk": wrap_handler(self._handle_check_disk),
            "check battery": wrap_handler(self._handle_check_battery),
            "check network": wrap_handler(self._handle_check_network),
        }
        
        # Natural language command patterns for intent recognition
        self.command_patterns = {
            # File patterns
            'file_operations': [
                r'(open|edit|create|delete|rename|copy|move|list)\s+(file|folder|directory)',
                r'(show|list)\s+(files|folders|directories)',
                r'(make|create)\s+(a\s+)?(new\s+)?(file|folder|directory)',
            ],
            # Web patterns
            'web_operations': [
                r'(open|go\s+to|visit|browse)\s+(website|site|webpage|url|link)',
                r'(search|look\s+up|find)\s+(for\s+)?(.*?)\s+(online|on\s+the\s+web|on\s+google)',
                r'(play|watch|stream)\s+(video|youtube)',
                r'(download|get)\s+(file|video|image|picture|document)',
            ],
            # Media patterns
            'media_operations': [
                r'(edit|modify|adjust|crop|resize)\s+(image|picture|photo)',
                r'(post|upload|share)\s+(video|image|picture|photo)',
                r'(take|capture)\s+(screenshot|screen\s+capture|screen\s+shot)',
                r'(record|capture)\s+(screen|video)',
            ],
            # System patterns
            'system_operations': [
                r'(check|show|display|tell)\s+(system|status|time|date|memory|cpu|disk|battery|network)',
                r'(what|current)\s+(time|date)\s+(is\s+it|now)',
                r'(how\s+much)\s+(memory|cpu|disk|battery)\s+(usage|left|available)',
            ],
        }
        
        self.initialized = True
        logger.info("CommandProcessor initialized with enhanced capabilities")
    
    @track_performance
    @handle_errors("command_processor", "command_processing")
    def process_command(self, command_text: str) -> str:
        """
        Process a command without using LLM
        
        Args:
            command_text: The command text to process
            
        Returns:
            Response text or None if no handler found
        """
        if not command_text:
            return "I didn't hear a command."
        
        # Record command in history with timestamp
        with self.command_lock:
            timestamp = time.time()
            self.last_command_time = timestamp
            self.command_history.append({
                'command': command_text,
                'timestamp': timestamp,
                'datetime': datetime.datetime.now().isoformat()
            })
            
            # Trim history if needed
            if len(self.command_history) > self.max_history:
                self.command_history = self.command_history[-self.max_history:]
        
        # Normalize command text
        command_text = command_text.lower().strip()
        logger.info(f"Processing command: '{command_text}'")
        
        try:
            # Check for direct command matches first (most efficient)
            for cmd_prefix, handler in self.command_handlers.items():
                if command_text.startswith(cmd_prefix):
                    # Extract the arguments (everything after the command prefix)
                    args = command_text[len(cmd_prefix):].strip()
                    logger.info(f"Executing command: {cmd_prefix} with args: {args}")
                    return handler(args)
            
            # If no direct match, try pattern matching for intent recognition
            command_intent, args = self._detect_command_intent(command_text)
            if command_intent:
                logger.info(f"Detected intent: {command_intent} with args: {args}")
                return self._handle_intent(command_intent, args, command_text)
            
            # Check for incomplete commands that need more information
            incomplete_commands = {
                "check": "The 'check' command is incomplete. Please specify what you want to check (e.g., 'check system', 'check time', 'check memory').",
                "copy": "The 'copy' command is incomplete. Please specify what you want to copy (e.g., 'copy file source.txt to target.txt').",
                "create": "The 'create' command is incomplete. Please specify what you want to create (e.g., 'create file example.txt').",
                "delete": "The 'delete' command is incomplete. Please specify what you want to delete (e.g., 'delete file example.txt').",
                "open": "The 'open' command is incomplete. Please specify what you want to open (e.g., 'open file example.txt', 'open website example.com')."
            }
            
            if command_text in incomplete_commands:
                logger.warning(f"Incomplete command detected: '{command_text}'")
                return incomplete_commands[command_text]
            
            # No handler or intent found
            logger.warning(f"No handler found for command: '{command_text}'")
            return "I don't understand that command. This command is not recognized. Please try again with a known command."
            
        except Exception as e:
            logger.error(f"Error processing command '{command_text}': {e}")
            if ERROR_HANDLING_AVAILABLE:
                error_details = self.error_tracker.track_error(
                    "command_processor", 
                    "command_processing", 
                    e, 
                    {"command": command_text}
                )
                if error_details.get("recovery_applied", False):
                    return f"I encountered an issue but recovered: {error_details.get('recovery_result', {}).get('message', '')}"
            
            return f"I encountered an error while processing your command: {str(e)}"
    
    def _detect_command_intent(self, command_text: str) -> Tuple[str, str]:
        """
        Detect the intent of a natural language command
        
        Args:
            command_text: The command text to analyze
            
        Returns:
            Tuple of (intent, arguments)
        """
        # Check each category of patterns
        for category, patterns in self.command_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, command_text, re.IGNORECASE)
                if match:
                    # Extract the action and target from the match
                    if category == 'file_operations':
                        action = match.group(1) if match.groups() else ""
                        target = self._extract_file_path(command_text)
                        return f"{action} file", target
                    
                    elif category == 'web_operations':
                        if "search" in command_text or "look" in command_text or "find" in command_text:
                            return "search for", self._extract_search_terms(command_text)
                        elif "play" in command_text or "watch" in command_text or "video" in command_text:
                            return "play video", self._extract_search_terms(command_text)
                        elif "open" in command_text or "visit" in command_text or "browse" in command_text:
                            website = self._extract_website(command_text)
                            return "open website", website
                    
                    elif category == 'media_operations':
                        if "screenshot" in command_text or "screen shot" in command_text:
                            return "take screenshot", ""
                        elif "edit" in command_text and ("image" in command_text or "picture" in command_text or "photo" in command_text):
                            return "edit image", self._extract_file_path(command_text)
                    
                    elif category == 'system_operations':
                        if "time" in command_text:
                            return "show time", ""
                        elif "date" in command_text:
                            return "show date", ""
                        elif "system" in command_text or "status" in command_text:
                            return "check system", ""
                        elif "memory" in command_text:
                            return "check memory", ""
                        elif "cpu" in command_text:
                            return "check cpu", ""
                        elif "disk" in command_text:
                            return "check disk", ""
        
        # Special cases for common commands
        if "youtube" in command_text:
            return "play video", self._extract_search_terms(command_text)
        
        if ".com" in command_text or ".org" in command_text or ".net" in command_text:
            website = self._extract_website(command_text)
            if website:
                return "open website", website
        
        return "", ""
    
    def _handle_intent(self, intent: str, args: str, original_command: str) -> str:
        """
        Handle a detected intent
        
        Args:
            intent: The detected intent
            args: Arguments for the intent
            original_command: The original command text
            
        Returns:
            Response text
        """
        if not intent:
            return "I couldn't determine what you want me to do."
        
        # Check if we have a direct handler for this intent
        if intent in self.command_handlers:
            return self.command_handlers[intent](args)
        
        # Handle file operations
        if intent.endswith("file"):
            action = intent.split()[0]
            if action == "open" and args:
                return self._handle_open_file(args)
            elif action == "edit" and args:
                return self._handle_edit_file(args)
            elif action == "create" and args:
                return self._handle_create_file(args)
            elif action == "delete" and args:
                return self._handle_delete_file(args)
            elif action == "rename" and "to" in original_command:
                # Extract source and target for rename
                parts = original_command.split("to", 1)
                if len(parts) == 2:
                    source = self._extract_file_path(parts[0])
                    target = self._extract_file_path(parts[1])
                    if source and target:
                        return self._handle_rename_file(f"{source} to {target}")
        
        # If we got here, we recognized an intent but couldn't handle it
        logger.warning(f"Recognized intent '{intent}' but couldn't handle it with args: '{args}'")
        return f"I understood you want to {intent}, but I couldn't process it correctly. Please try again with more specific instructions."
    
    def _extract_search_terms(self, text):
        """Extract search terms from command text"""
        # Remove common phrases like "search for" or "look up"
        for phrase in ["search for", "look up", "find", "search", "youtube", "video", "play"]:
            text = text.replace(phrase, "").strip()
        return text if text else ""
    
    def _extract_file_path(self, text):
        """Extract file path from command text"""
        # Look for phrases like "file X" or "document Y"
        match = re.search(r'(file|document|image|picture|photo)\s+([^\s]+)', text)
        if match:
            return match.group(2)
            
        # Look for quoted file paths
        match = re.search(r'["\'](.*?)["\'](\s+file)?', text)
        if match:
            return match.group(1)
            
        # Look for file extensions
        match = re.search(r'\b([\w\-\.]+\.(txt|pdf|doc|docx|jpg|jpeg|png|gif|mp4|mp3))\b', text)
        if match:
            return match.group(1)
            
        return ""
    
    def _extract_website(self, text):
        """Extract website from command text"""
        # Look for URLs or domain names
        match = re.search(r'(https?://)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', text)
        if match:
            domain = match.group(2)
            if not match.group(1):  # If no http:// or https:// prefix
                return f"https://{domain}"
            return f"{match.group(1)}{domain}"
        
        # Look for "website X" or "site Y"
        match = re.search(r'(website|site)\s+([^\s]+)', text)
        if match:
            return f"https://{match.group(2)}.com"
        
        return ""
    
    # File operation handlers
    @handle_errors("command_processor", "file_operation")
    def _handle_open_file(self, args):
        """Handle opening a file"""
        if not args:
            return "Please specify a file to open."
        
        file_path = self._resolve_path(args)
        if not os.path.exists(file_path):
            return f"File not found: {file_path}"
        
        try:
            # Use the default application to open the file
            if os.name == 'nt':  # Windows
                os.startfile(file_path)
            else:  # macOS and Linux
                subprocess.run(['xdg-open', file_path], check=True)
            return f"Opening file: {file_path}"
        except Exception as e:
            logger.error(f"Error opening file: {e}")
            return f"Failed to open file: {e}"
    
    @handle_errors("command_processor", "file_operation")
    def _handle_edit_file(self, args):
        """Handle editing a file"""
        if not args:
            return "Please specify a file to edit."
        
        file_path = self._resolve_path(args)
        if not os.path.exists(file_path):
            return f"File not found: {file_path}"
        
        try:
            # Use the default editor or notepad on Windows
            if os.name == 'nt':  # Windows
                subprocess.Popen(['notepad.exe', file_path])
            else:  # macOS and Linux
                editor = os.environ.get('EDITOR', 'nano')
                subprocess.Popen([editor, file_path])
            return f"Opening file for editing: {file_path}"
        except Exception as e:
            logger.error(f"Error editing file: {e}")
            return f"Failed to edit file: {e}"
    
    @handle_errors("command_processor", "file_operation")
    def _handle_create_file(self, args):
        """Handle creating a file"""
        if not args:
            return "Please specify a file name to create."
        
        file_path = self._resolve_path(args)
        
        try:
            # Create the directory if it doesn't exist
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            # Create an empty file
            with open(file_path, 'w') as f:
                pass
            
            return f"Created file: {file_path}"
        except Exception as e:
            logger.error(f"Error creating file: {e}")
            return f"Failed to create file: {e}"
    
    @handle_errors("command_processor", "file_operation")
    def _handle_delete_file(self, args):
        """Handle deleting a file"""
        if not args:
            return "Please specify a file to delete."

        file_path = self._resolve_path(args)

        # Security check for protected paths
        protected_paths = ["/root/", "C:\\Windows\\System32\\", "/etc/"]
        for protected in protected_paths:
            if protected.lower() in file_path.lower():
                logger.warning(f"Attempted to delete protected file: {file_path}")
                # This is a security check, not a retryable file system error.
                # We create and track the error here, then return a user-friendly message.
                if ERROR_HANDLING_AVAILABLE:
                    error = PermissionError(f"Attempt to delete protected path: {file_path}")
                    self.error_tracker.track_error(
                        "command_processor",
                        "permission",
                        error,
                        {"operation": "delete", "path": file_path}
                    )
                return f"Permission denied: Cannot access protected file {file_path}"

        if not os.path.exists(file_path):
            return f"File not found: {file_path}"

        # Retry logic for file deletion
        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
                return f"Deleted file: {file_path}"
            except (PermissionError, OSError) as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Error deleting file (attempt {attempt + 1}/{max_retries}): {e}. Retrying...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    logger.error(f"Failed to delete file after {max_retries} attempts: {e}")
                    raise  # Re-raise the exception to be caught by the decorator
            except FileNotFoundError:
                logger.info(f"File already deleted, likely by a concurrent process: {file_path}")
                return f"File already deleted: {file_path}"

    @handle_errors("command_processor", "file_operation")
    def _handle_rename_file(self, args):
        """Handle renaming a file"""
        if not args:
            return "Please specify source and target file names (e.g., 'rename file source.txt to target.txt')."
        
        if " to " not in args:
            return "Invalid format. Please use 'rename file source.txt to target.txt'."
        
        parts = args.split(" to ")
        if len(parts) != 2:
            return "Invalid format. Please use 'rename file source.txt to target.txt'."
        
        source_path = self._resolve_path(parts[0].strip())
        target_path = self._resolve_path(parts[1].strip())
        
        if not os.path.exists(source_path):
            return f"Source file not found: {source_path}"
        
        try:
            os.rename(source_path, target_path)
            return f"Renamed file from {source_path} to {target_path}"
        except Exception as e:
            logger.error(f"Error renaming file from {source_path} to {target_path}: {e}")
            raise
    
    @handle_errors("command_processor", "file_operation")
    def _handle_copy_file(self, args):
        """Handle copying a file"""
        if not args or " to " not in args:
            return "Please specify source and target file names (e.g., 'copy file source.txt to target.txt')."
        
        parts = args.split(" to ")
        if len(parts) != 2:
            return "Invalid format. Please use 'copy file source.txt to target.txt'."
        
        source_path = self._resolve_path(parts[0].strip())
        target_path = self._resolve_path(parts[1].strip())
        
        if not os.path.exists(source_path):
            return f"Source file not found: {source_path}"
        
        try:
            shutil.copy2(source_path, target_path)
            return f"Copied file from {source_path} to {target_path}"
        except Exception as e:
            logger.error(f"Error copying file from {source_path} to {target_path}: {e}")
            raise
    
    @handle_errors("command_processor", "file_operation")
    def _handle_move_file(self, args):
        """Handle moving a file"""
        if not args or " to " not in args:
            return "Please specify source and target file names (e.g., 'move file source.txt to target.txt')."
        
        parts = args.split(" to ")
        if len(parts) != 2:
            return "Invalid format. Please use 'move file source.txt to target.txt'."
        
        source_path = self._resolve_path(parts[0].strip())
        target_path = self._resolve_path(parts[1].strip())
        
        if not os.path.exists(source_path):
            return f"Source file not found: {source_path}"
        
        try:
            shutil.move(source_path, target_path)
            return f"Moved file from {source_path} to {target_path}"
        except Exception as e:
            logger.error(f"Error moving file from {source_path} to {target_path}: {e}")
            raise
    
    @handle_errors("command_processor", "file_operation")
    def _handle_list_files(self, args):
        """Handle listing files in a directory"""
        directory = args.strip() if args.strip() else os.getcwd()
        directory_path = self._resolve_path(directory)
        
        if not os.path.exists(directory_path):
            return f"Directory not found: {directory_path}"
        
        if not os.path.isdir(directory_path):
            return f"{directory_path} is not a directory."
        
        try:
            files = os.listdir(directory_path)
            if not files:
                return f"No files found in {directory_path}"
            
            # Group files by type
            file_types = {}
            for file in files:
                file_path = os.path.join(directory_path, file)
                if os.path.isdir(file_path):
                    file_type = "directory"
                else:
                    ext = os.path.splitext(file)[1].lower()
                    file_type = ext[1:] if ext else "file"
                
                if file_type not in file_types:
                    file_types[file_type] = []
                file_types[file_type].append(file)
            
            # Format the response
            response = f"Files in {directory_path}:\n"
            for file_type, files_list in file_types.items(): 
                response += f"\n{file_type.upper()} ({len(files_list)}):\n"
                for file_item in sorted(files_list): 
                    response += f"- {file_item}\n"
            
            return response
        except Exception as e:
            logger.error(f"Error listing files in directory {directory_path}: {e}")
            raise
    
    # Web operation handlers
    @handle_errors("command_processor", "web_operation")
    def _handle_open_website(self, args):
        """Handle opening a website"""
        if not args:
            return "Please specify a website to open."
        
        # Add https:// if not present
        url = args
        if not url.startswith("http"):
            url = "https://" + url
        
        try:
            webbrowser.open(url)
            return f"Opening website: {url}"
        except Exception as e:
            logger.error(f"Error opening website {url}: {e}")
            raise
    
    @handle_errors("command_processor", "web_operation")
    def _handle_browse(self, args):
        """Handle browsing a website with more options"""
        if not args:
            return "Please specify what you want to browse."
        
        # Check if it's a URL or search term
        if re.search(r'\.(com|org|net|edu|gov|io)\b', args) or args.startswith('http'):
            return self._handle_open_website(args)
        else:
            return self._handle_search_web(args)
    
    @handle_errors("command_processor", "web_operation")
    def _handle_download(self, args):
        """Handle downloading content from the web"""
        if not args:
            return "Please specify what you want to download."
        
        # This is a placeholder - actual implementation would require additional libraries
        # like requests to download files and would need to handle various content types
        return "Download functionality is not fully implemented yet. Please use your browser to download files."

    
    @handle_errors("command_processor", "web_operation")
    def _handle_search_web(self, args):
        """Handle web search"""
        if not args:
            return "Please specify what to search for."
        
        search_url = f"https://www.google.com/search?q={'+'.join(args.split())}"
        
        try:
            webbrowser.open(search_url)
            return f"Searching for: {args}"
        except Exception as e:
            logger.error(f"Error performing web search for \"{args}\": {e}")
            raise
    
    @handle_errors("command_processor", "web_operation")
    def _handle_play_video(self, args):
        """Handle playing a video on YouTube"""
        if not args:
            return "Please specify what video to play."
        
        youtube_url = f"https://www.youtube.com/results?search_query={'+'.join(args.split())}"
        
        try:
            webbrowser.open(youtube_url)
            return f"Searching for video: {args} on YouTube"
        except Exception as e:
            logger.error(f"Error searching YouTube for \"{args}\": {e}")
            raise
    
    # Media operation handlers
    @handle_errors("command_processor", "media_operation")
    def _handle_edit_image(self, args):
        """Handle editing an image"""
        if not args:
            return "Please specify an image to edit."
        
        file_path = self._resolve_path(args)
        if not os.path.exists(file_path):
            return f"Image not found: {file_path}"
        
        # Check if it's an image file
        if not file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
            return f"Not an image file: {file_path}"
        
        try:
            # Try to open with default image editor
            if os.name == 'nt':  # Windows
                os.startfile(file_path)
            else:  # macOS and Linux
                subprocess.run(['xdg-open', file_path], check=True)
            return f"Opening image for editing: {file_path}"
        except Exception as e:
            logger.error(f"Error editing image {file_path}: {e}")
            raise
    
    def _handle_post_video(self, args):
        """Handle posting a video"""
        # This is a placeholder - would need integration with specific platforms
        return "Video posting requires platform-specific integration. Please specify the platform (YouTube, TikTok, etc.) and I'll help you set up the integration."
    
    # System operation handlers
    @handle_errors("command_processor", "media_operation")
    def _handle_screenshot(self, args):
        """Handle taking a screenshot"""
        try:
            import pyautogui
            
            # Create screenshots directory if it doesn't exist
            screenshots_dir = os.path.join(os.path.expanduser("~"), "ALEJO_Screenshots")
            os.makedirs(screenshots_dir, exist_ok=True)
            
            # Generate filename with timestamp
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            screenshot_path = os.path.join(screenshots_dir, f"screenshot_{timestamp}.png")
            
            # Take the screenshot
            screenshot = pyautogui.screenshot()
            screenshot.save(screenshot_path)
            
            return f"Screenshot saved to: {screenshot_path}"
        except ImportError:
            return "Screenshot functionality requires the pyautogui package. Please install it with: pip install pyautogui"
        except Exception as e:
            logger.error(f"Error taking screenshot: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_system_check(self, args):
        """Handle system check"""
        try:
            if not PSUTIL_AVAILABLE:
                return "System check requires the psutil package. Please install it with 'pip install psutil'."
            
            # Get system information
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            boot_time = datetime.datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")
            
            # Get system info
            system_info = {
                "System": platform.system(),
                "Node": platform.node(),
                "Release": platform.release(),
                "Version": platform.version(),
                "Machine": platform.machine(),
                "Processor": platform.processor()
            }
            
            # Get network information
            net_io = psutil.net_io_counters()
            net_sent_mb = net_io.bytes_sent / (1024 * 1024)
            net_recv_mb = net_io.bytes_recv / (1024 * 1024)
            
            # Format the response
            response = "System Status:\n"
            response += f"CPU Usage: {cpu_percent}%\n"
            response += f"Memory: {memory.percent}% used ({memory.used / (1024 * 1024 * 1024):.2f} GB / {memory.total / (1024 * 1024 * 1024):.2f} GB)\n"
            response += f"Disk: {disk.percent}% used ({disk.used / (1024 * 1024 * 1024):.2f} GB / {disk.total / (1024 * 1024 * 1024):.2f} GB)\n"
            response += f"System Boot Time: {boot_time}\n"
            response += f"Network: Sent {net_sent_mb:.2f} MB, Received {net_recv_mb:.2f} MB"
            
            return response
        except Exception as e:
            logger.error(f"Error checking system: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_show_time(self, args):
        """Handle showing the current time"""
        try:
            current_time = datetime.datetime.now().strftime("%H:%M:%S")
            return f"The current time is: {current_time}"
        except Exception as e:
            logger.error(f"Error showing time: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_show_date(self, args):
        """Handle showing the current date"""
        try:
            current_date = datetime.datetime.now().strftime("%Y-%m-%d")
            day_name = datetime.datetime.now().strftime("%A")
            return f"Today is {day_name}, {current_date}"
        except Exception as e:
            logger.error(f"Error showing date: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_check_memory(self, args):
        """Handle checking memory usage"""
        try:
            if not PSUTIL_AVAILABLE:
                return "Memory check requires the psutil package. Please install it with 'pip install psutil'."
            
            memory = psutil.virtual_memory()
            response = "Memory Status:\n"
            response += f"Total: {memory.total / (1024 * 1024 * 1024):.2f} GB\n"
            response += f"Available: {memory.available / (1024 * 1024 * 1024):.2f} GB\n"
            response += f"Used: {memory.used / (1024 * 1024 * 1024):.2f} GB ({memory.percent}%)\n"
            response += f"Free: {memory.free / (1024 * 1024 * 1024):.2f} GB"
            
            return response
        except Exception as e:
            logger.error(f"Error checking memory: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_check_cpu(self, args):
        """Handle checking CPU usage"""
        try:
            if not PSUTIL_AVAILABLE:
                return "CPU check requires the psutil package. Please install it with 'pip install psutil'."
            
            # Get overall CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Get per-core CPU usage
            cpu_percent_per_core = psutil.cpu_percent(interval=1, percpu=True)
            
            # Get CPU frequency
            cpu_freq = psutil.cpu_freq()
            
            response = "CPU Status:\n"
            response += f"Overall CPU Usage: {cpu_percent}%\n\n"
            
            response += "CPU Usage Per Core:\n"
            for i, percent in enumerate(cpu_percent_per_core):
                response += f"Core {i}: {percent}%\n"
            
            if cpu_freq:
                response += f"\nCPU Frequency: {cpu_freq.current / 1000:.2f} GHz"
                if hasattr(cpu_freq, 'min') and cpu_freq.min:
                    response += f" (Min: {cpu_freq.min / 1000:.2f} GHz, Max: {cpu_freq.max / 1000:.2f} GHz)"
            
            return response
        except Exception as e:
            logger.error(f"Error checking CPU: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_check_disk(self, args):
        """Handle checking disk usage"""
        try:
            if not PSUTIL_AVAILABLE:
                return "Disk check requires the psutil package. Please install it with 'pip install psutil'."
            
            # Get disk partitions
            partitions = psutil.disk_partitions()
            
            response = "Disk Status:\n"
            for partition in partitions:
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    response += f"\nDrive {partition.device} ({partition.mountpoint}):\n"
                    response += f"  Total: {usage.total / (1024 * 1024 * 1024):.2f} GB\n"
                    response += f"  Used: {usage.used / (1024 * 1024 * 1024):.2f} GB ({usage.percent}%)\n"
                    response += f"  Free: {usage.free / (1024 * 1024 * 1024):.2f} GB\n"
                    response += f"  File System: {partition.fstype}"
                except PermissionError:
                    response += f"\nDrive {partition.device}: Permission denied\n"
            
            return response
        except Exception as e:
            logger.error(f"Error checking disk: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_check_battery(self, args):
        """Handle checking battery status"""
        try:
            if not PSUTIL_AVAILABLE:
                return "Battery check requires the psutil package. Please install it with 'pip install psutil'."
            
            if not hasattr(psutil, 'sensors_battery') or psutil.sensors_battery() is None:
                return "Battery information is not available on this system."
            
            battery = psutil.sensors_battery()
            
            if battery is None:
                return "No battery detected on this system."
            
            percent = battery.percent
            power_plugged = battery.power_plugged
            
            status = "Charging" if power_plugged else "Discharging"
            
            response = "Battery Status:\n"
            response += f"Charge: {percent}%\n"
            response += f"Status: {status}\n"
            
            if not power_plugged and battery.secsleft != psutil.POWER_TIME_UNLIMITED and battery.secsleft != psutil.POWER_TIME_UNKNOWN:
                hours, remainder = divmod(battery.secsleft, 3600)
                minutes, seconds = divmod(remainder, 60)
                response += f"Time remaining: {hours:02d}:{minutes:02d}:{seconds:02d}"
            
            return response
        except Exception as e:
            logger.error(f"Error checking battery: {e}")
            raise
    
    @handle_errors("command_processor", "system_operation")
    def _handle_check_network(self, args):
        """Handle checking network status"""
        try:
            if not PSUTIL_AVAILABLE:
                return "Network check requires the psutil package. Please install it with 'pip install psutil'."
            
            # Get network information
            net_io = psutil.net_io_counters()
            net_connections = psutil.net_connections()
            
            # Count active connections by type
            connection_types = {}
            for conn in net_connections:
                conn_type = conn.type
                if conn_type not in connection_types:
                    connection_types[conn_type] = 0
                connection_types[conn_type] += 1
            
            response = "Network Status:\n"
            response += f"Bytes Sent: {net_io.bytes_sent / (1024 * 1024):.2f} MB\n"
            response += f"Bytes Received: {net_io.bytes_recv / (1024 * 1024):.2f} MB\n"
            response += f"Packets Sent: {net_io.packets_sent}\n"
            response += f"Packets Received: {net_io.packets_recv}\n\n"
            
            response += "Active Connections:\n"
            for conn_type, count in connection_types.items():
                response += f"Type {conn_type}: {count} connections\n"
            
            return response
        except Exception as e:
            logger.error(f"Error checking network: {e}")
            raise
    
    def _resolve_path(self, path_str):
        """Resolve a path string to an absolute path"""
        if os.path.isabs(path_str):
            return path_str
        
        # If path starts with ~, expand user directory
        if path_str.startswith('~'):
            return os.path.expanduser(path_str)
        
        # Otherwise, assume relative to current directory
        return os.path.abspath(path_str)


# Singleton instance
_command_processor_instance = None

def get_command_processor(config: Dict[str, Any] = None) -> CommandProcessor:
    """Get the command processor singleton instance.
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        CommandProcessor instance
    """
    global _command_processor_instance
    if _command_processor_instance is None:
        _command_processor_instance = CommandProcessor(config)
    elif config and "error_tracker" in config:
        # Update error tracker if provided
        _command_processor_instance.error_tracker = config["error_tracker"]
    return _command_processor_instance
