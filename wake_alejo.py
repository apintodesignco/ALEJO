#!/usr/bin/env python3
"""
ALEJO Wake-Up System

This script provides multiple easy ways to start ALEJO:
1. Voice activation - Say "Wake up, ALEJO" or "Hey ALEJO"
2. Gesture recognition - Rub eyes or wave hand
3. Simple command - Just run this script
4. System tray icon - Always accessible

Requires admin privileges for full functionality.
"""

import os
import sys
import time
import logging
import argparse
import threading
import subprocess
import webbrowser
import ctypes
import asyncio
from pathlib import Path

# For UI and system tray
from PySide6.QtWidgets import QApplication, QSystemTrayIcon, QMenu, QWidget
from PySide6.QtGui import QIcon, QAction, QPixmap
from PySide6.QtCore import Qt, QTimer, Signal, Slot

# For voice recognition
import speech_recognition as sr

# For gesture recognition (if available)
try:
    import cv2
    import mediapipe as mp
    GESTURE_AVAILABLE = True
except ImportError:
    GESTURE_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_wake.log')
    ]
)

logger = logging.getLogger(__name__)

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Constants
WAKE_WORDS = ["wake up alejo", "hey alejo", "hello alejo", "start alejo"]
ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
ICON_PATH = os.path.join(ASSETS_DIR, "alejo_icon.png")

# Create a simple icon if it doesn't exist
def create_default_icon():
    """Create a default icon if none exists"""
    if not os.path.exists(ICON_PATH):
        # Create the directory if it doesn't exist
        os.makedirs(os.path.dirname(ICON_PATH), exist_ok=True)
        
        # Create a simple icon using PySide6
        app = QApplication.instance() or QApplication([])
        pixmap = QPixmap(256, 256)
        pixmap.fill(Qt.transparent)
        
        # Draw a simple "A" icon
        painter = pixmap.paintEngine().painter()
        painter.setRenderHint(painter.Antialiasing)
        painter.setPen(Qt.cyan)
        painter.setBrush(Qt.black)
        painter.drawEllipse(10, 10, 236, 236)
        painter.setPen(Qt.white)
        font = painter.font()
        font.setPointSize(150)
        font.setBold(True)
        painter.setFont(font)
        painter.drawText(pixmap.rect(), Qt.AlignCenter, "A")
        
        # Save the icon
        pixmap.save(ICON_PATH)
        logger.info(f"Created default icon at {ICON_PATH}")

