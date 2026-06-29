"""
Business Context Agent — рыночный контекст целевой компании.

Порядок работы:
1. Агент делает 3-4 веб-поиска через SerperSearchTool:
   категория рынка, целевая аудитория, конкуренты, дифференциаторы.
2. Релевантные факты сохраняет в pgvector через MemorySaveTool.
3. Возвращает BusinessContextData (output_pydantic), включая список
   main_competitors — он передаётся в Competitor Finder через context=.

Важно: поле main_competitors — это "мост" между агентами.
Business Context Agent называет конкурентов по имени;
Competitor Finder Agent глубоко исследует каждого из них.
"""
from __future__ import annotations

from crewai import Agent, Task

from config.llm_config import DEFAULTS, get_litellm_id
from models.schemas import BusinessContextData
from tools.memory_save_tool import MemorySaveTool
from tools.memory_search_tool import MemorySearchTool
from tools.serper_search_tool import SerperSearchTool


def create_business_context_agent(
    *,
    run_id: str,
    user_id: str,
    model_key: str | None = None,
) -> Agent:
    model_key = model_key or DEFAULTS["business_context_agent"]
    return Agent(
        role="Market Research Analyst",
        goal=(
            "Quickly establish the market context for the target company: "
            "what category it belongs to, who its users are, what makes it "
            "different from competitors, and who the top 3-5 direct competitors are."
        ),
        backstory=(
            "You are a market research analyst who specialises in the mobile app industry. "
            "In 15 minutes you can profile any app's market position using public data. "
            "You know where to look — app store pages, review sites, comparison articles — "
            "and you distil what you find into crisp, factual summaries."
        ),
        tools=[
            SerperSearchTool(),
            MemorySearchTool(run_id=run_id),
            MemorySaveTool(run_id=run_id, user_id=user_id, agent_name="business_context_agent"),
        ],
        llm=get_litellm_id(model_key),
        verbose=True,
        max_iter=8,
    )


def create_business_context_task(
    agent: Agent,
    *,
    company: str,
    period: str,
) -> Task:
    return Task(
        description=(
            f"Research the market context for '{company}' — a mobile app.\n\n"
            "Steps:\n"
            f"1. Search the web with these queries (one web_search call each):\n"
            f"   '{company} app category overview 2026'\n"
            f"   '{company} app target audience users'\n"
            f"   '{company} competitors alternatives'\n"
            f"2. Save key facts to memory using memory_save:\n"
            "   '<fact> | url: <source>'\n"
            "3. Determine and output:\n"
            "   - category: the app's market category "
            "(e.g. 'fitness tracking', 'productivity', 'navigation')\n"
            "   - target_audience: 1-2 sentences describing the primary user segment\n"
            "   - key_differentiators: 2-4 things that set this app apart\n"
            "   - main_competitors: list of 3-5 direct competitor app names "
            "(these will be researched in depth by the next agent)\n"
            "   - market_context: 2-3 sentences on market size, growth, key trends\n"
            "4. Set confidence: 0.9 if found clear category + ≥3 competitors, "
            "0.6 if partial data, 0.4 if very limited results."
        ),
        expected_output=(
            "A valid BusinessContextData JSON with: company, category, "
            "target_audience (str), key_differentiators (list of str), "
            "main_competitors (list of str, 3-5 names), "
            "market_context (str), confidence (float 0-1)."
        ),
        agent=agent,
        output_pydantic=BusinessContextData,
    )
