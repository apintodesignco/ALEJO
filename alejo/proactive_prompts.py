import logging

logger = logging.getLogger(__name__)

class ProactivePrompts:
    """Stub for generating proactive prompts for UI/voice components."""

    def __init__(self):
        pass

    def get_prompt(self) -> str:
        """Return a proactive prompt message."""
        prompt = "Have you considered exploring new ideas today?"
        logger.info(f"Proactive prompt generated: {prompt}")
        return prompt