def is_admin():
    """Check if the script is running with admin privileges"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

def run_as_admin():
    """Re-run the script with admin privileges"""
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, " ".join(sys.argv), None, 1
    )

class VoiceActivation(threading.Thread):
    """Thread for voice activation"""
    
    def __init__(self, callback):
        super().__init__(daemon=True)
        self.callback = callback
        self.running = True
        self.recognizer = sr.Recognizer()
        
    def run(self):
        """Run the voice recognition loop"""
        logger.info("Voice activation started")
        
        while self.running:
            try:
                with sr.Microphone() as source:
                    # Adjust for ambient noise
                    self.recognizer.adjust_for_ambient_noise(source)
                    logger.debug("Listening for wake words...")
                    
                    # Listen for audio
                    audio = self.recognizer.listen(source, timeout=5, phrase_time_limit=5)
                    
                    try:
                        # Recognize speech
                        text = self.recognizer.recognize_google(audio).lower()
                        logger.debug(f"Recognized: {text}")
                        
                        # Check for wake words
                        if any(wake_word in text for wake_word in WAKE_WORDS):
                            logger.info(f"Wake word detected: {text}")
                            self.callback()
                            
                    except sr.UnknownValueError:
                        pass  # Speech was unintelligible
                    except sr.RequestError as e:
                        logger.error(f"Could not request results: {e}")
                        
            except Exception as e:
                logger.error(f"Error in voice recognition: {e}")
                time.sleep(1)  # Avoid tight loop on error
                
    def stop(self):
        """Stop the voice recognition thread"""
        self.running = False

class GestureActivation(threading.Thread):
    """Thread for gesture activation"""
    
    def __init__(self, callback):
        super().__init__(daemon=True)
        self.callback = callback
        self.running = True
        
        # Initialize MediaPipe
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_hands = mp.solutions.hands
        
    def run(self):
        """Run the gesture recognition loop"""
        if not GESTURE_AVAILABLE:
            logger.warning("Gesture recognition not available (missing dependencies)")
            return
            
        logger.info("Gesture activation started")
        
        # Initialize webcam
        cap = cv2.VideoCapture(0)
        
        # Initialize face mesh and hands detection
        with self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        ) as face_mesh, self.mp_hands.Hands(
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        ) as hands:
            
            # Variables for gesture detection
            eye_rub_frames = 0
            wave_frames = 0
            
            while self.running and cap.isOpened():
                success, image = cap.read()
                if not success:
                    logger.warning("Failed to read from webcam")
                    break
                    
                # Flip the image horizontally for a mirror effect
                image = cv2.flip(image, 1)
                
                # Convert to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                
                # Process face mesh
                face_results = face_mesh.process(image_rgb)
                
                # Process hands
                hand_results = hands.process(image_rgb)
                
                # Check for eye rubbing gesture
                if face_results.multi_face_landmarks:
                    for face_landmarks in face_results.multi_face_landmarks:
                        # Get eye landmarks
                        left_eye = face_landmarks.landmark[159]  # Left eye outer corner
                        right_eye = face_landmarks.landmark[386]  # Right eye outer corner
                        
                        # Check if hands are near eyes
                        if hand_results.multi_hand_landmarks:
                            for hand_landmarks in hand_results.multi_hand_landmarks:
                                # Get index finger tip
                                index_tip = hand_landmarks.landmark[8]
                                
                                # Calculate distance to eyes
                                left_dist = ((left_eye.x - index_tip.x)**2 + 
                                            (left_eye.y - index_tip.y)**2)**0.5
                                right_dist = ((right_eye.x - index_tip.x)**2 + 
                                             (right_eye.y - index_tip.y)**2)**0.5
                                
                                # If finger is near eye
                                if left_dist < 0.1 or right_dist < 0.1:
                                    eye_rub_frames += 1
                                    if eye_rub_frames > 15:  # About 0.5 seconds
                                        logger.info("Eye rubbing gesture detected")
                                        self.callback()
                                        eye_rub_frames = 0
                                else:
                                    eye_rub_frames = max(0, eye_rub_frames - 1)
                
                # Check for wave gesture
                if hand_results.multi_hand_landmarks:
                    for hand_landmarks in hand_results.multi_hand_landmarks:
                        # Get wrist and fingertips
                        wrist = hand_landmarks.landmark[0]
                        index_tip = hand_landmarks.landmark[8]
                        
                        # Check if hand is raised and moving side to side
                        if wrist.y > 0.6 and abs(index_tip.x - wrist.x) > 0.2:
                            wave_frames += 1
                            if wave_frames > 20:  # About 0.7 seconds
                                logger.info("Wave gesture detected")
                                self.callback()
                                wave_frames = 0
                        else:
                            wave_frames = max(0, wave_frames - 1)
                
                # Small delay
                cv2.waitKey(30)
                
            # Release resources
            cap.release()
            
    def stop(self):
        """Stop the gesture recognition thread"""
        self.running = False

class SystemTrayIcon(QSystemTrayIcon):
    """System tray icon for ALEJO"""
    
    def __init__(self, icon, parent=None):
        super().__init__(icon, parent)
        self.setToolTip("ALEJO")
        
        # Create menu
        menu = QMenu(parent)
        
        # Add actions
        start_action = menu.addAction("Wake up ALEJO")
        start_action.triggered.connect(self.start_alejo)
        
        menu.addSeparator()
        
        exit_action = menu.addAction("Exit")
        exit_action.triggered.connect(self.exit_app)
        
        # Set the menu
        self.setContextMenu(menu)
        
        # Show the icon
        self.show()
        
    def start_alejo(self):
        """Start ALEJO"""
        start_alejo_process()
        
    def exit_app(self):
        """Exit the application"""
        QApplication.quit()

def start_alejo_process():
    """Start the ALEJO process"""
    logger.info("Starting ALEJO...")
    
    # Get the path to the ALEJO runner script
    alejo_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "run_alejo_optimized.py")
    
    # Start ALEJO in a new process
    if sys.platform == "win32":
        subprocess.Popen([sys.executable, alejo_script], creationflags=subprocess.CREATE_NEW_CONSOLE)
    else:
        subprocess.Popen([sys.executable, alejo_script])
        
    logger.info("ALEJO process started")

def create_shortcut():
    """Create a desktop shortcut for ALEJO"""
    if sys.platform == "win32":
        try:
            import winshell
            from win32com.client import Dispatch
            
            desktop = winshell.desktop()
            path = os.path.join(desktop, "ALEJO.lnk")
            
            shell = Dispatch('WScript.Shell')
            shortcut = shell.CreateShortCut(path)
            shortcut.Targetpath = sys.executable
            shortcut.Arguments = os.path.abspath(__file__)
            shortcut.WorkingDirectory = os.path.dirname(os.path.abspath(__file__))
            shortcut.IconLocation = os.path.abspath(ICON_PATH)
            shortcut.save()
            
            logger.info(f"Created desktop shortcut at {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to create shortcut: {e}")
            return False
    else:
        logger.warning("Shortcut creation not supported on this platform")
        return False

def create_startup_entry():
    """Create a startup entry for ALEJO"""
    if sys.platform == "win32":
        try:
            import winshell
            from win32com.client import Dispatch
            
            startup = winshell.startup()
            path = os.path.join(startup, "ALEJO.lnk")
            
            shell = Dispatch('WScript.Shell')
            shortcut = shell.CreateShortCut(path)
            shortcut.Targetpath = sys.executable
            shortcut.Arguments = os.path.abspath(__file__)
            shortcut.WorkingDirectory = os.path.dirname(os.path.abspath(__file__))
            shortcut.IconLocation = os.path.abspath(ICON_PATH)
            shortcut.save()
            
            logger.info(f"Created startup entry at {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to create startup entry: {e}")
            return False
    else:
        logger.warning("Startup entry creation not supported on this platform")
        return False

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='ALEJO Wake-Up System')
    parser.add_argument('--no-voice', action='store_true', help='Disable voice activation')
    parser.add_argument('--no-gesture', action='store_true', help='Disable gesture recognition')
    parser.add_argument('--no-tray', action='store_true', help='Disable system tray icon')
    parser.add_argument('--create-shortcut', action='store_true', help='Create desktop shortcut')
    parser.add_argument('--add-to-startup', action='store_true', help='Add to startup programs')
    parser.add_argument('--start-now', action='store_true', help='Start ALEJO immediately')
    
    return parser.parse_args()

def main():
    """Main entry point"""
    # Parse arguments
    args = parse_arguments()
    
    # Check for admin privileges
    if not is_admin():
        logger.warning("Running without admin privileges. Some features may not work.")
        logger.info("Restarting with admin privileges...")
        run_as_admin()
        return
    
    # Create default icon if needed
    create_default_icon()
    
    # Create desktop shortcut if requested
    if args.create_shortcut:
        create_shortcut()
    
    # Add to startup if requested
    if args.add_to_startup:
        create_startup_entry()
    
    # Start ALEJO immediately if requested
    if args.start_now:
        start_alejo_process()
        if args.no_voice and args.no_gesture and args.no_tray:
            # If all activation methods are disabled and we've started ALEJO, we can exit
            return
    
    # Create QApplication instance
    app = QApplication.instance() or QApplication([])
    
    # Create activation threads
    activation_threads = []
    
    # Start voice activation if not disabled
    if not args.no_voice:
        try:
            voice_thread = VoiceActivation(start_alejo_process)
            voice_thread.start()
            activation_threads.append(voice_thread)
        except Exception as e:
            logger.error(f"Failed to start voice activation: {e}")
    
    # Start gesture recognition if not disabled
    if not args.no_gesture and GESTURE_AVAILABLE:
        try:
            gesture_thread = GestureActivation(start_alejo_process)
            gesture_thread.start()
            activation_threads.append(gesture_thread)
        except Exception as e:
            logger.error(f"Failed to start gesture recognition: {e}")
    
    # Create system tray icon if not disabled
    if not args.no_tray:
        icon = QIcon(ICON_PATH)
        tray_icon = SystemTrayIcon(icon)
    
    # Run the application
    try:
        logger.info("ALEJO Wake-Up System started")
        logger.info("Say 'Wake up, ALEJO' or use the system tray icon to start ALEJO")
        
        # Run the event loop
        sys.exit(app.exec())
    finally:
        # Stop all threads
        for thread in activation_threads:
            thread.stop()

if __name__ == "__main__":
    main()