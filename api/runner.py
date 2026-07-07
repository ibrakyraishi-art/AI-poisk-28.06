"""
Background crew runner — запускает CrewAI pipeline в отдельном потоке.

POST /analyze вызывает start_analysis_run(), которая:
1. Создаёт запись в analysis_runs (status=running).
2. Запускает _run_crew() в ThreadPoolExecutor (не блокирует HTTP).
3. Возвращает run_id немедленно.

_run_crew() выполняет полный 7-агентный pipeline и обновляет
analysis_runs по завершении (completed / failed).
"""
from __future__ import annotations

import json
import os
import traceback
from concurrent.futures import ThreadPoolExecutor

from supabase import create_client

from config.llm_config import DEFAULTS

# Agents whose LLM can be chosen individually ("сменные мозги").
_AGENT_NAMES = (
    "reviews_agent",
    "news_agent",
    "business_context_agent",
    "competitor_finder_agent",
    "analyst_agent",
    "report_writer_agent",
    "manager_agent",
)

_executor = ThreadPoolExecutor(max_workers=4)

# BYOK: maps user_api_keys.keys field names → LiteLLM env var names
_BYOK_KEY_MAP = {
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "google_api_key": "GEMINI_API_KEY",
    "serper_api_key": "SERPER_API_KEY",
    "news_api_key": "NEWS_API_KEY",
}

# Which provider key (env var) each model requires.
_MODEL_PROVIDER = {
    "gemini-flash": "GEMINI_API_KEY",
    "haiku": "ANTHROPIC_API_KEY",
    "sonnet": "ANTHROPIC_API_KEY",
    "opus": "ANTHROPIC_API_KEY",
    "gpt-4o-mini": "OPENAI_API_KEY",
}


