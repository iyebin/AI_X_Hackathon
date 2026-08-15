import math
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from facility_api import fetch_facilities
from air import get_air_quality_by_gps
from weather import get_weather_by_gps
from firebase_service import send_push_notification

import models
import schemas
from database import Base, engine, get_db

from contextlib import asynccontextmanager
import secrets
from datetime import datetime, timedelta, timezone
import random
import string
import bcrypt

from lmtad_runtime import LMTADRuntime
import os
import random
from datetime import datetime, timedelta, timezone

import resend
resend.api_key = os.getenv("RESEND_API_KEY")

lmtad_runtime: LMTADRuntime | None = None
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global lmtad_runtime

    print("[LMTAD] 모델 로딩 시작")

    try:
        lmtad_runtime = LMTADRuntime()

        print(
            "[LMTAD] 모델 로딩 성공:",
            f"features={lmtad_runtime.features},",
            f"block_size={lmtad_runtime.block_size},",
            f"vocab_size={lmtad_runtime.vocab_size},",
            f"device={lmtad_runtime.device}",
        )

    except FileNotFoundError as e:
        print(f"[LMTAD] 모델 파일 없음: {e}")
        lmtad_runtime = None

    except Exception as e:
        print(f"[LMTAD] 모델 로딩 실패: {e}")
        lmtad_runtime = None

    yield

    lmtad_runtime = None
    
tags_metadata = [
    {
        "name": "기본",
        "description": "서버 실행 상태를 확인합니다.",
    },
    {
        "name": "기관",
        "description": "기관 데이터 가져오기와 기관 CRUD를 관리합니다.",
    },
    {
        "name": "보호대상자",
        "description": "보호대상자를 등록·조회·수정·삭제합니다.",
    },
    {
        "name": "보호자",
        "description": "보호자를 등록·조회·수정·삭제합니다.",
    },
    {
        "name": "보호자 등록 관계",
        "description": "보호자와 보호대상자를 연결합니다.",
    },
    {
        "name": "기관 관리자",
        "description": "기관 소속 관리자를 관리합니다.",
    },
    {
        "name": "담당 관리자 등록 관계",
        "description": "기관 관리자를 보호대상자에게 배정합니다.",
    },
    {
        "name": "GPS",
        "description": "보호대상자의 위치를 저장하고 조회합니다.",
    },
    {
        "name": "현재 위치 기반 기관 검색",
        "description": "좌표 또는 최신 GPS 위치로 가까운 기관을 검색합니다.",
    },
    {
        "name": "맞춤 기관 추천",
        "description": "보호대상자 유형과 거리를 이용해 기관을 추천합니다.",
    },
]

app = FastAPI(
    title="안심하랑께 백엔드 API",
    description="""
보호대상자, 보호자, 기관, 기관 관리자, GPS 정보를 관리합니다.

핵심 기능:
- 보호대상자/보호자 등록 및 연결
- 기관/기관 관리자 등록
- GPS 위치 저장
- 현재 위치 기반 주변 기관 검색
- 보호대상자 유형과 거리 기반 맞춤 기관 추천
""",
    version="3.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
)
AUTH_SPECIAL_CHARACTERS = "!@#$%^&*"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def apply_updates(db_object, update_data):
    values = update_data.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(db_object, field, value)

# =========================================================
# 알림 공통 함수
# =========================================================

DANGEROUS_RISK_LEVELS = {
    "danger",
    "emergency",
    "critical",
    "위험",
    "긴급",
    "심각",
}


def normalize_risk_level(value: str) -> str:
    return value.strip().lower()

def create_alerts_for_subject(
    db: Session,
    *,
    subject_id: int,
    alert_type: str,
    message: str,
    risk_score: float | None = None,
):
    # 해당 보호대상자와 연결된 보호자 조회
    guardian_links = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.subject_id == subject_id
        )
        .all()
    )

    alerts = []

    for link in guardian_links:
        alert = models.Alert(
            type=alert_type,
            subject_id=subject_id,
            guardian_id=link.guardian_id,
            message=message,
            risk_score=risk_score,
            is_read=False,
        )

        db.add(alert)
        alerts.append(alert)

    db.flush()

    return alerts

def haversine_km(
    latitude1: float,
    longitude1: float,
    latitude2: float,
    longitude2: float,
) -> float:
    earth_radius_km = 6371.0

    lat1 = math.radians(latitude1)
    lon1 = math.radians(longitude1)
    lat2 = math.radians(latitude2)
    lon2 = math.radians(longitude2)

    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1

    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(delta_lon / 2) ** 2
    )

    central_angle = 2 * math.atan2(
        math.sqrt(value),
        math.sqrt(1 - value),
    )

    return earth_radius_km * central_angle

def generate_auth_code() -> str:
    characters = [
        random.choice(string.digits),
        random.choice(string.digits),
        random.choice(string.ascii_uppercase),
        random.choice(string.ascii_lowercase),
        random.choice(AUTH_SPECIAL_CHARACTERS),
        random.choice(AUTH_SPECIAL_CHARACTERS),
    ]

    random.shuffle(characters)

    return "".join(characters)

def auth_code_exists(
    db: Session,
    auth_code: str,
) -> bool:
    subject_exists = (
        db.query(models.Subject)
        .filter(models.Subject.auth_code == auth_code)
        .first()
        is not None
    )

    guardian_exists = (
        db.query(models.Guardian)
        .filter(models.Guardian.auth_code == auth_code)
        .first()
        is not None
    )

    return subject_exists or guardian_exists

def generate_unique_auth_code(db: Session) -> str:
    for _ in range(100):
        auth_code = generate_auth_code()

        if not auth_code_exists(db, auth_code):
            return auth_code

    raise HTTPException(
        status_code=500,
        detail="고유한 인증코드를 생성하지 못했습니다.",
    )

def calculate_type_match_score(
    subject_type: models.SubjectType,
    institution_type: models.InstitutionType,
) -> float:
    exact_matches = {
        models.SubjectType.CHILD: models.InstitutionType.CHILD,
        models.SubjectType.DEMENTIA: models.InstitutionType.DEMENTIA,
        models.SubjectType.ELDERLY: models.InstitutionType.ELDERLY,
        models.SubjectType.DISABILITY: models.InstitutionType.DISABILITY,
        models.SubjectType.GENERAL: models.InstitutionType.GENERAL,
    }

    expected_type = exact_matches.get(subject_type)

    if expected_type == institution_type:
        return 1.0

    if institution_type == models.InstitutionType.GENERAL:
        return 0.7

    if institution_type in {
        models.InstitutionType.POLICE,
        models.InstitutionType.HOSPITAL,
    }:
        return 0.5

    return 0.2


