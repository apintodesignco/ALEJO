"""
ALEJO Startup Sequence

This module provides a futuristic, state-of-the-art startup animation and sound
sequence for ALEJO, giving the impression of a half-machine, half-human entity awakening.
"""

import os
import sys
import time
import math
import asyncio
import threading
import logging
from pathlib import Path
from typing import Optional, Callable, Dict, Any

from PySide6.QtWidgets import QApplication, QMainWindow, QWidget, QLabel
from PySide6.QtGui import QPainter, QColor, QPen, QFont, QLinearGradient, QFontDatabase
from PySide6.QtCore import Qt, QTimer, QRectF, QPropertyAnimation, QEasingCurve, Property, Signal, QSize
from PySide6.QtMultimedia import QSoundEffect, QMediaPlayer, QAudioOutput
from PySide6.QtCore import QUrl

logger = logging.getLogger(__name__)

# Directory for startup assets
ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "assets")
SOUNDS_DIR = os.path.join(ASSETS_DIR, "sounds")

# Create directories if they don't exist
os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(SOUNDS_DIR, exist_ok=True)

class StartupText(QWidget):
    """Widget for displaying animated text during startup"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.opacity = 0.0
        self.text_primary = "ALEJO"
        self.text_secondary = "Defender | Helper | Protector of Mankind"
        self.text_phase = 0  # 0: fade in, 1: hold, 2: fade out
        self.setAttribute(Qt.WA_TranslucentBackground)
        
        # Load custom font if available
        self.font_id = QFontDatabase.addApplicationFont(os.path.join(ASSETS_DIR, "fonts/tech_font.ttf"))
        if self.font_id != -1:
            self.font_family = QFontDatabase.applicationFontFamilies(self.font_id)[0]
        else:
            self.font_family = "Arial"
            
    def set_opacity(self, opacity):
        """Set the opacity of the text"""
        self.opacity = opacity
        self.update()
        
    def get_opacity(self):
        """Get the current opacity"""
        return self.opacity
        
    # Define the opacity property for animation
    opacity_prop = Property(float, get_opacity, set_opacity)
    
    def set_phase(self, phase):
        """Set the current text phase"""
        self.text_phase = phase
        self.update()
        
    def paintEvent(self, event):
        """Paint the text with current opacity"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Set black background
        painter.fillRect(self.rect(), QColor(0, 0, 0, 255))
        
        # Draw main title
        font = QFont(self.font_family, 60, QFont.Bold)
        painter.setFont(font)
        
        # Create a gradient for the text
        gradient = QLinearGradient(0, 0, 0, self.height())
        gradient.setColorAt(0.0, QColor(0, 200, 255, int(255 * self.opacity)))
        gradient.setColorAt(1.0, QColor(0, 100, 200, int(255 * self.opacity)))
        
        painter.setPen(QPen(gradient, 2))
        painter.drawText(self.rect(), Qt.AlignCenter, self.text_primary)
        
        # Draw subtitle if in phase 1 (hold)
        if self.text_phase >= 1:
            font = QFont(self.font_family, 20)
            painter.setFont(font)
            painter.setPen(QColor(200, 200, 200, int(255 * self.opacity)))
            subtitle_rect = self.rect()
            subtitle_rect.setTop(self.rect().center().y() + 50)
            painter.drawText(subtitle_rect, Qt.AlignHCenter | Qt.AlignTop, self.text_secondary)


