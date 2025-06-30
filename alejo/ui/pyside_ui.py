import sys
import math
from PySide6.QtWidgets import QApplication, QMainWindow, QWidget
from PySide6.QtGui import QPainter, QColor, QPen, QFont, QLinearGradient
from PySide6.QtCore import Qt, QTimer, QRectF

class HolographicWidget(QWidget):
    proactive_prompt_text = None
    proactive_prompt_type = None
    proactive_prompt_timer = None

    def show_proactive_prompt(self, text, prompt_type="empathy", duration_ms=5000):
        self.proactive_prompt_text = text
        self.proactive_prompt_type = prompt_type
        if self.proactive_prompt_timer is not None:
            self.proactive_prompt_timer.stop()
        self.proactive_prompt_timer = QTimer(self)
        self.proactive_prompt_timer.setSingleShot(True)
        self.proactive_prompt_timer.timeout.connect(self.clear_proactive_prompt)
        self.proactive_prompt_timer.start(duration_ms)
        self.update()

    def clear_proactive_prompt(self):
        self.proactive_prompt_text = None
        self.proactive_prompt_type = None
        self.update()

    """A widget for rendering the holographic UI with animations."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.circles = []
        self.angle = 0
        self._setup_circles()

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_animation)
        self.timer.start(30)  # ~33 FPS

    def _setup_circles(self):
        """Initialize the properties for the concentric circles."""
        for i in range(5):
            self.circles.append({
                'radius': (i + 1) * 60,
                'speed': 0.01 * (5 - i),
                'angle': i * (math.pi / 3)
            })

    def update_animation(self):
        """Update animation parameters and trigger a repaint."""
        for circle in self.circles:
            circle['angle'] += circle['speed']
        self.update()  # Schedule a paint event

    def paintEvent(self, event):
        """Handle the painting of the widget."""
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Set black background
        painter.fillRect(self.rect(), QColor('black'))

        center_x = self.width() / 2
        center_y = self.height() / 2

        self._draw_circles(painter, center_x, center_y)
        self._draw_logo(painter, center_x, center_y)
        self._draw_proactive_prompt(painter, center_x, center_y)

    def _draw_circles(self, painter, cx, cy):
        """Draw the animated concentric circles."""
        pen = QPen(QColor(0, 255, 255, 180)) # Cyan with some transparency
        pen.setWidth(2)
        painter.setPen(pen)

        for circle in self.circles:
            radius = circle['radius']
            # Add a subtle pulsing effect using a sine wave
            pulse = 1 + 0.02 * math.sin(circle['angle'] * 2)
            current_radius = radius * pulse
            rect = QRectF(cx - current_radius, cy - current_radius, current_radius * 2, current_radius * 2)
            painter.drawEllipse(rect)

    def _draw_proactive_prompt(self, painter, cx, cy):
        if self.proactive_prompt_text:
            color = QColor('#FF69B4') if self.proactive_prompt_type == 'empathy' else QColor('#FFD700')
            font = QFont('Arial', 22, QFont.Bold)
            painter.setFont(font)
            painter.setPen(color)
            painter.drawText(cx - 300, cy + 100, 600, 60, Qt.AlignCenter, self.proactive_prompt_text)

    def _draw_logo(self, painter, cx, cy):
        """Draw the ALEJO title and subtitle."""
        # Title
        font = QFont('Arial', 40, QFont.Bold)
        painter.setFont(font)
        painter.setPen(QColor('#00FFFF'))
        painter.drawText(cx - 150, cy, 300, 50, Qt.AlignCenter, 'A.L.E.J.O.')

        # Subtitle has been removed as per user request
        pass

class HolographicUIPySide(QMainWindow):
    def show_proactive_prompt(self, text, prompt_type="empathy", duration_ms=5000):
        self.central_widget.show_proactive_prompt(text, prompt_type, duration_ms)

    """The main window for the PySide6 Holographic UI."""

    def __init__(self, config=None, event_bus=None):
        super().__init__()
        self.config = config or {}
        self.event_bus = event_bus
        self.setWindowTitle('ALEJO Holographic Interface')
        self.setGeometry(100, 100, 800, 600)
        
        if self.event_bus:
            import asyncio
            asyncio.create_task(self._subscribe_to_prompts())
    
    async def _subscribe_to_prompts(self):
        """Subscribe to proactive prompt events"""
        await self.event_bus.subscribe(EventType.PROACTIVE_PROMPT, self._handle_proactive_prompt)
    
    def _handle_proactive_prompt(self, event):
        """Handle incoming proactive prompt events"""
        self.show_proactive_prompt(
            text=event.data['text'],
            prompt_type=event.data['prompt_type'],
            duration_ms=5000
        )

        # Set window flags for a frameless, transparent, always-on-top window
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setAttribute(Qt.WA_TranslucentBackground)

        self.central_widget = HolographicWidget(self)
        self.setCentralWidget(self.central_widget)

    def start(self):
        """Show the UI window."""
        self.show()

    def stop(self):
        """Close the UI window."""
        self.close()

# This part is for testing the UI independently
if __name__ == '__main__':
    app = QApplication(sys.argv)
    ui = HolographicUIPySide()
    ui.start()
    sys.exit(app.exec())
