import asyncio
import json
from unittest.mock import AsyncMock

import api.eat as eat_api
import httpx
import main
import pytest
from fastapi.testclient import TestClient
from services import llm


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    for key, value in {
        "LLM_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "test-anthropic-key",
        "ANTHROPIC_MODEL": "test-model",
        "AZURE_API_KEY": "test-azure-key",
        "AZURE_ENDPOINT": "https://azure.example.test/",
        "AZURE_DEPLOYMENT": "test-deployment",
        "OLLAMA_BASE_URL": "http://ollama.example.test/",
        "OLLAMA_MODEL": "test-local-model",
    }.items():
        monkeypatch.setattr(llm, key, value)


def test_shared_client_supports_all_providers_without_header_leakage(monkeypatch):
    seen = []

    def respond(request):
        seen.append(request)
        if request.url.host == "api.anthropic.com":
            return httpx.Response(
                200,
                json={
                    "content": [
                        {"type": "thinking", "thinking": "private reasoning"},
                        {"type": "text", "text": "first"},
                        {"type": "text", "text": "second"},
                    ]
                },
            )
        if request.url.host == "azure.example.test":
            return httpx.Response(
                200, json={"choices": [{"message": {"content": "azure reply"}}]}
            )
        return httpx.Response(
            200, json={"done": True, "message": {"content": "local reply"}}
        )

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            assert (
                await llm.call_llm("synthetic prompt", client=client) == "first\nsecond"
            )
            monkeypatch.setattr(llm, "LLM_PROVIDER", "azure")
            assert (
                await llm.call_llm("synthetic prompt", "other-model", client=client)
                == "azure reply"
            )
            monkeypatch.setattr(llm, "LLM_PROVIDER", "ollama")
            assert (
                await llm.call_llm("synthetic prompt", "other-local", client=client)
                == "local reply"
            )
            assert not client.is_closed
        assert client.is_closed

    asyncio.run(check())
    assert seen[0].headers["x-api-key"] == "test-anthropic-key"
    assert "authorization" not in seen[0].headers
    assert seen[1].headers["authorization"] == "Bearer test-azure-key"
    assert "x-api-key" not in seen[1].headers
    assert "/deployments/other-model/" in seen[1].url.path
    assert "authorization" not in seen[2].headers and "x-api-key" not in seen[2].headers
    assert json.loads(seen[2].content)["model"] == "other-local"


@pytest.mark.parametrize(
    "status,body",
    [
        (429, "secret upstream response"),
        (503, "secret upstream response"),
        (200, "invalid JSON secret upstream response"),
        (200, "[]"),
        (200, '{"content":null}'),
        (200, "[" * 2000 + "]" * 2000),
    ],
)
def test_failures_fall_back_without_retries_or_sensitive_logs(caplog, status, body):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(status, text=body)

    async def check():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            assert await llm.call_llm("secret prompt", client=client) == ""

    asyncio.run(check())
    assert len(requests) == 1
    assert "secret" not in caplog.text and "test-anthropic-key" not in caplog.text


@pytest.mark.parametrize(
    "provider,response",
    [
        (
            "anthropic",
            {
                "stop_reason": "max_tokens",
                "content": [{"type": "text", "text": "incomplete"}],
            },
        ),
        (
            "anthropic",
            {
                "stop_reason": "refusal",
                "content": [{"type": "text", "text": "refusal"}],
            },
        ),
        (
            "azure",
            {
                "choices": [
                    {"finish_reason": "length", "message": {"content": "incomplete"}}
                ]
            },
        ),
        ("ollama", {"done": False, "message": {"content": "incomplete"}}),
    ],
)
def test_truncated_generation_is_not_used(monkeypatch, provider, response):
    monkeypatch.setattr(llm, "LLM_PROVIDER", provider)

    async def check():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
        ) as client:
            assert await llm.call_llm("prompt", client=client) == ""

    asyncio.run(check())


@pytest.mark.parametrize(
    "provider,key,value",
    [
        ("anthropic", "ANTHROPIC_API_KEY", ""),
        ("anthropic", "ANTHROPIC_MODEL", "   "),
        ("azure", "AZURE_ENDPOINT", ""),
        ("ollama", "OLLAMA_MODEL", ""),
        ("unknown", "ANTHROPIC_API_KEY", "anything"),
    ],
)
def test_unconfigured_provider_never_allocates_client(
    monkeypatch, provider, key, value
):
    monkeypatch.setattr(llm, "LLM_PROVIDER", provider)
    monkeypatch.setattr(llm, key, value)

    def unexpected():
        pytest.fail("No client should be created without configuration")

    monkeypatch.setattr(llm, "create_llm_client", unexpected)
    assert not llm.is_llm_configured()
    assert asyncio.run(llm.call_llm("prompt")) == ""


