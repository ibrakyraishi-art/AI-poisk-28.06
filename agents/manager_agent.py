"""
Manager Agent — оркестратор иерархического pipeline (Stage 4+).

Используется с Process.hierarchical:
  Crew(process=Process.hierarchical, manager_agent=manager)

Manager не выполняет работу сам — он делегирует задачи worker-агентам.
Его задача: следить за порядком выполнения, читать результаты каждого агента
и принимать решение о следующем шаге (в том числе о том, нужен ли retry).

ConditionalTask-логика:
  Если Reviews Agent вернул review_count < MIN_REVIEW_COUNT
  или confidence < MIN_CONFIDENCE — Manager запускает повторный сбор
  отзывов с расширенным периодом (30d → 90d, 90d → 6m).

Важно: manager_agent НЕ входит в список agents= у Crew.
Crew(agents=[reviews, news, analyst, report], manager_agent=manager_agent)
"""
from __future__ import annotations

from crewai import Agent

from config.llm_config import DEFAULTS, get_litellm_id


def create_manager_agent(*, model_key: str | None = None) -> Agent:
    """
    Создаёт Manager Agent для Process.hierarchical.
    Передаётся в Crew(manager_agent=...), не в agents=[...].
    """
    model_key = model_key or DEFAULTS["manager_agent"]
    return Agent(
        role="Analysis Pipeline Manager",
        goal=(
            "Coordinate the competitive analysis pipeline from start to finish. "
            "Delegate each task to the right specialist agent, verify the quality "
            "of each output, and trigger a retry when data quality is insufficient "
            "(too few reviews or low confidence score)."
        ),
        backstory=(
            "You are a seasoned research director who oversees a team of specialist "
            "analysts. You never do the analysis yourself — your value is in knowing "
            "which expert to send each problem to, recognising when a result is "
            "incomplete or unreliable, and escalating intelligently when it is."
        ),
        llm=get_litellm_id(model_key),
        allow_delegation=True,
        verbose=True,
    )
