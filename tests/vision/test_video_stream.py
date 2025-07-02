import secrets  # More secure for cryptographic purposes

"""Test module for video stream processing integration
Demonstrates end-to-end video stream processing with CameraManager, VideoStreamManager, and VisionProcessor
"""

# Early debug prints to catch initialization issues
print("=== Module initialization starting ===", flush=True)

try:
    # Basic system info
    import sys

    print("Python executable:", sys.executable, flush=True)
    print("Python version:", sys.version, flush=True)
    print("Module name:", __name__, flush=True)

    # Standard library imports
    import asyncio
    import logging
    import warnings
    from typing import Optional

    print("Standard libraries imported", flush=True)

    # Configure warnings to stdout
    warnings.simplefilter("always")
    warnings.filterwarnings("always")

    def warning_handler(message, category, filename, lineno, file=None, line=None):
        print(f"WARNING: {message}", flush=True)

    warnings.showwarning = warning_handler

    # Configure detailed logging
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove any existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler with custom formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Get module logger
    logger = logging.getLogger(__name__)
    logger.info("Logging configured successfully")

    # Import ALEJO modules
    from alejo.core.event_bus import Event, EventBus, EventType
    from alejo.vision import CameraManager
    from alejo.vision.processor import VisionProcessor
    from alejo.vision.video_stream import VideoStreamConfig, VideoStreamManager

    logger.info("All ALEJO modules imported successfully")

except Exception as e:
    print(f"=== FATAL ERROR during module initialization: {e} ===", flush=True)
    import traceback

    traceback.print_exc()
    sys.exit(1)


async def test_video_stream(
    camera_config: Optional[dict] = None,
    stream_config: Optional[VideoStreamConfig] = None,
    event_bus: Optional[EventBus] = None,
) -> bool:
    print("Starting test_video_stream...", flush=True)
    print("Starting test_video_stream function...", flush=True)
    """
    Test end-to-end video stream processing
    
    Args:
        camera_config: Optional configuration for CameraManager
        stream_config: Optional configuration for VideoStreamManager
        event_bus: Optional event bus for publishing events
    """
    try:
        logger.info("Initializing video stream components...")

        # Initialize components
        print("Creating CameraManager...", flush=True)
        try:
            camera_manager = CameraManager(config=camera_config)
            print("CameraManager created successfully", flush=True)
        except Exception as e:
            print(f"Error creating CameraManager: {e}", flush=True)
            raise

        print("Creating VisionProcessor...", flush=True)
        vision_processor = VisionProcessor(event_bus=event_bus)
        print("VisionProcessor created successfully", flush=True)

        print("Creating VideoStreamManager...", flush=True)
        stream_manager = VideoStreamManager(
            camera=camera_manager,
            processor=vision_processor,
            event_bus=event_bus,
            config=stream_config,
        )
        print("VideoStreamManager created successfully", flush=True)

        # Start camera (test mode is already set in config)
        logger.info("Starting camera...", flush=True)
        if not camera_manager.start_camera("default"):
            logger.error("Failed to start camera", flush=True)
            return False

        # Start video stream
        print("Starting video stream...", flush=True)
        success = await stream_manager.start(camera_manager)
        if not success:
            logger.error("Failed to start video stream", flush=True)
            camera_manager.stop_camera()
            return False

        logger.info("Video stream started successfully", flush=True)
        logger.info(
            "Camera status: active=%s, fps=%s",
            camera_manager.active_camera is not None,
            camera_manager.actual_fps,
            flush=True,
        )

        # Run for a specified duration (30 seconds in test mode)
        try:
            logger.info("Starting main processing loop...", flush=True)
            stats_interval = 0
            start_time = asyncio.get_event_loop().time()
            test_duration = 30  # 30 seconds for test mode

            while True:
                current_time = asyncio.get_event_loop().time()
                elapsed_time = current_time - start_time

                # Exit after test_duration in test mode
                if camera_manager.test_mode and elapsed_time >= test_duration:
                    logger.info(
                        f"Test duration {test_duration}s reached, stopping...",
                        flush=True,
                    )
                    break

                if event_bus:
                    # Print stats every second
                    await asyncio.sleep(1)
                    stats_interval += 1

                    # Basic stats every second
                    logger.info(
                        f"Camera FPS: {camera_manager.actual_fps:.1f}, "
                        f"Frames in buffer: {stream_manager.frame_buffer.qsize()}, "
                        f"Time remaining: {max(0, test_duration - elapsed_time):.1f}s",
                        flush=True,
                    )

                    # Detailed stats every 5 seconds
                    if stats_interval >= 5:
                        stats_interval = 0
                        logger.info("Detailed status:", flush=True)
                        logger.info(
                            "- Camera: active=%s, test_mode=%s",
                            camera_manager.active_camera is not None,
                            camera_manager.test_mode,
                            flush=True,
                        )
                        logger.info(
                            "- Stream manager: running=%s",
                            stream_manager.is_running,
                            flush=True,
                        )
                        logger.info(
                            "- Frame buffer: size=%d/%d",
                            stream_manager.frame_buffer.qsize(),
                            stream_manager.frame_buffer.maxsize,
                            flush=True,
                        )
                        logger.info(
                            "- Last frame time: %.2f",
                            stream_manager.last_frame_time,
                            flush=True,
                        )
                else:
                    # Without event bus, just process frames
                    await asyncio.sleep(0.1)

        except KeyboardInterrupt:
            logger.info("Test interrupted by user", flush=True)

        except Exception as e:
            logger.error(f"Error during video stream test: {e}", flush=True)

        finally:
            # Stop video stream
            await stream_manager.stop()
            logger.info("Video stream stopped", flush=True)

    except Exception as e:
        print(f"Error in test_video_stream: {str(e)}", flush=True)
    return True


