"""POST /api/eat — Eat Pipeline API."""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from api.models import EatRequest, PipelineResponse
from services.pipeline import run_eat_pipeline, run_raw_eat_pipeline, stream_eat_pipeline

router = APIRouter()


@router.post("/eat", response_model=PipelineResponse)
async def eat(req: EatRequest):
    if req.mode == "raw":
        result = await run_raw_eat_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            labels=req.labels or None,
        )
    else:
        result = await run_eat_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            questionnaire=req.questionnaire,
            labels=req.labels or None,
        )
    return result


@router.post("/eat/stream")
async def eat_stream(req: EatRequest):
    return StreamingResponse(
        stream_eat_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            questionnaire=req.questionnaire or {},
            labels=req.labels or None,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
