"""
ALEJO Main UI Interface

This module provides the main UI interface for ALEJO, integrating all UI components
and connecting them to the ALEJO Brain. It serves as the entry point for the
user interface and manages the overall UI layout and interactions.
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import json
import threading
import time

# UI framework imports
try:
    import gradio as gr
except ImportError:
    gr = None

# Import UI components
from alejo.ui.components.emotional_insights import create_emotional_insights_component
from alejo.ui.components.multimodal_interface import create_multimodal_interface_component

# Import ALEJO core
from alejo.core.brain import Brain
from alejo.utils.config import Config
from alejo.utils.logging_config import setup_logging

logger = logging.getLogger("alejo.ui.main_interface")

class AlejoUI:
    """
    Main UI interface for ALEJO
    
    This class integrates all UI components and connects them to the ALEJO Brain.
    It provides methods for starting and stopping the UI server, as well as
    handling global UI events and state.
    """
    
    def __init__(
        self,
        brain: Optional[Brain] = None,
        config_path: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the ALEJO UI
        
        Args:
            brain: ALEJO Brain instance (optional, will create one if not provided)
            config_path: Path to configuration file (optional)
            config: Configuration dictionary (optional)
        """
        # Setup logging
        setup_logging()
        
        # Load configuration
        self.config = config or {}
        if config_path:
            config_obj = Config(config_path)
            self.config = config_obj.get_config()
        
        # Initialize or use provided brain
        self.brain = brain
        if self.brain is None:
            try:
                self.brain = Brain(self.config.get("brain", {}))
                logger.info("Created new Brain instance")
            except Exception as e:
                logger.error(f"Failed to create Brain: {e}")
                self.brain = None
        
        # Get event bus from brain
        self.event_bus = self.brain.event_bus if self.brain else None
        
        # UI components
        self.components = {}
        
        # UI state
        self.is_running = False
        self.server = None
        self.ui_thread = None
        
        # Check if Gradio is available
        if gr is None:
            logger.warning("Gradio not available. UI will not be rendered.")
        
        logger.info("ALEJO UI initialized")
    
    def create_ui(self):
        """
        Create the UI components and layout
        
        Returns:
            Gradio interface
        """
        if gr is None:
            logger.error("Cannot create UI: Gradio not available")
            return None
        
        # Create UI components
        self._create_components()
        
        # Create main interface
        with gr.Blocks(
            title="ALEJO AI",
            theme=gr.themes.Soft(
                primary_hue="indigo",
                secondary_hue="blue"
            ),
            css=self._get_custom_css()
        ) as interface:
            # Header
            with gr.Row(elem_id="header"):
                gr.Markdown(
                    "# ALEJO AI Platform\n"
                    "### Advanced Local Emotional & Judgmental Oracle"
                )
            
            # Main content
            with gr.Tabs() as tabs:
                # Chat interface
                with gr.TabItem("Chat", id="chat_tab"):
                    self._create_chat_interface()
                
                # Multimodal interface
                with gr.TabItem("Multimodal", id="multimodal_tab"):
                    if "multimodal" in self.components:
                        self.components["multimodal"].create_ui()
                
                # Emotional insights
                with gr.TabItem("Emotional Intelligence", id="emotional_tab"):
                    if "emotional" in self.components:
                        self.components["emotional"].create_ui()
                
                # Settings
                with gr.TabItem("Settings", id="settings_tab"):
                    self._create_settings_interface()
            
            # Footer
            with gr.Row(elem_id="footer"):
                gr.Markdown(
                    "ALEJO AI Platform - 100% Local Inference - "
                    "Developed with ❤️ for privacy and ethical AI"
                )
            
            # Register global event handlers
            self._register_global_events(interface)
        
        return interface
    
    def _create_components(self):
        """Create UI components"""
        # Create emotional insights component
        try:
            self.components["emotional"] = create_emotional_insights_component(
                brain=self.brain,
                event_bus=self.event_bus,
                config=self.config.get("ui", {}).get("emotional", {})
            )
            logger.info("Created emotional insights component")
        except Exception as e:
            logger.error(f"Failed to create emotional insights component: {e}")
        
        # Create multimodal interface component
        try:
            self.components["multimodal"] = create_multimodal_interface_component(
                brain=self.brain,
                event_bus=self.event_bus,
                config=self.config.get("ui", {}).get("multimodal", {})
            )
            logger.info("Created multimodal interface component")
        except Exception as e:
            logger.error(f"Failed to create multimodal interface component: {e}")
    
    def _create_chat_interface(self):
        """Create chat interface"""
        with gr.Row():
            with gr.Column(scale=3):
                # Chat history
                chat_history = gr.Chatbot(
                    label="Chat History",
                    height=500,
                    elem_id="chat_history"
                )
                
                # Input area
                with gr.Row():
                    with gr.Column(scale=8):
                        chat_input = gr.Textbox(
                            label="Message",
                            placeholder="Type your message here...",
                            lines=2,
                            elem_id="chat_input"
                        )
                    
                    with gr.Column(scale=1):
                        send_btn = gr.Button("Send", variant="primary")
                
                # Clear button
                clear_btn = gr.Button("Clear Chat")
            
            # Right sidebar - Context and state
            with gr.Column(scale=1):
                gr.Markdown("### ALEJO State")
                
                # Brain state
                brain_state = gr.JSON(
                    label="Brain State",
                    value={"status": "ready"},
                    elem_id="brain_state"
                )
                
                # Memory usage
                memory_usage = gr.Label(
                    label="Memory Usage",
                    value="0 MB",
                    elem_id="memory_usage"
                )
                
                # Refresh button
                refresh_btn = gr.Button("Refresh State")
        
        # Chat events
        send_btn.click(
            fn=self._handle_chat_message,
            inputs=[chat_input, chat_history],
            outputs=[chat_input, chat_history]
        )
        
        chat_input.submit(
            fn=self._handle_chat_message,
            inputs=[chat_input, chat_history],
            outputs=[chat_input, chat_history]
        )
        
        clear_btn.click(
            fn=lambda: None,
            outputs=[chat_history],
            _js="() => []"
        )
        
        refresh_btn.click(
            fn=self._get_brain_state,
            outputs=[brain_state, memory_usage]
        )
    
    def _create_settings_interface(self):
        """Create settings interface"""
        with gr.Row():
            with gr.Column():
                gr.Markdown("### ALEJO Settings")
                
                # Model settings
                gr.Markdown("#### Model Settings")
                model_dropdown = gr.Dropdown(
                    label="Default LLM Model",
                    choices=["local/llama-3-8b", "local/mistral-7b", "local/phi-3"],
                    value="local/llama-3-8b"
                )
                
                temperature_slider = gr.Slider(
                    label="Temperature",
                    minimum=0.0,
                    maximum=1.0,
                    value=0.7,
                    step=0.1
                )
                
                # Memory settings
                gr.Markdown("#### Memory Settings")
                memory_limit_slider = gr.Slider(
                    label="Memory Limit (MB)",
                    minimum=512,
                    maximum=8192,
                    value=2048,
                    step=512
                )
                
                # Save button
                save_btn = gr.Button("Save Settings", variant="primary")
                
                # Status message
                status_msg = gr.Markdown("")
        
        # Settings events
        save_btn.click(
            fn=self._save_settings,
            inputs=[model_dropdown, temperature_slider, memory_limit_slider],
            outputs=[status_msg]
        )
    
    async def _handle_chat_message(self, message, history):
        """
        Handle chat message
        
        Args:
            message: User message
            history: Chat history
            
        Returns:
            Updated message and history
        """
        if not message:
            return "", history
        
        # Add user message to history
        history = history + [[message, None]]
        
        # Clear input
        message = ""
        
        # Process message with brain
        if self.brain:
            try:
                # Get response from brain
                response = await self.brain.process_message(history[-1][0])
                
                # Update history with response
                history[-1][1] = response
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                history[-1][1] = f"Error: {str(e)}"
        else:
            history[-1][1] = "Brain not available. Please check the logs."
        
        return message, history
    
    def _get_brain_state(self):
        """
        Get brain state
        
        Returns:
            Brain state and memory usage
        """
        if not self.brain:
            return {"status": "unavailable"}, "N/A"
        
        try:
            # Get brain state
            state = self.brain.get_state()
            
            # Get memory usage
            import psutil
            process = psutil.Process(os.getpid())
            memory_mb = process.memory_info().rss / (1024 * 1024)
            
            return state, f"{memory_mb:.1f} MB"
        except Exception as e:
            logger.error(f"Error getting brain state: {e}")
            return {"status": "error", "message": str(e)}, "Error"
    
    def _save_settings(self, model, temperature, memory_limit):
        """
        Save settings
        
        Args:
            model: Default LLM model
            temperature: Temperature
            memory_limit: Memory limit
            
        Returns:
            Status message
        """
        try:
            # Update config
            if "llm" not in self.config:
                self.config["llm"] = {}
            
            self.config["llm"]["default_model"] = model
            self.config["llm"]["temperature"] = temperature
            
            if "memory" not in self.config:
                self.config["memory"] = {}
            
            self.config["memory"]["limit_mb"] = memory_limit
            
            # Save config
            config_path = self.config.get("config_path", "config/alejo_config.json")
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
            
            with open(config_path, "w") as f:
                json.dump(self.config, f, indent=2)
            
            # Apply settings to brain
            if self.brain:
                self.brain.update_config(self.config)
            
            return "✅ Settings saved successfully"
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
            return f"❌ Error saving settings: {str(e)}"
    
    def _register_global_events(self, interface):
        """
        Register global event handlers
        
        Args:
            interface: Gradio interface
        """
        if not self.event_bus:
            return
        
        # Register global events
        # (These would be implemented based on specific needs)
        pass
    
    def _get_custom_css(self):
        """
        Get custom CSS for the UI
        
        Returns:
            Custom CSS string
        """
        return """
        #header {
            background-color: #f0f4f8;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
        }
        
        #footer {
            margin-top: 2rem;
            padding: 1rem;
            background-color: #f0f4f8;
            border-radius: 0.5rem;
            text-align: center;
        }
        
        #chat_history {
            min-height: 400px;
        }
        """
    
    def start(self, port=7860, share=False):
        """
        Start the UI server
        
        Args:
            port: Server port
            share: Whether to create a public link
            
        Returns:
            Server instance
        """
        if gr is None:
            logger.error("Cannot start UI: Gradio not available")
            return None
        
        # Create interface
        interface = self.create_ui()
        if interface is None:
            return None
        
        # Start server
        def run_server():
            self.server = interface.launch(
                server_name="0.0.0.0",
                server_port=port,
                share=share,
                prevent_thread_lock=True
            )
            self.is_running = True
            logger.info(f"UI server started on port {port}")
        
        # Start in a separate thread
        self.ui_thread = threading.Thread(target=run_server)
        self.ui_thread.daemon = True
        self.ui_thread.start()
        
        # Wait for server to start
        start_time = time.time()
        while not self.is_running and time.time() - start_time < 30:
            time.sleep(0.1)
        
        return self.server
    
    def stop(self):
        """Stop the UI server"""
        if self.server:
            try:
                self.server.close()
                logger.info("UI server stopped")
            except Exception as e:
                logger.error(f"Error stopping UI server: {e}")
        
        self.is_running = False
        
        # Wait for thread to finish
        if self.ui_thread and self.ui_thread.is_alive():
            self.ui_thread.join(timeout=5.0)

# Main entry point
def main():
    """Main entry point for the UI"""
    import argparse
    
    # Parse arguments
    parser = argparse.ArgumentParser(description="ALEJO UI")
    parser.add_argument(
        "--config",
        type=str,
        default="config/alejo_config.json",
        help="Path to configuration file"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=7860,
        help="Server port"
    )
    parser.add_argument(
        "--share",
        action="store_true",
        help="Create a public link"
    )
    
    args = parser.parse_args()
    
    # Create UI
    ui = AlejoUI(config_path=args.config)
    
    # Start UI
    ui.start(port=args.port, share=args.share)
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        # Stop UI on keyboard interrupt
        ui.stop()

if __name__ == "__main__":
    main()