def infer_institution_type(name: str) -> models.InstitutionType:
    """시설명에 포함된 단어로 기관 유형을 자동 분류합니다."""
    normalized_name = name.replace(" ", "").lower()

    if any(
        keyword in normalized_name
        for keyword in ["아동", "어린이", "청소년", "지역아동", "보육"]
    ):
        return models.InstitutionType.CHILD

    if any(
        keyword in normalized_name
        for keyword in ["치매", "기억"]
    ):
        return models.InstitutionType.DEMENTIA

    if any(
        keyword in normalized_name
        for keyword in ["노인", "어르신", "경로", "요양", "재가복지"]
    ):
        return models.InstitutionType.ELDERLY

    if any(
        keyword in normalized_name
        for keyword in ["장애인", "장애", "재활"]
    ):
        return models.InstitutionType.DISABILITY

    if any(
        keyword in normalized_name
        for keyword in ["경찰", "파출소", "지구대"]
    ):
        return models.InstitutionType.POLICE

    if any(
        keyword in normalized_name
        for keyword in ["병원", "의료원", "보건소", "의원"]
    ):
        return models.InstitutionType.HOSPITAL

    return models.InstitutionType.GENERAL


def institution_to_result(
    institution: models.Institution,
    distance_km: float,
) -> dict:
    return {
        "id": institution.id,
        "institution_code": institution.institution_code,
        "name": institution.name,
        "institution_type": institution.institution_type.value,
        "address": institution.address,
        "phone": institution.phone,
        "latitude": institution.latitude,
        "longitude": institution.longitude,
        "distance_km": round(distance_km, 3),
    }


def get_latest_gps_or_404(
    db: Session,
    subject_id: int,
) -> models.GPSRecord:
    gps_record = (
        db.query(models.GPSRecord)
        .filter(models.GPSRecord.subject_id == subject_id)
        .order_by(models.GPSRecord.gps_id.desc())
        .first()
    )

    if not gps_record:
        raise HTTPException(
            status_code=404,
            detail="저장된 GPS 위치가 없습니다.",
        )

    return gps_record


@app.get("/", tags=["기본"])
def root():
    return {
        "message": "안심하랑께 백엔드 서버가 실행 중입니다.",
        "version": "3.0.0",
        "swagger": "/docs",
    }


@app.get("/health", tags=["기본"])
def health_check():
    return {"status": "ok"}


# =========================================================
# 보호자 CRUD
# =========================================================
@app.post(
    "/guardians",
    response_model=schemas.GuardianResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["보호자"],
)
def create_guardian(
    guardian_data: schemas.GuardianCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(models.Guardian)
        .filter(models.Guardian.phone == guardian_data.phone)
        .first()
    )

    if existing:
        raise HTTPException(status_code=409, detail="이미 등록된 보호자 연락처입니다.")

    guardian = models.Guardian(**guardian_data.model_dump())
    db.add(guardian)
    db.commit()
    db.refresh(guardian)
    return guardian


@app.get(
    "/guardians",
    response_model=List[schemas.GuardianResponse],
    tags=["보호자"],
)
def list_guardians(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Guardian)
        .order_by(models.Guardian.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get(
    "/guardians/{guardian_id}",
    response_model=schemas.GuardianResponse,
    tags=["보호자"],
)
def get_guardian(guardian_id: int, db: Session = Depends(get_db)):
    guardian = db.get(models.Guardian, guardian_id)
    if not guardian:
        raise HTTPException(status_code=404, detail="보호자를 찾을 수 없습니다.")
    return guardian


@app.patch(
    "/guardians/{guardian_id}",
    response_model=schemas.GuardianResponse,
    tags=["보호자"],include_in_schema=False,
)
def update_guardian(
    guardian_id: int,
    guardian_data: schemas.GuardianUpdate,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, guardian_id)
    if not guardian:
        raise HTTPException(status_code=404, detail="보호자를 찾을 수 없습니다.")

    apply_updates(guardian, guardian_data)

    try:
        db.commit()
        db.refresh(guardian)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 사용 중인 연락처입니다.")

    return guardian


@app.delete("/guardians/{guardian_id}", tags=["보호자"], include_in_schema=False,)
def delete_guardian(guardian_id: int, db: Session = Depends(get_db)):
    guardian = db.get(models.Guardian, guardian_id)
    if not guardian:
        raise HTTPException(status_code=404, detail="보호자를 찾을 수 없습니다.")

    db.delete(guardian)
    db.commit()
    return {"message": "보호자가 삭제되었습니다.", "guardian_id": guardian_id}

@app.get(
    "/subjects/{subject_id}/guardians",
    response_model=List[schemas.GuardianRegistrationDetailResponse],
    tags=["보호자 등록 관계"],
)
def get_guardians_of_subject(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    registrations = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.subject_id == subject_id
        )
        .order_by(
            models.GuardianRegistration.contact_priority,
            models.GuardianRegistration.guardian_id,
        )
        .all()
    )

    return [
        guardian_registration_to_detail(registration)
        for registration in registrations
    ]

@app.get(
    "/guardians/{guardian_id}/subjects",
    response_model=List[schemas.GuardianRegistrationDetailResponse],
    tags=["보호자 등록 관계"],
)
def get_subjects_of_guardian(
    guardian_id: int,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, guardian_id)

    if not guardian:
        raise HTTPException(
            status_code=404,
            detail="보호자를 찾을 수 없습니다.",
        )

    registrations = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.guardian_id == guardian_id
        )
        .order_by(
            models.GuardianRegistration.contact_priority,
            models.GuardianRegistration.subject_id,
        )
        .all()
    )

    return [
        guardian_registration_to_detail(registration)
        for registration in registrations
    ]
# =========================================================
# 기관 CRUD 및 현재 위치 검색
# 주의: /institutions/nearest는 /institutions/{institution_id}보다 위에 둠
# =========================================================
@app.post(
    "/institutions",
    response_model=schemas.InstitutionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["기관"],
)
def create_institution(
    institution_data: schemas.InstitutionCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(models.Institution)
        .filter(
            models.Institution.institution_code
            == institution_data.institution_code
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=409, detail="이미 등록된 기관 코드입니다.")

    institution = models.Institution(**institution_data.model_dump())
    db.add(institution)
    db.commit()
    db.refresh(institution)
    return institution


@app.get(
    "/institutions",
    response_model=List[schemas.InstitutionResponse],
    tags=["기관"],
)
def list_institutions(
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Institution)
        .all()
    )


