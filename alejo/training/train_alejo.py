"""
CLI tool for training ALEJO's voice and face characteristics
"""

import argparse
import logging
from pathlib import Path
from .voice_trainer import VoiceTrainer
from .face_trainer import FaceTrainer
from ..core.config import Config

logger = logging.getLogger(__name__)

def setup_logging():
    """Configure logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

def train_voice(config):
    """Run voice training session"""
    trainer = VoiceTrainer(config)
    print("\n=== ALEJO Voice Training ===")
    print("This session will record voice samples to customize ALEJO's voice.")
    print("You'll be asked to speak naturally for 5 seconds per sample.")
    
    num_samples = int(input("\nHow many samples would you like to record? (recommended: 5) "))
    trainer.start_training_session(num_samples)

def train_face(config):
    """Run face training session"""
    trainer = FaceTrainer(config)
    print("\n=== ALEJO Face Training ===")
    print("This session will capture facial expressions to customize ALEJO's avatar.")
    print("You'll be asked to show different expressions.")
    print("Make sure you're in a well-lit area and facing the camera directly.")
    
    trainer.start_training_session()

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Train ALEJO's voice and face characteristics")
    parser.add_argument('--config', type=str, help='Path to config file')
    parser.add_argument('--voice-only', action='store_true', help='Only train voice')
    parser.add_argument('--face-only', action='store_true', help='Only train face')
    args = parser.parse_args()

    setup_logging()
    
    # Load config
    config = Config()
    if args.config:
        config.load_from_file(args.config)

    try:
        if not args.face_only:
            train_voice(config)
        
        if not args.voice_only:
            train_face(config)
            
        print("\nTraining complete! ALEJO's voice and face profiles have been updated.")
        print("The new characteristics will be applied the next time you start ALEJO.")
        
    except KeyboardInterrupt:
        print("\nTraining cancelled by user.")
    except Exception as e:
        logger.error(f"Error during training: {e}", exc_info=True)
        print("\nAn error occurred during training. Check the logs for details.")

if __name__ == '__main__':
    main()
