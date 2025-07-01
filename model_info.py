#!/usr/bin/env python
"""
Provide information about OpenAI models and their specifications
"""

import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Model information based on OpenAI documentation
MODEL_INFO = {
    # GPT-4 models
    "gpt-4o": {
        "description": "Most capable model for chat, vision, and audio. Optimized for performance.",
        "context_window": 128000,
        "training_data": "Up to Apr 2023",
        "max_output_tokens": 4096,
        "recommended": True
    },
    "gpt-4o-mini": {
        "description": "Smaller, faster, and more affordable version of GPT-4o.",
        "context_window": 128000,
        "training_data": "Up to Apr 2023",
        "max_output_tokens": 4096,
        "recommended": True
    },
    "gpt-4": {
        "description": "More capable than any GPT-3.5 model, able to do more complex tasks.",
        "context_window": 8192,
        "training_data": "Up to Sep 2021",
        "max_output_tokens": 4096,
        "recommended": False
    },
    "gpt-4-turbo": {
        "description": "More capable than base GPT-4, with a 128K context window.",
        "context_window": 128000,
        "training_data": "Up to Dec 2023",
        "max_output_tokens": 4096,
        "recommended": True
    },
    
    # GPT-3.5 models
    "gpt-3.5-turbo": {
        "description": "Most capable GPT-3.5 model, optimized for chat at 1/10th the cost of GPT-4.",
        "context_window": 16385,
        "training_data": "Up to Sep 2021",
        "max_output_tokens": 4096,
        "recommended": True
    },
    "gpt-3.5-turbo-instruct": {
        "description": "Similar capabilities as text-davinci-003 but with a simpler API.",
        "context_window": 4096,
        "training_data": "Up to Sep 2021",
        "max_output_tokens": 4096,
        "recommended": False
    }
}

def print_model_info():
    """Print information about available models"""
    logger.info("OpenAI Model Information:")
    logger.info("=========================")
    
    # Print recommended models first
    logger.info("\nRECOMMENDED MODELS:")
    logger.info("------------------")
    for model_name, info in MODEL_INFO.items():
        if info["recommended"]:
            logger.info(f"Model: {model_name}")
            logger.info(f"  Description: {info['description']}")
            logger.info(f"  Context Window: {info['context_window']} tokens")
            logger.info(f"  Max Output Tokens: {info['max_output_tokens']} tokens")
            logger.info(f"  Training Data: {info['training_data']}")
            logger.info("  ---")
    
    # Print other models
    logger.info("\nOTHER MODELS:")
    logger.info("------------")
    for model_name, info in MODEL_INFO.items():
        if not info["recommended"]:
            logger.info(f"Model: {model_name}")
            logger.info(f"  Description: {info['description']}")
            logger.info(f"  Context Window: {info['context_window']} tokens")
            logger.info(f"  Max Output Tokens: {info['max_output_tokens']} tokens")
            logger.info(f"  Training Data: {info['training_data']}")
            logger.info("  ---")
    
    logger.info("\nRECOMMENDATIONS:")
    logger.info("--------------")
    logger.info("1. For best performance: gpt-4o (128K context, 4K output tokens)")
    logger.info("2. For balance of performance and cost: gpt-4o-mini (128K context, 4K output tokens)")
    logger.info("3. For cost efficiency: gpt-3.5-turbo (16K context, 4K output tokens)")
    
if __name__ == "__main__":
    print_model_info()