@app.get(
    "/institutions/nearest",
    tags=["현재 위치 기반 기관 검색"],
)
def find_nearest_institutions(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=10.0, gt=0, le=100),
    limit: int = Query(default=5, ge=1, le=100),
    institution_type: models.InstitutionType | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Institution).filter(
        models.Institution.latitude.isnot(None),
        models.Institution.longitude.isnot(None),
    )

    if institution_type is not None:
        query = query.filter(
            models.Institution.institution_type == institution_type
        )

    results = []

    for institution in query.all():
        distance = haversine_km(
            latitude,
            longitude,
            institution.latitude,
            institution.longitude,
        )

        if distance <= radius_km:
            results.append(institution_to_result(institution, distance))

    results.sort(key=lambda item: item["distance_km"])

    return {
        "search_location": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "radius_km": radius_km,
        "count": min(len(results), limit),
        "institutions": results[:limit],
    }



@app.post(
    "/institutions/import-openapi",
    tags=["기관"],
)
async def import_institutions_from_openapi(
    update_existing: bool = Query(
        default=True,
        description="이미 등록된 기관을 최신 공공데이터로 업데이트할지 여부",
    ),
    db: Session = Depends(get_db),
):
    """
    공공데이터포털 사회복지시설 목록을 가져와 institutions 테이블에 저장합니다.

    - institution_code: 공공데이터 external_id
    - 중복 기관: update_existing=True이면 업데이트
    - 좌표가 없는 시설: 건너뜀
    """
    try:
        facilities = await fetch_facilities()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"공공데이터 호출 중 오류가 발생했습니다: {exc}",
        ) from exc

    created_count = 0
    updated_count = 0
    skipped_count = 0

    try:
        for facility in facilities:
            external_id = str(facility.get("external_id", "")).strip()
            name = str(facility.get("name", "")).strip()
            address = facility.get("address")
            phone = facility.get("phone")
            latitude = facility.get("latitude")
            longitude = facility.get("longitude")

            if not external_id or not name:
                skipped_count += 1
                continue

            if latitude is None or longitude is None:
                skipped_count += 1
                continue

            existing = (
                db.query(models.Institution)
                .filter(models.Institution.institution_code == external_id)
                .first()
            )

            institution_type = infer_institution_type(name)

            if existing:
                if not update_existing:
                    skipped_count += 1
                    continue

                existing.name = name
                existing.address = address
                existing.phone = phone
                existing.latitude = latitude
                existing.longitude = longitude
                existing.institution_type = institution_type
                updated_count += 1
                continue

            db.add(
                models.Institution(
                    institution_code=external_id,
                    name=name,
                    institution_type=institution_type,
                    address=address,
                    phone=phone,
                    latitude=latitude,
                    longitude=longitude,
                )
            )
            created_count += 1

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"기관 데이터 저장 중 오류가 발생했습니다: {exc}",
        ) from exc

    total_in_database = db.query(models.Institution).count()

    return {
        "message": "공공데이터 기관 목록 저장 완료",
        "api_result_count": len(facilities),
        "created_count": created_count,
        "updated_count": updated_count,
        "skipped_count": skipped_count,
        "total_in_database": total_in_database,
    }


@app.get(
    "/institutions/count",
    tags=["기관"],
)
def count_institutions(db: Session = Depends(get_db)):
    total = db.query(models.Institution).count()
    with_coordinates = (
        db.query(models.Institution)
        .filter(
            models.Institution.latitude.isnot(None),
            models.Institution.longitude.isnot(None),
        )
        .count()
    )

    return {
        "total": total,
        "with_coordinates": with_coordinates,
        "without_coordinates": total - with_coordinates,
    }


