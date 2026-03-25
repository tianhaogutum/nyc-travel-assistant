"""Pydantic models for API requests and responses."""

from pydantic import BaseModel, Field
from typing import Optional


class EatRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=1.0, ge=0.1, le=100)
    data_source: str = Field(default="manhattan", pattern=r"^(brooklyn|manhattan)$")
    mode: str = Field(default="ai", pattern=r"^(ai|raw)$")
    labels: list[str] = Field(default_factory=list)
    questionnaire: dict = Field(default_factory=dict)


class ExploreRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(default=1.0, ge=0.1, le=100)
    data_source: str = Field(default="manhattan", pattern=r"^(brooklyn|manhattan)$")
    category: str = Field(default="culture", pattern=r"^(culture|entertainment|shopping|other)$")
    mode: str = Field(default="ai", pattern=r"^(ai|raw)$")
    labels: list[str] = Field(default_factory=list)
    questionnaire: dict = Field(default_factory=dict)


class RankingItem(BaseModel):
    rank: int
    name: str
    rating: Optional[float] = None
    review_count: Optional[int] = None
    price_level: Optional[str] = None
    primary_type: Optional[str] = None
    distance_m: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: str = ""
    recommendation: str = ""
    review: str = ""
    highlights: list[str] = []
    warnings: list[str] = []
    reasoning_sources: Optional[dict] = None
    neg_review_snippets: list[str] = []


class PipelineResponse(BaseModel):
    rankings: list[RankingItem] = []
    total: int = 0
    radius_km: float = 0
    data_source: str = ""
    category: Optional[str] = None
    pipeline_time_ms: int = 0
    error: Optional[str] = None
