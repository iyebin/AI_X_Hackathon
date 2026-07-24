from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SubjectCreate(BaseModel):
    name: str
    phone: str | None = None
    special_notes: str | None = None


class SubjectResponse(SubjectCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class GuardianCreate(BaseModel):
    name: str
    phone: str


class GuardianResponse(GuardianCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class LinkCreate(BaseModel):
    subject_id: int
    guardian_id: int
    relationship_type: str


class LinkResponse(LinkCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class GPSCreate(BaseModel):
    subject_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class GPSResponse(GPSCreate):
    id: int
    measured_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FacilityResponse(BaseModel):
    id: int
    external_id: str
    name: str
    address: str
    latitude: float
    longitude: float
    model_config = ConfigDict(from_attributes=True)


class NearbyFacilityResponse(FacilityResponse):
    distance_km: float
