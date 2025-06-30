"""Asynchronous health-monitor background task for ALEJO.

This module provides an in-process monitor that periodically checks the health
of internal micro-services (Brain, Emotional-intelligence, Vision, etc.).  It is
intended to run inside any long-lived ALEJO process (CLI, server, or agent)
and expose a simple callback that other parts of the system can subscribe to
(e.g. logging, metrics, UI dashboard).

Design goals
------------
1. **Non-blocking** – the monitor is fully asynchronous and never blocks the
   event-loop.  Synchronous I/O (the *requests* library) is off-loaded via
   ``asyncio.to_thread`` so that we avoid a hard dependency on `aiohttp`.
2. **Dependency-lite** – we rely only on the standard library; this keeps CI
   lightweight and prevents large downloads (similar to how we stubbed
   out *transformers* elsewhere).
3. **Extensible** – callers may register new services at runtime and subscribe
   to state-change notifications.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Callable, Dict, Optional

import requests

logger = logging.getLogger(__name__)

HealthCallback = Callable[[str, str, float], None]


@dataclass
class MonitoredService:
    """Metadata for a single service entry."""

    name: str
    url: str
    last_status: str = field(default="unknown")
    last_check: float = field(default_factory=time.time)


class HealthMonitor:
    """Periodically ping configured services and emit status updates."""

    def __init__(self, interval: float = 30.0, timeout: float = 5.0):
        self.interval = interval
        self.timeout = timeout
        self._services: Dict[str, MonitoredService] = {}
        self._subscribers: set[HealthCallback] = set()
        self._task: Optional[asyncio.Task] = None

    # ---------------------------------------------------------------------
    # Service management
    # ---------------------------------------------------------------------
    def add_service(self, name: str, url: str) -> None:
        if name in self._services:
            logger.warning("Updating existing service entry for %s -> %s", name, url)
        self._services[name] = MonitoredService(name=name, url=url)

    def remove_service(self, name: str) -> None:
        self._services.pop(name, None)

    def services(self) -> Dict[str, MonitoredService]:
        return dict(self._services)

    # ---------------------------------------------------------------------
    # Subscriber management
    # ---------------------------------------------------------------------
    def subscribe(self, cb: HealthCallback) -> None:
        self._subscribers.add(cb)

    def unsubscribe(self, cb: HealthCallback) -> None:
        self._subscribers.discard(cb)

    async def _notify(self, service: MonitoredService, status: str) -> None:
        for cb in set(self._subscribers):
            # Fire and forget – callbacks are responsible for their own timing
            try:
                cb(service.name, status, service.last_check)
            except Exception as exc:  # pragma: no cover – defensive
                logger.error("Health callback failed: %s", exc, exc_info=exc)

    # ---------------------------------------------------------------------
    # Lifecycle
    # ---------------------------------------------------------------------
    async def start(self) -> None:
        if self._task is None:
            logger.info("Starting HealthMonitor (%d services – %ss interval)",
                        len(self._services), self.interval)
            self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("HealthMonitor stopped")

    # ------------------------------------------------------------------
    # Internal implementation
    # ------------------------------------------------------------------
    async def _run_loop(self) -> None:
        while True:
            try:
                await asyncio.gather(*(self._check_service(svc) for svc in self._services.values()))
            except Exception as exc:  # pragma: no cover
                logger.error("HealthMonitor loop error: %s", exc, exc_info=exc)
            await asyncio.sleep(self.interval)

    async def _check_service(self, service: MonitoredService) -> None:
        """Ping a single service and update its status."""
        prev_status = service.last_status
        service.last_check = time.time()

        try:
            # We use POST by default because many ALEJO services expect JSON bodies.
            # If a service exposes a proper `/health` we can adapt per-service later.
            response = await asyncio.to_thread(
                requests.post,
                service.url,
                json={"ping": "health-check"},
                timeout=self.timeout,
            )
            status = "healthy" if response.status_code == 200 else f"bad:{response.status_code}"
        except Exception as exc:  # noqa: BLE001 – broad ok for health checks
            status = "down"
            logger.debug("Health check failed for %s – %s", service.name, exc)

        # Only log/emit on transition to avoid noise
        if status != prev_status:
            logger.info("Service %s status: %s -> %s", service.name, prev_status, status)
            service.last_status = status
            await self._notify(service, status)

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------
    @classmethod
    def default(cls) -> "HealthMonitor":
        """Instantiate with default ALEJO service endpoints."""
        monitor = cls()
        monitor.add_service("brain", "http://localhost:8000/health")
        monitor.add_service("emotional", "http://localhost:8001/health")
        monitor.add_service("vision", "http://localhost:8002/health")
        return monitor


__all__ = ["HealthMonitor", "MonitoredService"]
