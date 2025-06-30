"""Empathy layer for ALEJO.

Generates caring, positive reflections when the user expresses negative or
heightened emotions.  Designed to be dependency-light for tests; uses keyword
heuristics.  When a richer sentiment model is available (e.g. local LLM or
transformer), this class can delegate to it while retaining the same public
interface.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional

from .curiosity_layer import PromptSuggestion  # Re-use same structure

logger = logging.getLogger(__name__)


class EmpathyEngine:
    """Detect emotional tone and craft an empathetic reflection."""

    NEGATIVE_KEYWORDS = {
        "sad",
        "upset",
        "worried",
        "anxious",
        "anxiety",
        "angry",
        "mad",
        "frustrated",
        "depressed",
        "lonely",
        "tired",
        "stressed",
        "scared",
        "afraid",
        "unhappy",
    }

    def __init__(self, max_history: int = 5):
        self.history: List[Dict[str, Any]] = []
        self.max_history = max_history

    # ------------------------------------------------------------
    def record_turn(self, speaker: str, text: str) -> None:
        self.history.append({"speaker": speaker, "text": text})
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def get_empathy_prompt(self) -> Optional[PromptSuggestion]:
        """Return an empathetic reflection if negative sentiment detected."""
        if not self.history:
            return None

        last_user_turn = next((t for t in reversed(self.history) if t["speaker"] == "user"), None)
        if not last_user_turn:
            return None

        text = last_user_turn["text"].lower()
        if not any(kw in text for kw in self.NEGATIVE_KEYWORDS):
            return None

        reflection = (
            "I'm sorry you're going through this. It sounds challenging, and I'm here to listen. "
            "Would you like to share more about how you're feeling?"
        )
        rationale = "Provide empathetic acknowledgment to user-expressed distress."
        return PromptSuggestion(text=reflection, rationale=rationale)


__all__ = ["EmpathyEngine"]
