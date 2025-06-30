import asyncio
import logging
from ..core.event_bus import EventBus, Event, EventType
from ..vision.gaze_tracker import GazeTracker

logger = logging.getLogger(__name__)

class UIController:
    """
    Manages UI interactions based on events from the event bus.
    """

    def __init__(self, event_bus: EventBus, gaze_tracking_enabled: bool = False):
        """
        Initialize the UI controller.

        Args:
            event_bus: The main event bus for ALEJO.
            gaze_tracking_enabled: Flag to enable/disable gaze tracking.
        """
        self.event_bus = event_bus
        if gaze_tracking_enabled:
            try:
                # Pass the event bus and the running loop to the tracker
                loop = asyncio.get_running_loop()
                self.gaze_tracker = GazeTracker(event_bus=self.event_bus, loop=loop)
            except RuntimeError:
                self.gaze_tracker = None
                logger.warning("Could not get running asyncio loop. Gaze tracker disabled.")
        else:
            self.gaze_tracker = None

    async def start(self):
        """
        Start the UI controller and subscribe to relevant events.
        """
        if self.gaze_tracker:
            self.event_bus.subscribe(EventType.GAZE, self.handle_gaze_event)
            # Run the blocking gaze tracker in a separate thread
            loop = asyncio.get_running_loop()
            loop.run_in_executor(None, self.gaze_tracker.run)
        logger.info("UIController started and subscribed to GAZE events.")

    async def stop(self):
        """
        Stop the UI controller and unsubscribe from events.
        """
        if self.gaze_tracker:
            self.event_bus.unsubscribe(EventType.GAZE, self.handle_gaze_event)
            self.gaze_tracker.stop()
        logger.info("UIController stopped.")

    async def handle_gaze_event(self, event: Event):
        """
        Handle gaze events from the GazeTracker.
        """
        logger.info(f"Received gaze event: {event.data}")
        # In a real application, this would translate to UI actions.
        # For example, a "blink" could trigger a click.
        if event.data.get("type") == "blink":
            print("UI Controller: Click action triggered by blink.")
