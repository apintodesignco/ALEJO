"""
Simple script to verify CUDA installation and PyTorch GPU support.
"""

import torch
import sys

def check_cuda():
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    
    if torch.cuda.is_available():
        print(f"CUDA version: {torch.version.cuda}")
        print(f"CUDA device count: {torch.cuda.device_count()}")
        print(f"Current CUDA device: {torch.cuda.current_device()}")
        print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
        print("CUDA initialization successful!")
        return True
    else:
        print("CUDA is not available. Check your installation.")
        return False

if __name__ == "__main__":
    success = check_cuda()
    sys.exit(0 if success else 1)
