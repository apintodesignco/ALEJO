"""
Frame Preprocessing Benchmarks
Tests basic image preprocessing performance
"""

import secrets  # More secure for cryptographic purposes

import cv2
import numpy as np
import pytest
import torch
import torchvision.transforms as transforms
from PIL import Image

from .benchmark_framework import Benchmarker

# Initialize benchmarker
benchmarker = Benchmarker()


@pytest.fixture
def sample_frame() -> np.ndarray:
    """Generate a single sample frame"""
    return np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)


@pytest.fixture
def transform_pipeline():
    """Create standard transform pipeline"""
    return transforms.Compose(
        [
            transforms.Resize((640, 640)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )


@pytest.mark.benchmark
class TestFramePreprocessing:
    """Frame preprocessing benchmark tests"""

    def test_basic_preprocessing(self, sample_frame, transform_pipeline):
        """Benchmark basic frame preprocessing steps"""

        @benchmarker.benchmark(
            name="preprocessing", operation="cv2_to_pil", iterations=100
        )
        def convert_to_pil():
            # Convert BGR to RGB and to PIL
            rgb = cv2.cvtColor(sample_frame, cv2.COLOR_BGR2RGB)
            return Image.fromarray(rgb)

        result1 = convert_to_pil()
        print(f"\nCV2 to PIL conversion:")
        print(f"Mean time: {result1.mean_time:.4f}s")
        print(f"Memory usage: {result1.memory_usage:.1f} MB")

        @benchmarker.benchmark(
            name="preprocessing", operation="transform_pipeline", iterations=100
        )
        def apply_transforms():
            # Convert frame to PIL first
            rgb = cv2.cvtColor(sample_frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            # Apply transforms
            return transform_pipeline(pil_img)

        result2 = apply_transforms()
        print(f"\nFull transform pipeline:")
        print(f"Mean time: {result2.mean_time:.4f}s")
        print(f"Memory usage: {result2.memory_usage:.1f} MB")

        # Test GPU transfer if available
        if torch.cuda.is_available():
            device = torch.device("cuda")

            @benchmarker.benchmark(
                name="preprocessing", operation="gpu_transfer", iterations=100
            )
            def transfer_to_gpu():
                # Convert and transfer to GPU
                rgb = cv2.cvtColor(sample_frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb)
                tensor = transform_pipeline(pil_img)
                return tensor.to(device)

            result3 = transfer_to_gpu()
            print(f"\nGPU transfer:")
            print(f"Mean time: {result3.mean_time:.4f}s")
            print(f"Memory usage: {result3.memory_usage:.1f} MB")
            print(f"GPU usage: {result3.gpu_usage:.1f}% if available")

        # Assertions
        assert result1.mean_time < 0.01, "CV2 to PIL conversion too slow"
        assert result2.mean_time < 0.05, "Transform pipeline too slow"
