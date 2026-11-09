"""Bounded, reusable HTTP transport for Azure, Ollama and Anthropic."""

import asyncio
import json
import logging
from typing import Optional

import httpx
from config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    AZURE_API_KEY,
    AZURE_API_VERSION,
    AZURE_DEPLOYMENT,
    AZURE_ENDPOINT,
    LLM_PROVIDER,
    LLM_TIMEOUT,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
)

logger = logging.getLogger(__name__)
MAX_RESPONSE_BYTES = 1024 * 1024
MAX_CONNECTIONS = 5


def is_llm_configured() -> bool:
    """Report configuration readiness, without a network request or secret output."""
    required = {
        "anthropic": (ANTHROPIC_API_KEY, ANTHROPIC_MODEL),
        "azure": (AZURE_API_KEY, AZURE_ENDPOINT, AZURE_DEPLOYMENT),
        "ollama": (OLLAMA_BASE_URL, OLLAMA_MODEL),
    }.get(LLM_PROVIDER)
    return bool(required and all(value.strip() for value in required))


def create_llm_client() -> httpx.AsyncClient:
    """The application owns and closes this pool through its lifespan."""
    return httpx.AsyncClient(
        timeout=httpx.Timeout(LLM_TIMEOUT, connect=10, write=10, pool=2),
        limits=httpx.Limits(
            max_connections=MAX_CONNECTIONS,
            max_keepalive_connections=MAX_CONNECTIONS,
            keepalive_expiry=60,
        ),
        follow_redirects=False,
    )


def _request_spec(prompt: str, deployment: Optional[str]):
    if LLM_PROVIDER == "ollama":
        return (
            f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat",
            {},
            {
                "model": deployment or OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.7, "num_predict": 16384},
            },
        )
    if LLM_PROVIDER == "anthropic":
        return (
            "https://api.anthropic.com/v1/messages",
            {"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
            {
                "model": ANTHROPIC_MODEL,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
    return (
        f"{AZURE_ENDPOINT.rstrip('/')}/api/providers/azure/openai/deployments/"
        f"{deployment or AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}",
        {"Authorization": f"Bearer {AZURE_API_KEY}"},
        {
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_completion_tokens": 4096,
        },
    )


def _extract_text(data: object) -> str:
    if not isinstance(data, dict):
        raise ValueError("Invalid response object")
    if LLM_PROVIDER == "anthropic":
        if data.get("stop_reason") in ("max_tokens", "refusal", "pause_turn"):
            return ""
        blocks = data.get("content")
        if not isinstance(blocks, list):
            raise ValueError("Invalid content blocks")
        # Thinking/tool blocks are not recommendation text; text may span blocks.
        text = "\n".join(
            block["text"]
            for block in blocks
            if isinstance(block, dict)
            and block.get("type") == "text"
            and isinstance(block.get("text"), str)
        )
    elif LLM_PROVIDER == "ollama":
        if data.get("done_reason") == "length" or data.get("done") is False:
            return ""
        message = data.get("message")
        text = message.get("content") if isinstance(message, dict) else None
    else:
        choices = data.get("choices")
        if (
            not isinstance(choices, list)
            or not choices
            or not isinstance(choices[0], dict)
        ):
            raise ValueError("Invalid choices")
        choice = choices[0]
        if choice.get("finish_reason") in ("length", "content_filter"):
            return ""
        message = choice.get("message")
        text = message.get("content") if isinstance(message, dict) else None
    if not isinstance(text, str):
        raise ValueError("Invalid text content")
    return text.strip()


async def _send(
    client: httpx.AsyncClient, prompt: str, deployment: Optional[str]
) -> str:
    url, headers, payload = _request_spec(prompt, deployment)
    async with client.stream("POST", url, json=payload, headers=headers) as response:
        response.raise_for_status()
        body = bytearray()
        async for chunk in response.aiter_bytes():
            if len(body) + len(chunk) > MAX_RESPONSE_BYTES:
                raise ValueError("Response exceeds size limit")
            body.extend(chunk)
        return _extract_text(json.loads(body))


async def call_llm(
    prompt: str,
    deployment: Optional[str] = None,
    *,
    client: Optional[httpx.AsyncClient] = None,
) -> str:
    """Return text or a fallback sentinel; cancellation always propagates.

    The deadline includes pool admission and the entire response, not just idle
    time between chunks. Requests are not replayed automatically: an ambiguous
    transport failure may already have incurred a billable generation.
    """
    if not is_llm_configured():
        return ""
    try:
        async with asyncio.timeout(LLM_TIMEOUT):
            if client is not None:
                return await _send(client, prompt, deployment)
            # CLI/direct service users do not require an application lifespan.
            async with create_llm_client() as owned_client:
                return await _send(owned_client, prompt, deployment)
    except httpx.HTTPStatusError as exc:
        logger.warning("%s LLM HTTP status %d", LLM_PROVIDER, exc.response.status_code)
    except (httpx.HTTPError, TimeoutError, ValueError, TypeError, RecursionError):
        # Never log provider response bodies or exception messages: either may
        # contain prompts, preferences, credentials or upstream diagnostic data.
        logger.warning(
            "%s LLM request failed or returned invalid content", LLM_PROVIDER
        )
    return ""
