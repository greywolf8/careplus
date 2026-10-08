from typing import Optional, List
from pydantic import BaseModel, Field


class ProviderMatchRequest(BaseModel):
    item_type: str = Field(..., description="Type of item (e.g., 'cardiology', 'orthopedics')")
    latitude: Optional[float] = Field(None, description="Latitude for geographic search")
    longitude: Optional[float] = Field(None, description="Longitude for geographic search")
    radius_km: int = Field(10, description="Search radius in kilometers")


class ProviderInfo(BaseModel):
    provider_id: str
    provider_name: str
    match_score: float
    distance_km: Optional[float] = None
    specialty: Optional[str] = None


class ProviderMatchResponse(BaseModel):
    providers: List[ProviderInfo]
    disclaimer: str
    total_count: int
    error: Optional[str] = None
