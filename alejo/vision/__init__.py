"""
ALEJO Vision Module
Provides camera and visual processing capabilities for ALEJO
"""

import logging

__all__ = ['CameraManager', 'start_camera']

logger = logging.getLogger("alejo.vision")

class CameraManager:
    """
    Advanced camera management system for ALEJO
    
    Features:
    - Multi-camera support (front/rear/external cameras)
    - Real-time video stream management
    - Automatic camera detection and configuration
    - Frame rate control and synchronization
    - Error recovery and device management
    """
    
    def __init__(self, config=None):
        """
        Initialize the camera manager
        
        Args:
            config: Optional configuration dictionary with settings:
                - frame_width: Target frame width (default: 1280)
                - frame_height: Target frame height (default: 720)
                - fps: Target frame rate (default: 30)
                - auto_focus: Enable/disable autofocus (default: True)
                - exposure: Manual exposure value (-1 for auto)
                - white_balance: Manual white balance (-1 for auto)
                - test_mode: If True, use simulated camera (default: False)
        """
        self.config = config or {}
        self.initialized = False
        self.active_camera = None
        self.front_camera = None
        self.default_camera = None
        self.available_cameras = {}
        self.test_mode = self.config.get('test_mode', False)
        
        # Camera settings
        self.frame_width = self.config.get('frame_width', 1280)
        self.frame_height = self.config.get('frame_height', 720)
        self.fps = self.config.get('fps', 30)
        self.auto_focus = self.config.get('auto_focus', True)
        self.exposure = self.config.get('exposure', -1)  # -1 for auto
        self.white_balance = self.config.get('white_balance', -1)  # -1 for auto
        
        # Performance metrics
        self.actual_fps = 0
        self.frame_count = 0
        self.start_time = None
        
        # Try to initialize OpenCV
        try:
            if not self.test_mode:
                import cv2
                self.cv2 = cv2
                self.initialized = True
                logger.info("Camera manager initialized with OpenCV")
                
                # Initialize cameras
                self._initialize_cameras()
                logger.info(f"Found {len(self.available_cameras)} camera(s)")
                if len(self.available_cameras) > 1 and self.config.get('camera_index') is None:
                    self._prompt_select_camera()
            else:
                logger.info("Test mode: Using simulated camera")
                self.cv2 = None
                self.initialized = True
                # Create a simulated default camera for testing
                self.default_camera = {
                    'index': 0,
                    'name': 'simulated_camera',
                    'type': 'default',
                    'active': False,
                    'frame_width': self.frame_width,
                    'frame_height': self.frame_height,
                    'fps': self.fps
                }
                self.available_cameras[0] = self.default_camera
        except ImportError:
            logger.warning("OpenCV not available, camera features will be disabled")
            self.cv2 = None
        except Exception as e:
            logger.error(f"Failed to initialize camera manager: {e}")
            self.initialized = False
            
    def _initialize_cameras(self):
        """Initialize available cameras"""
        if not self.initialized:
            return
            
        logger.info("Attempting to initialize camera devices...")
        
        # Get default camera index from config
        try:
            default_index = self.config.get('default_camera_index', 0)
            logger.info(f"Attempting to open default camera at index {default_index}...")
        except Exception as e:
            logger.error(f"Error getting camera configuration: {e}")
            default_index = 0
            
        try:
            self.default_camera = self.cv2.VideoCapture(0)
            if not self.default_camera.isOpened():
                self.default_camera = None
                logger.warning("Failed to open default camera")
            else:
                logger.info("Successfully opened default camera")
        except Exception as e:
            logger.error(f"Error initializing default camera: {e}")
            self.default_camera = None

            # Try to initialize front camera
            front_index = self.config.get('front_camera_index', 1)
            logger.info(f"Attempting to open front camera at index {front_index}...")
            if front_index == default_index:
                logger.info(f"Front camera index ({front_index}) is same as default. Using default camera instance.")
            # Try to find a front-facing camera
            front_index = 1  # Usually index 1 is front camera
            try:
                self.front_camera = self.cv2.VideoCapture(front_index)
                if self.front_camera.isOpened():
                    logger.info(f"Successfully opened front camera (index {front_index}).")
                else:
                    logger.warning(f"Failed to open front camera (index {front_index}). Releasing if necessary.")
                    if self.front_camera:
                        self.front_camera.release()
                        self.front_camera = None
            except Exception as e:
                logger.error(f"Error initializing front camera: {e}")
                self.front_camera = None
            
        try:
            # Scan for available cameras (typically 0-4 on most systems)
            for i in range(5):
                try:
                    cap = self.cv2.VideoCapture(i)
                    if cap.isOpened():
                        self.available_cameras[i] = cap
                        
                        # Configure camera
                        self._configure_camera(cap)
                        
                        # Try to identify camera type
                        if i == 0:
                            self.default_camera = cap
                        elif self._is_front_camera(cap):
                            self.front_camera = cap
                except Exception as e:
                    logger.error(f"Failed to initialize camera {i}: {e}")
                    continue
            
            # Set default camera as active if available
            if self.default_camera:
                self.active_camera = self.default_camera
                
        except Exception as e:
            logger.error(f"Error initializing cameras: {e}")
            self.available_cameras.clear()
            self.default_camera = None
            self.front_camera = None
            self.active_camera = None
            
    def _configure_camera(self, cap):
        """Configure camera settings"""
        try:
            # Set resolution
            cap.set(self.cv2.CAP_PROP_FRAME_WIDTH, self.frame_width)
            cap.set(self.cv2.CAP_PROP_FRAME_HEIGHT, self.frame_height)
            
            # Set frame rate
            cap.set(self.cv2.CAP_PROP_FPS, self.fps)
            
            # Set focus mode
            if hasattr(self.cv2, 'CAP_PROP_AUTOFOCUS'):
                cap.set(self.cv2.CAP_PROP_AUTOFOCUS, 1 if self.auto_focus else 0)
            
            # Set exposure
            if self.exposure >= 0:
                cap.set(self.cv2.CAP_PROP_AUTO_EXPOSURE, 0)  # Manual mode
                cap.set(self.cv2.CAP_PROP_EXPOSURE, self.exposure)
            
            # Set white balance
            if self.white_balance >= 0 and hasattr(self.cv2, 'CAP_PROP_AUTO_WB'):
                cap.set(self.cv2.CAP_PROP_AUTO_WB, 0)  # Manual mode
                cap.set(self.cv2.CAP_PROP_WB_TEMPERATURE, self.white_balance)
                
        except Exception as e:
            logger.warning(f"Failed to configure camera: {e}")
            
    def _prompt_select_camera(self):
        """Interactively ask user to pick a camera when multiple are present."""
        import sys, time
        if not sys.stdin.isatty():
            # Non-interactive session; keep default camera (index 0)
            return
        print("\nAvailable cameras:")
        for idx in self.available_cameras.keys():
            print(f"[{idx}] Camera {idx}")
        try:
            choice = input("Select camera index (default 0 in 10s): ")
            # simple timeout via time.sleep not possible, rely on empty default
            cam_idx = int(choice) if choice.strip() else 0
        except Exception:
            cam_idx = 0
        if cam_idx in self.available_cameras:
            self.active_camera = self.available_cameras[cam_idx]
            self.config['camera_index'] = cam_idx
            logger.info("User selected camera %s as active", cam_idx)

    def _is_front_camera(self, cap) -> bool:
        """Try to determine if a camera is front-facing"""
        try:
            # This is a heuristic approach - front cameras often have these properties
            width = cap.get(self.cv2.CAP_PROP_FRAME_WIDTH)
            height = cap.get(self.cv2.CAP_PROP_FRAME_HEIGHT)
            
            # Most front cameras are landscape by default
            return width > height
            
        except Exception:
            return False
            
    def start_camera(self, camera_type='default'):
        """
        Start the specified camera
        
        Args:
            camera_type: Type of camera to start ('default' or 'front')
            
        Returns:
            True if camera started successfully
        """
        if not self.initialized:
            logger.warning("Camera manager not initialized, cannot start camera")
            return False
            
        try:
            if camera_type == 'default' and self.default_camera:
                if self.test_mode:
                    # In test mode, just mark the simulated camera as active
                    self.active_camera = self.default_camera
                    self.active_camera['active'] = True
                    logger.info("Simulated default camera activated")
                    return True
                else:
                    # Real camera mode
                    self.active_camera = self.default_camera
                    logger.info("Default camera activated")
                    return True
            elif camera_type == 'front' and self.front_camera:
                self.active_camera = self.front_camera
                logger.info("Front camera activated")
                return True
            else:
                logger.warning(f"Camera type '{camera_type}' not available")
                return False
        except Exception as e:
            logger.error(f"Error starting camera: {e}")
            return False
            
    def stop_camera(self):
        """
        Stop the active camera
        
        Returns:
            True if camera stopped successfully
        """
        if not self.initialized or not self.active_camera:
            return False
            
        try:
            self.active_camera.release()
            self.active_camera = None
            logger.info("Camera stopped")
            return True
        except Exception as e:
            logger.error(f"Error stopping camera: {e}")
            return False
            
    def get_frame(self):
        """
        Get a frame from the active camera with performance tracking
        
        Returns:
            Frame from the camera or None if not available
        """
        if not self.initialized or not self.active_camera:
            return None
            
        try:
            ret, frame = self.active_camera.read()
            
            if ret:
                # Update performance metrics
                self.frame_count += 1
                current_time = self.cv2.getTickCount() / self.cv2.getTickFrequency()
                
                if self.start_time is None:
                    self.start_time = current_time
                else:
                    elapsed = current_time - self.start_time
                    if elapsed >= 1.0:  # Update FPS every second
                        self.actual_fps = self.frame_count / elapsed
                        self.frame_count = 0
                        self.start_time = current_time
                
                return frame
            else:
                logger.warning("Failed to get frame from camera")
                return None
                
        except Exception as e:
            logger.error(f"Error getting frame: {e}")
            self._attempt_camera_recovery()
            return None
            
    def _attempt_camera_recovery(self):
        """Attempt to recover from camera errors"""
        try:
            if self.active_camera:
                self.active_camera.release()
            
            # Try to reinitialize the current camera
            camera_id = next((k for k, v in self.available_cameras.items() 
                            if v == self.active_camera), None)
            if camera_id is not None:
                self.active_camera = self.cv2.VideoCapture(camera_id)
                self._configure_camera(self.active_camera)
                
        except Exception as e:
            logger.error(f"Camera recovery failed: {e}")


def start_camera(config=None, test_mode=False):
    """
    Start the ALEJO camera
    
    Args:
        config: Optional configuration dictionary
        test_mode: If True, initialize without accessing actual camera hardware
        
    Returns:
        CameraManager instance if started successfully, None otherwise
    """
    try:
        if config is None:
            config = {}
        
        # If in test mode, ensure we set the test flag
        if test_mode:
            config['test_mode'] = True
        
        camera_manager = CameraManager(config)
        
        if test_mode:
            logger.info("Camera initialized in test mode (no hardware access)")
            # Even in test mode, we should call start_camera to ensure proper initialization
            camera_manager.start_camera('default')
            return camera_manager
        
        # Start default camera
        success = camera_manager.start_camera('default')
        
        if success:
            logger.info("Camera started successfully")
            return camera_manager
        else:
            logger.error("Failed to start camera")
            return None
    except Exception as e:
        logger.error(f"Error starting camera: {e}")
        return None
