import logging
from PIL import Image, ImageDraw
import pystray

logger = logging.getLogger(__name__)

class SystemTray:
    def __init__(self, app_name="ALEJO"):
        self.app_name = app_name
        self.icon = None
        self._voice_service = None
        self._main_app_shutdown_callback = None

    def _create_icon_image(self):
        """Creates a simple 2-color icon for the system tray."""
        width = 64
        height = 64
        # A simple blue circle on a transparent background
        image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        dc = ImageDraw.Draw(image)
        dc.ellipse(
            (0, 0, width - 1, height - 1),
            fill='dodgerblue',
            outline='black'
        )
        return image

    def _setup_menu(self):
        """Creates the menu items for the system tray icon."""
        menu = pystray.Menu(
            pystray.MenuItem(
                'Start Listening',
                self._on_start_listening,
                enabled=self._is_start_enabled
            ),
            pystray.MenuItem(
                'Stop Listening',
                self._on_stop_listening,
                enabled=self._is_stop_enabled
            ),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem('Exit', self._on_exit)
        )
        return menu

    # --- Callback Methods for Menu Items ---

    def _on_start_listening(self):
        if self._voice_service:
            logger.info("System Tray: Start listening triggered.")
            self._voice_service.start_listening()

    def _on_stop_listening(self):
        if self._voice_service:
            logger.info("System Tray: Stop listening triggered.")
            self._voice_service.stop_listening()

    def _on_exit(self):
        logger.info("System Tray: Exit triggered.")
        if self.icon:
            self.icon.stop()
        if self._main_app_shutdown_callback:
            self._main_app_shutdown_callback()

    # --- State Checkers for Menu Items ---

    def _is_start_enabled(self, item):
        return self._voice_service and self._voice_service.state == "STOPPED"

    def _is_stop_enabled(self, item):
        return self._voice_service and self._voice_service.state != "STOPPED"

    # --- Public Methods ---

    def run_in_background(self, voice_service, shutdown_callback):
        """Runs the system tray icon in a non-blocking thread."""
        self._voice_service = voice_service
        self._main_app_shutdown_callback = shutdown_callback
        
        image = self._create_icon_image()
        menu = self._setup_menu()
        
        self.icon = pystray.Icon(self.app_name, image, self.app_name, menu)
        self.icon.run_detached()
        logger.info(f"System tray icon for {self.app_name} is running.")

    def stop(self):
        """Stops the system tray icon."""
        if self.icon:
            self.icon.stop()
            logger.info("System tray icon stopped.")
