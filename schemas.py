from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models import GenderType, InstitutionType, SubjectType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GuardianCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    gender: GenderType = GenderType.UNKNOWN
    phone: str = Field(min_length=5, max_length=30)
    birth_date: Optional[date] = None
    address: Optional[str] = Field(default=None, max_length=255)


class GuardianUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    gender: Optional[GenderType] = None
    phone: Optional[str] = Field(default=None, min_length=5, max_length=30)
    birth_date: Optional[date] = None
    address: Optional[str] = Field(default=None, max_length=255)


class GuardianResponse(ORMModel):
    id: int
    name: str
    gender: GenderType
    phone: str
    birth_date: Optional[date]
    address: Optional[str]
    created_at: datetime
    updated_at: datetime
    auth_code: Optional[str] = None

class InstitutionCreate(BaseModel):
    institution_code: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    institution_type: InstitutionType = InstitutionType.GENERAL
    address: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("위도와 경도는 함께 입력해야 합니다.")
        return self


class InstitutionUpdate(BaseModel):
    institution_code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    institution_type: Optional[InstitutionType] = None
    address: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=30)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class InstitutionResponse(ORMModel):
    id: int
    institution_code: str
    name: str
    institution_type: InstitutionType
    address: Optional[str]
    phone: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime
    updated_at: datetime


class SubjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    gender: GenderType = GenderType.UNKNOWN
    phone: Optional[str] = Field(default=None, max_length=30)
    birth_date: Optional[date] = None
    address: Optional[str] = Field(default=None, max_length=255)
    subject_type: SubjectType = SubjectType.GENERAL
    special_notes: Optional[str] = None
    institution_id: Optional[int] = None


class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    gender: Optional[GenderType] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    birth_date: Optional[date] = None
    address: Optional[str] = Field(default=None, max_length=255)
    subject_type: Optional[SubjectType] = None
    special_notes: Optional[str] = None
    institution_id: Optional[int] = None


class SubjectResponse(ORMModel):
    id: int
    name: str
    gender: GenderType
    phone: Optional[str]
    birth_date: Optional[date]
    address: Optional[str]
    subject_type: SubjectType
    special_notes: Optional[str]
    institution_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    auth_code: Optional[str] = None

class GuardianRegistrationCreate(BaseModel):
    guardian_id: int
    subject_id: int
    relationship_code: str = Field(min_length=1, max_length=50, examples=["mother"])
    guardian_role_code: Optional[str] = Field(
        default=None,
        max_length=50,
        examples=["family_guardian"],
    )
    is_primary: bool = False
    contact_priority: int = Field(default=1, ge=1)
    living_together: bool = False
    protection_start_date: Optional[date] = None
    protection_end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.protection_start_date
            and self.protection_end_date
            and self.protection_end_date < self.protection_start_date
        ):
            raise ValueError("보호 종료일은 보호 시작일보다 빠를 수 없습니다.")
        return self


class GuardianRegistrationUpdate(BaseModel):
    relationship_code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    guardian_role_code: Optional[str] = Field(default=None, max_length=50)
    is_primary: Optional[bool] = None
    contact_priority: Optional[int] = Field(default=None, ge=1)
    living_together: Optional[bool] = None
    protection_start_date: Optional[date] = None
    protection_end_date: Optional[date] = None


class GuardianRegistrationResponse(ORMModel):
    guardian_id: int
    subject_id: int
    relationship_code: str
    guardian_role_code: Optional[str]
    is_primary: bool
    contact_priority: int
    living_together: bool
    protection_start_date: Optional[date]
    protection_end_date: Optional[date]
    created_at: datetime

# =========================================================
# 보호자-보호대상자 연결 상세 응답
# =========================================================
class GuardianSummary(ORMModel):
    id: int
    name: str
    gender: GenderType
    phone: str
    birth_date: Optional[date]
    address: Optional[str]


class SubjectSummary(ORMModel):
    id: int
    name: str
    gender: GenderType
    phone: Optional[str]
    birth_date: Optional[date]
    address: Optional[str]
    subject_type: SubjectType
    special_notes: Optional[str]
    institution_id: Optional[int]


class GuardianRegistrationDetailResponse(BaseModel):
    guardian_id: int
    subject_id: int

    relationship_code: str
    guardian_role_code: Optional[str]

    is_primary: bool
    contact_priority: int
    living_together: bool

    protection_start_date: Optional[date]
    protection_end_date: Optional[date]
    created_at: datetime

    guardian: GuardianSummary
    subject: SubjectSummary
class InstitutionManagerCreate(BaseModel):
    institution_id: int
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=30)
    position: Optional[str] = Field(default=None, max_length=100)


class InstitutionManagerUpdate(BaseModel):
    institution_id: Optional[int] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, min_length=5, max_length=30)
    position: Optional[str] = Field(default=None, max_length=100)


class InstitutionManagerResponse(ORMModel):
    id: int
    institution_id: int
    name: str
    phone: str
    position: Optional[str]
    created_at: datetime
    updated_at: datetime


class ManagerAssignmentCreate(BaseModel):
    manager_id: int
    subject_id: int
    is_primary_manager: bool = False
    assignment_start_date: Optional[date] = None
    assignment_end_date: Optional[date] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.assignment_start_date
            and self.assignment_end_date
            and self.assignment_end_date < self.assignment_start_date
        ):
            raise ValueError("담당 종료일은 담당 시작일보다 빠를 수 없습니다.")
        return self


class ManagerAssignmentUpdate(BaseModel):
    is_primary_manager: Optional[bool] = None
    assignment_start_date: Optional[date] = None
    assignment_end_date: Optional[date] = None


class ManagerAssignmentResponse(ORMModel):
    manager_id: int
    subject_id: int
    is_primary_manager: bool
    assignment_start_date: Optional[date]
    assignment_end_date: Optional[date]
    created_at: datetime


class GPSCreate(BaseModel):
    subject_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class GPSResponse(ORMModel):
    id: int
    subject_id: int
    latitude: float
    longitude: float
    measured_at: datetime

class AuthCodeResponse(BaseModel):
    user_type: str
    user_id: int
    auth_code: str

    class Config:
        from_attributes = True


class AuthCodeVerifyRequest(BaseModel):
    auth_code: str


class AuthCodeVerifyResponse(BaseModel):
    valid: bool
    user_type: Optional[str] = None
    user_id: Optional[int] = None
    message: str
    
class AuthCodeUpdate(BaseModel):
    auth_code: str = Field(min_length=1, max_length=50)