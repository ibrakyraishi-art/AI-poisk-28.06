"""
JWT verification для FastAPI.

Supabase выдаёт JWT доступа двумя способами:
  • legacy: симметричная подпись HS256 общим `SUPABASE_JWT_SECRET`;
  • новый:  асимметричная подпись ES256/RS256, публичные ключи в JWKS
            (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`).

verify_jwt() определяет алгоритм из заголовка токена и проверяет подпись
соответствующим способом — поэтому работает и на старых, и на новых проектах.
Возвращает user_id (sub) — используется для RLS-проверки владения данными.

P1: секрет читается из env, никогда не логируется.
"""
from __future__ import annotations

import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Header, HTTPException

_ASYMMETRIC_ALGS = ("ES256", "RS256")


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient | None:
    """Кэшированный клиент JWKS Supabase (сам кэширует публичные ключи)."""
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        return None
    return PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")


def verify_jwt(authorization: str = Header(...)) -> str:
    """
    Dependency: проверяет Bearer-токен и возвращает user_id.
    Использование: user_id: str = Depends(verify_jwt)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")

    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    try:
        if alg in _ASYMMETRIC_ALGS:
            # Новые асимметричные ключи Supabase — проверяем публичным ключом из JWKS.
            client = _jwks_client()
            if client is None:
                raise HTTPException(status_code=500, detail="SUPABASE_URL not configured for JWKS")
            signing_key = client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(_ASYMMETRIC_ALGS),
                audience="authenticated",
            )
        else:
            # Legacy HS256 — общий секрет.
            secret = os.environ.get("SUPABASE_JWT_SECRET", "")
            if not secret:
                raise HTTPException(status_code=500, detail="JWT secret not configured")
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        user_id: str = payload["sub"]
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
    except HTTPException:
        raise
    except Exception as exc:  # ошибки загрузки JWKS / сети
        raise HTTPException(status_code=401, detail=f"Token verification failed: {exc}")