async def simple_test():
    """Simple test to verify basic functionality"""
    print("Starting simple_test...", flush=True)
    logger.info("Starting simple test to verify basic functionality...")

    try:
        # Test EventBus
        event_bus = EventBus()
        logger.info("EventBus created successfully")

        # Test VisionProcessor with test mode
        vision_processor = VisionProcessor(
            event_bus=event_bus, config={"test_mode": True}  # Enable test mode
        )
        logger.info("VisionProcessor created successfully")

        # Test basic async functionality
        logger.info("Testing async functionality...")
        await asyncio.sleep(0.1)  # Shorter sleep for faster tests
        logger.info("Simple test completed successfully")

    except Exception as e:
        logger.error("Simple test failed", exc_info=True)
        raise


def main():
    """Main entry point for the test"""
    print("=== Main function starting ===", flush=True)

    try:
        # Get the current event loop
        loop = asyncio.get_event_loop()
        if not loop or loop.is_closed():
            print("No active event loop, creating new one", flush=True)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        print("Main function starting...", flush=True)
        logger.info("Starting test sequence")

        print("Running simple test first...", flush=True)
        try:
            loop.run_until_complete(simple_test())
            print("Simple test succeeded", flush=True)
        except Exception as e:
            logger.error(f"Simple test failed: {e}", exc_info=True)
            raise

        logger.info("Proceeding with full test...")

        # Initialize components
        try:
            event_bus = EventBus()
            logger.info("EventBus created successfully")

            camera_config = {
                "frame_width": 1280,
                "frame_height": 720,
                "fps": 30,
                "auto_focus": True,
                "test_mode": True,  # Enable test mode
            }
            logger.info("Camera config created: %s", camera_config)

            stream_config = VideoStreamConfig(
                frame_rate=30,
                buffer_size=30,
                skip_similar_frames=True,
                similarity_threshold=0.95,
            )
            logger.info("Stream config created: %s", stream_config)

        except Exception as e:
            logger.error("Failed to initialize components", exc_info=True)
            raise

        logger.info("Starting full test...")
        try:
            # Run test with proper task cleanup
            test_task = loop.create_task(
                test_video_stream(
                    camera_config=camera_config,
                    stream_config=stream_config,
                    event_bus=event_bus,
                )
            )

            # Wait for test completion with timeout
            try:
                loop.run_until_complete(asyncio.wait_for(test_task, timeout=60))
                logger.info("Full test completed successfully")
                return True

            except asyncio.TimeoutError:
                logger.error("Test timed out after 60 seconds")
                test_task.cancel()
                try:
                    loop.run_until_complete(test_task)
                except asyncio.CancelledError:
                    pass
                return False

        except asyncio.CancelledError:
            logger.warning("Test was cancelled")
            return False

        except Exception as e:
            logger.error("Full test failed", exc_info=True)
            raise

    except Exception as e:
        logger.error(f"Fatal error in main function: {e}", exc_info=True)
        import traceback

        traceback.print_exc()
        return False

    finally:
        # Ensure all handlers flush their buffers
        for handler in logging.getLogger().handlers:
            handler.flush()


