"""Admin / disaster-simulation endpoints.

An IMD operator can publish a warning (optionally "simulate" a live disaster),
and the service computes which registered users fall inside the geofence and
resolves personalized push payloads. This is the "Orange alert -> geofence ->
localized push" demo flow.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import AlertSimulationRequest, AlertSummary, SimulationResult
from app.services import warnings

router = APIRouter(prefix="/api/v1", tags=["alerts"])


@router.get("/alerts", response_model=list[AlertSummary])
async def alerts() -> list[AlertSummary]:
    return warnings.list_alerts()


@router.post("/alerts/simulate", response_model=SimulationResult)
async def simulate(body: AlertSimulationRequest) -> SimulationResult:
    if body.event_type not in ("heavy_rain", "cyclone", "heatwave", "thunderstorm", "flood"):
        raise HTTPException(400, "unknown event_type; use heavy_rain|cyclone|heatwave|thunderstorm|flood")
    return warnings.simulate(body)


@router.delete("/alerts")
async def clear() -> dict[str, int]:
    return {"cleared": warnings.clear_alerts()}