@app.get(
    "/institutions/{institution_id}",
    response_model=schemas.InstitutionResponse,
    tags=["기관"],
)
def get_institution(institution_id: int, db: Session = Depends(get_db)):
    institution = db.get(models.Institution, institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")
    return institution


@app.patch(
    "/institutions/{institution_id}",
    response_model=schemas.InstitutionResponse,
    tags=["기관"],
    include_in_schema=False,
)
def update_institution(
    institution_id: int,
    institution_data: schemas.InstitutionUpdate,
    db: Session = Depends(get_db),
):
    institution = db.get(models.Institution, institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")

    update_values = institution_data.model_dump(exclude_unset=True)

    new_latitude = update_values.get("latitude", institution.latitude)
    new_longitude = update_values.get("longitude", institution.longitude)

    if (new_latitude is None) != (new_longitude is None):
        raise HTTPException(
            status_code=400,
            detail="위도와 경도는 함께 입력해야 합니다.",
        )

    apply_updates(institution, institution_data)

    try:
        db.commit()
        db.refresh(institution)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 사용 중인 기관 코드입니다.")

    return institution


@app.delete("/institutions/{institution_id}", tags=["기관"], include_in_schema=False,)
def delete_institution(institution_id: int, db: Session = Depends(get_db)):
    institution = db.get(models.Institution, institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")

    db.delete(institution)
    db.commit()
    return {"message": "기관이 삭제되었습니다.", "institution_id": institution_id}


# =========================================================
# 보호대상자 CRUD
# =========================================================
@app.post(
    "/subjects",
    response_model=schemas.SubjectResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["보호대상자"],
)
def create_subject(
    subject_data: schemas.SubjectCreate,
    db: Session = Depends(get_db),
):
    if subject_data.institution_id is not None:
        institution = db.get(models.Institution, subject_data.institution_id)
        if not institution:
            raise HTTPException(status_code=404, detail="지정한 기관을 찾을 수 없습니다.")

    if subject_data.phone:
        existing = (
            db.query(models.Subject)
            .filter(models.Subject.phone == subject_data.phone)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="이미 등록된 보호대상자 연락처입니다.",
            )

    subject = models.Subject(**subject_data.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    
    return subject


@app.get(
    "/subjects",
    response_model=List[schemas.SubjectResponse],
    tags=["보호대상자"],
)
def list_subjects(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Subject)
        .order_by(models.Subject.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.get(
    "/subjects/{subject_id}",
    response_model=schemas.SubjectResponse,
    tags=["보호대상자"],
)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")
    return subject


@app.patch(
    "/subjects/{subject_id}",
    response_model=schemas.SubjectResponse,
    tags=["보호대상자"],
    include_in_schema=False,
)
def update_subject(
    subject_id: int,
    subject_data: schemas.SubjectUpdate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    update_values = subject_data.model_dump(exclude_unset=True)

    if "institution_id" in update_values:
        institution_id = update_values["institution_id"]
        if institution_id is not None:
            institution = db.get(models.Institution, institution_id)
            if not institution:
                raise HTTPException(
                    status_code=404,
                    detail="지정한 기관을 찾을 수 없습니다.",
                )

    apply_updates(subject, subject_data)
    try:
            db.commit()
            db.refresh(subject)
    except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="이미 사용 중인 연락처입니다.")

    return subject
        
def guardian_registration_to_detail(
    registration: models.GuardianRegistration,
) -> dict:
    """
    보호자-보호대상자 연결 정보에
    양쪽 사용자 상세 정보를 함께 담아 반환합니다.
    """

    guardian = registration.guardian
    subject = registration.subject

    return {
        "guardian_id": registration.guardian_id,
        "subject_id": registration.subject_id,
        "relationship_code": registration.relationship_code,
        "guardian_role_code": registration.guardian_role_code,
        "is_primary": registration.is_primary,
        "contact_priority": registration.contact_priority,
        "living_together": registration.living_together,
        "protection_start_date": registration.protection_start_date,
        "protection_end_date": registration.protection_end_date,
        "created_at": registration.created_at,

        "guardian": {
            "id": guardian.id,
            "name": guardian.name,
            "gender": guardian.gender,
            "phone": guardian.phone,
            "birth_date": guardian.birth_date,
            "address": guardian.address,
        },

        "subject": {
            "id": subject.id,
            "name": subject.name,
            "gender": subject.gender,
            "phone": subject.phone,
            "birth_date": subject.birth_date,
            "address": subject.address,
            "subject_type": subject.subject_type,
            "special_notes": subject.special_notes,
            "institution_id": subject.institution_id,
        },
    }



@app.delete("/subjects/{subject_id}", tags=["보호대상자"], include_in_schema=False,)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    db.delete(subject)
    db.commit()
    return {"message": "보호대상자가 삭제되었습니다.", "subject_id": subject_id}


# =========================================================
# 보호자 ↔ 보호대상자 연결
# =========================================================
@app.post(
    "/guardian-registrations",
    response_model=schemas.GuardianRegistrationDetailResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["보호자 등록 관계"],
)
def create_guardian_registration(
    registration_data: schemas.GuardianRegistrationCreate,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, registration_data.guardian_id)
    subject = db.get(models.Subject, registration_data.subject_id)

    if not guardian:
        raise HTTPException(status_code=404, detail="보호자를 찾을 수 없습니다.")
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    existing = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.guardian_id
            == registration_data.guardian_id,
            models.GuardianRegistration.subject_id
            == registration_data.subject_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="이미 연결된 보호자와 보호대상자입니다.",
        )

    registration = models.GuardianRegistration(
        **registration_data.model_dump()
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    return guardian_registration_to_detail(registration)

@app.get(
    "/guardian-registrations",
    response_model=List[schemas.GuardianRegistrationDetailResponse],
    tags=["보호자 등록 관계"],
)
def list_guardian_registrations(
    guardian_id: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.GuardianRegistration)

    if guardian_id is not None:
        query = query.filter(
            models.GuardianRegistration.guardian_id == guardian_id
        )

    if subject_id is not None:
        query = query.filter(
            models.GuardianRegistration.subject_id == subject_id
        )

    registrations = query.all()

    return [
    guardian_registration_to_detail(registration)
    for registration in registrations
]

@app.patch(
    "/guardian-registrations/{guardian_id}/{subject_id}",
    response_model=schemas.GuardianRegistrationResponse,
    tags=["보호자 등록 관계"],
    include_in_schema=False,
)
def update_guardian_registration(
    guardian_id: int,
    subject_id: int,
    registration_data: schemas.GuardianRegistrationUpdate,
    db: Session = Depends(get_db),
):
    registration = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.guardian_id == guardian_id,
            models.GuardianRegistration.subject_id == subject_id,
        )
        .first()
    )

    if not registration:
        raise HTTPException(status_code=404, detail="보호 관계를 찾을 수 없습니다.")

    apply_updates(registration, registration_data)

    if (
        registration.protection_start_date
        and registration.protection_end_date
        and registration.protection_end_date
        < registration.protection_start_date
    ):
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="보호 종료일은 보호 시작일보다 빠를 수 없습니다.",
        )

    db.commit()
    db.refresh(registration)

    return guardian_registration_to_detail(registration)


@app.delete(
    "/guardian-registrations/{guardian_id}/{subject_id}",
    tags=["보호자 등록 관계"],include_in_schema=False,
)
def delete_guardian_registration(
    guardian_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
):
    registration = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.guardian_id == guardian_id,
            models.GuardianRegistration.subject_id == subject_id,
        )
        .first()
    )

    if not registration:
        raise HTTPException(status_code=404, detail="보호 관계를 찾을 수 없습니다.")

    db.delete(registration)
    db.commit()

    return {
        "message": "보호자와 보호대상자의 연결이 삭제되었습니다.",
        "guardian_id": guardian_id,
        "subject_id": subject_id,
    }


