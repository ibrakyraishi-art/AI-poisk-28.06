"""
Reviews Agent — сбор и анализ отзывов пользователей.

Порядок работы:
1. FetchAndSaveReviewsTool скрейпит App Store / Google Play батчами по 50.
2. После каждого батча — проверка насыщения (is_saturated).
3. Если >95% батча — уже известные темы, или собрано MAX_REVIEWS — стоп.
4. Агент (LLM) ищет по памяти через MemorySearchTool и группирует темы.
5. Возвращает ReviewData (output_pydantic).

Фолбэк: если скрейпер падает → загружает tests/fixtures/app_store_reviews.json.
"""
from __future__ import annotations

import json
from pathlib import Path

from crewai import Agent, Task
from crewai.tools import BaseTool

from config.limits import BATCH_SIZE, MAX_REVIEWS
from config.llm_config import DEFAULTS, get_litellm_id
from memory import vector_store
from models.schemas import ReviewData
from tools.memory_save_tool import MemorySaveTool
from tools.memory_search_tool import MemorySearchTool

_MOCK_FIXTURE = Path(__file__).parent.parent / "tests" / "fixtures" / "app_store_reviews.json"


# ---------------------------------------------------------------------------
# Scraping helpers
# ---------------------------------------------------------------------------

def _load_mock() -> list[dict]:
    with open(_MOCK_FIXTURE, encoding="utf-8") as f:
        return json.load(f)


def _fetch_google_play(app_id: str) -> list[dict]:
    from google_play_scraper import Sort, reviews as gp_reviews  # noqa: PLC0415
    result, _ = gp_reviews(
        app_id, lang="en", country="us",
        sort=Sort.NEWEST, count=MAX_REVIEWS,
    )
    return [{"text": r["content"], "url": "", "rating": r["score"]} for r in result if r.get("content")]


def _fetch_app_store(app_name: str) -> list[dict]:
    from app_store_scraper import AppStore  # noqa: PLC0415
    app = AppStore(country="us", app_name=app_name)
    app.review(how_many=MAX_REVIEWS)
    return [{"text": r["review"], "url": "", "rating": r["rating"]} for r in app.reviews if r.get("review")]


def _scrape(app_name: str, platform: str) -> list[dict]:
    """Try real scrapers; fall back to mock if anything fails."""
    try:
        reviews: list[dict] = []
        if platform in ("google_play", "both"):
            reviews += _fetch_google_play(app_name)
        if platform in ("app_store", "both"):
            reviews += _fetch_app_store(app_name)
        if not reviews:
            raise RuntimeError("Scrapers returned 0 reviews.")
        return reviews
    except Exception as exc:
        print(f"[Reviews Agent] Scraper failed ({exc}). Loading mock fixture.")
        return _load_mock()


# ---------------------------------------------------------------------------
# FetchAndSaveReviewsTool
# ---------------------------------------------------------------------------

class FetchAndSaveReviewsTool(BaseTool):
    """
    Scrapes reviews, saves them to pgvector in batches, stops on saturation.
    Single tool call handles the entire data-collection pipeline.
    """
    name: str = "fetch_and_save_reviews"
    description: str = (
        "Fetch user reviews for an app and save them to analysis memory. "
        "Input format (pipe-separated): '<app_name> | <platform> | <period>' "
        "where platform is 'app_store', 'google_play', or 'both', "
        "and period is '30d', '90d', or '6m'. "
        "Returns a summary including how many reviews were saved and "
        "instructions for what to search next."
    )
    run_id: str
    user_id: str

    def _run(self, query: str) -> str:
        parts = [p.strip() for p in query.split("|")]
        app_name = parts[0] if parts else "unknown"
        platform  = parts[1] if len(parts) > 1 else "both"
        period    = parts[2] if len(parts) > 2 else "30d"

        all_reviews = _scrape(app_name, platform)
        all_reviews = all_reviews[:MAX_REVIEWS]

        saved = 0
        stop_reason = "MAX_REVIEWS reached"

        for i in range(0, len(all_reviews), BATCH_SIZE):
            batch = all_reviews[i : i + BATCH_SIZE]
            texts = [r["text"] for r in batch]

            # saturation check — only after first batch is already in memory
            if saved > 0 and vector_store.is_saturated(texts, run_id=self.run_id):
                stop_reason = "saturated (<5% new topics in batch)"
                break

            vector_store.save_batch(
                run_id=self.run_id,
                user_id=self.user_id,
                agent="reviews_agent",
                items=[{"content": r["text"], "source_url": r.get("url", "")} for r in batch],
            )
            saved += len(batch)

        return (
            f"Collected {len(all_reviews)} reviews for '{app_name}' "
            f"({platform}, {period}). Saved {saved} to memory. "
            f"Stopped: {stop_reason}.\n\n"
            "Next: use memory_search to find themes. Suggested queries: "
            "'crash bug error', 'price subscription cost', 'battery drain', "
            "'GPS accuracy', 'sync', 'UI design', 'customer support'."
        )


# ---------------------------------------------------------------------------
# Agent + Task factory functions
# ---------------------------------------------------------------------------

def create_reviews_agent(
    *,
    run_id: str,
    user_id: str,
    model_key: str | None = None,
) -> Agent:
    model_key = model_key or DEFAULTS["reviews_agent"]
    return Agent(
        role="App Reviews Analyst",
        goal=(
            "Collect user reviews for the target mobile app, identify the 3-7 most "
            "common themes (what users love and what frustrates them), and assess "
            "overall sentiment per theme."
        ),
        backstory=(
            "You are an expert in mobile app user research. You've analyzed thousands "
            "of App Store and Google Play reviews. You excel at spotting recurring "
            "patterns — from single-word complaints to nuanced UX frustrations — "
            "and turning them into actionable insights for product teams."
        ),
        tools=[
            FetchAndSaveReviewsTool(run_id=run_id, user_id=user_id),
            MemorySearchTool(run_id=run_id),
            MemorySaveTool(run_id=run_id, user_id=user_id, agent_name="reviews_agent"),
        ],
        llm=get_litellm_id(model_key),
        verbose=True,
        max_iter=8,
    )


def create_reviews_task(agent: Agent, *, app_name: str, period: str) -> Task:
    return Task(
        description=(
            f"Analyze user reviews for the app '{app_name}' over the past {period}.\n\n"
            "Step 1: Call fetch_and_save_reviews with the format "
            f"'{app_name} | both | {period}'.\n"
            "Step 2: Use memory_search with these queries to find patterns: "
            "'crash bug error', 'price cost subscription', 'battery drain', "
            "'GPS accuracy tracking', 'sync data cloud', 'UI design interface', "
            "'customer support response'.\n"
            "Step 3: Group findings into 3-7 themes. For each theme provide: "
            "theme name, sentiment (positive/negative/mixed), approximate review_count, "
            "and 2-3 direct quote examples from the reviews.\n"
            "Step 4: Set confidence: 0.9 if >50 reviews saved, 0.7 if 10–50, 0.5 if <10."
        ),
        expected_output=(
            "A valid ReviewData JSON with: app_name, platform, review_count, period, "
            "themes (list of ReviewTheme with theme/sentiment/review_count/examples), "
            "confidence (float 0–1), reviews_saved_to_memory (int)."
        ),
        agent=agent,
        output_pydantic=ReviewData,
    )
