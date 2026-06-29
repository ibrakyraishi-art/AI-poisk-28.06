#!/usr/bin/env python3
"""
CompetitorScope — точка входа.

Запуск:
  python main.py --company FitTrack --period 30d
  python main.py --company FitTrack --period 90d --platform app_store
  python main.py --company FitTrack --period 30d --model sonnet

Stage 4: Process.hierarchical + Manager Agent + ConditionalTask.
  Manager координирует pipeline; если Reviews вернул мало данных или
  низкую уверенность — ConditionalTask автоматически запускает повторный
  сбор с расширенным периодом (30d→90d, 90d→6m).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone

from crewai import ConditionalTask, Crew, Process

from agents.analyst_agent import create_analyst_agent, create_analyst_task
from agents.manager_agent import create_manager_agent
from agents.news_agent import create_news_agent, create_news_task
from agents.report_writer_agent import create_report_writer_agent, create_report_task
from agents.reviews_agent import create_reviews_agent, create_reviews_task
from config.limits import MIN_CONFIDENCE, MIN_REVIEW_COUNT
from config.llm_config import DEFAULTS, needs_cost_warning
from models.schemas import ReviewData

# 30d → 90d → 6m (максимум, выше не эскалируем)
_PERIOD_ESCALATION: dict[str, str] = {"30d": "90d", "90d": "6m", "6m": "6m"}


# ---------------------------------------------------------------------------
# ConditionalTask condition
# ---------------------------------------------------------------------------

def _needs_review_retry(task_output) -> bool:
    """
    Возвращает True, если Reviews Agent собрал слишком мало данных.
    CrewAI вызывает эту функцию перед retry_reviews_task;
    если True — задача выполняется, если False — пропускается.
    """
    try:
        data: ReviewData | None = task_output.pydantic
        if data is None:
            return True  # нет структурированного вывода → retry
        low_count      = data.review_count < MIN_REVIEW_COUNT
        low_confidence = data.confidence   < MIN_CONFIDENCE
        if low_count or low_confidence:
            print(
                f"[Manager] Reviews качество низкое "
                f"(count={data.review_count}, confidence={data.confidence:.2f}) "
                f"— запускаю retry с расширенным периодом."
            )
            return True
        return False
    except Exception as exc:
        print(f"[Manager] Ошибка при чтении ReviewData ({exc}) — retry.")
        return True


# ---------------------------------------------------------------------------
# Supabase helpers (optional — работает и без Supabase)
# ---------------------------------------------------------------------------

def _supabase_client():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    from supabase import create_client  # noqa: PLC0415
    return create_client(url, key)


def _create_run(client, *, user_id: str, company: str, period: str) -> str:
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


def _finish_run(
    client,
    run_id: str,
    *,
    status: str,
    report_json=None,
    report_docx_path: str | None = None,
    error: str | None = None,
) -> None:
    if client is None:
        return
    payload: dict = {
        "status": status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    if report_json is not None:
        payload["report_json"] = report_json
    if report_docx_path is not None:
        payload["report_docx_path"] = report_docx_path
    if error is not None:
        payload["error"] = error
    client.table("analysis_runs").update(payload).eq("id", run_id).execute()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="CompetitorScope — AI competitive analysis")
    parser.add_argument("--company",  required=True, help="Название приложения/компании")
    parser.add_argument("--period",   default="30d", choices=["30d", "90d", "6m"])
    parser.add_argument("--platform", default="both", choices=["app_store", "google_play", "both"])
    parser.add_argument("--model",    default=None,   help="Ключ модели: gemini-flash, haiku, sonnet, opus")
    parser.add_argument("--user-id",  default=None,   help="UUID пользователя (по умолчанию — dev UUID)")
    args = parser.parse_args()

    user_id        = args.user_id or "00000000-0000-0000-0000-000000000001"
    model_override = args.model
    extended_period = _PERIOD_ESCALATION[args.period]

    # Предупреждение о стоимости перед дорогими моделями
    effective_models = {
        name: model_override or DEFAULTS[name]
        for name in [
            "reviews_agent", "news_agent", "analyst_agent",
            "report_writer_agent", "manager_agent",
        ]
    }
    if needs_cost_warning(effective_models):
        print(f"\n[!] Внимание: модель '{model_override}' может стоить $1–5 за этот запуск.")
        confirm = input("Продолжить? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Отменено.")
            sys.exit(0)

    client = _supabase_client()
    run_id = _create_run(client, user_id=user_id, company=args.company, period=args.period)

    _print_header(args.company, args.period, effective_models, run_id)

    try:
        # --- Worker-агенты ---
        reviews_agent       = create_reviews_agent(run_id=run_id, user_id=user_id, model_key=model_override)
        news_agent          = create_news_agent(run_id=run_id, user_id=user_id, model_key=model_override)
        analyst_agent       = create_analyst_agent(run_id=run_id, model_key=model_override)
        report_writer_agent = create_report_writer_agent(run_id=run_id, user_id=user_id, model_key=model_override)

        # --- Manager (отдельно от worker-агентов) ---
        manager_agent = create_manager_agent(model_key=model_override)

        # --- Задачи ---
        reviews_task = create_reviews_task(
            reviews_agent, app_name=args.company, period=args.period,
        )

        # ConditionalTask: запускается только если _needs_review_retry вернул True
        retry_reviews_task = ConditionalTask(
            description=(
                f"The initial review collection returned insufficient data. "
                f"Re-collect reviews for '{args.company}' with an extended period "
                f"of {extended_period} (instead of {args.period}).\n\n"
                f"Use the same steps as the initial reviews task but with period={extended_period}. "
                f"Call fetch_and_save_reviews with: "
                f"'{args.company} | both | {extended_period}'."
            ),
            expected_output=(
                "A valid ReviewData JSON with higher review_count and confidence "
                "than the initial run."
            ),
            condition=_needs_review_retry,
            agent=reviews_agent,
            output_pydantic=ReviewData,
        )

        news_task = create_news_task(
            news_agent, company=args.company, period=args.period,
        )

        # Analyst и Report видят оба Reviews-таска: если retry запустился,
        # они получают оба вывода и используют более полный набор данных.
        analyst_task = create_analyst_task(
            analyst_agent,
            company=args.company,
            period=args.period,
            context_tasks=[reviews_task, retry_reviews_task, news_task],
        )
        report_task = create_report_task(
            report_writer_agent,
            company=args.company,
            period=args.period,
            context_tasks=[reviews_task, retry_reviews_task, news_task, analyst_task],
        )

        crew = Crew(
            agents=[reviews_agent, news_agent, analyst_agent, report_writer_agent],
            tasks=[reviews_task, retry_reviews_task, news_task, analyst_task, report_task],
            process=Process.hierarchical,
            manager_agent=manager_agent,
            verbose=True,
        )

        crew_output = crew.kickoff()

        report_data = crew_output.pydantic
        if report_data is None:
            raise RuntimeError("Crew не вернул структурированный ReportData.")

        _print_results(report_data)

        report_dict = json.loads(report_data.model_dump_json())
        _finish_run(
            client,
            run_id,
            status="completed",
            report_json=report_dict,
            report_docx_path=f"reports/{run_id}/report.docx",
        )
        print(f"\n[OK] Готово. run_id: {run_id}")

    except Exception as exc:
        _finish_run(client, run_id, status="failed", error=str(exc))
        print(f"\n[ERR] Ошибка: {exc}", file=sys.stderr)
        raise


# ---------------------------------------------------------------------------
# Print helpers
# ---------------------------------------------------------------------------

def _print_header(company: str, period: str, models: dict, run_id: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  CompetitorScope  |  {company}  |  {period}")
    print(f"  run_id  : {run_id}")
    print(f"  reviews : {models['reviews_agent']}   "
          f"news: {models['news_agent']}")
    print(f"  analyst : {models['analyst_agent']}   "
          f"report: {models['report_writer_agent']}")
    print(f"  manager : {models['manager_agent']}")
    print(f"{'=' * 60}\n")


def _print_results(report) -> None:
    sep = "=" * 60
    print(f"\n{sep}")
    print(f"  ФИНАЛЬНЫЙ ОТЧЁТ — {report.company}  ({report.period})")
    print(sep)

    print("\n--- Executive Summary ---")
    print(report.executive_summary)

    print(f"\n--- Темы отзывов ({len(report.review_themes)}) ---")
    icons = {"positive": "[+]", "negative": "[-]", "mixed": "[~]"}
    for t in report.review_themes:
        icon = icons.get(t.sentiment, "[?]")
        print(f"\n  {icon} {t.theme}  (~{t.review_count} отзывов)")
        for q in t.examples[:2]:
            print(f'      "{q}"')

    swot = report.swot
    print("\n--- SWOT ---")
    print(f"  Сильные стороны  ({len(swot.strengths)}): "
          + "; ".join(swot.strengths[:2]))
    print(f"  Слабые стороны   ({len(swot.weaknesses)}): "
          + "; ".join(swot.weaknesses[:2]))
    print(f"  Возможности      ({len(swot.opportunities)}): "
          + "; ".join(swot.opportunities[:2]))
    print(f"  Угрозы           ({len(swot.threats)}): "
          + "; ".join(swot.threats[:2]))

    print(f"\n--- Ключевые инсайты ({len(swot.key_insights)}) ---")
    for i, insight in enumerate(swot.key_insights, 1):
        print(f"  {i}. {insight}")

    print(f"\n--- Рекомендации ({len(report.recommendations)}) ---")
    for i, rec in enumerate(report.recommendations, 1):
        print(f"  {i}. {rec}")

    print(f"\n  Уверенность аналитика: {swot.confidence:.0%}")
    print(f"  Отчёт сгенерирован  : {report.generated_at}")
    print(sep)


if __name__ == "__main__":
    main()
