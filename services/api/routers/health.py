from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from services.api.config import get_settings

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["givemejob-api"]
    version: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="ok", service="givemejob-api", version=settings.app_version)
