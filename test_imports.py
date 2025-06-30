"""Test imports for alejo vision module"""
try:
    print("Attempting imports...")
    import alejo.vision
    from alejo.vision import CameraManager
    from alejo.vision.processor import VisionProcessor
    from alejo.vision.video_stream import VideoStreamManager, VideoStreamConfig
    from alejo.core.event_bus import EventBus
    print("All imports successful!")
except Exception as e:
    print(f"Import error: {e}")
    import traceback
    traceback.print_exc()