def _pick_model_for_agent(agent_name: str, chosen: str | None) -> str | None:
    """
    Resolve ONE agent's model, reading the BYOK keys already injected into
    os.environ for this run. Raises ValueError with a clear, user-facing
    (Russian) message when the required key is missing — so the run fails fast
    instead of hanging on endless LLM retries.

    `chosen` — the explicit pick for this agent (per-agent override, or the
    single global `model`), or None to use the agent's own default. When the
    default's provider key is missing, we substitute a model the user does have
    a key for, so a run never silently hangs.
    """
    has_google = bool(os.environ.get("GEMINI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))

    def _fallback() -> str:
        if has_anthropic:
            return "haiku"
        if has_google:
            return "gemini-flash"
        if has_openai:
            return "gpt-4o-mini"
        raise ValueError("Не задан ни один LLM-ключ (Anthropic, Google AI или OpenAI). Добавьте ключ в настройках.")

    if chosen:
        needs = _MODEL_PROVIDER.get(chosen)
        if needs == "GEMINI_API_KEY" and not has_google:
            raise ValueError("Для модели Gemini Flash нужен ключ Google AI. Добавьте его в настройках или выберите модель Claude.")
        if needs == "ANTHROPIC_API_KEY" and not has_anthropic:
            raise ValueError("Для моделей Claude нужен ключ Anthropic. Добавьте его в настройках или выберите Gemini Flash.")
        if needs == "OPENAI_API_KEY" and not has_openai:
            raise ValueError("Для модели GPT нужен ключ OpenAI. Добавьте его в настройках.")
        return chosen

    # No explicit choice → use the agent's built-in default, adapted to keys.
    default = DEFAULTS.get(agent_name, "haiku")
    provider = _MODEL_PROVIDER.get(default)
    if provider and os.environ.get(provider):
        return None  # let create_*_agent apply its own DEFAULTS[agent_name]
    return _fallback()


def _resolve_agent_models(model: str | None, agent_models: dict[str, str] | None) -> dict[str, str | None]:
    """Build the effective model per agent: per-agent override → global model → default."""
    am = agent_models or {}
    return {name: _pick_model_for_agent(name, am.get(name) or model) for name in _AGENT_NAMES}


def _load_user_keys(user_id: str) -> dict[str, str]:
    """Fetch user's BYOK keys from user_api_keys table and return as env-var dict."""
    client = _supabase()
    result = client.table("user_api_keys").select("keys").eq("user_id", user_id).execute()
    if not result.data:
        return {}
    stored: dict = result.data[0].get("keys") or {}
    return {
        env_var: stored[byok_key]
        for byok_key, env_var in _BYOK_KEY_MAP.items()
        if stored.get(byok_key)
    }


def _supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def start_analysis_run(
    *,
    user_id: str,
    company: str,
    period: str,
    platform: str,
    model: str | None,
    agent_models: dict[str, str] | None = None,
) -> str:
    """Creates the DB record, fires off the crew in background, returns run_id."""
    client = _supabase()
    result = client.table("analysis_runs").insert({
        "user_id": user_id,
        "company": company,
        "period": period,
        "status": "running",
    }).execute()
    if not result.data:
        raise RuntimeError("Failed to create analysis run — Supabase insert returned no data")
    run_id: str = result.data[0]["id"]

    _executor.submit(_run_crew, run_id=run_id, user_id=user_id,
                     company=company, period=period, platform=platform,
                     model=model, agent_models=agent_models)
    return run_id


def _run_crew(
    *,
    run_id: str,
    user_id: str,
    company: str,
    period: str,
    platform: str,
    model: str | None,
    agent_models: dict[str, str] | None = None,
) -> None:
    """Blocking crew execution — runs in a thread pool worker."""
    # BYOK: inject user's API keys into os.environ for this run
    user_keys = _load_user_keys(user_id)
    _prev_env: dict[str, str | None] = {}
    for env_var, value in user_keys.items():
        _prev_env[env_var] = os.environ.get(env_var)
        os.environ[env_var] = value

    from crewai import ConditionalTask, Crew, Process

    from agents.analyst_agent import create_analyst_agent, create_analyst_task
    from agents.business_context_agent import (
        create_business_context_agent,
        create_business_context_task,
    )
    from agents.competitor_finder_agent import (
        create_competitor_finder_agent,
        create_competitor_finder_task,
    )
    from agents.manager_agent import create_manager_agent
    from agents.news_agent import create_news_agent, create_news_task
    from agents.report_writer_agent import create_report_writer_agent, create_report_task
    from agents.reviews_agent import create_reviews_agent, create_reviews_task
    from config.limits import MIN_CONFIDENCE, MIN_REVIEW_COUNT
    from models.schemas import ReviewData

    _PERIOD_ESCALATION = {"30d": "90d", "90d": "6m", "6m": "6m"}
    extended_period = _PERIOD_ESCALATION[period]

    def _needs_retry(task_output) -> bool:
        try:
            data: ReviewData | None = task_output.pydantic
            if data is None:
                return True
            return data.review_count < MIN_REVIEW_COUNT or data.confidence < MIN_CONFIDENCE
        except Exception:
            return True

    client = _supabase()
    try:
        # Per-agent model choice ("сменные мозги"): resolve+validate each agent's
        # model (explicit override → global model → smart default). Fails fast
        # with a clear message if a chosen model has no key.
        m = _resolve_agent_models(model, agent_models)

        reviews_agent          = create_reviews_agent(run_id=run_id, user_id=user_id, model_key=m["reviews_agent"])
        news_agent             = create_news_agent(run_id=run_id, user_id=user_id, model_key=m["news_agent"])
        business_context_agent = create_business_context_agent(run_id=run_id, user_id=user_id, model_key=m["business_context_agent"])
        competitor_finder_agent= create_competitor_finder_agent(run_id=run_id, user_id=user_id, model_key=m["competitor_finder_agent"])
        analyst_agent          = create_analyst_agent(run_id=run_id, model_key=m["analyst_agent"])
        report_writer_agent    = create_report_writer_agent(run_id=run_id, user_id=user_id, model_key=m["report_writer_agent"])
        manager_agent          = create_manager_agent(model_key=m["manager_agent"])

        reviews_task = create_reviews_task(reviews_agent, app_name=company, period=period)
        retry_reviews_task = ConditionalTask(
            description=(
                f"Re-collect reviews for '{company}' with extended period {extended_period}. "
                f"Call fetch_and_save_reviews: '{company} | both | {extended_period}'."
            ),
            expected_output="A valid ReviewData JSON with higher review_count and confidence.",
            condition=_needs_retry,
            agent=reviews_agent,
            output_pydantic=ReviewData,
        )
        business_context_task = create_business_context_task(business_context_agent, company=company, period=period)
        news_task             = create_news_task(news_agent, company=company, period=period)
        competitor_finder_task= create_competitor_finder_task(competitor_finder_agent, company=company, context_tasks=[business_context_task])
        analyst_task          = create_analyst_task(analyst_agent, company=company, period=period, context_tasks=[reviews_task, retry_reviews_task, news_task])
        report_task           = create_report_task(report_writer_agent, company=company, period=period, context_tasks=[reviews_task, retry_reviews_task, business_context_task, news_task, competitor_finder_task, analyst_task])

        crew = Crew(
            agents=[reviews_agent, news_agent, business_context_agent, competitor_finder_agent, analyst_agent, report_writer_agent],
            tasks=[reviews_task, retry_reviews_task, business_context_task, news_task, competitor_finder_task, analyst_task, report_task],
            process=Process.hierarchical,
            manager_agent=manager_agent,
            verbose=False,
        )

        crew_output = crew.kickoff()
        report_data = crew_output.pydantic

        client.table("analysis_runs").update({
            "status": "completed",
            "report_json": json.loads(report_data.model_dump_json()),
            "report_docx_path": f"reports/{run_id}/report.docx",
        }).eq("id", run_id).execute()

    except ValueError as exc:
        # Missing/mismatched API key — surface the clear message, not a traceback.
        client.table("analysis_runs").update({
            "status": "failed",
            "error": str(exc),
        }).eq("id", run_id).execute()
    except Exception:
        client.table("analysis_runs").update({
            "status": "failed",
            "error": traceback.format_exc()[-2000:],
        }).eq("id", run_id).execute()
    finally:
        # Restore env vars that were set for this user's BYOK keys
        for env_var, original in _prev_env.items():
            if original is None:
                os.environ.pop(env_var, None)
            else:
                os.environ[env_var] = original
