"""
ALEJO Command Processor Service
Handles command execution with event-based architecture and monitoring
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

from ..core.event_bus import EventBus, Event, EventType
from ..core.monitoring import MonitoringSystem
from ..commands import CommandProcessor, CommandResult
from ..utils.exceptions import CommandError

logger = logging.getLogger(__name__)

class CommandProcessorService:
    """
    Enhanced command processor service with event support and monitoring
    """
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.event_bus = EventBus(redis_url)
        self.command_processor = CommandProcessor()
        self.monitoring = None  # Will be set during start()
        
        # Command history for context
        self.command_history: List[Dict] = []
        self.max_history = 100
        
        # Command statistics
        self.stats = {
            "total_commands": 0,
            "successful_commands": 0,
            "failed_commands": 0,
            "command_types": {}
        }
        
    async def start(self, metrics_port: int = 9091):
        """Start the command processor service"""
        await self.event_bus.start()
        
        # Initialize monitoring
        self.monitoring = MonitoringSystem(self.event_bus)
        await self.monitoring.start(metrics_port)
        self.monitoring.register_service("command_processor")
        
        # Subscribe to command events
        self.event_bus.subscribe(EventType.COMMAND, self._handle_command_event)
        self.event_bus.subscribe(EventType.SYSTEM, self._handle_system_event)
        
        logger.info("Command processor service started")
        
    async def stop(self):
        """Stop the command processor service"""
        await self.event_bus.stop()
        logger.info("Command processor service stopped")
        
    async def process_command(self, command: str, parameters: dict = None,
                            context: dict = None) -> CommandResult:
        """
        Process a command with monitoring and event emission
        """
        start_time = datetime.now()
        parameters = parameters or {}
        context = context or {}
        
        try:
            # Record command attempt
            self.stats["total_commands"] += 1
            command_type = command.split()[0] if command else "unknown"
            self.stats["command_types"][command_type] = \
                self.stats["command_types"].get(command_type, 0) + 1
            
            # Execute command
            result = await self.command_processor.execute(
                command,
                parameters,
                context
            )
            
            # Record success
            self.stats["successful_commands"] += 1
            
            # Update command history
            self._update_history({
                "command": command,
                "parameters": parameters,
                "context": context,
                "result": result.dict(),
                "timestamp": datetime.now().isoformat(),
                "success": True
            })
            
            # Record metrics
            duration = (datetime.now() - start_time).total_seconds()
            self.monitoring.record_request(
                "command_processor",
                f"command/{command_type}",
                duration
            )
            
            # Emit success event
            await self.event_bus.emit_command(
                command=command,
                parameters=parameters,
                result=result.dict(),
                source="command_processor"
            )
            
            return result
            
        except Exception as e:
            # Record failure
            self.stats["failed_commands"] += 1
            error_msg = str(e)
            
            # Update command history
            self._update_history({
                "command": command,
                "parameters": parameters,
                "context": context,
                "error": error_msg,
                "timestamp": datetime.now().isoformat(),
                "success": False
            })
            
            # Record error metrics
            self.monitoring.record_error(
                "command_processor",
                "command_execution",
                error_msg
            )
            
            # Emit failure event
            await self.event_bus.emit_command(
                command=command,
                parameters=parameters,
                error=error_msg,
                source="command_processor"
            )
            
            raise CommandError(f"Command execution failed: {error_msg}")
            
    def _update_history(self, entry: dict):
        """Update command history, maintaining max size"""
        self.command_history.append(entry)
        if len(self.command_history) > self.max_history:
            self.command_history.pop(0)
            
    async def _handle_command_event(self, event: Event):
        """Handle incoming command events"""
        if event.source != "command_processor":
            try:
                command = event.payload.get("command")
                if command:
                    await self.process_command(
                        command,
                        event.payload.get("parameters"),
                        event.payload.get("context")
                    )
            except Exception as e:
                logger.error(f"Error handling command event: {e}")
                
    async def _handle_system_event(self, event: Event):
        """Handle system events"""
        if event.payload.get("action") == "get_stats":
            # Return command statistics
            await self.event_bus.emit_system(
                action="stats_response",
                data={
                    "service": "command_processor",
                    "stats": self.stats,
                    "recent_history": self.command_history[-10:]  # Last 10 commands
                },
                source="command_processor"
            )
            
    def get_command_stats(self) -> dict:
        """Get command execution statistics"""
        return {
            **self.stats,
            "success_rate": (
                self.stats["successful_commands"] / self.stats["total_commands"]
                if self.stats["total_commands"] > 0 else 0
            ),
            "recent_history": self.command_history[-10:]  # Last 10 commands
        }
        
    def get_command_types(self) -> List[str]:
        """Get list of available command types"""
        return list(self.command_processor.get_available_commands())
