"""POST /api/eat — Eat Pipeline API."""

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from services.pipeline import (
    run_eat_pipeline,
    run_raw_eat_pipeline,
    stream_eat_pipeline,
)

from api.models import EatRequest, PipelineResponse

router = APIRouter()


@router.post("/eat", response_model=PipelineResponse)
async def eat(req: EatRequest, request: Request):
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
            llm_client=getattr(request.app.state, "llm_client", None),
            labels=req.labels or None,
        )
    return result


@router.post("/eat/stream")
async def eat_stream(req: EatRequest, request: Request):
    return StreamingResponse(
        stream_eat_pipeline(
            latitude=req.latitude,
            longitude=req.longitude,
            radius_km=req.radius_km,
            data_source=req.data_source,
            questionnaire=req.questionnaire or {},
            llm_client=getattr(request.app.state, "llm_client", None),
            labels=req.labels or None,
            raw=req.mode == "raw",
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
