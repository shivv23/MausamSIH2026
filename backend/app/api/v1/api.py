from fastapi import APIRouter

from app.api.v1.endpoints import homepage

api_router = APIRouter()
api_router.include_router(homepage.router)