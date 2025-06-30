"""
Multimodal Interface UI Component

This module provides UI components for interacting with ALEJO's multimodal
processing capabilities, including image upload, visual question answering,
scene analysis, and image captioning.
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Union
from pathlib import Path
import json
import base64
from io import BytesIO
import tempfile

# UI framework imports
try:
    import gradio as gr
    import numpy as np
    from PIL import Image
except ImportError:
    gr = None
    np = None
    Image = None

logger = logging.getLogger("alejo.ui.multimodal_interface")

class MultimodalInterfaceComponent:
    """
    UI component for multimodal interactions
    
    This component provides interfaces for:
    1. Image upload and display
    2. Visual question answering
    3. Scene analysis
    4. Image captioning
    """
    
    def __init__(
        self,
        brain=None,
        event_bus=None,
        config: Dict[str, Any] = None
    ):
        """
        Initialize the multimodal interface component
        
        Args:
            brain: ALEJO Brain instance
            event_bus: EventBus instance
            config: Configuration dictionary
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.config = config or {}
        
        # UI elements
        self.image_input = None
        self.image_display = None
        self.question_input = None
        self.response_output = None
        self.caption_output = None
        self.scene_analysis_output = None
        
        # State
        self.current_image_path = None
        self.current_image = None
        self.processing_history = []
        
        # Check if required libraries are available
        if gr is None or np is None or Image is None:
            logger.warning("Required libraries not available. UI components will not be rendered.")
        
        logger.info("Multimodal Interface UI component initialized")
    
    def create_ui(self, parent=None):
        """
        Create the UI components
        
        Args:
            parent: Parent UI container
            
        Returns:
            UI component
        """
        if gr is None:
            logger.error("Cannot create UI: Gradio not available")
            return None
        
        with gr.Column() as container:
            gr.Markdown("## Multimodal Processing Interface")
            
            with gr.Row():
                # Image upload and display
                with gr.Column(scale=2):
                    self.image_input = gr.Image(
                        label="Upload Image",
                        type="pil",
                        height=400
                    )
                    
                    # Add image upload event
                    self.image_input.change(
                        fn=self.handle_image_upload,
                        inputs=[self.image_input],
                        outputs=[]
                    )
                
                # Controls and outputs
                with gr.Column(scale=3):
                    # Tabs for different functionalities
                    with gr.Tabs() as tabs:
                        # Visual QA tab
                        with gr.TabItem("Visual Q&A"):
                            self.question_input = gr.Textbox(
                                label="Ask a question about the image",
                                placeholder="What can you see in this image?",
                                lines=2
                            )
                            
                            ask_button = gr.Button("Ask Question")
                            
                            self.response_output = gr.Markdown(
                                label="Response"
                            )
                            
                            # Add question event
                            ask_button.click(
                                fn=self.handle_visual_qa,
                                inputs=[self.image_input, self.question_input],
                                outputs=[self.response_output]
                            )
                        
                        # Image captioning tab
                        with gr.TabItem("Image Captioning"):
                            caption_button = gr.Button("Generate Caption")
                            
                            self.caption_output = gr.Textbox(
                                label="Generated Caption",
                                lines=3,
                                interactive=False
                            )
                            
                            # Add caption event
                            caption_button.click(
                                fn=self.handle_image_captioning,
                                inputs=[self.image_input],
                                outputs=[self.caption_output]
                            )
                        
                        # Scene analysis tab
                        with gr.TabItem("Scene Analysis"):
                            analyze_button = gr.Button("Analyze Scene")
                            
                            self.scene_analysis_output = gr.Markdown(
                                label="Scene Analysis"
                            )
                            
                            # Add analysis event
                            analyze_button.click(
                                fn=self.handle_scene_analysis,
                                inputs=[self.image_input],
                                outputs=[self.scene_analysis_output]
                            )
            
            # Processing history
            gr.Markdown("### Processing History")
            history_output = gr.JSON(
                label="Recent Processing",
                value=[],
                interactive=False
            )
            
            # Refresh history button
            refresh_btn = gr.Button("Refresh History")
            refresh_btn.click(
                fn=self.get_processing_history,
                inputs=[],
                outputs=[history_output]
            )
        
        # Register event handlers if event bus is available
        if self.event_bus:
            self.register_event_handlers()
        
        return container
    
    def register_event_handlers(self):
        """Register event handlers with the event bus"""
        if not self.event_bus:
            logger.warning("No event bus available. Cannot register event handlers.")
            return
        
        # Register handlers for multimodal events
        self.event_bus.register("brain.image_processed", self.handle_image_processed_event)
        self.event_bus.register("brain.visual_qa_completed", self.handle_visual_qa_event)
        self.event_bus.register("brain.scene_analyzed", self.handle_scene_analyzed_event)
        self.event_bus.register("brain.image_captioned", self.handle_image_captioned_event)
        
        logger.info("Multimodal Interface event handlers registered")
    
    async def handle_image_upload(self, image):
        """
        Handle image upload
        
        Args:
            image: Uploaded image
            
        Returns:
            Status message
        """
        if image is None:
            return "No image uploaded"
        
        try:
            # Save image to temporary file
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp:
                if isinstance(image, np.ndarray):
                    # Convert numpy array to PIL Image
                    pil_image = Image.fromarray(image)
                    pil_image.save(temp.name)
                else:
                    # Assume it's already a PIL Image
                    image.save(temp.name)
                
                self.current_image_path = temp.name
                self.current_image = image
            
            # Process image if brain is available
            if self.brain:
                await self.brain.process_image(self.current_image_path)
            
            # Add to processing history
            self._add_to_history("image_upload", {
                "action": "Image uploaded",
                "timestamp": asyncio.get_event_loop().time()
            })
            
            return "Image uploaded successfully"
        
        except Exception as e:
            logger.error(f"Error handling image upload: {e}")
            return f"Error: {str(e)}"
    
    async def handle_visual_qa(self, image, question):
        """
        Handle visual question answering
        
        Args:
            image: Image to analyze
            question: Question about the image
            
        Returns:
            Answer to the question
        """
        if image is None:
            return "Please upload an image first"
        
        if not question:
            return "Please enter a question"
        
        try:
            # Process image if it's new
            if self.current_image != image:
                await self.handle_image_upload(image)
            
            # Ask question if brain is available
            if self.brain:
                response = await self.brain.visual_qa(self.current_image_path, question)
                
                # Add to processing history
                self._add_to_history("visual_qa", {
                    "question": question,
                    "response": response,
                    "timestamp": asyncio.get_event_loop().time()
                })
                
                return f"**Q:** {question}\n\n**A:** {response}"
            else:
                return "Brain not available for processing"
        
        except Exception as e:
            logger.error(f"Error handling visual QA: {e}")
            return f"Error: {str(e)}"
    
    async def handle_image_captioning(self, image):
        """
        Handle image captioning
        
        Args:
            image: Image to caption
            
        Returns:
            Generated caption
        """
        if image is None:
            return "Please upload an image first"
        
        try:
            # Process image if it's new
            if self.current_image != image:
                await self.handle_image_upload(image)
            
            # Generate caption if brain is available
            if self.brain:
                caption = await self.brain.generate_image_caption(self.current_image_path)
                
                # Add to processing history
                self._add_to_history("image_captioning", {
                    "caption": caption,
                    "timestamp": asyncio.get_event_loop().time()
                })
                
                return caption
            else:
                return "Brain not available for processing"
        
        except Exception as e:
            logger.error(f"Error handling image captioning: {e}")
            return f"Error: {str(e)}"
    
    async def handle_scene_analysis(self, image):
        """
        Handle scene analysis
        
        Args:
            image: Image to analyze
            
        Returns:
            Scene analysis results
        """
        if image is None:
            return "Please upload an image first"
        
        try:
            # Process image if it's new
            if self.current_image != image:
                await self.handle_image_upload(image)
            
            # Analyze scene if brain is available
            if self.brain:
                analysis = await self.brain.analyze_scene(self.current_image_path)
                
                # Add to processing history
                self._add_to_history("scene_analysis", {
                    "analysis": analysis,
                    "timestamp": asyncio.get_event_loop().time()
                })
                
                # Format analysis as markdown
                markdown = "### Scene Analysis\n\n"
                
                if isinstance(analysis, str):
                    markdown += analysis
                elif isinstance(analysis, dict):
                    # Format dictionary
                    if "objects" in analysis:
                        markdown += "#### Detected Objects\n\n"
                        for obj in analysis["objects"]:
                            markdown += f"- {obj}\n"
                    
                    if "scene_type" in analysis:
                        markdown += f"\n#### Scene Type\n\n{analysis['scene_type']}\n"
                    
                    if "description" in analysis:
                        markdown += f"\n#### Description\n\n{analysis['description']}\n"
                
                return markdown
            else:
                return "Brain not available for processing"
        
        except Exception as e:
            logger.error(f"Error handling scene analysis: {e}")
            return f"Error: {str(e)}"
    
    def _add_to_history(self, action_type: str, data: Dict[str, Any]):
        """
        Add an action to the processing history
        
        Args:
            action_type: Type of action
            data: Action data
        """
        # Add to history
        self.processing_history.append({
            "type": action_type,
            **data
        })
        
        # Limit history size
        max_history = self.config.get("max_history_size", 10)
        if len(self.processing_history) > max_history:
            self.processing_history = self.processing_history[-max_history:]
    
    def get_processing_history(self):
        """
        Get the processing history
        
        Returns:
            List of processing history items
        """
        # Format timestamps
        formatted_history = []
        for item in self.processing_history:
            formatted_item = item.copy()
            if "timestamp" in formatted_item:
                formatted_item["timestamp"] = str(formatted_item["timestamp"])
            formatted_history.append(formatted_item)
        
        return formatted_history
    
    async def handle_image_processed_event(self, data: Dict[str, Any]):
        """
        Handle image processed event
        
        Args:
            data: Event data
        """
        if "image_path" not in data:
            return
        
        # Update current image path if it matches
        if data["image_path"] == self.current_image_path:
            logger.debug("Image processing completed")
    
    async def handle_visual_qa_event(self, data: Dict[str, Any]):
        """
        Handle visual QA event
        
        Args:
            data: Event data
        """
        if "question" not in data or "answer" not in data:
            return
        
        # Update response output if available
        if self.response_output:
            question = data["question"]
            answer = data["answer"]
            await self.response_output.update(f"**Q:** {question}\n\n**A:** {answer}")
    
    async def handle_scene_analyzed_event(self, data: Dict[str, Any]):
        """
        Handle scene analyzed event
        
        Args:
            data: Event data
        """
        if "analysis" not in data:
            return
        
        # Update scene analysis output if available
        if self.scene_analysis_output:
            analysis = data["analysis"]
            
            # Format analysis as markdown
            markdown = "### Scene Analysis\n\n"
            
            if isinstance(analysis, str):
                markdown += analysis
            elif isinstance(analysis, dict):
                # Format dictionary
                if "objects" in analysis:
                    markdown += "#### Detected Objects\n\n"
                    for obj in analysis["objects"]:
                        markdown += f"- {obj}\n"
                
                if "scene_type" in analysis:
                    markdown += f"\n#### Scene Type\n\n{analysis['scene_type']}\n"
                
                if "description" in analysis:
                    markdown += f"\n#### Description\n\n{analysis['description']}\n"
            
            await self.scene_analysis_output.update(markdown)
    
    async def handle_image_captioned_event(self, data: Dict[str, Any]):
        """
        Handle image captioned event
        
        Args:
            data: Event data
        """
        if "caption" not in data:
            return
        
        # Update caption output if available
        if self.caption_output:
            caption = data["caption"]
            await self.caption_output.update(caption)

# Factory function
def create_multimodal_interface_component(
    brain=None,
    event_bus=None,
    config: Dict[str, Any] = None
) -> MultimodalInterfaceComponent:
    """
    Create a multimodal interface component
    
    Args:
        brain: ALEJO Brain instance
        event_bus: EventBus instance
        config: Configuration dictionary
        
    Returns:
        MultimodalInterfaceComponent instance
    """
    return MultimodalInterfaceComponent(brain, event_bus, config)
