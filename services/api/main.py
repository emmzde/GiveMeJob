from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from services.api.config import get_settings
from services.api.observability import configure_observability
from services.api.routers.health import router as health_router

logger = structlog.get_logger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_observability(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        await logger.ainfo("api_started", environment=settings.app_env)
        yield
        await logger.ainfo("api_stopped")

    application = FastAPI(
        title="GiveMeJob API",
        version=settings.app_version,
        lifespan=lifespan,
    )
    application.include_router(health_router)
    return application


app = create_app()