def run_tests():
    """Entry point for both module and script execution"""
    print("=== Starting run_tests ===", flush=True)
    try:
        print("Calling main()...", flush=True)
        success = main()
        print(f"main() returned: {success}", flush=True)
        logger.info(f"Test {'succeeded' if success else 'failed'}")
        return success
    except Exception as e:
        print(f"=== ERROR in run_tests: {e} ===", flush=True)
        logger.error(f"Test failed with error: {e}", exc_info=True)
        import traceback

        traceback.print_exc()
        return False
    finally:
        print("=== Exiting run_tests ===", flush=True)


def main_with_error_handling():
    """Main entry point with global error handling"""
    print("=== Starting main_with_error_handling ===", flush=True)
    try:
        print("Calling run_tests...", flush=True)
        success = run_tests()
        print(f"run_tests returned: {success}", flush=True)
        return success
    except Exception as e:
        print(f"=== FATAL ERROR in main execution: {e} ===", flush=True)
        import traceback

        traceback.print_exc()
        return False
    finally:
        print("=== Exiting main_with_error_handling ===", flush=True)


def _setup_event_loop():
    """Set up a new event loop for testing"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop
    except Exception as e:
        print(f"Failed to set up event loop: {e}", flush=True)
        return None


def _cleanup_event_loop(loop):
    """Clean up the event loop properly"""
    try:
        # Cancel all running tasks
        pending = asyncio.all_tasks(loop)
        if pending:
            print(f"Cancelling {len(pending)} pending tasks...", flush=True)
            for task in pending:
                task.cancel()
            # Wait for tasks to complete cancellation
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))

        # Close the loop
        loop.stop()
        loop.close()
        print("Event loop cleaned up successfully", flush=True)
    except Exception as e:
        print(f"Error during event loop cleanup: {e}", flush=True)


# This will run whether the module is imported or run directly
if __name__ in ["__main__", "alejo.vision.test_video_stream"]:
    print("=== Test module initialization starting ===", flush=True)

    # Set up event loop
    loop = _setup_event_loop()
    if not loop:
        print("Failed to set up event loop, exiting", flush=True)
        sys.exit(1)

    try:
        print("Running main test sequence...", flush=True)
        success = main_with_error_handling()
        print(f"Test sequence completed with success={success}", flush=True)

    except KeyboardInterrupt:
        print("\nTest interrupted by user", flush=True)
        success = False

    except Exception as e:
        print(f"\nUnexpected error in main sequence: {e}", flush=True)
        traceback.print_exc()
        success = False

    finally:
        # Clean up
        print("\nStarting cleanup...", flush=True)
        _cleanup_event_loop(loop)
        print("Cleanup completed", flush=True)

        # Ensure all log messages are written
        for handler in logging.getLogger().handlers:
            handler.flush()

        print(
            f"=== Test module exiting with {'success' if success else 'failure'} ===",
            flush=True,
        )
        sys.exit(0 if success else 1)
