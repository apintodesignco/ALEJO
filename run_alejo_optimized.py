#!/usr/bin/env python3
"""
ALEJO Optimized Runner Script

Starts the complete ALEJO system with all components enabled and resource management
to ensure optimal performance and prevent system overheating.
"""
import os
import sys
import logging
import argparse
import time
import asyncio
import webbrowser
import secrets
import threading
import ctypes
from threading import Timer, Event
from pathlib import Path
from dotenv import load_dotenv

# Import PySide6 for UI components
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt

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
    assets_dir = Path(os.path.dirname(os.path.abspath(__file__))) / 'assets'
    sounds_dir = assets_dir / 'sounds'
    fonts_dir = assets_dir / 'fonts'
    
    os.makedirs(data_dir, exist_ok=True)
    os.makedirs(log_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)
    os.makedirs(sounds_dir, exist_ok=True)
    os.makedirs(fonts_dir, exist_ok=True)
    
    # Download ALEJO icon if it doesn't exist
    icon_path = assets_dir / 'alejo_icon.png'
    if not icon_path.exists():
        try:
            logger.info("Downloading ALEJO icon...")
            from assets.download_icon import main as download_icon
            download_icon()
        except Exception as e:
            logger.error(f"Failed to download ALEJO icon: {e}")
    
    # Set default environment variables if not set
    if 'REDIS_URL' not in os.environ:
        os.environ['REDIS_URL'] = 'redis://localhost:6379/0'
        logger.info("Using default Redis URL: redis://localhost:6379/0")
        
    # Ensure local LLM configuration
    os.environ['ALEJO_LOCAL_INFERENCE'] = '1'
    logger.info("ALEJO configured for 100% local inference")
    
    # Check if models directory exists and create if needed
    models_dir = os.path.expanduser("~/.alejo/models")
    os.makedirs(models_dir, exist_ok=True)

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='ALEJO Runner')
    parser.add_argument('--web-only', action='store_true', help='Start only the web interface')
    parser.add_argument('--voice-only', action='store_true', help='Start only the voice interface')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    parser.add_argument('--port', type=int, default=8000, help='Web interface port (default: 8000)')
    parser.add_argument('--host', type=str, default='127.0.0.1', help='Web interface host (default: 127.0.0.1)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--create-env', action='store_true', help='Create a new .env file with secure defaults')
    parser.add_argument('--optimize-resources', action='store_true', help='Enable resource optimization')
    parser.add_argument('--enable-comfort', action='store_true', help='Enable emotional comfort responses')
    parser.add_argument('--skip-startup', action='store_true', help='Skip the startup sequence')
    parser.add_argument('--create-shortcut', action='store_true', help='Create desktop shortcut')
    parser.add_argument('--add-to-startup', action='store_true', help='Add to Windows startup')
    
    return parser.parse_args()

def open_browser(url):
    """Open the web browser after a short delay"""
    def _open_browser():
        logger.info(f"Opening browser at {url}")
        webbrowser.open(url)
        
    Timer(2.0, _open_browser).start()

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
    
def create_shortcut():
    """Create a desktop shortcut for ALEJO"""
    if sys.platform == "win32":
        try:
            import winshell
            from win32com.client import Dispatch
            
            desktop = winshell.desktop()
            path = os.path.join(desktop, "ALEJO.lnk")
            
            icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "alejo_icon.ico")
            if not os.path.exists(icon_path):
                icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "alejo_icon.png")
            
            shell = Dispatch('WScript.Shell')
            shortcut = shell.CreateShortCut(path)
            shortcut.Targetpath = sys.executable
            shortcut.Arguments = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Start_ALEJO.bat")
            shortcut.WorkingDirectory = os.path.dirname(os.path.abspath(__file__))
            shortcut.IconLocation = icon_path
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
            
            icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "alejo_icon.ico")
            if not os.path.exists(icon_path):
                icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "alejo_icon.png")
            
            shell = Dispatch('WScript.Shell')
            shortcut = shell.CreateShortCut(path)
            shortcut.Targetpath = sys.executable
            shortcut.Arguments = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wake_alejo.py")
            shortcut.WorkingDirectory = os.path.dirname(os.path.abspath(__file__))
            shortcut.IconLocation = icon_path
            shortcut.save()
            
            logger.info(f"Created startup entry at {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to create startup entry: {e}")
            return False
    else:
        logger.warning("Startup entry creation not supported on this platform")
        return False

