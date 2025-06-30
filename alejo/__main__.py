#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Standard library imports
import argparse
import asyncio
import logging
import os
import signal
import sys
from pathlib import Path

# Third-party imports
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('__main__')

# ALEJO component imports
from alejo.brain.alejo_brain import ALEJOBrain
from alejo.vision import start_camera  # Updated to use vision module instead of camera
from alejo.ui import start_holographic_ui  # Fixed import to use ui module directly
from alejo.voice import start_voice_service
from alejo.web import start_web_interface
from alejo.core.health_monitor import HealthMonitor
from alejo.core.event_bus import EventBus
from alejo.ui.controller import UIController

async def main():
    """
    Main entry point for the ALEJO application.
    Initializes all components and starts the main application loop.
    """
    # 1. Load environment variables from .env file at the very beginning.
    load_dotenv()

    # Setup argument parsing
    parser = argparse.ArgumentParser(description="ALEJO - Your Personal AI Assistant")
    parser.add_argument('--web', action='store_true', help='Enable the web interface')
    parser.add_argument('--voice', action='store_true', help='Enable voice interaction')
    parser.add_argument('--no-camera', action='store_true', help='Disable camera')
    parser.add_argument('--no-ui', action='store_true', help='Disable holographic UI')
    parser.add_argument('--port', type=int, default=5000, help='Port for the web interface')
    args = parser.parse_args()

    # Load configuration
    config = {
        'llm': {
            'provider': os.getenv('LLM_PROVIDER', 'local'),
            'model': os.getenv('LOCAL_MODEL', 'llama-3-13b-q4_k_m.gguf'),
            'temperature': float(os.getenv('LLM_TEMPERATURE', '0.7'))
        },
        'camera': {
            'device_id': os.getenv('CAMERA_DEVICE_ID', '0'),
            'resolution': tuple(map(int, os.getenv('CAMERA_RESOLUTION', '1280,720').split(','))),
            'fps': int(os.getenv('CAMERA_FPS', '30'))
        },
        'voice': {
            'language': os.getenv('VOICE_LANGUAGE', 'en-US'),
            'voice_id': os.getenv('VOICE_ID', 'en-US-Standard-A'),
            'sample_rate': int(os.getenv('VOICE_SAMPLE_RATE', '16000'))
        },
        'ui': {
            'window_size': tuple(map(int, os.getenv('UI_WINDOW_SIZE', '1920,1080').split(','))),
            'fullscreen': os.getenv('UI_FULLSCREEN', 'false').lower() == 'true',
            'theme': os.getenv('UI_THEME', 'dark')
        },
        'web': {
            'host': os.getenv('WEB_HOST', '0.0.0.0'),
            'port': int(os.getenv('WEB_PORT', '5000')),
            'debug': os.getenv('WEB_DEBUG', 'false').lower() == 'true'
        },
        'vision': {
            'gaze_tracking_enabled': os.getenv('GAZE_TRACKING_ENABLED', 'true').lower() == 'true'
        }
    }
    
    # Initialize component placeholders
    voice_instance = None
    camera_instance = None
    ui_instance = None
    web_server_task = None
    health_monitor = None
    ui_controller = None
    
    # Initialize event bus
    logger.info("Initializing Event Bus...")
    event_bus = EventBus()
    await event_bus.start()
    logger.info("Event Bus initialized")

    try:
        # 2. Initialize Brain first.
        # This defines brain_instance before it's used, fixing the NameError.
        logger.info("Initializing ALEJO Brain...")
        brain_instance = ALEJOBrain(config, event_bus=event_bus) # Pass event bus to brain
        logger.info("ALEJO Brain initialized")

        # Initialize and start UI Controller
        logger.info("Initializing UI Controller...")
        gaze_tracking_enabled = config.get('vision', {}).get('gaze_tracking_enabled', False)
        ui_controller = UIController(event_bus, gaze_tracking_enabled=gaze_tracking_enabled)
        await ui_controller.start()
        logger.info("UI Controller started.")

        # ------------------------------------------------------------------
        # Health monitor
        # ------------------------------------------------------------------
        health_monitor = HealthMonitor.default()
        await health_monitor.start()

        # 3. Initialize other components, passing the correctly named brain_instance to them.
        if args.voice:
            try:
                logger.info("Starting Voice Service...")
                voice_instance = start_voice_service(brain_instance, config, event_bus=event_bus)
                if not voice_instance:
                    logger.error("Failed to initialize voice service. Continuing without voice.")
            except Exception as e:
                logger.error(f"Error starting voice service: {e}. Continuing without voice.")

        if not args.no_camera:
            try:
                logger.info("Attempting to initialize camera...")
                camera_instance = start_camera(config)
                if camera_instance:
                    logger.info("Camera initialized successfully.")
                else:
                    logger.warning("Camera failed to initialize but did not raise an exception.")
            except Exception as e:
                logger.error(f"An exception occurred during camera initialization: {e}", exc_info=True)
                # Log error but continue

        if not args.no_ui:
            try:
                logger.info("Starting Holographic UI...")
                ui_instance = await start_holographic_ui(config, event_bus=event_bus)
                logger.info("Holographic UI started")
            except Exception as e:
                logger.error(f"Error starting holographic UI: {e}. Continuing without UI.")
                if ui_instance:
                    logger.info("Holographic UI initialized successfully.")
                    if voice_instance: # Check if voice is active before trying to speak
                        voice_instance.speak("Welcome sir. All systems are online and ready.")
                else:
                    logger.warning("Holographic UI failed to initialize but did not raise an exception.")
            except Exception as e:
                logger.error(f"An exception occurred during UI initialization: {e}", exc_info=True)
                # Log error but continue

        if args.web:
            logger.info(f"Starting web interface on port {args.port}...")
            try:
                web_server_task = asyncio.create_task(
                    start_web_interface(brain_instance, host='0.0.0.0', port=args.port) # Uses brain_instance
                )
                # Wait a moment to catch immediate failures
                await asyncio.sleep(2)
                if web_server_task.done():
                    # Check if the task failed
                    try:
                        result = web_server_task.result()
                        if result is None:
                            logger.error("Web server failed to start (returned None)")
                        else:
                            logger.info(f"Web server started successfully on port {args.port}")
                    except Exception as e:
                        logger.error(f"Web server task failed with exception: {e}", exc_info=True)
                else:
                    logger.info(f"Web server task running on port {args.port}")
            except Exception as e:
                logger.error(f"Failed to create web server task: {e}", exc_info=True)
                web_server_task = None

        logger.info("ALEJO is now running. Press Ctrl+C to exit.")
        while True:
            await asyncio.sleep(1) # Keep main alive

    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Shutdown signal received.")
    except Exception as e:
        # Catch any other unexpected error in main
        logger.error(f"A critical unexpected error occurred in main: {e}", exc_info=True)
    finally:
        logger.info("Initiating ALEJO shutdown sequence...")
        if web_server_task and not web_server_task.done():
            web_server_task.cancel()
            try:
                await web_server_task # Allow task to process cancellation
            except asyncio.CancelledError:
                logger.info("Web server task successfully cancelled.")
            except Exception as e:
                logger.error(f"Error during web server task cancellation: {e}", exc_info=True)
        if voice_instance:
            voice_instance.stop_service()
            # logger.info("Voice service stopped.") # Already logged by stop_service
        if camera_instance:
            try:
                if hasattr(camera_instance, 'stop'):
                    await camera_instance.stop()
                elif hasattr(camera_instance, 'release'):
                    camera_instance.release()
                logger.info("Camera stopped successfully.")
            except Exception as e:
                logger.error(f"Error stopping camera: {e}", exc_info=True)
        if ui_controller:
            try:
                await ui_controller.stop()
                logger.info("UI Controller stopped.")
            except Exception as e:
                logger.error(f"Error stopping UI Controller: {e}", exc_info=True)
        if ui_instance:
            try:
                if hasattr(ui_instance, 'stop'):
                    await ui_instance.stop()
                elif hasattr(ui_instance, 'close'):
                    ui_instance.close()
                elif hasattr(ui_instance, 'destroy'):
                    ui_instance.destroy()
                logger.info("UI stopped successfully.")
            except Exception as e:
                logger.error(f"Error stopping UI: {e}", exc_info=True)
        if health_monitor:
            try:
                await health_monitor.stop()
            except Exception as e:
                logger.error(f"Error stopping health monitor: {e}", exc_info=True)
        logger.info("ALEJO shutdown complete.")

# Entry point for the application
if __name__ == "__main__":
    # Use asyncio.run() to properly manage the event loop
    asyncio.run(main())
