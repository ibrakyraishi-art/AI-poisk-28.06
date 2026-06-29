"""
Pydantic-схемы для структурированного вывода агентов.

CrewAI передаёт схему в output_pydantic= агента.
LLM вынужден ответить JSON, который валидируется по этой схеме.
Если JSON не проходит — CrewAI делает retry (до 2 раз).
"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Reviews Agent output
# ---------------------------------------------------------------------------

class ReviewTheme(BaseModel):
    """Одна тема из отзывов: название, тональность, примеры цитат."""
    theme: str
    sentiment: str          # "positive" | "negative" | "mixed"
    review_count: int       # сколько отзывов попало в эту тему
    examples: list[str] = Field(default_factory=list)  # 2-3 цитаты из отзывов


class ReviewData(BaseModel):
    """
    Полный вывод Reviews Agent.

    confidence используется ConditionalTask (Stage 4):
    если review_count < MIN_REVIEW_COUNT или confidence < MIN_CONFIDENCE,
    Manager отправляет агента на повторный прогон с расширенным периодом.
    """
    app_name: str
    platform: str                            # "app_store" | "google_play" | "both"
    review_count: int                        # всего обработано отзывов
    period: str                              # "30d" | "90d" | "6m"
    themes: list[ReviewTheme]
    confidence: float = Field(ge=0.0, le=1.0)  # уверенность агента в результате
    reviews_saved_to_memory: int = 0         # сколько сохранено в pgvector


# ---------------------------------------------------------------------------
# News Agent output
# ---------------------------------------------------------------------------

class NewsData(BaseModel):
    """Вывод News Agent: статьи и упоминания в прессе."""
    company: str
    period: str
    article_count: int
    key_developments: list[str]      # важные события: обновления, финансирование, etc.
    sentiment_summary: str           # общий тон прессы о компании
    confidence: float = Field(ge=0.0, le=1.0)
    articles_saved_to_memory: int = 0


# ---------------------------------------------------------------------------
# Analyst Agent output
# ---------------------------------------------------------------------------

class AnalystOutput(BaseModel):
    """SWOT-анализ и ключевые инсайты на основе данных из RAG-памяти."""
    company: str
    period: str
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]
    key_insights: list[str]
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Business Context Agent output (Stage 5)
# ---------------------------------------------------------------------------

class BusinessContextData(BaseModel):
    """Рыночный контекст целевой компании: категория, аудитория, позиционирование."""
    company: str
    category: str              # "fitness tracking", "project management", etc.
    target_audience: str       # кто основные пользователи
    key_differentiators: list[str]   # чем выделяется среди конкурентов
    main_competitors: list[str]      # имена конкурентов — передаются Competitor Finder
    market_context: str        # краткий абзац о рынке и трендах
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Competitor Finder output (Stage 5)
# ---------------------------------------------------------------------------

class CompetitorProfile(BaseModel):
    """Профиль одного конкурента для матрицы сравнения."""
    name: str
    app_name: str | None = None
    rating: float | None = Field(default=None, ge=1.0, le=5.0)  # оценка в сторе
    price_model: str = ""    # "free" | "freemium" | "paid" | "subscription"
    key_features: list[str] = Field(default_factory=list)
    user_sentiment_summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)


class CompetitorFinderOutput(BaseModel):
    """Полный вывод Competitor Finder: матрица конкурентов."""
    company: str
    competitors: list[CompetitorProfile]  # ≥ COMPETITOR_MIN_COUNT=2
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Report Writer output
# ---------------------------------------------------------------------------

class ReportData(BaseModel):
    """Финальный отчёт — складывается из выводов всех агентов."""
    company: str
    period: str
    generated_at: str        # ISO 8601, например "2026-06-28T18:00:00Z"
    executive_summary: str
    review_themes: list[ReviewTheme]
    swot: AnalystOutput
    competitors: list[CompetitorProfile]
    recommendations: list[str]
