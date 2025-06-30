import asyncio
import cv2
import mediapipe as mp
import pyautogui
import numpy as np
import threading
from datetime import datetime
from ..core.event_bus import EventBus, Event, EventType

class GazeTracker:
    """
    Tracks the user's gaze and translates it into UI control events.
    """

    def __init__(self, event_bus: EventBus = None, loop: asyncio.AbstractEventLoop = None):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(refine_landmarks=True)
        self.screen_w, self.screen_h = pyautogui.size()
        self.cam = cv2.VideoCapture(0)
        self.calibrated = False
        self.calibration_points = []
        self.running = False
        self.lock = threading.Lock()
        self.event_bus = event_bus
        self.loop = loop

    def _get_eye_landmarks(self, frame):
        """Detects facial landmarks and returns the coordinates of the eyes."""
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(frame_rgb)
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0].landmark
            return landmarks
        return None

    def _calculate_gaze_ratio(self, eye_points, landmarks):
        """Calculates the horizontal and vertical gaze ratio."""
        # This is a simplified example. A more robust implementation would be needed.
        eye_region = np.array([(landmarks[i].x, landmarks[i].y) for i in eye_points])
        center_x = np.mean([p[0] for p in eye_region])
        center_y = np.mean([p[1] for p in eye_region])
        return center_x, center_y

    def _calibrate(self):
        """Runs the calibration sequence to map gaze to screen coordinates."""
        # In a real application, this would involve displaying points on the screen
        # and recording the user's gaze.
        print("Calibration sequence would run here.")
        self.calibrated = True

    def run(self):
        """Starts the gaze tracking loop."""
        if not self.calibrated:
            self._calibrate()

        with self.lock:
            self.running = True

        while self.running:
            _, frame = self.cam.read()
            if not _:
                continue
            
            frame = cv2.flip(frame, 1)
            landmarks = self._get_eye_landmarks(frame)

            if landmarks:
                # Example: Use the left eye for gaze tracking
                left_eye_points = [33, 160, 158, 133, 153, 144]
                gaze_x, gaze_y = self._calculate_gaze_ratio(left_eye_points, landmarks)

                # Map gaze to screen coordinates (requires calibration)
                screen_x = np.interp(gaze_x, [0.2, 0.8], [0, self.screen_w])
                screen_y = np.interp(gaze_y, [0.2, 0.8], [0, self.screen_h])

                pyautogui.moveTo(screen_x, screen_y)

                # Blink detection (simple example)
                left_eye_top = landmarks[159].y
                left_eye_bottom = landmarks[145].y
                if (left_eye_top - left_eye_bottom) < 0.01: # Threshold for blink
                    print("Blink detected!")
                    if self.event_bus and self.loop:
                        blink_event = Event.create(
                            type=EventType.GAZE,
                            payload={"type": "blink", "timestamp": datetime.now().isoformat()},
                            source="GazeTracker"
                        )
                        asyncio.run_coroutine_threadsafe(self.event_bus.publish(blink_event), self.loop)

            cv2.imshow("Gaze Tracker", frame)

            # The loop will terminate when self.running is set to False
            if cv2.waitKey(1) & 0xFF == 27: # Allow manual exit with ESC for standalone testing
                break

        self.cam.release()
        cv2.destroyAllWindows()

    def stop(self):
        """Stops the gaze tracking loop."""
        with self.lock:
            self.running = False

if __name__ == '__main__':
    gaze_tracker = GazeTracker()
    gaze_tracker.run()
