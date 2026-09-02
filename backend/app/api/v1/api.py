from fastapi import APIRouter

from app.api.v1.endpoints import activities, alerts, ask, homepage, risk

api_router = APIRouter()
api_router.include_router(homepage.router)
api_router.include_router(ask.router)
api_router.include_router(activities.router)
api_router.include_router(risk.router)
api_router.include_router(alerts.router)