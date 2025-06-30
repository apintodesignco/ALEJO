"""Cross-library microphone / speaker enumeration helpers.

These utilities shield ALEJO from optional heavyweight deps. They prefer the
`sounddevice` library (tiny) and fall back to `pyaudio`.  When neither is
available, they return empty lists so the caller can degrade gracefully.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

@dataclass
class AudioDevice:
    index: int
    name: str
    max_input_channels: int = 0
    max_output_channels: int = 0


# ---------------------------------------------------------------------------

def _query_with_sounddevice() -> List[AudioDevice]:
    try:
        import sounddevice as sd  # type: ignore
    except ModuleNotFoundError:
        return []

    devices = []
    for idx, d in enumerate(sd.query_devices()):
        devices.append(
            AudioDevice(
                index=idx,
                name=d.get("name") or f"device_{idx}",
                max_input_channels=d.get("max_input_channels", 0),
                max_output_channels=d.get("max_output_channels", 0),
            )
        )
    return devices


def _query_with_pyaudio() -> List[AudioDevice]:
    try:
        import pyaudio  # type: ignore
    except ModuleNotFoundError:
        return []

    pa = pyaudio.PyAudio()
    devices = []
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        devices.append(
            AudioDevice(
                index=i,
                name=info.get("name", f"device_{i}"),
                max_input_channels=int(info.get("maxInputChannels", 0)),
                max_output_channels=int(info.get("maxOutputChannels", 0)),
            )
        )
    pa.terminate()
    return devices


def list_audio_devices() -> List[AudioDevice]:
    """Return all audio devices detected by available backend libs."""
    devices = _query_with_sounddevice() or _query_with_pyaudio()
    if not devices:
        logger.warning("No audio back-end library found; cannot enumerate devices.")
    return devices


def choose_device(devices: List[AudioDevice], want_input: bool = True) -> Optional[AudioDevice]:
    """Interactively ask user to pick a device.  Returns first compatible if no TTY."""
    compatible = [d for d in devices if (d.max_input_channels if want_input else d.max_output_channels) > 0]
    if not compatible:
        return None

    import sys
    if not sys.stdin.isatty():
        return compatible[0]

    print("\nSelect an audio INPUT device:" if want_input else "\nSelect an audio OUTPUT device:")
    for i, d in enumerate(compatible):
        chan = d.max_input_channels if want_input else d.max_output_channels
        print(f"[{i}] {d.name} (channels: {chan})")
    try:
        choice = int(input("Enter number (default 0 in 10s): ") or 0)
        return compatible[choice]
    except Exception:
        return compatible[0]
