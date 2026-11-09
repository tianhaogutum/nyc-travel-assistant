"""Best-effort review search with bounded workers, deadlines and a small TTL cache."""

import asyncio
import logging
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="review-search")
_slots = threading.BoundedSemaphore(5)
_cache = OrderedDict()
_cache_lock = threading.Lock()
CACHE_TTL = 900
CACHE_SIZE = 256
SEARCH_BUDGET_SECONDS = 12


def _search_one(place_name: str, max_results: int = 3) -> list[str]:
    try:
        from duckduckgo_search import DDGS

        # The client is not shared across threads; each HTTP request has a timeout.
        with DDGS(timeout=4) as ddgs:
            snippets = []
            for query in (
                f'"{place_name}" NYC bad review',
                f'"{place_name}" NYC 踩雷 差评',
            ):
                for result in ddgs.text(query, max_results=max_results):
                    body = result.get("body")
                    if isinstance(body, str) and body:
                        snippets.append(body[:300])
            return list(dict.fromkeys(snippets))
    except Exception as exc:
        logger.debug("Review search unavailable for %r: %s", place_name, exc)
        return []


def _cached_search(name):
    snippets = _search_one(name)
    with _cache_lock:
        _cache[name] = (time.monotonic(), tuple(snippets))
        _cache.move_to_end(name)
        while len(_cache) > CACHE_SIZE:
            _cache.popitem(last=False)
    return snippets


async def search_negative_reviews(place_names: list[str]) -> dict[str, list[str]]:
    # Slots are released when the real thread completes, not when an awaiting
    # request is cancelled. Overload skips optional searches instead of queuing.
    deadline = time.monotonic() + SEARCH_BUDGET_SECONDS
    results = {}

    async def search(name):
        with _cache_lock:
            cached = _cache.get(name)
            if cached and time.monotonic() - cached[0] < CACHE_TTL:
                results[name] = list(cached[1])
                return
        while True:
            if time.monotonic() >= deadline:
                results[name] = []
                return
            if _slots.acquire(blocking=False):
                break
            await asyncio.sleep(0.05)
        try:
            future = _executor.submit(_cached_search, name)
        except BaseException:
            _slots.release()
            raise
        future.add_done_callback(lambda _, slots=_slots: slots.release())
        try:
            remaining = max(0, deadline - time.monotonic())
            results[name] = await asyncio.wait_for(
                asyncio.wrap_future(future), remaining
            )
        except Exception:
            results[name] = []

    await asyncio.gather(*(search(name) for name in dict.fromkeys(place_names)))
    return results
