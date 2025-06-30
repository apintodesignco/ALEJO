#!/usr/bin/env python3
"""
ALEJO Installer

This script handles the installation, dependency management, and model downloads for ALEJO.
It can also create an offline installer package for distribution.

Usage:
  - Install: python installer.py install [--download-model] [--model MODEL_NAME]
  - Create offline package: python installer.py create [--output OUTPUT_DIR] [--include-models]
"""
import os
import sys
import shutil
import zipfile
import subprocess
import platform
import ctypes
import json
import hashlib
import argparse
import time
import socket
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Union
from datetime import datetime

# Optional imports - will be used if available
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False

# Constants
VERSION = "0.9.0"
MODEL_CONFIG_FILE = "model_config.json"
DEFAULT_MODEL = "llama-3-8b-instruct.Q4_K_M.gguf"
MODEL_REPO = "https://huggingface.co/TheBloke/Llama-3-8B-Instruct-GGUF/resolve/main/"
MODEL_SIZES = {
    "llama-3-8b-instruct.Q4_K_M.gguf": 4_900_000_000,  # ~4.9GB
    "llama-3-8b-instruct.Q5_K_M.gguf": 5_900_000_000,  # ~5.9GB
    "llama-3-70b-instruct.Q4_K_M.gguf": 38_000_000_000,  # ~38GB
}
MODEL_CHECKSUMS = {
    "llama-3-8b-instruct.Q4_K_M.gguf": "7e4e6e55d98d64303d8d5d46e6d4a8e1a5d0eb5fe4d8b7a1a34d22d3b6dca3d7",
    "llama-3-8b-instruct.Q5_K_M.gguf": "9e8a8c5a7b9fb92e92c5dc0c3dff3a1e6331e7d93e8ec7d2e4e8931cb2c36e12",
}


def is_admin() -> bool:
    """Check if the script is running with administrator privileges"""
    try:
        if platform.system() == "Windows":
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        else:  # Unix-based systems
            return os.geteuid() == 0
    except Exception:
        return False


def get_free_space(path: str) -> int:
    """Get free space in bytes for the given path"""
    if platform.system() == "Windows":
        free_bytes = ctypes.c_ulonglong(0)
        ctypes.windll.kernel32.GetDiskFreeSpaceExW(
            ctypes.c_wchar_p(path), None, None, ctypes.pointer(free_bytes))
        return free_bytes.value
    else:  # Unix-based systems
        st = os.statvfs(path)
        return st.f_bavail * st.f_frsize

def download_model(model_name: str, output_dir: str) -> bool:
    """Download a model from the repository"""
    if not REQUESTS_AVAILABLE:
        print("Error: The 'requests' library is required for downloading models.")
        print("Please install it with: pip install requests")
        return False
    
    model_url = f"{MODEL_REPO}{model_name}"
    model_path = os.path.join(output_dir, model_name)
    model_size = MODEL_SIZES.get(model_name, 0)
    
    # Check if model already exists and has correct checksum
    if os.path.exists(model_path):
        print(f"Model {model_name} already exists. Verifying integrity...")
        if verify_model_checksum(model_path, model_name):
            print("Model integrity verified.")
            return True
        else:
            print("Model file is corrupted. Will download again.")
            os.remove(model_path)
    
    # Check available disk space
    free_space = get_free_space(output_dir)
    if free_space < model_size * 1.1:  # Add 10% buffer
        print(f"Error: Not enough disk space. Need {model_size / 1e9:.1f} GB, but only {free_space / 1e9:.1f} GB available.")
        return False
    
    # Create directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Downloading {model_name} ({model_size / 1e9:.1f} GB)...")
    try:
        response = requests.get(model_url, stream=True)
        response.raise_for_status()
        
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024 * 1024  # 1MB
        
        if TQDM_AVAILABLE:
            progress_bar = tqdm.tqdm(total=total_size, unit='iB', unit_scale=True)
        
        with open(model_path, 'wb') as f:
            for data in response.iter_content(block_size):
                if data:
                    f.write(data)
                    if TQDM_AVAILABLE:
                        progress_bar.update(len(data))
        
        if TQDM_AVAILABLE:
            progress_bar.close()
        
        # Verify downloaded model
        if verify_model_checksum(model_path, model_name):
            print(f"Successfully downloaded and verified {model_name}")
            return True
        else:
            print("Error: Downloaded model is corrupted. Please try again.")
            os.remove(model_path)
            return False
            
    except Exception as e:
        print(f"Error downloading model: {e}")
        # Remove partially downloaded file
        if os.path.exists(model_path):
            os.remove(model_path)
        return False


