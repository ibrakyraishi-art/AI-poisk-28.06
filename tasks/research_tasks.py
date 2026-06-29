"""
Сборка задач для sequential pipeline (Stage 2–3).

Этот модуль знает порядок задач и передаёт контекст между ними:
Reviews → News → Analyst → Report Writer.

В Stage 4 Manager возьмёт управление порядком на себя
(Process.hierarchical + ConditionalTask), этот модуль станет
источником Task-объектов для него.
"""
from __future__ import annotations

from crewai import Task



def make_reviews_task(agent, *, app_name: str, period: str) -> Task:
    """Stage 2: собрать отзывы и определить темы."""
    from agents.reviews_agent import create_reviews_task
    return create_reviews_task(agent, app_name=app_name, period=period)


def make_news_task(agent, *, company: str, period: str) -> Task:
    """Stage 3: собрать новости и упомянания в прессе."""
    from agents.news_agent import create_news_task
    return create_news_task(agent, company=company, period=period)


def make_analyst_task(agent, *, company: str, period: str, context_tasks: list[Task]) -> Task:
    """Stage 3: SWOT-анализ на основе данных из RAG-памяти."""
    from agents.analyst_agent import create_analyst_task
    return create_analyst_task(agent, company=company, period=period, context_tasks=context_tasks)


def make_report_task(agent, *, company: str, period: str, context_tasks: list[Task]) -> Task:
    """Stage 3: финальный отчёт по всем данным."""
    from agents.report_writer_agent import create_report_task
    return create_report_task(agent, company=company, period=period, context_tasks=context_tasks)
