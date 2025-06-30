#!/usr/bin/env python3
"""
ALEJO Runner Script
Starts the complete ALEJO system with all components enabled
"""
import os
import sys
import logging
import argparse
import time
import webbrowser
import secrets
import threading
from threading import Timer, Event
from pathlib import Path
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_runtime.log')
    ]
)

logger = logging.getLogger(__name__)

def setup_environment():
    """Set up the environment for ALEJO"""
    # Add the current directory to the path
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    # Load environment variables from .env file if it exists
    env_file = Path(os.path.dirname(os.path.abspath(__file__))) / '.env'
    if env_file.exists():
        logger.info(f"Loading environment from {env_file}")
        load_dotenv(env_file)
    else:
        logger.info("No .env file found, using defaults")
    
    # Create necessary directories if they don't exist
    data_dir = os.environ.get('DATA_DIR', 'data')
    log_dir = os.path.dirname(os.environ.get('LOG_FILE', 'logs/alejo.log'))
    
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure logging based on environment variables
    log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
    log_file = os.environ.get('LOG_FILE', 'logs/alejo.log')
    
    logging.basicConfig(
        level=getattr(logging, log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file)
        ]
    )
    
    logger.info("Environment setup complete")

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='ALEJO AI Assistant Runner')
    
    # Get defaults from environment variables
    default_port = int(os.environ.get('ALEJO_PORT', 5000))
    default_host = os.environ.get('ALEJO_HOST', '127.0.0.1')
    default_debug = os.environ.get('ALEJO_DEBUG', 'False').lower() in ('true', 'yes', '1')
    
    parser.add_argument('--port', type=int, default=default_port, help=f'Web interface port (default: {default_port})')
    parser.add_argument('--host', type=str, default=default_host, help=f'Web interface host (default: {default_host})')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    parser.add_argument('--no-mic', action='store_true', help='Run without microphone input.')
    parser.add_argument('--no-web', action='store_true', help='Run without the web interface.')
    parser.add_argument('--stealth', action='store_true', help='Run in stealth mode with only a system tray icon.')
    parser.add_argument('--debug', action='store_true', default=default_debug, help='Enable debug mode')
    parser.add_argument('--create-env', action='store_true', help='Create a new .env file from example')
    
    return parser.parse_args()

def open_browser(url):
    """Open the web browser after a short delay"""
    def _open_browser():
        webbrowser.open(url)
        logger.info(f"Opened browser at {url}")
    
    Timer(2.0, _open_browser).start()

def create_env_file():
    """Create a new .env file with secure defaults"""
    env_example = Path(os.path.dirname(os.path.abspath(__file__))) / '.env.example'
    env_file = Path(os.path.dirname(os.path.abspath(__file__))) / '.env'
    
    if not env_example.exists():
        logger.error(".env.example file not found. Cannot create .env file.")
        return False
    
    if env_file.exists():
        logger.warning(".env file already exists. Not overwriting.")
        return False
    
    # Read the example file
    with open(env_example, 'r') as f:
        env_content = f.read()
    
    # Generate a secure secret key
    secret_key = secrets.token_hex(32)
    env_content = env_content.replace('FLASK_SECRET_KEY=change-this-to-a-random-secret-key', 
                                    f'FLASK_SECRET_KEY={secret_key}')
    
    # Write the new .env file
    with open(env_file, 'w') as f:
        f.write(env_content)
    
    logger.info(f"Created new .env file at {env_file}")
    return True

def shutdown(voice_service, web_server, tray_icon=None):
    logger.info("Shutting down services...")
    if tray_icon:
        tray_icon.stop()
    if voice_service:
        voice_service.shutdown()
    if web_server and web_server.is_alive():
        web_server.stop()
    logger.info("ALEJO has been shut down.")

def main():
    """Main entry point for ALEJO Runner"""
    logger.info("Starting ALEJO Runner...")
    
    # Parse command line arguments first to check for --create-env
    args = parse_arguments()
    
    # Create .env file if requested
    if args.create_env:
        if create_env_file():
            logger.info("Created new .env file. Please review and restart ALEJO.")
            return
    
    # Set up the environment (loads .env file if it exists)
    setup_environment()
    
    # Import core modules
    try:
        logger.info("Importing core modules...")
        from alejo.brain import ALEJOBrain
        from alejo.voice import VoiceService
        from alejo.web import start_web_interface
        from alejo.web.web_interface import ALEJOWebInterface, initialize_wsgi
        from alejo.ui.system_tray import SystemTray
    except ImportError as e:
        logger.error(f"Failed to import core modules: {e}")
        logger.error("Please make sure you have installed all required dependencies")
        sys.exit(1)
    
    # Create configuration from environment variables and command line arguments
    config = {
        "port": args.port,
        "host": args.host,
        "debug": args.debug,
        "enable_voice": os.environ.get('ENABLE_VOICE', 'True').lower() in ('true', 'yes', '1'),
        "enable_vision": os.environ.get('ENABLE_VISION', 'True').lower() in ('true', 'yes', '1'),
        "holographic_ui": os.environ.get('ENABLE_HOLOGRAPHIC_UI', 'True').lower() in ('true', 'yes', '1'),
        "default_view": os.environ.get('DEFAULT_VIEW', 'holographic'),
        "enable_3d": True,
        "secret_key": os.environ.get('FLASK_SECRET_KEY', secrets.token_hex(32)),
        "thread_pool_size": int(os.environ.get('THREAD_POOL_SIZE', 4)),
        "max_connections": int(os.environ.get('MAX_CONNECTIONS', 100))
    }
    
    # Initialize brain
    try:
        logger.info("Initializing ALEJO Brain...")
        brain = ALEJOBrain()
        logger.info("(OK) ALEJO Brain initialized")
    except Exception as e:
        logger.error(f"Failed to initialize brain: {e}")
        sys.exit(1)
    
    # Initialize voice service
    try:
        logger.info("Initializing Voice Service...")
        voice = VoiceService()
        logger.info("(OK) Voice Service initialized")

        # Connect Voice Service to Brain
        voice.set_brain_callback(brain.process_command)
        # Start continuous listening
        voice.start_listening()

    except Exception as e:
        logger.error(f"Failed to initialize voice service: {e}")
        logger.warning("Continuing without voice service")
        voice = None

    # Setup main loop and shutdown event
    shutdown_event = Event()
    web_interface = None
    tray = None

    def trigger_shutdown():
        logger.info("Shutdown triggered.")
        shutdown_event.set()

    # Start services based on arguments
    if args.stealth:
        logger.info("Running in stealth mode.")
        tray = SystemTray(app_name="ALEJO")
        tray.run_in_background(voice, shutdown_callback=trigger_shutdown)
    
    if not args.no_web and not args.stealth:
        logger.info("Starting Web Interface...")
        web_interface = ALEJOWebInterface(brain, voice, config)
        web_interface.app.secret_key = config["secret_key"]
        initialize_wsgi(web_interface)
        web_interface.start()
        logger.info(f"(OK) Web interface started at http://{args.host}:{args.port}")
        if not args.no_browser:
            url = f"http://{args.host}:{args.port}"
            open_browser(url)
    elif not args.stealth:
        logger.info("Running in console-only mode. Press Ctrl+C to exit.")

    # Wait for shutdown signal
    try:
        shutdown_event.wait()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received. Shutting down.")
    finally:
        shutdown(voice, web_interface, tray)

if __name__ == "__main__":
    main()
