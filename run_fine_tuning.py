"""
Fine-tuning Script for ALEJO LLM

Runs the complete process of dataset creation, model fine-tuning,
and evaluation to create an ALEJO-aligned local LLM.
"""

import logging
import json
from pathlib import Path
from alejo.llm_training import DatasetBuilder, LLMFineTuner

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Run the complete fine-tuning process"""
    try:
        # Configuration
        config = {
            'model_name': 'codellama:13b',
            'output_dir': 'fine_tuned_models',
            'training_data_dir': 'training_data',
            'db_path': 'alejo_data.db'
        }
        
        logger.info("Starting ALEJO LLM fine-tuning process...")
        
        # Create dataset
        logger.info("Building training dataset...")
        dataset_builder = DatasetBuilder(config)
        dataset_builder.build_training_dataset()
        
        # Initialize fine-tuner
        logger.info("Initializing fine-tuning process...")
        fine_tuner = LLMFineTuner(config)
        
        # Run fine-tuning
        logger.info("Starting model fine-tuning...")
        fine_tuner.fine_tune_model()
        
        # Evaluate results
        logger.info("Evaluating fine-tuned model...")
        model_name = f"alejo-{config['model_name']}"
        metrics = fine_tuner.evaluate_model(model_name)
        
        # Save evaluation results
        results_path = Path('fine_tuned_models') / 'evaluation_results.json'
        with open(results_path, 'w') as f:
            json.dump(metrics, f, indent=2)
            
        logger.info(f"Evaluation results saved to {results_path}")
        logger.info("Fine-tuning process completed successfully!")
        
        # Print summary
        print("\nFine-tuning Results Summary:")
        print("-" * 40)
        for metric, value in metrics.items():
            print(f"{metric}: {value:.2%}")
            
    except Exception as e:
        logger.error(f"Fine-tuning process failed: {e}")
        raise

if __name__ == '__main__':
    main()
