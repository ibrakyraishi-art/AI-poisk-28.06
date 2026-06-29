"""
FastAPI application entry point.

Запуск:
  uvicorn api.main:app --host 0.0.0.0 --port 8000 --log-level warning --no-access-log
  (--no-access-log скрывает URL из логов, где могут мелькать query-params с ключами)
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.analyze import router as analyze_router

app = FastAPI(title="CompetitorScope API", version="1.0.0")

_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(analyze_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
