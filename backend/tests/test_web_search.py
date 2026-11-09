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


def test_concurrent_requests_share_search_but_not_cancellation(monkeypatch):
    started, release = threading.Event(), threading.Event()
    slots = threading.BoundedSemaphore(1)
    calls = []
    monkeypatch.setattr(search, "_slots", slots)
    monkeypatch.setattr(search, "_cache", search.OrderedDict())
    monkeypatch.setattr(search, "_inflight", {})

    def slow(name):
        calls.append(name)
        started.set()
        release.wait(2)
        return ["shared review"]

    monkeypatch.setattr(search, "_search_one", slow)

    async def check():
        first = asyncio.create_task(search.search_negative_reviews(["Shared"]))
        await asyncio.to_thread(started.wait, 1)
        second = asyncio.create_task(search.search_negative_reviews(["Shared"]))
        await asyncio.sleep(0)
        first.cancel()
        try:
            await first
        except asyncio.CancelledError:
            pass
        assert not slots.acquire(blocking=False)
        release.set()
        assert await second == {"Shared": ["shared review"]}
        assert await search.search_negative_reviews(["Shared"]) == {
            "Shared": ["shared review"]
        }

    try:
        asyncio.run(check())
    finally:
        release.set()
        assert slots.acquire(timeout=1)
        slots.release()
    assert calls == ["Shared"]
    assert search._inflight == {}


def test_completed_search_callback_does_not_deadlock(monkeypatch):
    from concurrent.futures import Future

    class ImmediateExecutor:
        def submit(self, *args):
            future = Future()
            future.set_result(["ready"])
            return future

    slots = threading.BoundedSemaphore(1)
    monkeypatch.setattr(search, "_executor", ImmediateExecutor())
    monkeypatch.setattr(search, "_slots", slots)
    monkeypatch.setattr(search, "_cache", search.OrderedDict())
    monkeypatch.setattr(search, "_inflight", {})
    assert asyncio.run(search.search_negative_reviews(["Instant"])) == {
        "Instant": ["ready"]
    }
    assert slots.acquire(blocking=False)
    assert search._inflight == {}
