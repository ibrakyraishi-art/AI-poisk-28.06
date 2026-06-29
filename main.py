#!/usr/bin/env python3
"""
CompetitorScope — точка входа.

Запуск:
  python main.py --company FitTrack --period 30d
  python main.py --company FitTrack --period 90d --platform app_store
  python main.py --company FitTrack --period 30d --model sonnet

Stage 2: один Reviews Agent, Process.sequential.
Stage 4 переключит на Process.hierarchical + Manager.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone

from crewai import Crew, Process

from agents.reviews_agent import create_reviews_agent, create_reviews_task
from config.llm_config import DEFAULTS, needs_cost_warning


# ---------------------------------------------------------------------------
# Supabase helpers (optional — работает и без Supabase)
# ---------------------------------------------------------------------------

def _supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)


def _create_run(client, *, user_id: str, company: str, period: str) -> str:
    """Создаёт запись в analysis_runs и возвращает run_id."""
    if client is None:
        run_id = str(uuid.uuid4())
        print(f"[Supabase] Не настроен — используется локальный run_id: {run_id}")
        return run_id
    result = client.table("analysis_runs").insert({
        "user_id": user_id,
        "company": company,
        "period": period,
        "status": "running",
    }).execute()
    return result.data[0]["id"]


def _finish_run(client, run_id: str, *, status: str, report_json=None, error: str | None = None):
    if client is None:
        return
    payload: dict = {
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if report_json is not None:
        payload["report_json"] = report_json
    if error is not None:
        payload["error"] = error
    client.table("analysis_runs").update(payload).eq("id", run_id).execute()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="CompetitorScope — AI competitive analysis")
    parser.add_argument("--company",  required=True, help="Название приложения или компании (e.g. FitTrack)")
    parser.add_argument("--period",   default="30d", choices=["30d", "90d", "6m"])
    parser.add_argument("--platform", default="both", choices=["app_store", "google_play", "both"])
    parser.add_argument("--model",    default=None,   help="Ключ модели: gemini-flash, haiku, sonnet, opus")
    parser.add_argument("--user-id",  default=None,   help="UUID пользователя (по умолчанию — dev UUID)")
    args = parser.parse_args()

    user_id   = args.user_id or "00000000-0000-0000-0000-000000000001"
    model_key = args.model or DEFAULTS["reviews_agent"]

    # Предупреждение о стоимости перед дорогими моделями (Opus)
    if needs_cost_warning({"reviews_agent": model_key}):
        print(f"\n⚠  Внимание: модель '{model_key}' может стоить $1–5 за этот запуск.")
        confirm = input("Продолжить? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Отменено.")
            sys.exit(0)

    client = _supabase_client()
    run_id = _create_run(client, user_id=user_id, company=args.company, period=args.period)

    _print_header(args.company, args.period, model_key, run_id)

    try:
        agent = create_reviews_agent(run_id=run_id, user_id=user_id, model_key=model_key)
        task  = create_reviews_task(agent, app_name=args.company, period=args.period)

        crew = Crew(
            agents=[agent],
            tasks=[task],
            process=Process.sequential,
            verbose=True,
        )

        crew_output = crew.kickoff()

        # output_pydantic=ReviewData → результат доступен через .pydantic
        review_data = crew_output.pydantic
        if review_data is None:
            raise RuntimeError("Crew не вернул структурированный ReviewData.")

        _print_results(review_data)

        report_json = json.loads(review_data.model_dump_json())
        _finish_run(client, run_id, status="completed", report_json=report_json)
        print(f"\n✓ Готово. run_id: {run_id}")

    except Exception as exc:
        _finish_run(client, run_id, status="failed", error=str(exc))
        print(f"\n✗ Ошибка: {exc}", file=sys.stderr)
        raise


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------

def _print_header(company: str, period: str, model: str, run_id: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  CompetitorScope  |  {company}  |  {period}")
    print(f"  run_id : {run_id}")
    print(f"  model  : {model}")
    print(f"{'=' * 60}\n")


def _print_results(review_data) -> None:
    print(f"\n{'=' * 60}")
    print("  РЕЗУЛЬТАТЫ — Reviews Agent")
    print(f"{'=' * 60}")
    print(f"Приложение :   {review_data.app_name}")
    print(f"Платформа  :   {review_data.platform}")
    print(f"Отзывов    :   {review_data.review_count}")
    print(f"Сохранено  :   {review_data.reviews_saved_to_memory}")
    print(f"Уверенность:   {review_data.confidence:.0%}")
    print(f"\nТемы ({len(review_data.themes)}):")
    for theme in review_data.themes:
        sentiment_icon = {"positive": "✓", "negative": "✗", "mixed": "~"}.get(theme.sentiment, "?")
        print(f"\n  {sentiment_icon} [{theme.sentiment.upper()}] {theme.theme}  (~{theme.review_count} отзывов)")
        for example in theme.examples[:2]:
            print(f"    • \"{example}\"")


if __name__ == "__main__":
    main()
