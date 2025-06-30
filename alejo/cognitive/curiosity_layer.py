"""Curiosity & Empathy layer for ALEJO.

This module provides lightweight hooks that let ALEJO generate proactive,
curiosity-driven follow-up questions and empathetic reflections.  It is designed
as a *thin* abstraction that eventually will be powered by the LLM; for CI and
unit-tests it relies only on simple heuristics so that no outbound network is
required.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class PromptSuggestion:
    """Structure representing a proactive prompt."""

    text: str
    rationale: str
    created_at: datetime = datetime.utcnow()


class CuriosityEngine:
    """Generate curiosity-driven follow-ups based on recent conversation."""

    def __init__(self, max_history: int = 5):
        self.history: List[Dict[str, Any]] = []
        self.max_history = max_history

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def record_turn(self, speaker: str, text: str) -> None:
        """Append a conversation turn for later analysis."""
        self.history.append({"speaker": speaker, "text": text})
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def get_proactive_prompt(self) -> Optional[PromptSuggestion]:
        """Return a follow-up question if curiosity is triggered."""
        if not self.history:
            return None

        last_user_turn = next((t for t in reversed(self.history) if t["speaker"] == "user"), None)
        if not last_user_turn:
            return None

        text = last_user_turn["text"].strip()
        # Very naive heuristic – refine later with NLP/LLM.
        if text.endswith("?"):
            logger.debug("Last user message was a question – no proactive prompt.")
            return None
        if len(text.split()) < 3:
            logger.debug("User text too short for curiosity trigger.")
            return None

        words = [w.strip(".,!?;:") for w in text.split() if w]
        stopwords = {
            "i",
            "i'm",
            "im",
            "a",
            "an",
            "the",
            "my",
            "we",
            "it",
            "this",
            "that",
            "yesterday",
            "today",
            "tomorrow",
            "tonight",
        }
        topic = next((w for w in reversed(words) if w.lower() not in stopwords), words[-1])
        follow_up = f"Could you tell me more about {topic.lower()}?"
        rationale = "Encourage user elaboration to deepen context."
        return PromptSuggestion(text=follow_up, rationale=rationale)


__all__ = ["CuriosityEngine", "PromptSuggestion"]