# =========================================================
# 기관 관리자 CRUD
# =========================================================
@app.post(
    "/institution-managers",
    response_model=schemas.InstitutionManagerResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["기관 관리자"],
)
def create_institution_manager(
    manager_data: schemas.InstitutionManagerCreate,
    db: Session = Depends(get_db),
):
    institution = db.get(models.Institution, manager_data.institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")

    manager = models.InstitutionManager(**manager_data.model_dump())
    db.add(manager)
    db.commit()
    db.refresh(manager)
    return manager


@app.get(
    "/institution-managers",
    response_model=List[schemas.InstitutionManagerResponse],
    tags=["기관 관리자"],
)
def list_institution_managers(
    institution_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.InstitutionManager)

    if institution_id is not None:
        query = query.filter(
            models.InstitutionManager.institution_id == institution_id
        )

    return query.order_by(models.InstitutionManager.id).all()


@app.get(
    "/institution-managers/{manager_id}",
    response_model=schemas.InstitutionManagerResponse,
    tags=["기관 관리자"],
)
def get_institution_manager(
    manager_id: int,
    db: Session = Depends(get_db),
):
    manager = db.get(models.InstitutionManager, manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="기관 관리자를 찾을 수 없습니다.")
    return manager


@app.patch(
    "/institution-managers/{manager_id}",
    response_model=schemas.InstitutionManagerResponse,
    tags=["기관 관리자"],
    include_in_schema=False,
)
def update_institution_manager(
    manager_id: int,
    manager_data: schemas.InstitutionManagerUpdate,
    db: Session = Depends(get_db),
):
    manager = db.get(models.InstitutionManager, manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="기관 관리자를 찾을 수 없습니다.")

    update_values = manager_data.model_dump(exclude_unset=True)

    if "institution_id" in update_values:
        institution = db.get(
            models.Institution,
            update_values["institution_id"],
        )
        if not institution:
            raise HTTPException(
                status_code=404,
                detail="변경할 기관을 찾을 수 없습니다.",
            )

    apply_updates(manager, manager_data)
    db.commit()
    db.refresh(manager)
    return manager


@app.delete("/institution-managers/{manager_id}", tags=["기관 관리자"], include_in_schema=False,)
def delete_institution_manager(
    manager_id: int,
    db: Session = Depends(get_db),
):
    manager = db.get(models.InstitutionManager, manager_id)
    if not manager:
        raise HTTPException(status_code=404, detail="기관 관리자를 찾을 수 없습니다.")

    db.delete(manager)
    db.commit()
    return {"message": "기관 관리자가 삭제되었습니다.", "manager_id": manager_id}

@app.post(
    "/institution-managers/signup",
    response_model=schemas.InstitutionManagerAuthResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["기관 관리자 인증"],
)
def signup_institution_manager(
    data: schemas.InstitutionManagerSignup,
    db: Session = Depends(get_db),
):
    institution = db.get(
        models.Institution,
        data.institution_id,
    )

    if not institution:
        raise HTTPException(
            status_code=404,
            detail="기관을 찾을 수 없습니다.",
        )

    verified_email = (
        db.query(models.EmailVerification)
        .filter(
            models.EmailVerification.email == data.email.strip().lower(),
            models.EmailVerification.verified_at.is_not(None),
        )
        .order_by(
            models.EmailVerification.verified_at.desc()
        )
        .first()
    )

    if not verified_email:
        raise HTTPException(
            status_code=403,
            detail="이메일 인증이 필요합니다.",
        )
    
    existing_login_id = (
        db.query(models.InstitutionManager)
        .filter(
            models.InstitutionManager.login_id
            == data.login_id
        )
        .first()
    )

    if existing_login_id:
        raise HTTPException(
            status_code=409,
            detail="이미 사용 중인 아이디입니다.",
        )

    existing_email = (
        db.query(models.InstitutionManager)
        .filter(
            models.InstitutionManager.email
            == data.email
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="이미 사용 중인 이메일입니다.",
        )

    manager = models.InstitutionManager(
        institution_id=data.institution_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        login_id=data.login_id,
        password_hash=hash_password(
            data.password
        ),
    )

    db.add(manager)
    db.commit()
    db.refresh(manager)

    return manager

@app.post(
    "/institution-managers/login",
    response_model=schemas.InstitutionManagerAuthResponse,
    tags=["기관 관리자 인증"],
)
def login_institution_manager(
    data: schemas.InstitutionManagerLogin,
    db: Session = Depends(get_db),
):
    manager = (
        db.query(models.InstitutionManager)
        .filter(
            models.InstitutionManager.login_id
            == data.login_id
        )
        .first()
    )

    if not manager:
        raise HTTPException(
            status_code=401,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    if not verify_password(
        data.password,
        manager.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    return manager
# =========================================================
# 기관 관리자 ↔ 보호대상자 연결
# =========================================================
@app.post(
    "/manager-assignments",
    response_model=schemas.ManagerAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["담당 관리자 등록 관계"],
)
def create_manager_assignment(
    assignment_data: schemas.ManagerAssignmentCreate,
    db: Session = Depends(get_db),
):
    manager = db.get(models.InstitutionManager, assignment_data.manager_id)
    subject = db.get(models.Subject, assignment_data.subject_id)

    if not manager:
        raise HTTPException(status_code=404, detail="기관 관리자를 찾을 수 없습니다.")
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    existing = (
        db.query(models.ManagerAssignment)
        .filter(
            models.ManagerAssignment.manager_id
            == assignment_data.manager_id,
            models.ManagerAssignment.subject_id
            == assignment_data.subject_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="이미 배정된 관리자와 보호대상자입니다.",
        )

    assignment = models.ManagerAssignment(**assignment_data.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@app.get(
    "/manager-assignments",
    response_model=List[schemas.ManagerAssignmentResponse],
    tags=["담당 관리자 등록 관계"],
)
def list_manager_assignments(
    manager_id: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.ManagerAssignment)

    if manager_id is not None:
        query = query.filter(
            models.ManagerAssignment.manager_id == manager_id
        )

    if subject_id is not None:
        query = query.filter(
            models.ManagerAssignment.subject_id == subject_id
        )

    return query.all()


@app.patch(
    "/manager-assignments/{manager_id}/{subject_id}",
    response_model=schemas.ManagerAssignmentResponse,
    tags=["담당 관리자 등록 관계"],
    include_in_schema=False,
)
def update_manager_assignment(
    manager_id: int,
    subject_id: int,
    assignment_data: schemas.ManagerAssignmentUpdate,
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.ManagerAssignment)
        .filter(
            models.ManagerAssignment.manager_id == manager_id,
            models.ManagerAssignment.subject_id == subject_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="담당 관리자 배정 정보를 찾을 수 없습니다.",
        )

    apply_updates(assignment, assignment_data)

    if (
        assignment.assignment_start_date
        and assignment.assignment_end_date
        and assignment.assignment_end_date
        < assignment.assignment_start_date
    ):
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="담당 종료일은 담당 시작일보다 빠를 수 없습니다.",
        )

    db.commit()
    db.refresh(assignment)
    return assignment


@app.delete(
    "/manager-assignments/{manager_id}/{subject_id}",
    tags=["담당 관리자 등록 관계"],include_in_schema=False,
)
def delete_manager_assignment(
    manager_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.ManagerAssignment)
        .filter(
            models.ManagerAssignment.manager_id == manager_id,
            models.ManagerAssignment.subject_id == subject_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="담당 관리자 배정 정보를 찾을 수 없습니다.",
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": "담당 관리자 배정이 삭제되었습니다.",
        "manager_id": manager_id,
        "subject_id": subject_id,
    }


# =========================================================
# GPS 저장/조회
# =========================================================
@app.post(
    "/gps",
    response_model=schemas.GPSResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["GPS"],
)
def save_gps(
    gps_data: schemas.GPSCreate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, gps_data.subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    gps_record = models.GPSRecord(**gps_data.model_dump())
    db.add(gps_record)
    db.commit()
    db.refresh(gps_record)
    return gps_record


@app.get(
    "/gps/latest/{subject_id}",
    response_model=schemas.GPSResponse,
    tags=["GPS"],
)
def get_latest_gps(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    return get_latest_gps_or_404(db, subject_id)


@app.get(
    "/gps/history/{subject_id}",
    response_model=List[schemas.GPSResponse],
    tags=["GPS"],
)
def get_gps_history(
    subject_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    return (
        db.query(models.GPSRecord)
        .filter(models.GPSRecord.subject_id == subject_id)
        .order_by(
            models.GPSRecord.measured_at.desc(),
            models.GPSRecord.gps_id.desc(),
        )
        .limit(limit)
        .all()
    )


# =========================================================
# 보호대상자의 최신 GPS 기준 주변 기관 검색
# =========================================================
@app.get(
    "/subjects/{subject_id}/institutions/nearest",
    tags=["현재 위치 기반 기관 검색"],
)
def find_nearest_institutions_by_subject(
    subject_id: int,
    radius_km: float = Query(default=10.0, gt=0, le=100),
    limit: int = Query(default=5, ge=1, le=100),
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    latest_gps = get_latest_gps_or_404(db, subject_id)

    institutions = (
        db.query(models.Institution)
        .filter(
            models.Institution.latitude.isnot(None),
            models.Institution.longitude.isnot(None),
        )
        .all()
    )

    results = []

    for institution in institutions:
        distance = haversine_km(
            latest_gps.latitude,
            latest_gps.longitude,
            institution.latitude,
            institution.longitude,
        )

        if distance <= radius_km:
            results.append(institution_to_result(institution, distance))

    results.sort(key=lambda item: item["distance_km"])

    return {
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "subject_type": subject.subject_type.value,
        },
        "current_location": {
            "latitude": latest_gps.latitude,
            "longitude": latest_gps.longitude,
            "measured_at": latest_gps.measured_at,
        },
        "radius_km": radius_km,
        "count": min(len(results), limit),
        "institutions": results[:limit],
    }


@app.get(
    "/subjects/{subject_id}/institutions/recommended",
    tags=["맞춤 기관 추천"],
)
def recommend_institutions_for_subject(
    subject_id: int,
    radius_km: float = Query(default=20.0, gt=0, le=100),
    limit: int = Query(default=5, ge=1, le=100),
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="보호대상자를 찾을 수 없습니다.")

    latest_gps = get_latest_gps_or_404(db, subject_id)

    institutions = (
        db.query(models.Institution)
        .filter(
            models.Institution.latitude.isnot(None),
            models.Institution.longitude.isnot(None),
        )
        .all()
    )

    recommendations = []

    for institution in institutions:
        distance = haversine_km(
            latest_gps.latitude,
            latest_gps.longitude,
            institution.latitude,
            institution.longitude,
        )

        if distance > radius_km:
            continue

        type_score = calculate_type_match_score(
            subject.subject_type,
            institution.institution_type,
        )

        distance_score = max(0.0, 1.0 - distance / radius_km)
        recommendation_score = type_score * 0.6 + distance_score * 0.4

        result = institution_to_result(institution, distance)
        result.update(
            {
                "type_match_score": round(type_score, 3),
                "distance_score": round(distance_score, 3),
                "recommendation_score": round(recommendation_score, 3),
            }
        )
        recommendations.append(result)

    recommendations.sort(
        key=lambda item: (
            -item["recommendation_score"],
            item["distance_km"],
        )
    )

    return {
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "subject_type": subject.subject_type.value,
        },
        "current_location": {
            "latitude": latest_gps.latitude,
            "longitude": latest_gps.longitude,
            "measured_at": latest_gps.measured_at,
        },
        "weights": {
            "type_match": 0.6,
            "distance": 0.4,
        },
        "radius_km": radius_km,
        "count": min(len(recommendations), limit),
        "recommendations": recommendations[:limit],
    }

@app.post(
    "/subjects/{subject_id}/auth-code",
    response_model=schemas.AuthCodeResponse,
    tags=["알림"],
)
def issue_subject_auth_code(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(
        models.Subject,
        subject_id,
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    # 6자리 인증코드 생성
    code = f"{secrets.randbelow(1_000_000):06d}"

    # 현재 시간 기준 10분 유효
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=10)
    )

    # 인증코드 DB 저장
    auth_code = models.SubjectAuthCode(
        subject_id=subject_id,
        code=code,
        expires_at=expires_at,
    )

    db.add(auth_code)

    # 보호자에게 인증 요청 알림 자동 생성
    created_alerts = create_alerts_for_subject(
        db,
        subject_id=subject_id,
        alert_type="auth_request",
        message=(
            "앱에서 보호자 인증을 요청했습니다. "
            f"인증코드: {code} "
            "(10분간 유효)"
        ),
    )

    db.commit()

    db.refresh(auth_code)

    for alert in created_alerts:
        db.refresh(alert)

    return {
        "subject_id": subject_id,
        "auth_code": code,
        "expires_at": expires_at,
        "created_alert_ids": [
            alert.id
            for alert in created_alerts
        ],
    }

@app.post(
    "/guardians/{guardian_id}/auth-code",
    response_model=schemas.AuthCodeResponse,
    tags=["인증코드"],
)
def issue_guardian_auth_code(
    guardian_id: int,
    db: Session = Depends(get_db),
):
    guardian = (
        db.query(models.Guardian)
        .filter(models.Guardian.id == guardian_id)
        .first()
    )

    if guardian is None:
        raise HTTPException(
            status_code=404,
            detail="보호자를 찾을 수 없습니다.",
        )

    auth_code = generate_unique_auth_code(db)
    guardian.auth_code = auth_code

    alert = models.Alert(
        type="auth",
        guardian_id=guardian.id,
        message=f"{guardian.name}님의 인증코드가 발급되었습니다.",
        is_read=False
    )
    db.add(alert)
    db.commit()
    db.refresh(guardian)
    db.refresh(alert)

    return {
        "user_type": "guardian",
        "user_id": guardian.id,
        "auth_code": guardian.auth_code,
    }

@app.post(
    "/auth-codes/verify",
    response_model=schemas.AuthCodeVerifyResponse,
    tags=["인증코드"],
)
def verify_auth_code(
    request: schemas.AuthCodeVerifyRequest,
    db: Session = Depends(get_db),
):
    auth_code = request.auth_code.strip()

    subject = (
        db.query(models.Subject)
        .filter(models.Subject.auth_code == auth_code)
        .first()
    )

    if subject is not None:
        return {
            "valid": True,
            "user_type": "subject",
            "user_id": subject.id,
            "message": "보호대상자 인증코드가 확인되었습니다.",
        }

    guardian = (
        db.query(models.Guardian)
        .filter(models.Guardian.auth_code == auth_code)
        .first()
    )

    if guardian is not None:
        return {
            "valid": True,
            "user_type": "guardian",
            "user_id": guardian.id,
            "message": "보호자 인증코드가 확인되었습니다.",
        }

    return {
        "valid": False,
        "user_type": None,
        "user_id": None,
        "message": "유효하지 않은 인증코드입니다.",
    }

@app.patch(
    "/subjects/{subject_id}/verification-code",
    tags=["보호대상자"],
    include_in_schema=False,
)
@app.patch(
    "/subjects/{subject_id}/auth-code",
    tags=["보호대상자"],
    include_in_schema=False,
)
def save_auth_code(
    subject_id: int,
    data: schemas.AuthCodeUpdate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    subject.auth_code = data.auth_code

    # 이 보호대상자와 연결된 보호자들 찾기
    guardian_links = (
        db.query(models.GuardianRegistration)
        .filter(
            models.GuardianRegistration.subject_id == subject.id
        )
        .all()
    )

    # 연결된 보호자마다 인증 요청 알림 생성
    for link in guardian_links:
        alert = models.Alert(
            subject_id=subject.id,
            guardian_id=link.guardian_id,
            type="auth",
            message=(
                f"{subject.name}님의 인증 요청이 있습니다. "
                f"인증코드: {subject.auth_code}"
            ),
            is_read=False,
        )
        db.add(alert)

    # 인증코드 저장 + 알림 저장을 한 번에 commit
    db.commit()
    db.refresh(subject)

    return {
        "subject_id": subject.id,
        "auth_code": subject.auth_code,
    }
@app.get(
    "/environment/air/{subject_id}",
    tags=["환경정보"],
)
def read_air_quality(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(
        models.Subject,
        subject_id,
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    latest_gps = get_latest_gps_or_404(
        db,
        subject_id,
    )

    return get_air_quality_by_gps(
        latest_gps.latitude,
        latest_gps.longitude,
    )


@app.get(
    "/environment/weather/{subject_id}",
    tags=["환경정보"],
)
def read_weather_by_gps(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(
        models.Subject,
        subject_id,
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    latest_gps = get_latest_gps_or_404(
        db,
        subject_id,
    )

    return get_weather_by_gps(
        latest_gps.latitude,
        latest_gps.longitude,
    )

def read_air_quality(
    subject_id: int,
    db: Session = Depends(get_db),
):
    latest_gps = (
        db.query(models.GPSRecord)
        .filter(
            models.GPSRecord.subject_id == subject_id
        )
        .order_by(
            models.GPSRecord.measured_at.desc(),
            models.GPSRecord.gps_id.desc(),
        )
        .first()
    )

    if latest_gps is None:
        raise HTTPException(
            status_code=404,
            detail="저장된 GPS 위치가 없습니다.",
        )

    return get_air_quality_by_gps(
        latest_gps.latitude,
        latest_gps.longitude,
    )
# =========================================================
# AI 위험도 결과 → 위험 알림 자동 생성
# =========================================================
def send_risk_push_to_guardian(
    db: Session,
    guardian_id: int,
    subject_id: int,
    subject_name: str,
    risk_level: str,
    risk_score=None,
):
    tokens = (
    db.query(models.DeviceToken)
    .filter(
        models.DeviceToken.user_type
        == "guardian",
        models.DeviceToken.user_id
        == guardian_id,
    )
    .all()
)

    if not tokens:
        print(
            f"[FCM] guardian {guardian_id}: "
            "registered token not found"
        )
        return

    for device in tokens:
        try:
            send_push_notification(
                token=device.token,
                title="위험 알림",
                body=(
                    f"{subject_name}님의 "
                    "위험 상황이 감지되었습니다."
                ),
                data={
                    "type": "risk",
                    "subject_id": str(subject_id),
                    "guardian_id": str(
                        guardian_id
                    ),
                    "risk_level": str(
                        risk_level
                    ),
                    "risk_score": str(
                        risk_score
                        if risk_score is not None
                        else ""
                    ),
                },
            )

        except Exception as e:
            print(
                f"[FCM] Push failed "
                f"guardian={guardian_id}: {e}"
            )


@app.post(
    "/risk-results",
    response_model=schemas.RiskResultResponse,
    tags=["알림"],
)
def receive_risk_result(
    data: schemas.RiskResultCreate,
    db: Session = Depends(get_db),
):
    subject = db.get(
        models.Subject,
        data.subject_id,
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    normalized = normalize_risk_level(
        data.risk_level
    )

    created_alerts = []

    latitude = data.latitude
    longitude = data.longitude

    # AI가 좌표를 안 보내면 최신 GPS 위치 사용
    if latitude is None or longitude is None:
        latest_gps = (
            db.query(models.GPSRecord)
            .filter(
                models.GPSRecord.subject_id
                == data.subject_id
            )
            .order_by(
                models.GPSRecord.measured_at.desc(),
                models.GPSRecord.gps_id.desc(),
            )
            .first()
        )

        if latest_gps:
            latitude = latest_gps.latitude
            longitude = latest_gps.longitude

    # 위험 단계일 때만 알림 자동 생성
    if normalized in DANGEROUS_RISK_LEVELS:
        five_minutes_ago = (
            datetime.now(timezone.utc)
            - timedelta(minutes=5)
        )

        recent_alert = (
            db.query(models.Alert)
            .filter(
                models.Alert.subject_id
                == data.subject_id,
                models.Alert.type
                == "risk",
                models.Alert.created_at
                >= five_minutes_ago,
            )
            .order_by(
                models.Alert.created_at.desc()
            )
            .first()
        )

        if not recent_alert:
            reason = (
                data.reason
                or "GPS 기반 위험도 모델에서 위험 단계가 감지되었습니다."
            )

            if data.risk_score is not None:
                score_text = (
                    f" (위험 점수: {data.risk_score:g})"
                )
            else:
                score_text = ""

            created_alerts = create_alerts_for_subject(
                db,
                subject_id=data.subject_id,
                alert_type="risk",
                message=(
                    f"{subject.name}님 위험 감지: "
                    f"{reason}{score_text}"
                ),
                risk_score=data.risk_score,
            )

        else:
            print(
                "[FCM] 최근 5분 이내 위험 알림이 있어 "
                f"중복 알림을 생략합니다. "
                f"subject_id={data.subject_id}"
            )

    db.commit()

    for alert in created_alerts:
        db.refresh(alert)

    for alert in created_alerts:
        if alert.guardian_id is None:
            continue

        send_risk_push_to_guardian(
            db=db,
            guardian_id=alert.guardian_id,
            subject_id=data.subject_id,
            subject_name=subject.name,
            risk_level=normalized,
            risk_score=data.risk_score,
        )

    return {
        "subject_id": data.subject_id,
        "risk_level": data.risk_level,
        "risk_score": data.risk_score,
        "alert_created": bool(created_alerts),
        "created_alert_ids": [
            alert.id
            for alert in created_alerts
        ],
    }
    
@app.get(
    "/alerts",
    response_model=list[schemas.AlertResponse],
    tags=["알림"]
)
def get_alerts(
    is_read: bool | None = None,
    alert_type: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Alert)

    if is_read is not None:
        query = query.filter(models.Alert.is_read == is_read)

    if alert_type:
        query = query.filter(models.Alert.type == alert_type)

    return query.order_by(models.Alert.created_at.desc()).all()

@app.patch(
    "/alerts/{alert_id}/read",
    response_model=schemas.AlertResponse,
    tags=["알림"]
)

@app.post(
    "/guardians/{guardian_id}/test-push",
    tags=["알림"],
)
def test_push(
    guardian_id: int,
    db: Session = Depends(get_db),
):
    guardian = db.get(
        models.Guardian,
        guardian_id,
    )

    if not guardian:
        raise HTTPException(
            status_code=404,
            detail="보호자를 찾을 수 없습니다.",
        )

    tokens = (
    db.query(models.DeviceToken)
    .filter(
        models.DeviceToken.user_type
        == "guardian",
        models.DeviceToken.user_id
        == guardian_id,
    )
    .all()
)

    if not tokens:
        raise HTTPException(
            status_code=404,
            detail="등록된 기기 토큰이 없습니다.",
        )

    results = []

    for device in tokens:
        try:
            result = send_push_notification(
                token=device.token,
                title="FCM 테스트 알림",
                body="백엔드에서 보낸 테스트 알림입니다.",
                data={
                    "type": "test",
                    "guardian_id": str(
                        guardian_id
                    ),
                },
            )

            results.append(
                {
                    "token_id": device.id,
                    "success": True,
                    "result": result,
                }
            )

        except Exception as e:
            results.append(
                {
                    "token_id": device.id,
                    "success": False,
                    "error": str(e),
                }
            )

    return {
        "guardian_id": guardian_id,
        "results": results,
    }

def mark_alert_as_read(
    alert_id: int,
    db: Session = Depends(get_db)
):
    alert = (
        db.query(models.Alert)
        .filter(models.Alert.id == alert_id)
        .first()
    )

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="알림을 찾을 수 없습니다."
        )

    alert.is_read = True
    db.commit()
    db.refresh(alert)

    return alert

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )

def generate_sms_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"

def send_verification_email(
    email: str,
    code: str,
):
    if not resend.api_key:
        raise HTTPException(
            status_code=500,
            detail="RESEND_API_KEY가 설정되지 않았습니다.",
        )

    try:
        return resend.Emails.send({
            "from": "안심하랑께 <onboarding@resend.dev>",
            "to": [email],
            "subject": "[안심하랑께] 이메일 인증번호",
            "html": f"""
                <h2>안심하랑께 이메일 인증</h2>
                <p>인증번호는</p>
                <h1>{code}</h1>
                <p>입니다.</p>
                <p>인증번호는 3분간 유효합니다.</p>
            """,
        })

    except Exception as e:
        print(f"[EMAIL ERROR] {e}")

        raise HTTPException(
            status_code=502,
            detail="인증 이메일 발송에 실패했습니다.",
        )

@app.post(
    "/auth/email/send",
    tags=["이메일 인증"],
)
def send_email_verification(
    data: schemas.EmailSendRequest,
    db: Session = Depends(get_db),
):
    email = email.strip().lower()

    code = f"{random.randint(0, 999999):06d}"

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=3)

    verification = models.EmailVerification(
        email=email,
        code=code,
        expires_at=expires_at,
        attempts=0,
    )

    db.add(verification)
    db.commit()
    db.refresh(verification)

    try:
        send_verification_email(
            email=email,
            code=code,
        )

    except Exception:
        # 메일이 안 갔는데 DB에는 인증번호가 남는 상황 방지
        db.delete(verification)
        db.commit()
        raise

    return {
        "message": "인증번호를 이메일로 전송했습니다.",
        "email": email,
        "expires_in": 180,
    }

@app.post(
    "/auth/email/verify",
    tags=["이메일 인증"],
)
def verify_email(
    data: schemas.EmailVerifyRequest,
    db: Session = Depends(get_db),
):
    email = email.strip().lower()

    verification = (
        db.query(models.EmailVerification)
        .filter(
            models.EmailVerification.email == email,
            models.EmailVerification.verified_at.is_(None),
        )
        .order_by(
            models.EmailVerification.id.desc()
        )
        .first()
    )

    if not verification:
        raise HTTPException(
            status_code=404,
            detail="인증 요청을 찾을 수 없습니다.",
        )

    now = datetime.now(timezone.utc)

    expires_at = verification.expires_at

    # DB 드라이버가 timezone 정보를 제거해서 반환하는 경우 대비
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if now > expires_at:
        raise HTTPException(
            status_code=400,
            detail="인증번호가 만료되었습니다.",
        )

    if verification.attempts >= 5:
        raise HTTPException(
            status_code=429,
            detail="인증번호 입력 횟수를 초과했습니다. 다시 요청해주세요.",
        )

    if verification.code != data.code:
        verification.attempts += 1
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="인증번호가 올바르지 않습니다.",
        )

    verification.verified_at = now
    db.commit()

    return {
        "verified": True,
        "email": email,
        "message": "이메일 인증이 완료되었습니다.",
    }

@app.post(
    "/push-tokens",
    response_model=schemas.PushTokenResponse,
    tags=["알림"],
)
def register_push_token(
    data: schemas.PushTokenCreate,
    db: Session = Depends(get_db),
):
    # 실제 사용자가 존재하는지 확인
    if data.user_type == "guardian":
        user = db.get(
            models.Guardian,
            data.user_id,
        )
    else:
        user = db.get(
            models.Subject,
            data.user_id,
        )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="사용자를 찾을 수 없습니다.",
        )

    # 같은 FCM token이 이미 등록되어 있는지 확인
    existing_token = (
        db.query(models.DeviceToken)
        .filter(
            models.DeviceToken.token
            == data.push_token
        )
        .first()
    )

    # 이미 있으면 현재 로그인한 사용자 정보로 갱신
    if existing_token:
        existing_token.user_type = data.user_type
        existing_token.user_id = data.user_id

        db.commit()
        db.refresh(existing_token)

        return {
            "id": existing_token.id,
            "user_type": existing_token.user_type,
            "user_id": existing_token.user_id,
            "push_token": existing_token.token,
        }

    # 처음 등록되는 token
    device_token = models.DeviceToken(
        user_type=data.user_type,
        user_id=data.user_id,
        token=data.push_token,
    )

    db.add(device_token)
    db.commit()
    db.refresh(device_token)

    return {
        "id": device_token.id,
        "user_type": device_token.user_type,
        "user_id": device_token.user_id,
        "push_token": device_token.token,
    }