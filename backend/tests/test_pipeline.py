import asyncio
import json
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from main import app
from services import pipeline as p


def candidates():
    return [
        dict(
            place_id="a",
            name="Same Cafe",
            latitude=40.75,
            longitude=-73.98,
            rating=4.6,
            review_count=100,
        ),
        dict(
            place_id="b",
            name="Same Cafe",
            latitude=40.76,
            longitude=-73.98,
            rating=4.3,
            review_count=200,
        ),
    ]


def test_grounding_duplicates_and_invalid_types():
    places = candidates()
    output = p._merge_rankings(
        [
            None,
            {"name": "Invented"},
            {"name": "Same Cafe"},
            {"place_id": ["a"]},
            {
                "place_id": "b",
                "name": "Fake name",
                "rank": -7,
                "rating": 5,
                "highlights": "bad type",
                "warnings": [{}, "note"],
                "description": None,
            },
            {"place_id": "b"},
            {"place_id": "a", "rank": 999},
        ],
        places,
    )
    assert [r["place_id"] for r in output] == ["b", "a"]
    assert [r["rank"] for r in output] == [1, 2]
    assert output[0]["rating"] == 4.3
    assert output[0]["name"] == "Same Cafe"
    assert output[0]["highlights"] == []
    assert output[0]["warnings"] == ["note"]


def test_parser_fences_and_trailing_prose():
    assert p._parse_llm_response(
        '```json\n[{"place_id":"a"},null,42]\n```\n[reference]'
    ) == [{"place_id": "a"}]
    assert p._parse_llm_response("not JSON") == []


def setup_pipeline(monkeypatch, places=None):
    monkeypatch.setattr(p, "_resolve_db", lambda *args: "fake.db")
    monkeypatch.setattr(
        p,
        "cold_filter",
        lambda *args, **kwargs: candidates() if places is None else places,
    )
    monkeypatch.setattr(p, "query_online_recommendations", lambda *args, **kwargs: [])
    monkeypatch.setattr(p, "search_negative_reviews", AsyncMock(return_value={}))
    monkeypatch.setattr(p, "call_llm", AsyncMock(return_value='[{"place_id":"b"}]'))


def test_json_stream_parity_and_raw_mode(monkeypatch):
    setup_pipeline(monkeypatch)
    with TestClient(app) as client:
        for kind in ("eat", "explore"):
            payload = {"latitude": 40.75, "longitude": -73.98}
            response = client.post("/api/" + kind, json=payload)
            assert response.status_code == 200
            final = response.json()
            text = client.post("/api/" + kind + "/stream", json=payload).text
            frames = [
                json.loads(line[6:])
                for line in text.splitlines()
                if line.startswith("data: {")
            ]
            assert [f["type"] for f in frames] == ["cold", "ai"]
            assert (
                final["rankings"][0]["place_id"]
                == frames[-1]["rankings"][0]["place_id"]
                == "b"
            )
            assert final["ranking_method"] == "ai"
            assert text.endswith("data: [DONE]\n\n")
        p.call_llm.reset_mock()
        raw = client.post("/api/eat/stream", json={**payload, "mode": "raw"}).text
        assert '"type": "raw"' in raw
        p.call_llm.assert_not_awaited()


def test_fallback_empty_missing_and_validation(monkeypatch):
    setup_pipeline(monkeypatch)
    with TestClient(app) as client:
        payload = {"latitude": 40.75, "longitude": -73.98}
        p.call_llm.return_value = '[{"place_id":"invented"}]'
        assert (
            client.post("/api/eat", json=payload).json()["ranking_method"] == "fallback"
        )
        monkeypatch.setattr(p, "cold_filter", lambda *a, **k: [])
        assert '"type": "empty"' in client.post("/api/eat/stream", json=payload).text
        monkeypatch.setattr(p, "_resolve_db", lambda *a: None)
        text = client.post("/api/eat/stream", json=payload).text
        assert '"type": "error"' in text and "[DONE]" in text
        assert (
            client.post("/api/eat", json={**payload, "labels": ["a"] * 101}).status_code
            == 422
        )
        assert (
            client.post(
                "/api/eat", json={**payload, "questionnaire": {"x": "a" * 501}}
            ).status_code
            == 422
        )
        assert (
            client.post("/api/eat", json={**payload, "latitude": 91}).status_code == 422
        )


def test_heartbeat_and_disconnect_cancels_enrichment(monkeypatch):
    setup_pipeline(monkeypatch)
    monkeypatch.setattr(p, "HEARTBEAT_SECONDS", 0.01)

    async def check():
        cancelled = asyncio.Event()

        async def slow(*args):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.set()

        monkeypatch.setattr(p, "call_llm", slow)
        stream = p.stream_eat_pipeline(40.75, -73.98, 1, "manhattan", {})
        assert '"type": "cold"' in await anext(stream)
        assert await anext(stream) == ": keep-alive\n\n"
        await stream.aclose()
        assert cancelled.is_set()

    asyncio.run(check())
