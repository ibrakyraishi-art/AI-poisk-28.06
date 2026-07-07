from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import verify_jwt
from api.runner import start_analysis_run
from config.llm_config import MODELS
from supabase import create_client

router = APIRouter()

# Agents whose LLM can be chosen individually.
_AGENT_NAMES = {
    "reviews_agent",
    "news_agent",
    "business_context_agent",
    "competitor_finder_agent",
    "analyst_agent",
    "report_writer_agent",
    "manager_agent",
}


def _supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


class AnalyzeRequest(BaseModel):
    company: str
    period: str = "30d"
    platform: str = "both"
    model: str | None = None
    # Optional per-agent LLM overrides, e.g. {"analyst_agent": "opus"}.
    agent_models: dict[str, str] | None = None


class AnalyzeResponse(BaseModel):
    run_id: str
    status: str


@router.post("/analyze", response_model=AnalyzeResponse)
def post_analyze(
    body: AnalyzeRequest,
    user_id: str = Depends(verify_jwt),
) -> AnalyzeResponse:
    if body.period not in ("30d", "90d", "6m"):
        raise HTTPException(status_code=422, detail="period must be 30d, 90d, or 6m")
    if not body.company.strip():
        raise HTTPException(status_code=422, detail="company is required")

    if body.model is not None and body.model not in MODELS:
        raise HTTPException(status_code=422, detail=f"unknown model '{body.model}'")
    if body.agent_models:
        for agent, model_key in body.agent_models.items():
            if agent not in _AGENT_NAMES:
                raise HTTPException(status_code=422, detail=f"unknown agent '{agent}'")
            if model_key not in MODELS:
                raise HTTPException(status_code=422, detail=f"unknown model '{model_key}' for {agent}")

    run_id = start_analysis_run(
        user_id=user_id,
        company=body.company.strip(),
        period=body.period,
        platform=body.platform,
        model=body.model,
        agent_models=body.agent_models,
    )
    return AnalyzeResponse(run_id=run_id, status="running")


@router.get("/analyze/{run_id}")
def get_analyze(
    run_id: str,
    user_id: str = Depends(verify_jwt),
) -> dict[str, Any]:
    client = _supabase()
    result = client.table("analysis_runs").select("*").eq("id", run_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Run not found")

    run = result.data[0]

    # P0: ownership check — never return another user's data
    if run["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return run
