#!/usr/bin/env python3
"""
ALEJO Icon Downloader

This script downloads a high-quality half-human, half-robot face icon for ALEJO
and prepares it for use in the system tray, shortcuts, and UI.
"""

import os
import sys
import requests
from pathlib import Path
import logging
from PIL import Image, ImageOps
import io

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('alejo_icon_download.log')
    ]
)

logger = logging.getLogger(__name__)

# Constants
ASSETS_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = ASSETS_DIR
ICON_PATH = ICON_DIR / "alejo_icon.png"
ICON_ICO_PATH = ICON_DIR / "alejo_icon.ico"

# URLs for high-quality cyborg/robot face icons (free for commercial use)
ICON_URLS = [
    "https://cdn-icons-png.flaticon.com/512/4712/4712109.png",  # Robot face with human features
    "https://cdn-icons-png.flaticon.com/512/6134/6134346.png",  # Cyborg face
    "https://cdn-icons-png.flaticon.com/512/8606/8606837.png",  # AI robot face
    "https://cdn-icons-png.flaticon.com/512/5024/5024795.png",  # Futuristic robot
    "https://cdn-icons-png.flaticon.com/512/4712/4712027.png",  # Android face
]

def download_icon(url, save_path):
    """Download an icon from a URL and save it to the specified path."""
    try:
        logger.info(f"Downloading icon from {url}")
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Save the downloaded image
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        logger.info(f"Icon saved to {save_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to download icon: {e}")
        return False

def create_ico_file(png_path, ico_path):
    """Convert a PNG image to ICO format for Windows applications."""
    try:
        logger.info(f"Converting {png_path} to ICO format")
        img = Image.open(png_path)
        
        # Create multiple sizes for the ICO file
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        images = []
        
        for size in sizes:
            resized_img = img.copy()
            resized_img = resized_img.resize(size, Image.LANCZOS)
            images.append(resized_img)
        
        # Save as ICO
        img.save(ico_path, format='ICO', sizes=[(x, y) for x, y in sizes])
        logger.info(f"ICO file saved to {ico_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create ICO file: {e}")
        return False

def main():
    """Main function to download and prepare the ALEJO icon."""
    # Create the icon directory if it doesn't exist
    os.makedirs(ICON_DIR, exist_ok=True)
    
    # Try each URL until one works
    success = False
    for url in ICON_URLS:
        if download_icon(url, ICON_PATH):
            success = True
            break
    
    if not success:
        logger.error("Failed to download any icon. Please check your internet connection.")
        return False
    
    # Create ICO file for Windows applications
    if not create_ico_file(ICON_PATH, ICON_ICO_PATH):
        logger.error("Failed to create ICO file.")
        return False
    
    logger.info("ALEJO icon successfully downloaded and prepared.")
    logger.info(f"PNG icon: {ICON_PATH}")
    logger.info(f"ICO icon: {ICON_ICO_PATH}")
    
    return True

if __name__ == "__main__":
    main()