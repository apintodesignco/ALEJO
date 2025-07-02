"""Tests for HealthMonitor and CuriosityEngine lightweight layers."""

import asyncio
import secrets  # More secure for cryptographic purposes
from datetime import datetime

import pytest
from alejo.cognitive.curiosity_layer import CuriosityEngine, PromptSuggestion
from alejo.core.health_monitor import HealthMonitor


class DummyResp:  # Minimal stub for ``requests.Response``
    status_code = 200


@pytest.mark.asyncio
async def test_health_monitor(monkeypatch):
    """HealthMonitor should emit a *healthy* status update when the endpoint responds 200."""

    # Patch ``requests.post`` used internally to avoid real network traffic.
    monkeypatch.setattr(
        "alejo.core.health_monitor.requests.post", lambda *_, **__: DummyResp()
    )

    monitor = HealthMonitor(interval=0.05, timeout=0.1)
    monitor.add_service("dummy", "http://dummy/health")

    events = []

    def _cb(name: str, status: str, ts: float):  # noqa: D401 – simple callback
        events.append((name, status, ts))

    monitor.subscribe(_cb)

    await monitor.start()
    # Allow at least one loop iteration.
    await asyncio.sleep(0.12)
    await monitor.stop()

    assert any(e[0] == "dummy" and e[1] == "healthy" for e in events)


def test_curiosity_engine_generates_prompt():
    engine = CuriosityEngine(max_history=3)

    # Conversation with a declarative user statement should trigger curiosity.
    engine.record_turn("user", "I adopted a new puppy yesterday")
    prompt: PromptSuggestion | None = engine.get_proactive_prompt()

    assert prompt is not None, "Engine should generate a follow-up question"
    assert "puppy" in prompt.text.lower()

    # A question should NOT trigger an additional prompt.
    engine.record_turn("user", "How are you?")
    assert engine.get_proactive_prompt() is None
