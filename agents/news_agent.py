"""
News Agent — сбор новостей и упоминаний в прессе.

Порядок работы:
1. NewsSearchTool делает запросы к News API по нескольким поисковым фразам.
2. Агент сохраняет релевантные статьи в pgvector через MemorySaveTool.
3. Агент (LLM) читает сохранённые данные через MemorySearchTool.
4. Возвращает NewsData с key_developments и sentiment_summary (output_pydantic).

Фолбэк: если NEWS_API_KEY не задан или API недоступен → возвращает 10 заготовленных
mock-статей, охватывающих типичные темы (обновления, цены, конкуренты, финансирование).
"""
from __future__ import annotations

import os

from crewai import Agent, Task
from crewai.tools import BaseTool

from config.llm_config import DEFAULTS, get_litellm_id
from models.schemas import NewsData
from tools.memory_save_tool import MemorySaveTool
from tools.memory_search_tool import MemorySearchTool

_MOCK_ARTICLES = [
    {
        "title": "App Rolls Out Major Performance Update After User Complaints",
        "source": "TechCrunch",
        "description": (
            "The company announced a significant performance update addressing "
            "battery drain and crash issues reported by users over the past quarter."
        ),
        "url": "https://techcrunch.com/mock/performance-update",
    },
    {
        "title": "Company Raises $20M Series B to Expand AI Features",
        "source": "VentureBeat",
        "description": (
            "The fitness app startup secured $20 million in Series B funding "
            "to accelerate development of AI-powered recommendations."
        ),
        "url": "https://venturebeat.com/mock/series-b",
    },
    {
        "title": "Premium Subscription Price Hike Sparks User Backlash",
        "source": "The Verge",
        "description": (
            "After announcing a 30% increase in monthly subscription fees, "
            "the app faced significant criticism on social media and app stores."
        ),
        "url": "https://theverge.com/mock/price-hike",
    },
    {
        "title": "New Competitor Launches with Free Tier, Takes Aim at Market Leader",
        "source": "Forbes",
        "description": (
            "A well-funded startup launched a competing app offering a generous "
            "free tier that directly challenges the incumbent's freemium model."
        ),
        "url": "https://forbes.com/mock/competitor-launch",
    },
    {
        "title": "App Store Rating Climbs to 4.7 After Customer Support Overhaul",
        "source": "9to5Mac",
        "description": (
            "Following an investment in customer support staffing and a revamped "
            "help center, the app's rating improved from 3.9 to 4.7 in six months."
        ),
        "url": "https://9to5mac.com/mock/rating-improvement",
    },
    {
        "title": "Partnership with Apple Health Brings Automatic Data Sync",
        "source": "MacRumors",
        "description": (
            "A new integration with Apple Health enables automatic bidirectional "
            "sync of workout data, resolving a long-standing complaint from iOS users."
        ),
        "url": "https://macrumors.com/mock/apple-health-sync",
    },
    {
        "title": "Data Privacy Concerns Raised After Security Researcher's Report",
        "source": "Wired",
        "description": (
            "A security researcher disclosed that the app was transmitting location "
            "data more frequently than its privacy policy indicated."
        ),
        "url": "https://wired.com/mock/privacy-concern",
    },
    {
        "title": "Android Version Gets Long-Awaited GPS Accuracy Fix",
        "source": "Android Authority",
        "description": (
            "Version 8.2 includes a rewritten GPS module that addresses systematic "
            "distance tracking errors reported by runners and cyclists."
        ),
        "url": "https://androidauthority.com/mock/gps-fix",
    },
    {
        "title": "Company Expands Into European Market with Localised Features",
        "source": "TechEU",
        "description": (
            "The app launched localised versions for Germany, France, and Spain, "
            "with region-specific route data and multi-language support."
        ),
        "url": "https://tech.eu/mock/europe-expansion",
    },
    {
        "title": "Analyst Report: Fitness App Market Growing 18% Year-Over-Year",
        "source": "Business Insider",
        "description": (
            "Industry analysts project 18% YoY growth in fitness app subscriptions, "
            "driven by post-pandemic health awareness and wearable device adoption."
        ),
        "url": "https://businessinsider.com/mock/market-growth",
    },
]


