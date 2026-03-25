"""POST /api/explore — Explore Pipeline API."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from api.models import ExploreRequest, PipelineResponse
from services.pipeline import run_explore_pipeline, run_raw_explore_pipeline, stream_explore_pipeline

router = APIRouter()


@router.post("/explore", response_model=PipelineResponse)
async def explore(req: ExploreRequest):
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
            labels=req.labels or None,
        )
    return result


@router.post("/explore/stream")
async def explore_stream(req: ExploreRequest):
    return StreamingResponse(
        stream_explore_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            category=req.category,
            questionnaire=req.questionnaire or {},
            labels=req.labels or None,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
