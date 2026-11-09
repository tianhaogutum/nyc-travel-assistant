import asyncio
import threading

from services import web_search as search


def test_cache_deduplicates_names_and_returns_copies(monkeypatch):
    calls = []
    monkeypatch.setattr(search, "_cache", search.OrderedDict())

    def fake(name):
        calls.append(name)
        return ["review"]

    monkeypatch.setattr(search, "_search_one", fake)

    async def check():
        first = await search.search_negative_reviews(["Cafe", "Cafe"])
        first["Cafe"].append("changed")
        second = await search.search_negative_reviews(["Cafe"])
        assert second == {"Cafe": ["review"]}

    asyncio.run(check())
    assert calls == ["Cafe"]


def test_search_deadline_does_not_release_running_thread_slot(monkeypatch):
    started, release = threading.Event(), threading.Event()
    slots = threading.BoundedSemaphore(1)
    monkeypatch.setattr(search, "_slots", slots)
    monkeypatch.setattr(search, "_cache", search.OrderedDict())
    monkeypatch.setattr(search, "SEARCH_BUDGET_SECONDS", 0.02)

    def slow(name):
        started.set()
        release.wait(2)
        return []

    monkeypatch.setattr(search, "_search_one", slow)
    try:
        assert asyncio.run(search.search_negative_reviews(["Slow"])) == {"Slow": []}
        assert started.is_set()
        assert not slots.acquire(blocking=False)
    finally:
        release.set()
        assert slots.acquire(timeout=1)
        slots.release()
