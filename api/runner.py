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


def _resolve_model_or_fail(model: str | None) -> str | None:
    """
    Pick a model the user actually has a key for, reading the BYOK keys already
    injected into os.environ for this run. Raises ValueError with a clear,
    user-facing (Russian) message when the required key is missing — so the run
    fails fast instead of hanging on endless LLM retries.

    - explicit `model`: verify its provider key is present.
    - default (`model is None`): the per-agent DEFAULTS mix Gemini (data agents)
      and Claude (analysis), so they need BOTH providers. If the user has only
      one, force a single-provider model so "По умолчанию" just works.
    """
    has_google = bool(os.environ.get("GEMINI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))

    if model:
        needs = _MODEL_PROVIDER.get(model)
        if needs == "GEMINI_API_KEY" and not has_google:
            raise ValueError("Для модели Gemini Flash нужен ключ Google AI. Добавьте его в настройках или выберите модель Claude.")
        if needs == "ANTHROPIC_API_KEY" and not has_anthropic:
            raise ValueError("Для моделей Claude нужен ключ Anthropic. Добавьте его в настройках или выберите Gemini Flash.")
        if needs == "OPENAI_API_KEY" and not has_openai:
            raise ValueError("Для модели GPT нужен ключ OpenAI. Добавьте его в настройках.")
        return model

    if has_google and has_anthropic:
        return None            # per-agent defaults: cheap Gemini + smart Claude
    if has_anthropic:
        return "haiku"         # весь пайплайн на Claude Haiku — дёшево, без Google
    if has_google:
        return "gemini-flash"  # весь пайплайн на Gemini
    if has_openai:
        return "gpt-4o-mini"
    raise ValueError("Не задан ни один LLM-ключ (Anthropic, Google AI или OpenAI). Добавьте ключ в настройках.")


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
                     company=company, period=period, platform=platform, model=model)
    return run_id


def _run_crew(
    *,
    run_id: str,
    user_id: str,
    company: str,
    period: str,
    platform: str,
    model: str | None,
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
        # Fail fast (clear message) if the chosen model has no key; adapt the
        # default model to whichever provider the user actually configured.
        resolved_model = _resolve_model_or_fail(model)

        reviews_agent          = create_reviews_agent(run_id=run_id, user_id=user_id, model_key=resolved_model)
        news_agent             = create_news_agent(run_id=run_id, user_id=user_id, model_key=resolved_model)
        business_context_agent = create_business_context_agent(run_id=run_id, user_id=user_id, model_key=resolved_model)
        competitor_finder_agent= create_competitor_finder_agent(run_id=run_id, user_id=user_id, model_key=resolved_model)
        analyst_agent          = create_analyst_agent(run_id=run_id, model_key=resolved_model)
        report_writer_agent    = create_report_writer_agent(run_id=run_id, user_id=user_id, model_key=resolved_model)
        manager_agent          = create_manager_agent(model_key=resolved_model)

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
