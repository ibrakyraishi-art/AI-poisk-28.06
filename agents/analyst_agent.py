"""
Analyst Agent — SWOT-анализ на основе данных из RAG-памяти.

Порядок работы:
1. Агент ищет данные в pgvector через MemorySearchTool по нескольким запросам:
   'user complaints', 'positive feedback', 'product updates' и т.д.
2. Синтезирует найденное в Strengths, Weaknesses, Opportunities, Threats.
3. Выделяет 3-5 key_insights — конкретные выводы для продуктовой команды.
4. Возвращает AnalystOutput (output_pydantic).

Важно: агент НЕ делает внешних запросов — только читает то, что Reviews Agent
и News Agent уже сохранили в pgvector. Воспроизводимость гарантирована.
Дополнительно: CrewAI передаёт context_tasks, поэтому агент видит
структурированный JSON-вывод предыдущих агентов прямо в промпте.
"""
from __future__ import annotations

from crewai import Agent, Task

from config.llm_config import DEFAULTS, get_litellm_id
from models.schemas import AnalystOutput
from tools.memory_search_tool import MemorySearchTool


def create_analyst_agent(
    *,
    run_id: str,
    model_key: str | None = None,
) -> Agent:
    model_key = model_key or DEFAULTS["analyst_agent"]
    return Agent(
        role="Strategic Business Analyst",
        goal=(
            "Synthesise user review themes and press coverage into a rigorous "
            "SWOT analysis. Identify patterns across data sources, assess "
            "competitive position, and extract actionable insights for the product team."
        ),
        backstory=(
            "You are a senior product strategist with an MBA and 15 years of experience "
            "in competitive analysis for mobile app companies. You excel at connecting "
            "dots across disparate data — a spike in GPS complaints in reviews, a press "
            "article about a competitor's mapping feature, a funding announcement — "
            "and translating them into clear strategic recommendations that drive decisions."
        ),
        tools=[
            MemorySearchTool(run_id=run_id),
        ],
        llm=get_litellm_id(model_key),
        verbose=True,
        max_iter=10,
    )


def create_analyst_task(
    agent: Agent,
    *,
    company: str,
    period: str,
    context_tasks: list[Task],
) -> Task:
    return Task(
        description=(
            f"Perform a strategic SWOT analysis for '{company}' based on "
            f"reviews and news collected over the past {period}.\n\n"
            "Steps:\n"
            "1. Search memory with these queries to gather evidence "
            "(one memory_search call per query):\n"
            "   'user complaints bug crash error',\n"
            "   'positive feedback love great excellent',\n"
            "   'price cost subscription expensive',\n"
            "   'competitor alternative better',\n"
            "   'product update feature launch',\n"
            "   'market growth opportunity trend'.\n"
            "2. Also review the structured output already provided in your context "
            "(ReviewData and NewsData from previous agents).\n"
            "3. Synthesise all evidence into:\n"
            "   - Strengths: what users consistently praise; clear product advantages\n"
            "   - Weaknesses: recurring pain points; technical issues; pricing friction\n"
            "   - Opportunities: underserved user needs; market trends; partnership signals\n"
            "   - Threats: competitor moves; churn signals; platform or regulatory risks\n"
            "4. Extract 3-5 key_insights. Be specific and actionable:\n"
            "   Good: 'GPS accuracy issues affect Android users disproportionately — "
            "a targeted fix could recover ~20% of recently churned users.'\n"
            "   Bad: 'Users have some complaints about the app.'\n"
            "5. Set confidence: 0.9 if memory returned >50 results total, "
            "0.7 if 20-50, 0.5 if <20."
        ),
        expected_output=(
            "A valid AnalystOutput JSON with: company, period, "
            "strengths (list of strings), weaknesses (list of strings), "
            "opportunities (list of strings), threats (list of strings), "
            "key_insights (list of strings), confidence (float 0-1)."
        ),
        agent=agent,
        output_pydantic=AnalystOutput,
        context=context_tasks,
    )