def verify_model_checksum(model_path: str, model_name: str) -> bool:
    """Verify the integrity of a downloaded model using SHA-256"""
    expected_checksum = MODEL_CHECKSUMS.get(model_name)
    if not expected_checksum:
        print(f"Warning: No checksum available for {model_name}. Skipping verification.")
        return True
    
    print("Verifying model integrity (this may take a moment)...")
    sha256_hash = hashlib.sha256()
    
    with open(model_path, "rb") as f:
        # Read the file in chunks to avoid loading it all into memory
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    
    file_hash = sha256_hash.hexdigest()
    return file_hash == expected_checksum


def check_dependencies() -> Tuple[bool, List[str]]:
    """Check if all required dependencies are installed"""
    required_packages = [
        "numpy",
        "torch",
        "fastapi",
        "uvicorn",
        "python-dotenv",
        "llama-cpp-python",
        "redis"
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    return len(missing_packages) == 0, missing_packages


def install_dependencies(missing_packages: List[str]) -> bool:
    """Install missing dependencies"""
    print("Installing missing dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        return False
    except Exception as e:
        print(f"Error during installation: {e}")
        return False


def check_redis_service() -> bool:
    """Check if Redis service is running"""
    try:
        # Try to connect to Redis on default port
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect(("localhost", 6379))
        s.close()
        return True
    except (socket.error, socket.timeout):
        return False


def create_offline_installer(source_dir: str, output_dir: str, include_models: bool = True) -> str:
    """Packages the entire ALEJO project into a self-contained zip file for offline installation.
    
    Args:
        source_dir: Path to the ALEJO source directory
        output_dir: Directory where the installer will be created
        include_models: Whether to include models in the installer
        
    Returns:
        Path to the created installer
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    installer_name = f"alejo_offline_installer_{timestamp}.zip"
    installer_path = os.path.join(output_dir, installer_name)
    
    print(f"Creating offline installer at {installer_path}")
    
    # Create a metadata file with installation information
    metadata = {
        "version": VERSION,
        "created_at": timestamp,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": platform.system(),
        "include_models": include_models
    }
    
    metadata_path = os.path.join(source_dir, "installer_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    
    try:
        with zipfile.ZipFile(installer_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # First, add all source files
            for root, dirs, files in os.walk(source_dir):
                # Skip directories that shouldn't be included
                if any(excluded in root for excluded in [".git", "__pycache__", ".pytest_cache", "venv", ".env"]):
                    continue
                    
                # Add files to the zip
                for file in files:
                    # Skip certain file types
                    if file.endswith(('.pyc', '.pyo', '.pyd', '.so', '.dll')):
                        continue
                    
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    
                    # Skip model files if not including them
                    if not include_models and file.endswith(('.gguf', '.bin')) and 'models' in arcname:
                        continue
                        
                    zipf.write(file_path, arcname)
            
            # Add installer script to the package
            installer_script = os.path.abspath(__file__)
            zipf.write(installer_script, os.path.basename(installer_script))
            
            print(f"Created offline installer: {installer_path}")
            return installer_path
    except Exception as e:
        print(f"Error creating offline installer: {e}")
        if os.path.exists(installer_path):
            os.remove(installer_path)
        return None
import zipfile


def create_offline_installer(source_dir: str, output_zip: str) -> None:
    """Packages the entire ALEJO project into a self-contained zip file for offline installation."""
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Exclude unnecessary files (e.g., .git, __pycache__ directories) if needed
                if '.git' in file_path or '__pycache__' in file_path:
                    continue
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
    print(f"Offline installer created at {output_zip}")


if __name__ == '__main__':
    # Assume current directory is the project root
    project_root = os.path.abspath('.')
    installer_path = os.path.join(project_root, 'alejo_offline_installer.zip')
    create_offline_installer(project_root, installer_path)
