from datetime import date, datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_serializer,
    model_validator,
)

from backend.models import GenderType, InstitutionType, SubjectType
from backend.risk_policy import (
    calculate_integrated_risk,
    clamp_risk_score,
    risk_level_from_score,
)


KST = timezone(timedelta(hours=9))


def to_kst(dt: datetime | None):
    if dt is None:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(KST)


def calculate_combined_risk_score(
    lmtad_score: float | None,
    weather_score: float | None,
    air_score: float | None,
) -> float | None:
    """하위 호환용 wrapper. 실제 계산 정책은 risk_policy.py 한 곳에서 관리한다."""
    if all(
        score is None
        for score in (lmtad_score, weather_score, air_score)
    ):
        return None

    score, _ = calculate_integrated_risk(
        lmtad_score,
        weather_score,
        air_score,
    )
    return score


class KSTBaseModel(BaseModel):
    @field_serializer(
        "*",
        check_fields=False,
        when_used="json",
    )
    def serialize_datetime(self, value):
        if isinstance(value, datetime):
            return to_kst(value).isoformat()

        return value


class ORMModel(KSTBaseModel):
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
    relationship_note: Optional[str] = Field(default=None, max_length=100, examples=["이모"])
    guardian_role_code: Optional[str] = Field(default=None, max_length=50, examples=["family_guardian"])
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
    relationship_note: Optional[str] = Field(default=None, max_length=100)
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
    relationship_note: Optional[str]
    guardian_role_code: Optional[str]
    is_primary: bool
    contact_priority: int
    living_together: bool
    protection_start_date: Optional[date]
    protection_end_date: Optional[date]
    created_at: datetime


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
    relationship_note: Optional[str]
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
    email: str = Field(min_length=3, max_length=255)
    login_id: str = Field(min_length=4, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    position: Optional[str] = Field(default=None, max_length=100)


class InstitutionManagerUpdate(BaseModel):
    institution_id: Optional[int] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, min_length=5, max_length=30)
    position: Optional[str] = Field(default=None, max_length=100)


class InstitutionManagerResponse(ORMModel):
    id: int
    institution_id: Optional[int]
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    login_id: Optional[str]
    position: Optional[str]
    created_at: datetime
    updated_at: datetime


class InstitutionManagerSignup(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=5, max_length=30)
    email: str = Field(min_length=3, max_length=255)
    login_id: str = Field(min_length=4, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    institution_id: int


class InstitutionManagerLogin(BaseModel):
    login_id: str
    password: str


class InstitutionManagerAuthResponse(BaseModel):
    id: int
    institution_id: int
    name: str
    phone: str
    email: str
    login_id: str
    position: Optional[str]
    model_config = ConfigDict(from_attributes=True)


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
    measured_at: Optional[datetime] = None


class GPSResponse(ORMModel):
    gps_id: int
    subject_id: int
    latitude: float
    longitude: float
    measured_at: datetime

    @field_serializer("measured_at")
    def serialize_measured_at(self, value: datetime):
        kst = ZoneInfo("Asia/Seoul")
        if value.tzinfo is None:
            value = value.replace(tzinfo=ZoneInfo("UTC"))
        return value.astimezone(kst).isoformat(timespec="milliseconds")

    model_config = ConfigDict(from_attributes=True)


class AIPlacePredictionRequest(BaseModel):
    subject_id: int
    user_token: str
    weekday_token: str
    places: list[str]


class AIPlacePredictionResponse(BaseModel):
    subject_id: int
    values: list[str]
    token_ids: list[int]
    token_count: int
    anomaly_score: float
    is_anomaly: bool | None


class AuthCodeResponse(BaseModel):
    subject_id: int
    auth_code: str
    created_alert_ids: list[int]


class AuthCodeVerifyRequest(BaseModel):
    auth_code: str


class AuthCodeVerifyResponse(BaseModel):
    valid: bool
    user_type: str | None
    user_id: int | None
    message: str


class AuthCodeUpdate(BaseModel):
    auth_code: str


class RiskResultCreate(BaseModel):
    subject_id: int
    risk_level: str | None = None
    risk_score: float | None = None
    reason: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    @model_validator(mode="after")
    def resolve_risk_level(self):
        if self.risk_score is not None:
            self.risk_score = clamp_risk_score(self.risk_score)
            self.risk_level = risk_level_from_score(self.risk_score)
        elif self.risk_level is None:
            raise ValueError("risk_score 또는 risk_level 중 하나는 필요합니다.")
        return self


class RiskResultResponse(BaseModel):
    subject_id: int
    risk_level: str
    risk_score: float | None = None
    alert_created: bool
    created_alert_ids: list[int]


class AlertResponse(BaseModel):
    id: int
    type: str
    subject_id: int | None = None
    guardian_id: int | None = None

    # 신규 필드 - 기존 API 호환을 위해 optional
    recipient_type: str | None = None
    recipient_id: int | None = None

    message: str
    risk_score: float | None = None
    risk_snapshot: dict | None = None
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PushTokenCreate(BaseModel):
    user_type: Literal["guardian", "subject", "institution_manager"]
    user_id: int
    push_token: str


class PushTokenResponse(BaseModel):
    id: int
    user_type: str
    user_id: int
    push_token: str


class GuardianAuthCodeResponse(BaseModel):
    user_type: str
    user_id: int
    auth_code: str


class RiskStatusCreate(BaseModel):
    subject_id: int
    risk_level: str | None = None
    risk_score: float | None = None
    lmtad_score: float | None = None
    weather_score: float | None = None
    air_score: float | None = None
    lmtad_reason: str | None = None
    weather_reason: str | None = None
    air_reason: str | None = None

    @model_validator(mode="after")
    def resolve_risk_score_and_level(self):
        if self.risk_score is None:
            self.risk_score = calculate_combined_risk_score(
                self.lmtad_score,
                self.weather_score,
                self.air_score,
            )
        else:
            self.risk_score = clamp_risk_score(self.risk_score)

        if self.risk_score is not None:
            self.risk_level = risk_level_from_score(self.risk_score)
        elif self.risk_level is None:
            raise ValueError(
                "risk_score, 세부 위험점수 또는 risk_level 중 하나는 필요합니다."
            )
        return self


class RiskStatusResponse(KSTBaseModel):
    id: int
    subject_id: int
    risk_level: str
    risk_score: float | None = None
    lmtad_score: float | None = None
    weather_score: float | None = None
    air_score: float | None = None
    lmtad_reason: str | None = None
    weather_reason: str | None = None
    air_reason: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GPSInferenceResponse(BaseModel):
    subject_id: int
    target_date: date
    point_count: int
    gps_token_count: int
    tokens: list[str]
    anomaly_score: float
    threshold: float
    risk_level: str
    integrated_risk_score: float | None = None
    integrated_risk_level: str | None = None
    lmtad_score: float | None = None
    weather_score: float | None = None
    air_score: float | None = None
    skipped_no_new_gps: bool = False


class RiskFactorResponse(BaseModel):
    type: str
    name: str
    score: float
    percentage: int
    description: str


class RiskAnalysisResponse(KSTBaseModel):
    subject_id: int
    total_score: float
    risk_level: str
    measured_at: datetime
    factors: list[RiskFactorResponse]
    ai_explanation: str | None = None


class InstitutionManagerPasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
