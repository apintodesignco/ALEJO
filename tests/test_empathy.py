"""Unit tests for EmpathyEngine."""

from alejo.cognitive.empathy_layer import EmpathyEngine
from alejo.cognitive.curiosity_layer import PromptSuggestion


def test_empathy_engine_triggers_on_negative_keywords():
    engine = EmpathyEngine()
    engine.record_turn("user", "I am feeling very sad and lonely today.")

    prompt: PromptSuggestion | None = engine.get_empathy_prompt()
    assert prompt is not None
    assert "sorry" in prompt.text.lower()


def test_empathy_engine_ignores_neutral():
    engine = EmpathyEngine()
    engine.record_turn("user", "I just had breakfast and went for a walk.")
    assert engine.get_empathy_prompt() is None
