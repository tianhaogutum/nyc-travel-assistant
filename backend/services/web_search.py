"""Web search service — search for negative reviews via DuckDuckGo."""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import so duckduckgo_search is optional at import time
_ddgs = None


def _get_ddgs():
    global _ddgs
    if _ddgs is None:
        try:
            from duckduckgo_search import DDGS
            _ddgs = DDGS()
        except ImportError:
            logger.warning("duckduckgo-search not installed — web search disabled")
    return _ddgs


def _search_one(place_name: str, max_results: int = 3) -> list[str]:
    """Search DuckDuckGo for negative reviews of a single place. Synchronous."""
    ddgs = _get_ddgs()
    if ddgs is None:
        return []

    queries = [
        f'"{place_name}" NYC bad review',
        f'"{place_name}" 踩雷 差评',
    ]
    snippets: list[str] = []
    for q in queries:
        try:
            results = list(ddgs.text(q, max_results=max_results))
            for r in results:
                body = r.get("body", "")
                if body:
                    snippets.append(body[:300])
        except Exception as exc:
            logger.debug("DuckDuckGo search failed for %r: %s", q, exc)
    return snippets


async def search_negative_reviews(place_names: list[str]) -> dict[str, list[str]]:
    """Search negative reviews for a batch of place names.

    Returns {place_name: [snippet, ...]} — empty list if nothing found or search fails.
    Runs searches in a thread pool to avoid blocking the event loop.
    """
    loop = asyncio.get_event_loop()
    results: dict[str, list[str]] = {}

    async def _do(name: str):
        try:
            snippets = await loop.run_in_executor(None, _search_one, name)
            results[name] = snippets
        except Exception:
            results[name] = []

    # Run up to 5 concurrent searches to be polite to DuckDuckGo
    sem = asyncio.Semaphore(5)

    async def _bounded(name: str):
        async with sem:
            await _do(name)

    await asyncio.gather(*[_bounded(n) for n in place_names])
    return results
