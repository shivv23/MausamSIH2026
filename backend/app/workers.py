"""Celery application (optional alert fan-out worker).

Only used when ``CELERY_ENABLED=1``. The broker defaults to RabbitMQ
(``CELERY_BROKER_URL``) and the result backend to Redis (``REDIS_URL``); both
are safe to leave unset for the sync fallback path.
"""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "mausam",
    broker=settings.celery_broker_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_default_queue="alerts",
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    result_expires=3600,
)

celery_app.autodiscover_tasks(["app.tasks"])