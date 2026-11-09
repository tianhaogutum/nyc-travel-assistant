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
_inflight = {}
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


def _finish_search(name, future, slots):
    try:
        try:
            snippets = future.result()
        except Exception:
            snippets = []
        with _cache_lock:
            _cache[name] = (time.monotonic(), tuple(snippets))
            _cache.move_to_end(name)
            while len(_cache) > CACHE_SIZE:
                _cache.popitem(last=False)
            if _inflight.get(name) is future:
                del _inflight[name]
    finally:
        # Only the owning search releases the real thread's slot, including
        # when every request waiting for it has been cancelled.
        slots.release()


def _get_or_start_search(name):
    with _cache_lock:
        cached = _cache.get(name)
        if cached and time.monotonic() - cached[0] < CACHE_TTL:
            return list(cached[1]), None
        future = _inflight.get(name)
        if future is not None:
            return None, future
        slots = _slots
        if not slots.acquire(blocking=False):
            return None, None
        try:
            future = _executor.submit(_search_one, name)
        except BaseException:
            slots.release()
            raise
        _inflight[name] = future
    # add_done_callback can run synchronously for an already finished search,
    # so register outside the cache lock.
    future.add_done_callback(lambda done: _finish_search(name, done, slots))
    return None, future


async def search_negative_reviews(place_names: list[str]) -> dict[str, list[str]]:
    """Share in-flight work across requests without sharing their cancellation."""
    deadline = time.monotonic() + SEARCH_BUDGET_SECONDS
    results = {}

    async def search(name):
        while True:
            if time.monotonic() >= deadline:
                results[name] = []
                return
            cached, future = _get_or_start_search(name)
            if cached is not None:
                results[name] = cached
                return
            if future is not None:
                break
            if time.monotonic() >= deadline:
                results[name] = []
                return
            await asyncio.sleep(min(0.05, max(0, deadline - time.monotonic())))
        try:
            remaining = max(0, deadline - time.monotonic())
            wrapped = asyncio.wrap_future(future)
            # Consume any late exception even if all request waiters leave.
            wrapped.add_done_callback(
                lambda done: None if done.cancelled() else done.exception()
            )
            snippets = await asyncio.wait_for(asyncio.shield(wrapped), remaining)
            results[name] = list(snippets)
        except Exception:
            results[name] = []

    await asyncio.gather(*(search(name) for name in dict.fromkeys(place_names)))
    return results
