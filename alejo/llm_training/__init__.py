"""
LLM Training Module for ALEJO

Handles dataset creation, fine-tuning, and evaluation of local LLMs
to align with ALEJO's personality and capabilities.
"""

from .dataset_builder import DatasetBuilder
from .fine_tuner import LLMFineTuner

__all__ = ['DatasetBuilder', 'LLMFineTuner']