def create_env_file():
    """Create a new .env file with secure defaults"""
    env_file = Path(os.path.dirname(os.path.abspath(__file__))) / '.env'
    
    if env_file.exists():
        logger.warning(f"{env_file} already exists. Please delete it first if you want to create a new one.")
        return
        
    # Generate secure defaults
    secret_key = secrets.token_hex(32)
    
    # Create .env file
    with open(env_file, 'w') as f:
        f.write(f"# ALEJO Environment Configuration\n")
        f.write(f"# Created on {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"# Security\n")
        f.write(f"SECRET_KEY={secret_key}\n\n")
        f.write(f"# LLM Configuration\n")
        f.write(f"ALEJO_LOCAL_INFERENCE=1\n")
        f.write(f"ALEJO_LLM_MODEL_TIER=standard\n\n")
        f.write(f"# Redis Configuration\n")
        f.write(f"REDIS_URL=redis://localhost:6379/0\n\n")
        f.write(f"# Logging\n")
        f.write(f"LOG_LEVEL=INFO\n")
        f.write(f"LOG_FILE=logs/alejo.log\n\n")
        f.write(f"# Data Storage\n")
        f.write(f"DATA_DIR=data\n")
        f.write(f"DATABASE_URL=sqlite:///data/alejo.db\n\n")
        
    logger.info(f"Created new .env file at {env_file}")
    logger.info(f"Please edit it to set your OpenAI API key and other configuration options.")

async def shutdown(startup_manager=None):
    """Shutdown all components gracefully"""
    logger.info("Shutting down ALEJO...")
    
    if startup_manager:
        await startup_manager.stop()
    
    logger.info("ALEJO shutdown complete")

async def show_startup_sequence():
    """Show the ALEJO startup sequence"""
    try:
        # Import the startup sequence module
        from alejo.ui.startup_sequence import StartupSequence
        
        # Create QApplication instance if it doesn't exist
        app = QApplication.instance() or QApplication([])
        
        # Create and show the startup sequence
        startup = StartupSequence()
        startup.show()
        
        # Run the startup sequence
        await startup.run_sequence()
        
        # Close the startup window
        startup.close()
        
        return True
    except Exception as e:
        logger.error(f"Failed to show startup sequence: {e}")
        return False

async def main_async():
    """Main async entry point for ALEJO"""
    # Parse arguments
    args = parse_arguments()
    
    # Check for admin privileges
    if not is_admin() and sys.platform == "win32":
        logger.warning("Running without admin privileges. Some features may not work.")
        logger.info("Restarting with admin privileges...")
        run_as_admin()
        return
    
    # If requested, create a new .env file and exit
    if args.create_env:
        create_env_file()
        return
    
    # Create desktop shortcut if requested
    if args.create_shortcut:
        create_shortcut()
    
    # Add to startup if requested
    if args.add_to_startup:
        create_startup_entry()
    
    # Set up the environment
    setup_environment()
    
    # Set log level based on debug flag
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug mode enabled")
    
    logger.info("Starting ALEJO...")
    
    # Show the startup sequence unless skipped
    if not args.skip_startup:
        await show_startup_sequence()
    
    # Import here to avoid circular imports
    from alejo.core.startup import get_alejo_startup
    
    # Clean up any redundant processes before starting
    if args.optimize_resources:
        logger.info("Cleaning up redundant processes...")
        from alejo.core.process_manager import ProcessManager
        process_manager = ProcessManager()
        redundant_count = process_manager.terminate_redundant_processes()
        test_count = process_manager.terminate_all_test_processes()
        logger.info(f"Terminated {redundant_count} redundant processes and {test_count} test processes")
    
    # Start ALEJO with resource management
    startup_manager = get_alejo_startup()
    await startup_manager.start()
    
    # Determine web interface URL
    url = f"http://{args.host}:{args.port}"
    
    # Open browser if not disabled
    if not args.no_browser:
        open_browser(url)
    
    logger.info(f"ALEJO is running at {url}")
    logger.info("Press Ctrl+C to exit")
    
    # Keep the main thread alive
    try:
        # Wait indefinitely
        stop_event = Event()
        while not stop_event.is_set():
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    finally:
        await shutdown(startup_manager)

def main():
    """Main entry point for ALEJO Runner"""
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
    except Exception as e:
        logger.error(f"Error in main: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()