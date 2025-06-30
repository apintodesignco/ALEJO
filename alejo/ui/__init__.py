"""
ALEJO UI Module (PySide6)
Provides modern holographic UI capabilities for ALEJO.
"""

import sys
import logging
import threading

__all__ = ['start_holographic_ui']

logger = logging.getLogger("alejo.ui")

# Global variable to hold the QApplication instance
qt_app = None
ui_instance = None

def _run_pyside_ui(config, event_bus=None):
    """This function runs in a separate thread to manage the UI."""
    global qt_app, ui_instance
    try:
        from PySide6.QtWidgets import QApplication
        from .pyside_ui import HolographicUIPySide

        # Ensure a QApplication instance exists
        if QApplication.instance() is None:
            qt_app = QApplication(sys.argv)
        else:
            qt_app = QApplication.instance()

        # Create and show the main window
        ui_instance = HolographicUIPySide(config, event_bus=event_bus)
        ui_instance.start()

        logger.info("Holographic UI (PySide6) started successfully.")

        # Start the Qt event loop
        qt_app.exec()

        logger.info("Holographic UI (PySide6) shut down.")

    except Exception as e:
        logger.error(f"Failed to start PySide6 UI: {e}", exc_info=True)

def start_holographic_ui(config=None, event_bus=None, test_mode=False):
    """
    Starts the ALEJO holographic UI in a separate thread.

    Args:
        config: Optional configuration dictionary.
        test_mode: If True, initialize without starting actual UI thread.

    Returns:
        The UI thread if started successfully, otherwise None.
    """
    try:
        if test_mode:
            logger.info("Holographic UI initialized in test mode (no UI thread started)")
            return threading.Thread() # Return a dummy thread object
            
        # The UI needs to run in its own thread to not block the main app
        ui_thread = threading.Thread(target=_run_pyside_ui, args=(config,), daemon=True)
        ui_thread.start()
        return ui_thread # Returning thread for potential management

    except Exception as e:
        logger.error(f"Failed to create UI thread: {e}", exc_info=True)
        return None
