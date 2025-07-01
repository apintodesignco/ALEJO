"""
Test Resource Generator
Creates test resources for ALEJO integration testing
"""

import cv2
import numpy as np
import wave
import struct
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class TestResourceGenerator:
    """Generates test resources for integration testing"""
    
    def __init__(self):
        self.resources_dir = Path(__file__).parent.parent / 'tests' / 'integration' / 'resources'
        self.resources_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_all(self):
        """Generate all test resources"""
        self.generate_face_images()
        self.generate_scene_images()
        self.generate_voice_samples()
        logger.info("All test resources generated")
        
    def generate_face_images(self):
        """Generate test face images"""
        # Generate a simple face-like pattern
        for i in range(1, 3):
            img = np.zeros((300, 300, 3), dtype=np.uint8)
            img.fill(200)  # Light gray background
            
            # Draw face outline
            cv2.circle(img, (150, 150), 100, (100, 100, 100), 2)
            
            # Draw eyes
            cv2.circle(img, (110, 120), 15, (50, 50, 50), -1)
            cv2.circle(img, (190, 120), 15, (50, 50, 50), -1)
            
            # Draw mouth (different for each image)
            if i == 1:
                # Smile
                cv2.ellipse(img, (150, 150), (60, 40), 0, 0, 180, (50, 50, 50), 2)
            else:
                # Neutral
                cv2.line(img, (110, 180), (190, 180), (50, 50, 50), 2)
                
            # Save image
            cv2.imwrite(str(self.resources_dir / f'test_face_{i}.jpg'), img)
            logger.info(f"Generated test_face_{i}.jpg")
            
    def generate_scene_images(self):
        """Generate test scene image"""
        # Create a simple scene with shapes
        img = np.zeros((400, 600, 3), dtype=np.uint8)
        img.fill(240)  # Light background
        
        # Draw "sky"
        cv2.rectangle(img, (0, 0), (600, 200), (255, 200, 100), -1)
        
        # Draw "ground"
        cv2.rectangle(img, (0, 200), (600, 400), (100, 200, 100), -1)
        
        # Draw some "objects"
        # House
        cv2.rectangle(img, (100, 150), (200, 250), (200, 100, 100), -1)
        cv2.triangle = np.array([[50, 150], [150, 50], [250, 150]])
        cv2.fillPoly(img, [cv2.triangle], (150, 75, 75))
        
        # Tree
        cv2.rectangle(img, (400, 150), (425, 250), (150, 75, 0), -1)
        cv2.circle(img, (412, 125), 50, (50, 150, 50), -1)
        
        cv2.imwrite(str(self.resources_dir / 'test_scene.jpg'), img)
        logger.info("Generated test_scene.jpg")
        
    def generate_voice_samples(self):
        """Generate test voice audio files"""
        for i in range(1, 3):
            # Generate a simple sine wave
            duration = 2  # seconds
            sample_rate = 44100
            frequency = 440 * i  # Different pitch for each sample
            
            samples = []
            for t in range(int(duration * sample_rate)):
                sample = int(32767 * np.sin(2 * np.pi * frequency * t / sample_rate))
                samples.append(sample)
                
            # Save as WAV file
            with wave.open(str(self.resources_dir / f'test_voice_{i}.wav'), 'w') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(struct.pack('h' * len(samples), *samples))
                
            logger.info(f"Generated test_voice_{i}.wav")

def main():
    """Main entry point"""
    logging.basicConfig(level=logging.INFO)
    
    generator = TestResourceGenerator()
    generator.generate_all()

if __name__ == '__main__':
    main()