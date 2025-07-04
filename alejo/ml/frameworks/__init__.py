"""
ALEJO - Advanced Learning Engine with Judgment Orchestration
ML Frameworks Module - Framework-specific implementations
"""

from alejo.ml.frameworks.tensorflow_model import TensorFlowModel
from alejo.ml.frameworks.pytorch_model import PyTorchModel
from alejo.ml.frameworks.huggingface_model import HuggingFaceModel
from alejo.ml.frameworks.llama_model import LlamaModel

__all__ = ['TensorFlowModel', 'PyTorchModel', 'HuggingFaceModel', 'LlamaModel']
