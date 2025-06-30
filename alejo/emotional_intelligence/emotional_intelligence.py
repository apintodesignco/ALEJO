"""Emotional Intelligence Module for ALEJO"""

class EmotionalMemory:
    """Stores user interactions along with associated emotional context."""
    def __init__(self):
        self.memory = {}

    def record_experience(self, interaction: str, emotion: str) -> bool:
        """Record a user interaction with the associated emotion."""
        self.memory.setdefault(emotion, []).append(interaction)
        return True

    def get_memory(self, emotion: str):
        """Retrieve memory for a given emotion."""
        return self.memory.get(emotion, [])


class EmotionalProcessor:
    """Processes textual input to analyze sentiment and generate context-aware responses."""
    def __init__(self, memory: EmotionalMemory):
        self.memory = memory

    def analyze_text(self, text: str) -> str:
        """Analyze text and return a sentiment: positive, negative or neutral."""
        lower = text.lower()
        if "happy" in lower or "joy" in lower:
            return "positive"
        elif "sad" in lower or "down" in lower:
            return "negative"
        else:
            return "neutral"

    def generate_response(self, text: str) -> str:
        """Generate a response based on the sentiment of the input text."""
        sentiment = self.analyze_text(text)
        if sentiment == "positive":
            response = "I'm glad to hear that! Tell me more."
        elif sentiment == "negative":
            response = "I'm sorry you're feeling down. How can I help?"
        else:
            response = "Thanks for sharing. What else would you like to talk about?"
        return response


class EthicalFramework:
    """Implements ethical constraints and evaluates decisions based on predefined principles."""
    def __init__(self):
        self.ethical_constraints = ["Do no harm", "Respect privacy"]

    def evaluate_decision(self, decision: str) -> bool:
        """Evaluate a decision; return True if it aligns with ethical constraints."""
        # Dummy logic: disallow decisions that mention 'harm'
        if "harm" in decision.lower():
            return False
        return True
