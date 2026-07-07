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

# Always allow local dev + the production Vercel domain, even if the CORS_ORIGINS
# env var on the host is stale (e.g. still points at an old preview URL).
for _default in ("http://localhost:3000", "https://ai-poisk-28-06.vercel.app"):
    if _default not in _ALLOWED_ORIGINS:
        _ALLOWED_ORIGINS.append(_default)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    # Every Vercel deployment (production alias + per-branch/per-commit previews)
    # is served from a *.vercel.app host — allow them all so a redeploy never
    # breaks CORS again.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(analyze_router)


@app.get("/health")
def health() -> dict[str, str]:
    # `auth` marks which JWT-verification build is live — lets us confirm a Render
    # redeploy actually landed. "es256+hs256" = the JWKS-aware build.
    return {"status": "ok", "auth": "es256+hs256"}
