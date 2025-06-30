"""Lightweight integration smoke test for ALEJO.

Run with: python scripts/smoke_test.py

Checks:
1. Correct Python version (>=3.9)
2. Instantiates ALEJOBrain + HealthMonitor.
3. Exercises different text inputs and validates response types.
4. Verifies empathy & curiosity prompts appear where expected.
5. Ensures HealthMonitor starts/stops without error.

This avoids heavy deps (no voice/camera/ui) so it can run in CI.
"""
from __future__ import annotations

import asyncio
import sys
import pathlib

# Ensure project root is on sys.path when running directly
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
from typing import List

# ---------------------------------------------------------------------------
REQUIRED_PY_VERSION = (3, 9)


def assert_python_version() -> None:
    if sys.version_info < REQUIRED_PY_VERSION:
        raise AssertionError(
            f"Python {REQUIRED_PY_VERSION[0]}.{REQUIRED_PY_VERSION[1]}+ required, "
            f"found {sys.version_info.major}.{sys.version_info.minor}"
        )


async def exercise_brain() -> None:
    from alejo.brain.alejo_brain import ALEJOBrain
    from alejo.core.health_monitor import HealthMonitor

    brain = ALEJOBrain(test_mode=True)  # We assume ALEJOBrain supports test_mode
    hm = HealthMonitor(interval_seconds=1)

    await hm.start()

    async def collect(text: str) -> List[dict]:
        outputs = []
        async for o in brain.process_text(text):
            outputs.append(o)
        return outputs

    # 1. Command
    out_cmd = await collect("/show time")
    assert any(o.get("command_error") is None for o in out_cmd), "Failed to process command"

    # 2. Neutral text
    out_neutral = await collect("I took a walk in the park today.")
    assert any(o["type"] == "direct_response" for o in out_neutral)
    assert not any(o["type"] == "empathy_prompt" for o in out_neutral)

    # 3. Negative sentiment
    out_negative = await collect("I feel very anxious and lonely.")
    assert any(o["type"] == "empathy_prompt" for o in out_negative), "Empathy prompt missing"

    # 4. Curiosity trigger
    out_rich = await collect("I adopted a rescue dog yesterday named Luna.")
    assert any(o["type"] == "curiosity_prompt" for o in out_rich), "Curiosity prompt missing"

    await hm.stop()


if __name__ == "__main__":
    assert_python_version()
    asyncio.run(exercise_brain())
    print("✔ ALEJO smoke test passed.")
