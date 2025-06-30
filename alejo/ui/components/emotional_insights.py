"""
Emotional Insights UI Component

This module provides UI components for visualizing emotional intelligence insights
from the ALEJO emotional intelligence system. It includes components for:
- Emotion visualization
- Sentiment analysis display
- Ethical decision explanation
- Interaction recommendations
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import json

# UI framework imports
try:
    import gradio as gr
except ImportError:
    gr = None

logger = logging.getLogger("alejo.ui.emotional_insights")

class EmotionalInsightsComponent:
    """
    UI component for displaying emotional intelligence insights
    
    This component provides visualizations and explanations for:
    1. Detected emotions in text and speech
    2. Sentiment analysis results
    3. Ethical decisions and principles
    4. Interaction recommendations
    """
    
    def __init__(
        self,
        brain=None,
        event_bus=None,
        config: Dict[str, Any] = None
    ):
        """
        Initialize the emotional insights component
        
        Args:
            brain: ALEJO Brain instance
            event_bus: EventBus instance
            config: Configuration dictionary
        """
        self.brain = brain
        self.event_bus = event_bus or (brain.event_bus if brain else None)
        self.config = config or {}
        
        # UI elements
        self.emotion_chart = None
        self.sentiment_gauge = None
        self.ethical_display = None
        self.recommendation_box = None
        
        # State
        self.current_emotions = {}
        self.current_sentiment = 0.0
        self.current_ethical_decision = None
        self.current_recommendation = None
        
        # Check if Gradio is available
        if gr is None:
            logger.warning("Gradio not available. UI components will not be rendered.")
        
        logger.info("Emotional Insights UI component initialized")
    
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
            gr.Markdown("## Emotional Intelligence Insights")
            
            with gr.Row():
                # Emotion visualization
                with gr.Column(scale=2):
                    self.emotion_chart = gr.Plot(
                        label="Emotion Analysis",
                        show_label=True
                    )
                
                # Sentiment gauge
                with gr.Column(scale=1):
                    self.sentiment_gauge = gr.Number(
                        label="Sentiment Score",
                        value=0.0,
                        minimum=-1.0,
                        maximum=1.0,
                        interactive=False
                    )
            
            # Ethical decision display
            self.ethical_display = gr.Markdown(
                "No ethical decisions to display"
            )
            
            # Interaction recommendations
            self.recommendation_box = gr.Textbox(
                label="Interaction Recommendations",
                placeholder="Recommendations will appear here...",
                interactive=False
            )
            
            # Refresh button
            refresh_btn = gr.Button("Refresh Insights")
            refresh_btn.click(fn=self.refresh_insights)
        
        # Register event handlers if event bus is available
        if self.event_bus:
            self.register_event_handlers()
        
        return container
    
    def register_event_handlers(self):
        """Register event handlers with the event bus"""
        if not self.event_bus:
            logger.warning("No event bus available. Cannot register event handlers.")
            return
        
        # Register handlers for emotional intelligence events
        self.event_bus.register("brain.emotion_analyzed", self.handle_emotion_analysis)
        self.event_bus.register("brain.sentiment_analyzed", self.handle_sentiment_analysis)
        self.event_bus.register("brain.ethical_decision", self.handle_ethical_decision)
        self.event_bus.register("brain.interaction_recommendation", self.handle_interaction_recommendation)
        
        logger.info("Emotional Insights event handlers registered")
    
    async def handle_emotion_analysis(self, data: Dict[str, Any]):
        """
        Handle emotion analysis event
        
        Args:
            data: Event data with emotions
        """
        if "emotions" not in data:
            return
        
        self.current_emotions = data["emotions"]
        await self.update_emotion_chart()
    
    async def handle_sentiment_analysis(self, data: Dict[str, Any]):
        """
        Handle sentiment analysis event
        
        Args:
            data: Event data with sentiment score
        """
        if "sentiment" not in data:
            return
        
        self.current_sentiment = data["sentiment"]
        await self.update_sentiment_gauge()
    
    async def handle_ethical_decision(self, data: Dict[str, Any]):
        """
        Handle ethical decision event
        
        Args:
            data: Event data with ethical decision
        """
        if "decision" not in data:
            return
        
        self.current_ethical_decision = data["decision"]
        await self.update_ethical_display()
    
    async def handle_interaction_recommendation(self, data: Dict[str, Any]):
        """
        Handle interaction recommendation event
        
        Args:
            data: Event data with recommendation
        """
        if "recommendation" not in data:
            return
        
        self.current_recommendation = data["recommendation"]
        await self.update_recommendation_box()
    
    async def update_emotion_chart(self):
        """Update the emotion chart with current emotions"""
        if not self.emotion_chart or not self.current_emotions:
            return
        
        try:
            import matplotlib.pyplot as plt
            import numpy as np
            
            # Create figure
            fig, ax = plt.subplots(figsize=(8, 5))
            
            # Sort emotions by intensity
            emotions = sorted(
                self.current_emotions.items(),
                key=lambda x: x[1],
                reverse=True
            )
            
            # Get top emotions (max 6)
            top_emotions = emotions[:6]
            
            # Extract labels and values
            labels = [e[0] for e in top_emotions]
            values = [e[1] for e in top_emotions]
            
            # Create bar chart
            bars = ax.bar(
                labels,
                values,
                color=plt.cm.viridis(np.linspace(0, 0.8, len(top_emotions)))
            )
            
            # Add value labels
            for bar in bars:
                height = bar.get_height()
                ax.annotate(
                    f'{height:.2f}',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),
                    textcoords="offset points",
                    ha='center',
                    va='bottom'
                )
            
            # Set labels and title
            ax.set_xlabel('Emotions')
            ax.set_ylabel('Intensity')
            ax.set_title('Detected Emotions')
            
            # Set y-axis limits
            ax.set_ylim(0, 1.0)
            
            # Update the chart
            self.emotion_chart.update(fig)
            
            # Close figure to prevent memory leak
            plt.close(fig)
        
        except Exception as e:
            logger.error(f"Error updating emotion chart: {e}")
    
    async def update_sentiment_gauge(self):
        """Update the sentiment gauge with current sentiment"""
        if not self.sentiment_gauge:
            return
        
        try:
            self.sentiment_gauge.update(self.current_sentiment)
        except Exception as e:
            logger.error(f"Error updating sentiment gauge: {e}")
    
    async def update_ethical_display(self):
        """Update the ethical decision display"""
        if not self.ethical_display or not self.current_ethical_decision:
            return
        
        try:
            decision = self.current_ethical_decision
            
            # Format ethical decision as markdown
            markdown = f"### Ethical Decision\n\n"
            markdown += f"**Action:** {decision.get('action', 'Unknown')}\n\n"
            markdown += f"**Evaluation:** {decision.get('evaluation', 'Unknown')}\n\n"
            
            # Add principles if available
            if "principles" in decision and decision["principles"]:
                markdown += "**Principles Applied:**\n\n"
                for principle, weight in decision["principles"].items():
                    markdown += f"- {principle}: {weight:.2f}\n"
            
            # Add explanation if available
            if "explanation" in decision and decision["explanation"]:
                markdown += f"\n**Explanation:**\n\n{decision['explanation']}\n"
            
            # Update the display
            self.ethical_display.update(markdown)
        
        except Exception as e:
            logger.error(f"Error updating ethical display: {e}")
    
    async def update_recommendation_box(self):
        """Update the recommendation box with current recommendation"""
        if not self.recommendation_box or not self.current_recommendation:
            return
        
        try:
            recommendation = self.current_recommendation
            
            # Format recommendation as text
            if isinstance(recommendation, str):
                text = recommendation
            elif isinstance(recommendation, dict):
                text = recommendation.get("text", "")
                if "confidence" in recommendation:
                    text += f"\n\nConfidence: {recommendation['confidence']:.2f}"
            else:
                text = str(recommendation)
            
            # Update the box
            self.recommendation_box.update(text)
        
        except Exception as e:
            logger.error(f"Error updating recommendation box: {e}")
    
    async def refresh_insights(self):
        """Refresh all insights"""
        await asyncio.gather(
            self.update_emotion_chart(),
            self.update_sentiment_gauge(),
            self.update_ethical_display(),
            self.update_recommendation_box()
        )
        
        return "Insights refreshed"
    
    def get_current_state(self) -> Dict[str, Any]:
        """
        Get the current state of emotional insights
        
        Returns:
            Dictionary with current state
        """
        return {
            "emotions": self.current_emotions,
            "sentiment": self.current_sentiment,
            "ethical_decision": self.current_ethical_decision,
            "recommendation": self.current_recommendation
        }

# Factory function
def create_emotional_insights_component(
    brain=None,
    event_bus=None,
    config: Dict[str, Any] = None
) -> EmotionalInsightsComponent:
    """
    Create an emotional insights component
    
    Args:
        brain: ALEJO Brain instance
        event_bus: EventBus instance
        config: Configuration dictionary
        
    Returns:
        EmotionalInsightsComponent instance
    """
    return EmotionalInsightsComponent(brain, event_bus, config)
