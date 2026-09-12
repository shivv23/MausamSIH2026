"""Expo push delivery for server->device alerts.

The alert flow archives a durable inbox entry per affected user and then
delivers an actual push notification to every registered device via the Expo
Push HTTP API. Tokens Expo reports as invalid (app uninstalled) are pruned so
we never retry dead devices.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.services import store

logger = logging.getLogger("mausam")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepts at most 100 messages per request.
CHUNK_SIZE = 100


async def _deliver(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """POST one chunk to the Expo push API and return per-message receipts."""
    headers = {"Content-Type": "application/json"}
    if settings.expo_push_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_push_access_token}"
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.post(EXPO_PUSH_URL, json=messages, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data.get("data", [])


async def send_push(
    *,
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    sound: str = "default",
) -> dict[str, int]:
    """Deliver one notification to ``tokens``; returns ``{sent, failed}``.

    A no-op (0/0) whenever push is disabled (tests/CI) or there are no tokens.
    """
    if not settings.push_enabled or not tokens:
        return {"sent": 0, "failed": 0}

    messages = [
        {"to": token, "title": title, "body": body, "sound": sound, "data": data or {}}
        for token in tokens
    ]

    sent = 0
    failed = 0
    for i in range(0, len(messages), CHUNK_SIZE):
        chunk = messages[i : i + CHUNK_SIZE]
        try:
            results = await _deliver(chunk)
        except httpx.HTTPError as exc:
            logger.warning("Expo push delivery failed for %d devices: %s", len(chunk), exc)
            failed += len(chunk)
            continue
        for receipt, message in zip(results, chunk):
            if receipt.get("status") == "error":
                failed += 1
                details = receipt.get("details", {})
                if details.get("error") == "DeviceNotRegistered":
                    token = message.get("to")
                    if token:
                        store.delete_push_token_all(token)
            else:
                sent += 1
    logger.info("push fan-out → sent=%d failed=%d", sent, failed)
    return {"sent": sent, "failed": failed}