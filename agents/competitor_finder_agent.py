"""
Competitor Finder Agent — матрица конкурентов.

Порядок работы:
1. Читает main_competitors из вывода Business Context Agent (через context=).
2. По каждому конкуренту делает 2 веб-поиска:
   рейтинг+цена, функции+отзывы.
3. Сохраняет ключевые факты в pgvector через MemorySaveTool.
4. Собирает CompetitorProfile для каждого и возвращает CompetitorFinderOutput.

Ограничения:
- Минимум COMPETITOR_MIN_COUNT=2 профилей (иначе отчёт неполный).
- Максимум 5 конкурентов — больше нецелесообразно для executive-отчёта.
- Если данных по конкуренту мало → заполняет доступные поля, остальные пропускает.
"""
from __future__ import annotations

from crewai import Agent, Task

from config.limits import COMPETITOR_MIN_COUNT
from config.llm_config import DEFAULTS, get_litellm_id
from models.schemas import CompetitorFinderOutput
from tools.memory_save_tool import MemorySaveTool
from tools.memory_search_tool import MemorySearchTool
from tools.serper_search_tool import SerperSearchTool


def create_competitor_finder_agent(
    *,
    run_id: str,
    user_id: str,
    model_key: str | None = None,
) -> Agent:
    model_key = model_key or DEFAULTS["competitor_finder_agent"]
    return Agent(
        role="Competitive Intelligence Researcher",
        goal=(
            "Build a detailed comparison matrix of the target company's direct competitors. "
            "For each competitor find: App Store/Play rating, pricing model, "
            "top features, user sentiment, strengths and weaknesses."
        ),
        backstory=(
            "You are a competitive intelligence specialist who tracks mobile app markets. "
            "You know how to quickly assemble a competitor profile from review sites, "
            "app store pages, and tech press — extracting the metrics that matter "
            "to a product team: price, rating, key features, and what users complain about."
        ),
        tools=[
            SerperSearchTool(),
            MemorySearchTool(run_id=run_id),
            MemorySaveTool(run_id=run_id, user_id=user_id, agent_name="competitor_finder_agent"),
        ],
        llm=get_litellm_id(model_key),
        verbose=True,
        max_iter=12,
    )


def create_competitor_finder_task(
    agent: Agent,
    *,
    company: str,
    context_tasks: list[Task],
) -> Task:
    return Task(
        description=(
            f"Build a competitor comparison matrix for '{company}'.\n\n"
            "Steps:\n"
            "1. Read the main_competitors list from the Business Context output in your context.\n"
            f"   Research at least {COMPETITOR_MIN_COUNT} competitors, up to 5.\n\n"
            "2. For EACH competitor, run two web searches:\n"
            "   a. '<competitor name> app review rating price 2026'\n"
            "   b. '<competitor name> app features pros cons users'\n\n"
            "3. After each competitor's searches, save key facts to memory:\n"
            "   '<competitor>: <fact> | url: <source_url>'\n\n"
            "4. Build a CompetitorProfile for each competitor with:\n"
            "   - name: competitor's brand name\n"
            "   - app_name: app name if different from brand\n"
            "   - rating: numeric App Store / Play rating (1.0-5.0)\n"
            "   - price_model: 'free' | 'freemium' | 'paid' | 'subscription'\n"
            "   - key_features: 3-5 notable features\n"
            "   - user_sentiment_summary: 1-2 sentences on what users love/hate\n"
            "   - strengths: 2-3 competitive advantages vs the target company\n"
            "   - weaknesses: 2-3 areas where the competitor falls short\n"
            "   - source_urls: URLs used to build this profile\n\n"
            "5. Set confidence: 0.9 if ≥3 complete profiles, "
            "0.6 if 2 profiles, 0.4 if only 1."
        ),
        expected_output=(
            "A valid CompetitorFinderOutput JSON with: "
            f"company ('{company}'), "
            f"competitors (list of CompetitorProfile, at least {COMPETITOR_MIN_COUNT}), "
            "confidence (float 0-1)."
        ),
        agent=agent,
        output_pydantic=CompetitorFinderOutput,
        context=context_tasks,
    )
