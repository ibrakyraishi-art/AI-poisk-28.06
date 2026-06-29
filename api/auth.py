"""
JWT verification для FastAPI.

Supabase выдаёт JWT-токены подписанные SUPABASE_JWT_SECRET.
verify_jwt() используется как Depends() в каждом защищённом эндпоинте.
Возвращает user_id (sub из payload) — используется для RLS-проверки владения данными.

P1: ключ читается из env, никогда не логируется.
"""
from __future__ import annotations

import os

import jwt
from fastapi import Header, HTTPException


def verify_jwt(authorization: str = Header(...)) -> str:
    """
    Dependency: проверяет Bearer-токен и возвращает user_id.
    Использование: user_id: str = Depends(verify_jwt)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ")
    secret = os.environ.get("SUPABASE_JWT_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    try:
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
