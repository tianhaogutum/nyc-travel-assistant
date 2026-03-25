"""GET /api/profile — User profile API."""

from fastapi import APIRouter
from services.profile import get_profile_summary

router = APIRouter()


@router.get("/profile")
async def profile():
    return get_profile_summary()