class PulsingCircle(QWidget):
    """Widget for displaying pulsing circles during startup"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.opacity = 0.0
        self.circles = []
        self.angle = 0
        self.setAttribute(Qt.WA_TranslucentBackground)
        self._setup_circles()
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_animation)
        
    def start_animation(self):
        """Start the circle animation"""
        self.timer.start(30)  # ~33 FPS
        
    def stop_animation(self):
        """Stop the circle animation"""
        self.timer.stop()
        
    def _setup_circles(self):
        """Initialize the properties for the concentric circles"""
        for i in range(5):
            self.circles.append({
                'radius': (i + 1) * 60,
                'speed': 0.01 * (5 - i),
                'angle': i * (math.pi / 3)
            })
            
    def set_opacity(self, opacity):
        """Set the opacity of the circles"""
        self.opacity = opacity
        self.update()
        
    def get_opacity(self):
        """Get the current opacity"""
        return self.opacity
        
    # Define the opacity property for animation
    opacity_prop = Property(float, get_opacity, set_opacity)
    
    def update_animation(self):
        """Update animation parameters and trigger a repaint"""
        for circle in self.circles:
            circle['angle'] += circle['speed']
        self.update()
        
    def paintEvent(self, event):
        """Handle the painting of the widget"""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        # Set transparent background
        painter.fillRect(self.rect(), QColor(0, 0, 0, 0))
        
        center_x = self.width() / 2
        center_y = self.height() / 2
        
        # Draw the animated concentric circles
        for circle in self.circles:
            radius = circle['radius']
            # Add a subtle pulsing effect using a sine wave
            pulse = 1 + 0.05 * math.sin(circle['angle'] * 2)
            current_radius = radius * pulse
            
            # Create a gradient pen for the circle
            gradient = QLinearGradient(
                center_x - current_radius, center_y - current_radius,
                center_x + current_radius, center_y + current_radius
            )
            gradient.setColorAt(0.0, QColor(0, 255, 255, int(180 * self.opacity)))
            gradient.setColorAt(1.0, QColor(0, 100, 255, int(100 * self.opacity)))
            
            pen = QPen(gradient)
            pen.setWidth(2)
            painter.setPen(pen)
            
            rect = QRectF(
                center_x - current_radius, 
                center_y - current_radius, 
                current_radius * 2, 
                current_radius * 2
            )
            painter.drawEllipse(rect)


class StartupSequence(QMainWindow):
    """Main window for ALEJO's startup sequence"""
    
    startup_complete = Signal()
    
    def __init__(self, on_complete=None):
        super().__init__()
        self.on_complete = on_complete
        self.setup_ui()
        self.setup_audio()
        self.animations = []
        
    def setup_ui(self):
        """Set up the UI components"""
        # Configure window
        self.setWindowTitle("ALEJO Startup")
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setGeometry(100, 100, 800, 600)
        
        # Create text widget
        self.text_widget = StartupText(self)
        self.text_widget.setGeometry(0, 0, 800, 600)
        
        # Create circles widget
        self.circles_widget = PulsingCircle(self)
        self.circles_widget.setGeometry(0, 0, 800, 600)
        
    def setup_audio(self):
        """Set up audio components"""
        self.audio_player = QMediaPlayer()
        self.audio_output = QAudioOutput()
        self.audio_player.setAudioOutput(self.audio_output)
        
        # Create startup sound if it doesn't exist
        self.startup_sound_path = os.path.join(SOUNDS_DIR, "alejo_startup.wav")
        if not os.path.exists(self.startup_sound_path):
            self._create_default_startup_sound()
            
        # Set up sound file
        self.audio_player.setSource(QUrl.fromLocalFile(self.startup_sound_path))
        self.audio_output.setVolume(0.8)
        
    def _create_default_startup_sound(self):
        """Create a default startup sound file if none exists"""
        logger.info("Creating default startup sound file")
        
        # This is a placeholder - in a real implementation, we would generate
        # a proper sound file. For now, we'll just create an empty file.
        with open(self.startup_sound_path, 'wb') as f:
            # Write a minimal WAV header
            f.write(b'RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00')
            
        logger.info(f"Created default startup sound at {self.startup_sound_path}")
        
    def start(self):
        """Start the startup sequence"""
        self.show()
        self.create_animations()
        self.start_animations()
        
    def create_animations(self):
        """Create the animation sequence"""
        # Text fade in animation
        self.text_fade_in = QPropertyAnimation(self.text_widget, b"opacity_prop")
        self.text_fade_in.setDuration(2000)
        self.text_fade_in.setStartValue(0.0)
        self.text_fade_in.setEndValue(1.0)
        self.text_fade_in.setEasingCurve(QEasingCurve.InOutQuad)
        
        # Text hold animation (just a delay)
        self.text_hold = QPropertyAnimation(self.text_widget, b"opacity_prop")
        self.text_hold.setDuration(3000)
        self.text_hold.setStartValue(1.0)
        self.text_hold.setEndValue(1.0)
        
        # Text fade out animation
        self.text_fade_out = QPropertyAnimation(self.text_widget, b"opacity_prop")
        self.text_fade_out.setDuration(1500)
        self.text_fade_out.setStartValue(1.0)
        self.text_fade_out.setEndValue(0.0)
        self.text_fade_out.setEasingCurve(QEasingCurve.InOutQuad)
        
        # Circles fade in animation
        self.circles_fade_in = QPropertyAnimation(self.circles_widget, b"opacity_prop")
        self.circles_fade_in.setDuration(2000)
        self.circles_fade_in.setStartValue(0.0)
        self.circles_fade_in.setEndValue(1.0)
        self.circles_fade_in.setEasingCurve(QEasingCurve.InOutQuad)
        
        # Store animations in a list
        self.animations = [
            self.text_fade_in,
            self.text_hold,
            self.text_fade_out,
            self.circles_fade_in
        ]
        
        # Connect signals
        self.text_fade_in.finished.connect(self._on_text_fade_in_complete)
        self.text_hold.finished.connect(self._on_text_hold_complete)
        self.text_fade_out.finished.connect(self._on_text_fade_out_complete)
        self.circles_fade_in.finished.connect(self._on_circles_fade_in_complete)
        
    def start_animations(self):
        """Start the animation sequence"""
        # Start audio
        self.audio_player.play()
        
        # Start first animation
        self.text_fade_in.start()
        
    def _on_text_fade_in_complete(self):
        """Handle completion of text fade in"""
        self.text_widget.set_phase(1)  # Show subtitle
        self.text_hold.start()
        
    def _on_text_hold_complete(self):
        """Handle completion of text hold"""
        self.text_widget.set_phase(2)  # Prepare for fade out
        self.text_fade_out.start()
        
    def _on_text_fade_out_complete(self):
        """Handle completion of text fade out"""
        self.circles_widget.start_animation()
        self.circles_fade_in.start()
        
    def _on_circles_fade_in_complete(self):
        """Handle completion of circles fade in"""
        # Wait a moment, then complete the startup sequence
        QTimer.singleShot(2000, self._complete_startup)
        
    def _complete_startup(self):
        """Complete the startup sequence"""
        # Emit the completion signal
        self.startup_complete.emit()
        
        # Call the completion callback if provided
        if self.on_complete:
            self.on_complete()
            
        # Close the startup window
        self.close()


