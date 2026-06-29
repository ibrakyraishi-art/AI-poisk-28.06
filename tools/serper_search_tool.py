"""
SerperSearchTool — веб-поиск через SerperDev (google.serper.dev).

Используется в Stage 5:
- Business Context Agent: поиск контекста о компании и рынке.
- Competitor Finder Agent: поиск информации о конкурентах.

Фолбэк: если SERPER_API_KEY не задан или API недоступен → возвращает
реалистичные mock-результаты, которые позволяют агентам работать в dev-режиме.

Результаты НЕ сохраняются автоматически — агент сам решает,
что релевантно, и вызывает memory_save для нужных фрагментов.
"""
from __future__ import annotations

import os

import requests
from crewai.tools import BaseTool

_MOCK_RESULTS: list[dict] = [
    {
        "title": "Top 5 Fitness Tracking Apps Compared (2026)",
        "snippet": (
            "We compare FitTrack, Strava, Garmin Connect, RunKeeper, and Nike Run Club "
            "across features, price, and user ratings. Strava leads in social features "
            "while FitTrack wins on UI simplicity. RunKeeper offers the most generous free tier."
        ),
        "link": "https://techradar.com/mock/fitness-apps-compared",
    },
    {
        "title": "Strava App Review 2026 — Rating 4.5 | Freemium",
        "snippet": (
            "Strava remains the gold standard for cyclists and runners. Free tier includes "
            "route tracking; premium ($11.99/month) unlocks training plans and segment leaderboards. "
            "4.5★ on App Store, 4.4★ on Google Play. Biggest weakness: Android battery drain."
        ),
        "link": "https://pcmag.com/mock/strava-review",
    },
    {
        "title": "Garmin Connect vs FitTrack — Which is Better?",
        "snippet": (
            "Garmin Connect is free and tightly integrated with Garmin hardware. "
            "FitTrack is hardware-agnostic and has a cleaner interface. "
            "Garmin dominates among serious athletes; FitTrack appeals to casual users."
        ),
        "link": "https://runnersworld.com/mock/garmin-vs-fittrack",
    },
    {
        "title": "RunKeeper by ASICS — Free Fitness App",
        "snippet": (
            "RunKeeper (owned by ASICS) offers GPS tracking, training plans, and "
            "Apple Health integration for free. Premium plan ($9.99/month) is rarely needed. "
            "Known for its simple onboarding and beginner-friendly approach. Rating: 4.3★."
        ),
        "link": "https://cnet.com/mock/runkeeper-review",
    },
    {
        "title": "Nike Run Club Review — Best Free Running App",
        "snippet": (
            "Nike Run Club (NRC) is completely free with guided runs, coaching plans, "
            "and Apple Watch integration. No paid tier. Weakness: limited cross-training "
            "support and no cycling mode. Rating 4.6★ iOS, 4.2★ Android."
        ),
        "link": "https://shape.com/mock/nike-run-club-review",
    },
    {
        "title": "Fitness App Market Size 2026 — $15B by 2028",
        "snippet": (
            "The global fitness app market is valued at $10.2B in 2026, growing at 18% CAGR. "
            "Key drivers: wearable device adoption, post-pandemic health awareness, "
            "AI-powered personalisation. Subscription models dominate (67% of revenue)."
        ),
        "link": "https://grandviewresearch.com/mock/fitness-app-market",
    },
    {
        "title": "MapMyRun Under Armour — Fitness Tracking App Review",
        "snippet": (
            "MapMyRun (Under Armour) offers route mapping, nutrition logging, and "
            "UA shoe integration. Free tier is solid; MVP ($5.99/month) adds "
            "heart rate analysis. Strength: massive route database. Weakness: cluttered UI."
        ),
        "link": "https://verywellfit.com/mock/mapmyrun-review",
    },
    {
        "title": "App Store Rankings — Health & Fitness Category June 2026",
        "snippet": (
            "Current top 10 in Health & Fitness: 1. Nike Run Club, 2. Strava, "
            "3. FitTrack, 4. Garmin Connect, 5. RunKeeper, 6. MapMyRun, "
            "7. Peloton, 8. Whoop, 9. MyFitnessPal, 10. Adidas Running."
        ),
        "link": "https://appannie.com/mock/fitness-rankings",
    },
    {
        "title": "FitTrack Pricing — Is the Premium Plan Worth It?",
        "snippet": (
            "FitTrack charges $12.99/month or $89.99/year for premium. "
            "After a 30% price increase in early 2026, user reviews dropped from 4.2 to 3.8. "
            "Competitors Strava and RunKeeper both offer lower price points."
        ),
        "link": "https://tomsguide.com/mock/fittrack-pricing",
    },
    {
        "title": "Best Free Alternatives to FitTrack in 2026",
        "snippet": (
            "Looking for a free FitTrack alternative? Nike Run Club is fully free. "
            "RunKeeper offers 90% of the features at no cost. Strava's free tier covers "
            "basic GPS tracking. All three support Apple Health and Google Fit sync."
        ),
        "link": "https://techradar.com/mock/fittrack-alternatives",
    },
]


class SerperSearchTool(BaseTool):
    """
    Searches the web via SerperDev Google Search API.
    Falls back to mock results if SERPER_API_KEY is not set.
    Results are returned as formatted text — the agent saves
    relevant snippets to memory via MemorySaveTool.
    """
    name: str = "web_search"
    description: str = (
        "Search the web for information about a company, app, or market. "
        "Input: a search query string (e.g. 'Strava app price rating 2026'). "
        "Returns titles, snippets, and URLs from top search results. "
        "After reviewing results, save relevant facts using memory_save "
        "in the format: '<fact> | url: <source_url>'."
    )

    def _run(self, query: str) -> str:
        try:
            return self._serper_search(query)
        except Exception as exc:
            print(f"[SerperSearch] API failed ({exc!r}). Using mock results.")
            return self._format_mock(query)

    def _serper_search(self, query: str) -> str:
        api_key = os.getenv("SERPER_API_KEY", "")
        if not api_key:
            raise RuntimeError("SERPER_API_KEY not set")
        response = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("organic", [])
        if not results:
            return f"No web results found for: '{query}'"
        lines = [f"Web search results for '{query}':"]
        for r in results:
            title   = r.get("title", "No title")
            snippet = r.get("snippet", "")[:300]
            link    = r.get("link", "")
            lines.append(f"\n{title}\n{snippet}\nURL: {link}")
        return "\n".join(lines)

    def _format_mock(self, query: str) -> str:
        lines = [f"Mock web results for '{query}' (SERPER_API_KEY not set):"]
        for r in _MOCK_RESULTS:
            lines.append(
                f"\n{r['title']}\n{r['snippet']}\nURL: {r['link']}"
            )
        return "\n".join(lines)
