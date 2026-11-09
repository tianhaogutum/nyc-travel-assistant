"""POST /api/explore — Explore Pipeline API."""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from services.pipeline import (
    run_explore_pipeline,
    run_raw_explore_pipeline,
    stream_explore_pipeline,
)

from api.models import ExploreRequest, PipelineResponse

router = APIRouter()


@router.post("/explore", response_model=PipelineResponse)
async def explore(req: ExploreRequest, request: Request):
    if req.mode == "raw":
        result = await run_raw_explore_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            category=req.category,
            labels=req.labels or None,
        )
    else:
        result = await run_explore_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            category=req.category,
            questionnaire=req.questionnaire,
            llm_client=getattr(request.app.state, "llm_client", None),
            labels=req.labels or None,
        )
    return result


@router.post("/explore/stream")
async def explore_stream(req: ExploreRequest, request: Request):
    return StreamingResponse(
        stream_explore_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            category=req.category,
            questionnaire=req.questionnaire or {},
            llm_client=getattr(request.app.state, "llm_client", None),
            labels=req.labels or None,
            raw=req.mode == "raw",
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
