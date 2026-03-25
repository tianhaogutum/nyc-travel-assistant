"""LLM service — supports Azure OpenAI (via BricksLLM proxy), Ollama, and Anthropic."""

import httpx
import logging
from typing import Optional

from config import (
    LLM_PROVIDER, LLM_TIMEOUT,
    AZURE_API_KEY, AZURE_ENDPOINT, AZURE_API_VERSION, AZURE_DEPLOYMENT,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
    ANTHROPIC_API_KEY, ANTHROPIC_MODEL,
)

logger = logging.getLogger(__name__)


async def call_llm(prompt: str, deployment: Optional[str] = None) -> str:
    """Send a prompt to the configured LLM provider and return the text reply.

    Provider is selected by the LLM_PROVIDER config ("azure" or "ollama").
    Returns empty string on failure so the pipeline can fall back to cold ranking.
    """
    if LLM_PROVIDER == "ollama":
        return await _call_ollama(prompt, model=deployment)
    if LLM_PROVIDER == "anthropic":
        return await _call_anthropic(prompt)
    return await _call_azure(prompt, deployment=deployment)


async def _call_azure(prompt: str, deployment: Optional[str] = None) -> str:
    deployment = deployment or AZURE_DEPLOYMENT
    url = (
        f"{AZURE_ENDPOINT}/api/providers/azure/openai/deployments/{deployment}"
        f"/chat/completions?api-version={AZURE_API_VERSION}"
    )
    headers = {
        "Authorization": f"Bearer {AZURE_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_completion_tokens": 4096,
    }

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except httpx.TimeoutException:
        logger.warning("Azure OpenAI request timed out after %ds", LLM_TIMEOUT)
        return ""
    except httpx.ConnectError:
        logger.error("Cannot connect to Azure endpoint: %s", AZURE_ENDPOINT)
        return ""
    except (KeyError, IndexError):
        logger.error("Unexpected Azure response format")
        return ""
    except httpx.HTTPStatusError as exc:
        logger.error("Azure API error %d: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Azure OpenAI call failed: %s", exc)
        return ""


async def _call_ollama(prompt: str, model: Optional[str] = None) -> str:
    model = model or OLLAMA_MODEL
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 16384},
    }

    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]
    except httpx.TimeoutException:
        logger.warning("Ollama request timed out after %ds", LLM_TIMEOUT)
        return ""
    except httpx.ConnectError:
        logger.error("Cannot connect to Ollama at: %s", OLLAMA_BASE_URL)
        return ""
    except (KeyError, IndexError):
        logger.error("Unexpected Ollama response format")
        return ""
    except httpx.HTTPStatusError as exc:
        logger.error("Ollama API error %d: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Ollama call failed: %s", exc)
        return ""


async def _call_anthropic(prompt: str) -> str:
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }
    try:
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()["content"][0]["text"]
    except httpx.TimeoutException:
        logger.warning("Anthropic request timed out after %ds", LLM_TIMEOUT)
        return ""
    except (KeyError, IndexError):
        logger.error("Unexpected Anthropic response format")
        return ""
    except httpx.HTTPStatusError as exc:
        logger.error("Anthropic API error %d: %s", exc.response.status_code, exc.response.text[:200])
        return ""
    except Exception as exc:
        logger.error("Anthropic call failed: %s", exc)
        return ""
