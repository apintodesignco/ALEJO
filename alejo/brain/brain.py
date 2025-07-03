"""
ALEJO - Advanced Language and Execution Joint Operator
Brain - Core cognitive processing engine
"""

import logging
import threading
import time
from typing import Dict, List, Optional, Any, Callable

from alejo.utils.exceptions import CommandError, LLMServiceError


class ALEJOBrain:
    """
    Main cognitive processing engine for ALEJO
    Coordinates between different modules and provides central intelligence
    """
    
    def __init__(self, config=None):
        """
        Initialize the ALEJO Brain
        
        Args:
            config: Configuration dictionary
        """
        self.config = config or {}
        self.running = False
        self.components = {}
        self.services = {}
        self.event_listeners = {}
        self.logger = logging.getLogger("alejo.brain")
        self.memory = {}
        self._lock = threading.RLock()
        
    def register_component(self, name: str, component: Any) -> None:
        """
        Register a component with the brain
        
        Args:
            name: Component name/identifier
            component: Component instance
        """
        with self._lock:
            self.components[name] = component
            self.logger.info(f"Registered component: {name}")
            
    def register_service(self, name: str, service: Any) -> None:
        """
        Register a service with the brain
        
        Args:
            name: Service name/identifier
            service: Service instance
        """
        with self._lock:
            self.services[name] = service
            self.logger.info(f"Registered service: {name}")
    
    def start(self) -> None:
        """
        Start the ALEJO Brain and all its registered components
        """
        with self._lock:
            if self.running:
                return
                
            self.logger.info("Starting ALEJO Brain...")
            
            # Start all components
            for name, component in self.components.items():
                try:
                    if hasattr(component, 'start') and callable(component.start):
                        component.start()
                        self.logger.info(f"Started component: {name}")
                except Exception as e:
                    self.logger.error(f"Failed to start component {name}: {str(e)}")
                    
            # Start all services
            for name, service in self.services.items():
                try:
                    if hasattr(service, 'start') and callable(service.start):
                        service.start()
                        self.logger.info(f"Started service: {name}")
                except Exception as e:
                    self.logger.error(f"Failed to start service {name}: {str(e)}")
            
            self.running = True
            self.logger.info("ALEJO Brain started successfully")
    
    def stop(self) -> None:
        """
        Stop the ALEJO Brain and all its registered components
        """
        with self._lock:
            if not self.running:
                return
                
            self.logger.info("Stopping ALEJO Brain...")
            
            # Stop all services (in reverse order)
            for name, service in reversed(list(self.services.items())):
                try:
                    if hasattr(service, 'stop') and callable(service.stop):
                        service.stop()
                        self.logger.info(f"Stopped service: {name}")
                except Exception as e:
                    self.logger.error(f"Failed to stop service {name}: {str(e)}")
            
            # Stop all components (in reverse order)
            for name, component in reversed(list(self.components.items())):
                try:
                    if hasattr(component, 'stop') and callable(component.stop):
                        component.stop()
                        self.logger.info(f"Stopped component: {name}")
                except Exception as e:
                    self.logger.error(f"Failed to stop component {name}: {str(e)}")
            
            self.running = False
            self.logger.info("ALEJO Brain stopped successfully")
    
    def execute_command(self, command: str, *args, **kwargs) -> Any:
        """
        Execute a command through the appropriate component
        
        Args:
            command: Command name to execute
            *args: Positional arguments for the command
            **kwargs: Keyword arguments for the command
            
        Returns:
            Command execution result
            
        Raises:
            CommandError: If command execution fails
        """
        try:
            # Find the right component to handle this command
            for component in self.components.values():
                if hasattr(component, 'can_handle_command') and callable(component.can_handle_command):
                    if component.can_handle_command(command):
                        return component.handle_command(command, *args, **kwargs)
            
            raise CommandError(f"No component can handle command: {command}")
        except Exception as e:
            if isinstance(e, CommandError):
                raise
            raise CommandError(f"Error executing command {command}: {str(e)}", command=command)
    
    def process_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process input from various sources and generate appropriate responses
        
        Args:
            input_data: Dictionary containing input data
            
        Returns:
            Dictionary containing response data
        """
        input_type = input_data.get("type", "unknown")
        self.logger.info(f"Processing input of type: {input_type}")
        
        # Simple stub implementation
        return {"status": "processed", "response": "Input received and processed"}
    
    def trigger_event(self, event_name: str, event_data: Any = None) -> None:
        """
        Trigger an event to be handled by registered listeners
        
        Args:
            event_name: Name of the event
            event_data: Data associated with the event
        """
        listeners = self.event_listeners.get(event_name, [])
        
        for listener in listeners:
            try:
                listener(event_name, event_data)
            except Exception as e:
                self.logger.error(f"Error in event listener for {event_name}: {str(e)}")
    
    def register_event_listener(self, event_name: str, listener: Callable) -> None:
        """
        Register a listener for a specific event
        
        Args:
            event_name: Name of the event to listen for
            listener: Callback function that takes (event_name, event_data)
        """
        if event_name not in self.event_listeners:
            self.event_listeners[event_name] = []
            
        self.event_listeners[event_name].append(listener)
        
    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the ALEJO Brain
        
        Returns:
            Dictionary with status information
        """
        return {
            "running": self.running,
            "components": list(self.components.keys()),
            "services": list(self.services.keys()),
            "event_listeners": {event: len(listeners) for event, listeners in self.event_listeners.items()}
        }