# ---------------------------------------------------------------------------
# NewsSearchTool
# ---------------------------------------------------------------------------

class NewsSearchTool(BaseTool):
    """
    Searches News API for recent articles about a company or topic.
    Results are returned as formatted text — the agent decides which ones
    are worth saving to memory (via MemorySaveTool).
    Falls back to _MOCK_ARTICLES if NEWS_API_KEY is missing or API fails.
    """
    name: str = "news_search"
    description: str = (
        "Search for recent news articles about a company or app. "
        "Input: a search query string (e.g. 'Strava app update 2024'). "
        "Returns article titles, summaries, and URLs. "
        "After reviewing results, save relevant articles using memory_save "
        "in the format: '<title>: <summary> | url: <url>'."
    )
    run_id: str
    user_id: str

    def _run(self, query: str) -> str:
        try:
            return self._search_newsapi(query)
        except Exception as exc:
            print(f"[News Agent] NewsAPI failed ({exc!r}). Using mock articles.")
            return self._format_mock(query)

    def _search_newsapi(self, query: str) -> str:
        from newsapi import NewsApiClient  # noqa: PLC0415
        api_key = os.getenv("NEWS_API_KEY", "")
        if not api_key:
            raise RuntimeError("NEWS_API_KEY not set")
        client = NewsApiClient(api_key=api_key)
        response = client.get_everything(
            q=query,
            language="en",
            sort_by="relevancy",
            page_size=10,
        )
        articles = response.get("articles", [])
        if not articles:
            return f"No articles found for: '{query}'"
        lines = [f"Found {len(articles)} articles for '{query}':"]
        for a in articles:
            title = a.get("title") or "No title"
            source = (a.get("source") or {}).get("name", "Unknown")
            url = a.get("url", "")
            desc = (a.get("description") or "")[:300]
            lines.append(f"\n[{source}] {title}\nSummary: {desc}\nURL: {url}")
        return "\n".join(lines)

    def _format_mock(self, query: str) -> str:
        lines = [f"Mock news results for '{query}' (NEWS_API_KEY not set):"]
        for a in _MOCK_ARTICLES:
            lines.append(
                f"\n[{a['source']}] {a['title']}\n"
                f"Summary: {a['description']}\n"
                f"URL: {a['url']}"
            )
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Agent + Task factory functions
# ---------------------------------------------------------------------------

def create_news_agent(
    *,
    run_id: str,
    user_id: str,
    model_key: str | None = None,
) -> Agent:
    model_key = model_key or DEFAULTS["news_agent"]
    return Agent(
        role="Technology News Analyst",
        goal=(
            "Find and analyse recent press coverage about the target company. "
            "Identify key product developments, funding events, user sentiment in media, "
            "and competitive moves mentioned in articles."
        ),
        backstory=(
            "You are a technology journalist turned analyst with 10 years of experience "
            "covering mobile app companies. You quickly scan dozens of articles and extract "
            "the strategic signals that matter: product launches, pricing changes, "
            "executive moves, competitive threats, and reputation events."
        ),
        tools=[
            NewsSearchTool(run_id=run_id, user_id=user_id),
            MemorySearchTool(run_id=run_id),
            MemorySaveTool(run_id=run_id, user_id=user_id, agent_name="news_agent"),
        ],
        llm=get_litellm_id(model_key),
        verbose=True,
        max_iter=8,
    )


def create_news_task(agent: Agent, *, company: str, period: str) -> Task:
    return Task(
        description=(
            f"Find recent news articles and press mentions about '{company}' "
            f"from the past {period}.\n\n"
            "Steps:\n"
            "1. Call news_search with these queries (one call each):\n"
            f"   '{company} app update', '{company} user review',\n"
            f"   '{company} funding', '{company} competitor'.\n"
            "2. For each relevant article, save it using memory_save:\n"
            "   '<title>: <summary> | url: <url>'\n"
            "3. Identify across all articles:\n"
            "   - Product updates and new features\n"
            "   - User complaints or praise mentioned in press\n"
            "   - Funding, partnerships, or company news\n"
            "   - Competitive moves or market shifts\n"
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
