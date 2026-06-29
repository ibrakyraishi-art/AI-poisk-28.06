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

from models.schemas import AnalystOutput, NewsData, ReportData, ReviewData


def make_reviews_task(agent, *, app_name: str, period: str) -> Task:
    """Stage 2: собрать отзывы и определить темы."""
    from agents.reviews_agent import create_reviews_task
    return create_reviews_task(agent, app_name=app_name, period=period)


def make_news_task(agent, *, company: str, period: str) -> Task:
    """Stage 3: собрать новости и упомянания в прессе."""
    return Task(
        description=(
            f"Find recent news articles and press mentions about '{company}' "
            f"from the past {period}.\n\n"
            "Steps:\n"
            "1. Search for news using the news_search tool with these queries: "
            f"'{company} app update', '{company} review', '{company} funding', "
            f"'{company} competitor'.\n"
            "2. Save each relevant article summary to memory using memory_save "
            "with the source URL appended: 'summary | url: <url>'.\n"
            "3. Identify: product updates, user complaints mentioned in press, "
            "funding or company news, competitive moves.\n"
            "4. Set confidence: 0.9 if >10 articles found, 0.6 if 5-10, 0.4 if <5."
        ),
        expected_output=(
            "A valid NewsData JSON with: company, period, article_count, "
            "key_developments (list of strings), sentiment_summary (string), "
            "confidence (float 0-1), articles_saved_to_memory (int)."
        ),
        agent=agent,
        output_pydantic=NewsData,
    )


def make_analyst_task(agent, *, company: str, period: str, context_tasks: list[Task]) -> Task:
    """Stage 3: SWOT-анализ на основе данных из RAG-памяти."""
    return Task(
        description=(
            f"Perform a strategic SWOT analysis for '{company}' based on "
            f"collected reviews and news from the past {period}.\n\n"
            "Steps:\n"
            "1. Search memory for key themes: use memory_search with queries like "
            "'user complaints', 'positive feedback', 'product updates', "
            "'competitive threats', 'market opportunity'.\n"
            "2. Synthesize findings into Strengths, Weaknesses, Opportunities, Threats.\n"
            "3. Extract 3-5 key_insights — actionable statements for the product team.\n"
            "4. Set confidence based on data richness (>50 data points = 0.9, else scale down)."
        ),
        expected_output=(
            "A valid AnalystOutput JSON with: company, period, strengths, weaknesses, "
            "opportunities, threats, key_insights, confidence."
        ),
        agent=agent,
        output_pydantic=AnalystOutput,
        context=context_tasks,   # видит вывод Reviews и News задач
    )


def make_report_task(agent, *, company: str, period: str, context_tasks: list[Task]) -> Task:
    """Stage 3: финальный отчёт по всем данным."""
    return Task(
        description=(
            f"Write a comprehensive competitive analysis report for '{company}' "
            f"covering the past {period}.\n\n"
            "Using the analysis from previous agents:\n"
            "1. Write a concise executive_summary (3-5 sentences, management-level).\n"
            "2. Include top review themes with example quotes.\n"
            "3. Include the full SWOT analysis.\n"
            "4. List 3-5 concrete, prioritised recommendations.\n"
            "The report will be saved as a Word document and JSON."
        ),
        expected_output=(
            "A valid ReportData JSON with: company, period, generated_at (ISO 8601), "
            "executive_summary, review_themes, swot (AnalystOutput), "
            "competitors (empty list for now — filled in Stage 5), recommendations."
        ),
        agent=agent,
        output_pydantic=ReportData,
        context=context_tasks,
    )