class SlowStream(httpx.AsyncByteStream):
    def __init__(self):
        self.started = asyncio.Event()
        self.closed = False

    async def __aiter__(self):
        self.started.set()
        while True:
            await asyncio.sleep(0.01)
            yield b" "

    async def aclose(self):
        self.closed = True


def test_total_deadline_applies_even_while_upstream_keeps_sending(monkeypatch):
    monkeypatch.setattr(llm, "LLM_TIMEOUT", 0.04)

    async def check():
        stream = SlowStream()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, stream=stream))
        ) as client:
            assert await llm.call_llm("prompt", client=client) == ""
            assert stream.closed

    asyncio.run(check())


def test_cancellation_releases_response_and_propagates():
    async def check():
        stream = SlowStream()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, stream=stream))
        ) as client:
            task = asyncio.create_task(llm.call_llm("prompt", client=client))
            await stream.started.wait()
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert stream.closed and not client.is_closed

    asyncio.run(check())


def test_oversize_body_is_rejected_and_closed(monkeypatch):
    monkeypatch.setattr(llm, "MAX_RESPONSE_BYTES", 100)

    class LargeStream(httpx.AsyncByteStream):
        closed = False

        async def __aiter__(self):
            yield b" " * 80
            yield b" " * 80
            pytest.fail("Should stop reading after the size limit")

        async def aclose(self):
            self.closed = True

    async def check():
        stream = LargeStream()
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, stream=stream))
        ) as client:
            assert await llm.call_llm("prompt", client=client) == ""
            assert stream.closed

    asyncio.run(check())


def test_app_reuses_client_and_closes_it_at_shutdown(monkeypatch):
    runner = AsyncMock(return_value={"rankings": [], "total": 0})
    monkeypatch.setattr(eat_api, "run_eat_pipeline", runner)
    with TestClient(main.app) as client:
        pool = main.app.state.llm_client
        for _ in range(2):
            response = client.post(
                "/api/eat", json={"latitude": 40.7, "longitude": -74}
            )
            assert response.status_code == 200
            assert runner.call_args.kwargs["llm_client"] is pool
            assert not pool.is_closed
    assert pool.is_closed and main.app.state.llm_client is None


def test_direct_service_call_closes_owned_client(monkeypatch):
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                200, json={"content": [{"type": "text", "text": "reply"}]}
            )
        )
    )
    monkeypatch.setattr(llm, "create_llm_client", lambda: client)
    assert asyncio.run(llm.call_llm("prompt")) == "reply"
    assert client.is_closed


def test_real_http_pool_bounds_concurrency_and_reuses_connections(monkeypatch):
    monkeypatch.setattr(llm, "LLM_PROVIDER", "ollama")
    monkeypatch.setenv("NO_PROXY", "127.0.0.1")

    async def check():
        accepted = 0
        active = 0
        peak = 0
        handlers = set()
        body = json.dumps({"done": True, "message": {"content": "reply"}}).encode()

        async def serve(reader, writer):
            nonlocal accepted, active, peak
            task = asyncio.current_task()
            handlers.add(task)
            accepted += 1
            try:
                while True:
                    headers = await reader.readuntil(b"\r\n\r\n")
                    length = next(
                        int(line.split(b":", 1)[1])
                        for line in headers.split(b"\r\n")
                        if line.lower().startswith(b"content-length:")
                    )
                    await reader.readexactly(length)
                    active += 1
                    peak = max(peak, active)
                    try:
                        await asyncio.sleep(0.02)
                        writer.write(
                            b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                            + str(len(body)).encode()
                            + b"\r\n\r\n"
                            + body
                        )
                        await writer.drain()
                    finally:
                        active -= 1
            except asyncio.IncompleteReadError:
                pass
            finally:
                writer.close()
                await writer.wait_closed()
                handlers.discard(task)

        server = await asyncio.start_server(serve, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        monkeypatch.setattr(llm, "OLLAMA_BASE_URL", f"http://127.0.0.1:{port}")
        try:
            async with llm.create_llm_client() as client:

                async def batch():
                    return await asyncio.gather(
                        *(llm.call_llm("prompt", client=client) for _ in range(10))
                    )

                assert await asyncio.wait_for(batch(), 5) == ["reply"] * 10
                assert await asyncio.wait_for(batch(), 5) == ["reply"] * 10
            assert peak <= 5
            assert accepted <= 5  # Both batches reused the original connection pool.
        finally:
            server.close()
            await server.wait_closed()
            if handlers:
                await asyncio.wait_for(asyncio.gather(*handlers), 2)

    asyncio.run(check())
