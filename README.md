# NYC Travel Assistant

FastAPI + SQLite + a static JavaScript frontend for nearby food and attractions in Manhattan and Brooklyn. The server serves both the API and frontend. Existing design and survey preferences are retained.

## Run locally

Requires Python 3.11 or newer. From the repository root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements-dev.txt
cd backend
../.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000`. Direct Mode works without external credentials. For Smart Mode, configure `backend/.env` using the settings in `backend/config.py`: `LLM_PROVIDER` supports `anthropic`, `azure`, and `ollama`. Never commit credentials. Smart Mode sends profile/preferences and candidate context to the chosen provider and place names to DuckDuckGo; Direct Mode uses only local data. Missing credentials or an unavailable model produce explicitly labeled local recommendations.

## Recommendation behavior

- SQL filters the geographic bounding box and selected labels before loading candidate rows; Haversine then checks the exact radius, including polar and antimeridian cases. Databases are opened read-only; no dataset migration is required. Existing SQLite tables do not have spatial indexes, so this reduces Python work and materialized rows, not the database scan complexity. Rows without usable names/coordinates are skipped; invalid ratings and review counts are treated as missing evidence.
- Direct Mode keeps review-count ordering and returns up to 50 unique places.
- Smart Mode takes up to `TOP_N` local candidates (currently 10). Its cold-start score is `(review_count × rating + 20 × 4.0) / (review_count + 20) + 0.25 / (1 + distance_m / 1000)`. This shrinks sparse ratings toward a 4.0 prior and modestly favors proximity. These are initial heuristic weights, not a trained or user-validated model; questionnaire personalization happens in the LLM step.
- Identity combines normalized name and coordinates rounded to five decimals. Same-name branches remain distinct; exact duplicate identities are collapsed. Editorial candidates also respect the requested radius and labels. Coordinate/name differences across sources may still represent the same real-world venue; fuzzy entity resolution is not implemented.
- AI output can reorder known candidates and supply text, but cannot invent places or replace factual coordinates, ratings or counts. Unknown IDs, duplicates and malformed fields are discarded. Unambiguous legacy name-only responses are accepted. Omitted candidates remain visible.
- Missing AI configuration immediately returns local recommendations without running optional web searches. A review-search or editorial-data failure does not disable the remaining AI ranking inputs. Local database errors produce a readable error result and a normally terminated SSE stream.
- Model-generated prose and third-party search snippets are not verified facts; identity validation does not fact-check recommendations. The JSON parser bounds response length and parse attempts and skips citation arrays before ranking output.
- Review searches use at most five worker threads, a 12-second batch budget, per-request upstream timeouts and a bounded 15-minute in-memory cache. Concurrent requests for the same place share one in-flight search; cancelling one waiter does not cancel another. Cancelling a request cannot interrupt an already running synchronous search, so its worker slot stays reserved until it actually finishes. Limits/cache are per server process.
- AI requests reuse an application-owned pool of at most five HTTP connections, closed on shutdown. Connection/write timeouts are 10 seconds, pool admission is limited to two seconds, and the complete generation has the configured `LLM_TIMEOUT` deadline (300 seconds). Responses above 1 MiB and provider-reported truncated generations fall back. Failed generations are not automatically replayed. Provider response bodies and prompt text are not written to failure logs. `/api/llm-provider` includes a `configured` flag; it reports configuration completeness, not a live provider health check.
- JSON and SSE endpoints use the same pipeline. SSE emits `cold`, then `ai` or `fallback`, or one `raw`/`empty`/`error` result; every normal stream ends with `[DONE]`. Heartbeat comments keep idle streams active. `ranking_method` exposes the result state to both clients.
- The UI cancels obsolete requests, ignores late responses, retains local results on an interrupted AI stream, escapes external text and supports keyboard-operable category/survey controls. Unsubmitted survey drafts and area/category filter selections survive navigation and mode switches in the current tab session. Submitted surveys remain in local storage and are validated against current question options when loaded. GPS, test locations and custom coordinates are available; blank or invalid custom coordinates produce a validation error.

The original `SPEC.md` describes the earlier design; the behavior above documents the current implementation.

## Checks

Node.js 22+ is needed only for frontend tests; the production frontend has no build step or npm runtime dependency.

```bash
.venv/bin/pytest -q
.venv/bin/ruff check backend
npm --prefix frontend ci --ignore-scripts
npm --prefix frontend test
PYTHONPATH=backend .venv/bin/python backend/scripts/benchmark_geo.py
```

Tests cover geographic equivalence, candidate grounding, ranking fallback, API/SSE parity, stream heartbeats and cancellation, search deadlines/cache/shared in-flight requests, all three provider response formats, HTTP pool lifecycle, overall timeouts, truncated or oversized AI responses, HTML injection, repeated category clicks, draft retention and stale responses. They mock external AI/search calls and do not require secrets. GitHub Actions runs backend and frontend checks. Live provider quality, production load and cross-browser visual appearance require separate validation.