class StartupManager:
    """Manager for ALEJO's startup sequence"""
    
    def __init__(self):
        self.app = None
        self.startup_sequence = None
        self.startup_complete_event = asyncio.Event()
        
    async def run_startup_sequence(self):
        """Run the startup sequence asynchronously"""
        # Create a threading event to signal completion
        complete_event = threading.Event()
        
        # Run the startup sequence in a separate thread
        threading.Thread(
            target=self._run_startup_in_thread,
            args=(complete_event,),
            daemon=True
        ).start()
        
        # Wait for the startup sequence to complete
        await asyncio.get_event_loop().run_in_executor(
            None, complete_event.wait
        )
        
    def _run_startup_in_thread(self, complete_event):
        """Run the startup sequence in a separate thread"""
        # Create QApplication if it doesn't exist
        if QApplication.instance() is None:
            self.app = QApplication([])
        else:
            self.app = QApplication.instance()
            
        # Create and run the startup sequence
        self.startup_sequence = StartupSequence(
            on_complete=lambda: complete_event.set()
        )
        self.startup_sequence.start()
        
        # Run the event loop
        self.app.exec()


# Function to run the startup sequence
async def run_startup_sequence():
    """Run ALEJO's startup sequence"""
    manager = StartupManager()
    await manager.run_startup_sequence()


# For testing the startup sequence independently
if __name__ == "__main__":
    import asyncio
    
    async def main():
        await run_startup_sequence()
        print("Startup sequence complete!")
        
    asyncio.run(main())
