import json
import math
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
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
from datetime import date, datetime, timedelta, timezone
import random
import string

from lmtad_runtime import LMTADRuntime
import os
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from inference_service import run_gps_inference
import requests
import bcrypt

lmtad_runtime: LMTADRuntime | None = None
Base.metadata.create_all(bind=engine)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError, AttributeError):
        return False

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

KST = timezone(timedelta(hours=9))


def datetime_to_kst(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(
            tzinfo=timezone.utc
        )

    return value.astimezone(
        KST
    ).isoformat()


ENCODERS_BY_TYPE[datetime] = datetime_to_kst

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


RISK_DANGER_REPEAT_MINUTES = int(
    os.getenv("RISK_DANGER_REPEAT_MINUTES", "5")
)
RISK_DANGER_TO_CAUTION_MINUTES = int(
    os.getenv("RISK_DANGER_TO_CAUTION_MINUTES", "10")
)


def send_push_to_user(
    db: Session,
    *,
    user_type: str,
    user_id: int,
    title: str,
    body: str,
    data: dict,
):
    tokens = (
        db.query(models.DeviceToken)
        .filter(
            models.DeviceToken.user_type == user_type,
            models.DeviceToken.user_id == user_id,
        )
        .all()
    )

    for device in tokens:
        try:
            send_push_notification(
                token=device.token,
                title=title,
                body=body,
                data={
                    key: str(value)
                    for key, value in data.items()
                },
            )
        except Exception as error:
            print(
                "[FCM] Push failed "
                f"user_type={user_type}, "
                f"user_id={user_id}: {error}"
            )


def get_guardian_ids_for_subject(
    db: Session,
    subject_id: int,
) -> list[int]:
    return [
        link.guardian_id
        for link in (
            db.query(models.GuardianRegistration)
            .filter(
                models.GuardianRegistration.subject_id
                == subject_id
            )
            .all()
        )
    ]


def get_manager_ids_for_subject(
    db: Session,
    subject_id: int,
) -> list[int]:
    return [
        assignment.manager_id
        for assignment in (
            db.query(models.ManagerAssignment)
            .filter(
                models.ManagerAssignment.subject_id
                == subject_id
            )
            .all()
        )
    ]


def get_nearby_facilities_for_alert(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    limit: int = 3,
) -> list[dict]:
    facilities = []

    for institution in (
        db.query(models.Institution)
        .filter(
            models.Institution.latitude.isnot(None),
            models.Institution.longitude.isnot(None),
        )
        .all()
    ):
        distance = haversine_km(
            latitude,
            longitude,
            institution.latitude,
            institution.longitude,
        )
        facilities.append(
            {
                "name": institution.name,
                "distance_km": round(distance, 2),
                "address": institution.address,
                "phone": institution.phone,
            }
        )

    facilities.sort(
        key=lambda item: item["distance_km"]
    )
    return facilities[:limit]


def format_nearby_facilities(
    facilities: list[dict],
) -> str:
    if not facilities:
        return "인근 시설 정보 없음"

    return " / ".join(
        (
            f"{facility['name']} "
            f"({facility['distance_km']}km, "
            f"{facility.get('address') or '주소 없음'}, "
            f"{facility.get('phone') or '전화번호 없음'})"
        )
        for facility in facilities
    )


def notify_risk_transition(
    db: Session,
    *,
    subject: models.Subject,
    alert_type: str,
    risk_level: str,
    risk_score: float,
    message: str,
    notify_guardians: bool,
    notify_subject: bool,
    notify_managers: bool,
    nearby_facilities: list[dict] | None = None,
):
    guardian_ids = (
        get_guardian_ids_for_subject(db, subject.id)
        if notify_guardians
        else []
    )
    manager_ids = (
        get_manager_ids_for_subject(db, subject.id)
        if notify_managers
        else []
    )

    if notify_guardians:
        for guardian_id in guardian_ids:
            db.add(
                models.Alert(
                    type=alert_type,
                    subject_id=subject.id,
                    guardian_id=guardian_id,
                    message=message,
                    risk_score=risk_score,
                    is_read=False,
                )
            )

    db.commit()

    push_data = {
        "type": alert_type,
        "subject_id": subject.id,
        "risk_level": risk_level,
        "risk_score": risk_score,
    }
    if nearby_facilities is not None:
        push_data["nearby_facilities"] = json.dumps(
            nearby_facilities,
            ensure_ascii=False,
        )

    for guardian_id in guardian_ids:
        send_push_to_user(
            db,
            user_type="guardian",
            user_id=guardian_id,
            title="안심하랑께 위험도 알림",
            body=message,
            data=push_data,
        )

    if notify_subject:
        send_push_to_user(
            db,
            user_type="subject",
            user_id=subject.id,
            title="안심하랑께 위험도 알림",
            body=message,
            data=push_data,
        )

    for manager_id in manager_ids:
        send_push_to_user(
            db,
            user_type="institution_manager",
            user_id=manager_id,
            title="안심하랑께 기관 위험 알림",
            body=message,
            data=push_data,
        )


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
        .filter(
            models.Subject.auth_code == auth_code
        )
        .first()
        is not None
    )

    guardian_exists = (
        db.query(models.Guardian)
        .filter(
            models.Guardian.auth_code == auth_code
        )
        .first()
        is not None
    )

    subject_auth_code_exists = (
        db.query(models.SubjectAuthCode)
        .filter(
            models.SubjectAuthCode.code == auth_code
        )
        .first()
        is not None
    )

    return (
        subject_exists
        or guardian_exists
        or subject_auth_code_exists
    )

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

    existing_manager = (
        db.query(models.InstitutionManager)
        .filter(
            (models.InstitutionManager.login_id == manager_data.login_id.strip())
            | (models.InstitutionManager.email == manager_data.email.strip().lower())
        )
        .first()
    )
    if existing_manager:
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디 또는 이메일입니다.")

    manager = models.InstitutionManager(
        institution_id=manager_data.institution_id,
        name=manager_data.name.strip(),
        phone=manager_data.phone.strip(),
        email=manager_data.email.strip().lower(),
        login_id=manager_data.login_id.strip(),
        password_hash=hash_password(manager_data.password),
        position=manager_data.position,
    )
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
    institution = db.get(models.Institution, data.institution_id)
    if not institution:
        raise HTTPException(status_code=404, detail="기관을 찾을 수 없습니다.")

    login_id = data.login_id.strip()
    email = data.email.strip().lower()

    if db.query(models.InstitutionManager).filter(
        models.InstitutionManager.login_id == login_id
    ).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다.")

    if db.query(models.InstitutionManager).filter(
        models.InstitutionManager.email == email
    ).first():
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")

    manager = models.InstitutionManager(
        institution_id=data.institution_id,
        name=data.name.strip(),
        phone=data.phone.strip(),
        email=email,
        login_id=login_id,
        password_hash=hash_password(data.password),
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
    manager = db.query(models.InstitutionManager).filter(
        models.InstitutionManager.login_id == data.login_id.strip()
    ).first()

    if not manager or not verify_password(data.password, manager.password_hash):
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
    code = generate_unique_auth_code(db)

    # 기존 응답 형식과 DB 호환성을 위해 만료 예정 시각은 저장하지만,
    # 인증코드 검증 시에는 만료 여부를 확인하지 않는다.
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
            f"인증코드: {code}"
        ),
    )

    db.commit()

    db.refresh(auth_code)

    for alert in created_alerts:
        db.refresh(alert)

    return {
        "subject_id": subject_id,
        "auth_code": code,
        "expires_at": expires_at.astimezone(ZoneInfo("Asia/Seoul")),
        "created_alert_ids": [
            alert.id
            for alert in created_alerts
        ],
    }

@app.post(
    "/guardians/{guardian_id}/auth-code",
    response_model=schemas.GuardianAuthCodeResponse,
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

    subject_auth_code = (
        db.query(models.SubjectAuthCode)
        .filter(
            models.SubjectAuthCode.code == auth_code,
        )
        .order_by(
            models.SubjectAuthCode.created_at.desc()
        )
        .first()
    )

    if subject_auth_code is not None:
        return {
            "valid": True,
            "user_type": "subject",
            "user_id": subject_auth_code.subject_id,
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

@app.post(
    "/risk-status",
    response_model=schemas.RiskStatusResponse,
    tags=["위험도"],
)
def create_risk_status(
    data: schemas.RiskStatusCreate,
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

    allowed_levels = {
        "safe",
        "caution",
        "danger",
    }

    if data.risk_level not in allowed_levels:
        raise HTTPException(
            status_code=400,
            detail="risk_level은 safe, caution, danger 중 하나여야 합니다.",
        )

    risk_status = models.RiskStatusHistory(
        subject_id=data.subject_id,
        risk_level=data.risk_level,
        risk_score=data.risk_score,
        lmtad_score=data.lmtad_score,
        weather_score=data.weather_score,
        air_score=data.air_score,
    )

    db.add(risk_status)
    db.commit()
    db.refresh(risk_status)

    return risk_status

@app.get(
    "/subjects/{subject_id}/risk-status",
    response_model=schemas.RiskStatusResponse,
    tags=["위험도"],
)
def get_current_risk_status(
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

    risk_status = (
        db.query(models.RiskStatusHistory)
        .filter(
            models.RiskStatusHistory.subject_id
            == subject_id
        )
        .order_by(
            models.RiskStatusHistory.created_at.desc(),
            models.RiskStatusHistory.id.desc(),
        )
        .first()
    )

    if not risk_status:
        raise HTTPException(
            status_code=404,
            detail="위험도 기록이 없습니다.",
        )

    return risk_status

@app.get(
    "/subjects/{subject_id}/risk-history",
    response_model=list[schemas.RiskStatusResponse],
    tags=["위험도"],
)
def get_risk_history(
    subject_id: int,
    limit: int = 50,
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

    history = (
        db.query(models.RiskStatusHistory)
        .filter(
            models.RiskStatusHistory.subject_id
            == subject_id
        )
        .order_by(
            models.RiskStatusHistory.created_at.desc(),
            models.RiskStatusHistory.id.desc(),
        )
        .limit(limit)
        .all()
    )

    return history

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

@app.patch(
    "/alerts/{alert_id}/read",
    response_model=schemas.AlertResponse,
    tags=["알림"],
)
def mark_alert_as_read(
    alert_id: int,
    db: Session = Depends(get_db),
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

def generate_sms_code() -> str:
    return f"{secrets.randbelow(1000000):06d}"

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
    elif data.user_type == "subject":
        user = db.get(
            models.Subject,
            data.user_id,
        )
    else:
        user = db.get(
            models.InstitutionManager,
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

def calculate_integrated_risk(
    lmtad_score: float,
    weather_score: float,
    air_score: float,
):
    # 임시 가중치
    lmtad_weight = 0.60
    weather_weight = 0.25
    air_weight = 0.15

    final_score = (
        lmtad_score * lmtad_weight
        + weather_score * weather_weight
        + air_score * air_weight
    )

    final_score = max(
        0.0,
        min(100.0, final_score),
    )

    if final_score >= 70:
        risk_level = "danger"

    elif final_score >= 40:
        risk_level = "caution"

    else:
        risk_level = "safe"

    return round(final_score, 2), risk_level

# =========================================================
# GPS AI 추론
# =========================================================
@app.post(
    "/subjects/{subject_id}/integrated-risk",
    response_model=schemas.RiskStatusResponse,
    tags=["위험도"],
)
def calculate_subject_integrated_risk(
    subject_id: int,
    lmtad_score: float = Query(ge=0, le=100),
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

    # 최신 GPS 조회
    latest_gps = (
        db.query(models.GPSRecord)
        .filter(
            models.GPSRecord.subject_id
            == subject_id
        )
        .order_by(
            models.GPSRecord.measured_at.desc(),
            models.GPSRecord.gps_id.desc(),
        )
        .first()
    )

    if not latest_gps:
        raise HTTPException(
            status_code=404,
            detail="GPS 기록이 없습니다.",
        )

    latitude = latest_gps.latitude
    longitude = latest_gps.longitude

    # 기상 조회
    weather_data = get_weather_by_gps(
        latitude,
        longitude,
    )

    weather_score = weather_data.get(
        "weather_risk_score"
    )

    # 대기 조회
    air_data = get_air_quality_by_gps(
        latitude,
        longitude,
    )

    air_quality = air_data.get(
        "air_quality",
        {},
    )

    air_score = air_quality.get(
        "air_risk_score"
    )

    # 외부 API 데이터가 없으면 계산 불가
    if weather_score is None:
        raise HTTPException(
            status_code=503,
            detail="기상 위험점수를 불러올 수 없습니다.",
        )

    if air_score is None:
        raise HTTPException(
            status_code=503,
            detail="대기 위험점수를 불러올 수 없습니다.",
        )

    # 통합 위험도 계산
    final_score, risk_level = (
        calculate_integrated_risk(
            lmtad_score=lmtad_score,
            weather_score=weather_score,
            air_score=air_score,
        )
    )

    # 직전 상태를 먼저 조회해 단계 변화를 판단합니다.
    previous_status = (
        db.query(models.RiskStatusHistory)
        .filter(
            models.RiskStatusHistory.subject_id
            == subject_id
        )
        .order_by(
            models.RiskStatusHistory.created_at.desc(),
            models.RiskStatusHistory.id.desc(),
        )
        .first()
    )
    previous_level = (
        previous_status.risk_level
        if previous_status
        else None
    )

    # DB 이력 저장
    risk_status = models.RiskStatusHistory(
        subject_id=subject_id,
        risk_level=risk_level,
        risk_score=final_score,
        lmtad_score=lmtad_score,
        weather_score=weather_score,
        air_score=air_score,
    )

    db.add(risk_status)
    db.commit()
    db.refresh(risk_status)

    now = datetime.now(timezone.utc)

    if risk_level == "safe":
        if previous_level in {"caution", "danger"}:
            notify_risk_transition(
                db,
                subject=subject,
                alert_type="risk_recovered_safe",
                risk_level=risk_level,
                risk_score=final_score,
                message=(
                    f"{subject.name}님의 위험 단계가 "
                    "안전으로 변경되었습니다."
                ),
                notify_guardians=True,
                notify_subject=False,
                notify_managers=False,
            )

    elif risk_level == "caution":
        if previous_level in {None, "safe"}:
            notify_risk_transition(
                db,
                subject=subject,
                alert_type="risk_caution",
                risk_level=risk_level,
                risk_score=final_score,
                message=(
                    f"{subject.name}님이 주의 단계에 "
                    f"진입했습니다. (위험 점수: {final_score:g})"
                ),
                notify_guardians=True,
                notify_subject=True,
                notify_managers=False,
            )

        elif previous_level == "caution":
            last_non_caution = (
                db.query(models.RiskStatusHistory)
                .filter(
                    models.RiskStatusHistory.subject_id
                    == subject_id,
                    models.RiskStatusHistory.risk_level
                    != "caution",
                )
                .order_by(
                    models.RiskStatusHistory.created_at.desc(),
                    models.RiskStatusHistory.id.desc(),
                )
                .first()
            )

            if (
                last_non_caution
                and last_non_caution.risk_level == "danger"
                and last_non_caution.created_at
                <= now
                - timedelta(
                    minutes=RISK_DANGER_TO_CAUTION_MINUTES
                )
            ):
                already_notified = (
                    db.query(models.Alert)
                    .filter(
                        models.Alert.subject_id == subject_id,
                        models.Alert.type
                        == "risk_danger_to_caution",
                        models.Alert.created_at
                        >= last_non_caution.created_at,
                    )
                    .first()
                )

                if not already_notified:
                    notify_risk_transition(
                        db,
                        subject=subject,
                        alert_type="risk_danger_to_caution",
                        risk_level=risk_level,
                        risk_score=final_score,
                        message=(
                            f"{subject.name}님의 위험 단계가 "
                            f"{RISK_DANGER_TO_CAUTION_MINUTES}분 동안 "
                            "주의로 유지되어 단계가 완화되었습니다."
                        ),
                        notify_guardians=True,
                        notify_subject=False,
                        notify_managers=False,
                    )

    else:
        repeat_cutoff = now - timedelta(
            minutes=RISK_DANGER_REPEAT_MINUTES
        )
        recent_danger_alert = (
            db.query(models.Alert)
            .filter(
                models.Alert.subject_id == subject_id,
                models.Alert.type == "risk_danger",
                models.Alert.created_at >= repeat_cutoff,
            )
            .first()
        )

        if previous_level != "danger" or not recent_danger_alert:
            nearby_facilities = (
                get_nearby_facilities_for_alert(
                    db,
                    latitude=latitude,
                    longitude=longitude,
                )
            )
            facility_text = format_nearby_facilities(
                nearby_facilities
            )

            notify_risk_transition(
                db,
                subject=subject,
                alert_type="risk_danger",
                risk_level=risk_level,
                risk_score=final_score,
                message=(
                    f"{subject.name}님이 위험 단계에 "
                    f"진입했습니다. (위험 점수: {final_score:g}) "
                    f"인근 시설: {facility_text}"
                ),
                notify_guardians=True,
                notify_subject=True,
                notify_managers=True,
                nearby_facilities=nearby_facilities,
            )

    return risk_status

# GPS inference
@app.post(
    "/subjects/{subject_id}/gps-inference",
    response_model=schemas.GPSInferenceResponse,
    tags=["AI"],
)
def infer_subject_gps(
    subject_id: int,
    target_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_db),
):
    if lmtad_runtime is None:
        raise HTTPException(
            status_code=503,
            detail="LMTAD 모델이 로드되지 않았습니다.",
        )

    try:
        result = run_gps_inference(
            db=db,
            runtime=lmtad_runtime,
            subject_id=subject_id,
            target_date=target_date,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        )

    result["risk_level"] = (
        "danger"
        if result.pop("is_anomaly")
        else "safe"
    )

    return result


# =========================================================
# 위험도 상세 분석 조회
# GPS 이탈 + 기상 + 대기
# =========================================================
@app.get(
    "/subjects/{subject_id}/risk-analysis",
    response_model=schemas.RiskAnalysisResponse,
    tags=["위험도"],
)
def get_risk_analysis(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="보호대상자를 찾을 수 없습니다.",
        )

    risk_status = (
        db.query(models.RiskStatusHistory)
        .filter(
            models.RiskStatusHistory.subject_id == subject_id
        )
        .order_by(
            models.RiskStatusHistory.created_at.desc(),
            models.RiskStatusHistory.id.desc(),
        )
        .first()
    )

    if not risk_status:
        raise HTTPException(
            status_code=404,
            detail="위험도 기록이 없습니다.",
        )

    gps_score = float(risk_status.lmtad_score or 0)
    weather_score = float(risk_status.weather_score or 0)
    air_score = float(risk_status.air_score or 0)

    factor_total = (
        gps_score
        + weather_score
        + air_score
    )

    total_score = float(
        risk_status.risk_score
        if risk_status.risk_score is not None
        else factor_total
    )

    def percentage(score: float) -> int:
        if factor_total <= 0:
            return 0

        return round(
            score / factor_total * 100
        )

    # -----------------------------------------------------
    # GPS 설명
    # -----------------------------------------------------
    if gps_score >= 80:
        gps_description = (
            "평소 이동 패턴과 크게 다른 경로가 감지되었습니다. "
            f"GPS 이동 이상 점수가 {gps_score:g}점으로 매우 높습니다."
        )
    elif gps_score >= 50:
        gps_description = (
            "평소 이동 패턴과 다른 이동이 감지되었습니다. "
            f"GPS 이동 이상 점수가 {gps_score:g}점으로 주의가 필요합니다."
        )
    elif gps_score > 0:
        gps_description = (
            "평소 경로와 일부 다른 이동이 감지되었습니다. "
            f"GPS 이동 이상 점수는 {gps_score:g}점입니다."
        )
    else:
        gps_description = (
            "현재 GPS 이동 패턴에서 특이사항이 감지되지 않았습니다."
        )

    # -----------------------------------------------------
    # 최신 GPS 위치 기준 실제 환경정보 조회
    # -----------------------------------------------------
    weather_data = None
    air_data = None

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

    if latest_gps:
        try:
            weather_data = get_weather_by_gps(
                latest_gps.latitude,
                latest_gps.longitude,
            )
        except Exception as exc:
            print(
                "[RISK ANALYSIS] weather lookup failed:",
                exc,
            )

        try:
            air_data = get_air_quality_by_gps(
                latest_gps.latitude,
                latest_gps.longitude,
            )
        except Exception as exc:
            print(
                "[RISK ANALYSIS] air lookup failed:",
                exc,
            )

    # -----------------------------------------------------
    # 기상 설명
    # -----------------------------------------------------
    weather_reasons = []

    if weather_data:
        temperature = weather_data.get("temperature")
        apparent_temperature = weather_data.get(
            "apparent_temperature"
        )
        rainfall = weather_data.get("rainfall_1h")
        wind_speed = weather_data.get("wind_speed")
        precipitation_type = weather_data.get(
            "precipitation_type"
        )

        warning = weather_data.get(
            "weather_warning"
        ) or {}

        warning_level = warning.get(
            "highest_level"
        )

        if warning_level:
            weather_reasons.append(
                f"현재 지역에 {warning_level} 단계의 "
                "기상특보가 적용되어 있습니다."
            )

        try:
            apparent = float(apparent_temperature)
        except (TypeError, ValueError):
            apparent = None

        try:
            temp = float(temperature)
        except (TypeError, ValueError):
            temp = None

        try:
            rain = float(rainfall)
        except (TypeError, ValueError):
            rain = 0.0

        try:
            wind = float(wind_speed)
        except (TypeError, ValueError):
            wind = 0.0

        if apparent is not None:
            if apparent >= 35:
                weather_reasons.append(
                    f"체감온도가 {apparent:g}℃로 매우 높아 "
                    "폭염 위험이 있습니다."
                )
            elif apparent >= 30:
                weather_reasons.append(
                    f"체감온도가 {apparent:g}℃로 높아 "
                    "장시간 야외 활동에 주의가 필요합니다."
                )
            elif apparent <= -5:
                weather_reasons.append(
                    f"체감온도가 {apparent:g}℃로 낮아 "
                    "한랭 위험이 있습니다."
                )
        elif temp is not None:
            weather_reasons.append(
                f"현재 기온은 {temp:g}℃입니다."
            )

        if rain >= 30:
            weather_reasons.append(
                f"최근 1시간 강수량이 {rain:g}mm로 "
                "매우 강한 비가 내리고 있습니다."
            )
        elif rain >= 15:
            weather_reasons.append(
                f"최근 1시간 강수량이 {rain:g}mm로 "
                "강한 비가 내리고 있습니다."
            )
        elif rain >= 5:
            weather_reasons.append(
                f"최근 1시간 강수량이 {rain:g}mm로 "
                "보행 시 미끄럼에 주의가 필요합니다."
            )

        precipitation_names = {
            "1": "비",
            "2": "비 또는 눈",
            "3": "눈",
            "5": "빗방울",
            "6": "빗방울 또는 눈날림",
            "7": "눈날림",
        }

        pty_name = precipitation_names.get(
            str(precipitation_type)
        )

        if pty_name and rain <= 0:
            weather_reasons.append(
                f"현재 {pty_name}가 관측되고 있어 "
                "이동 시 주의가 필요합니다."
            )

        if wind >= 15:
            weather_reasons.append(
                f"풍속이 {wind:g}m/s로 매우 강해 "
                "보행 안전에 주의가 필요합니다."
            )
        elif wind >= 10:
            weather_reasons.append(
                f"풍속이 {wind:g}m/s로 강한 편입니다."
            )

    if weather_score <= 0 and not weather_reasons:
        weather_description = (
            "현재 위치에서는 기상으로 인한 "
            "추가 위험이 감지되지 않았습니다."
        )
    elif weather_reasons:
        weather_description = " ".join(
            weather_reasons[:3]
        )
    else:
        weather_description = (
            f"기상 위험 점수가 {weather_score:g}점으로 "
            "현재 기상 상황에 주의가 필요합니다."
        )

    # -----------------------------------------------------
    # 대기질 설명
    # -----------------------------------------------------
    air_reasons = []

    if air_data:
        quality = air_data.get(
            "air_quality"
        ) or {}

        pm10 = quality.get("pm10")
        pm25 = quality.get("pm25")
        o3 = quality.get("o3")
        khai = quality.get("khai")
        station = quality.get("station_name")

        def to_float(value):
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        pm10_value = to_float(pm10)
        pm25_value = to_float(pm25)
        o3_value = to_float(o3)

        if pm10_value is not None:
            if pm10_value > 150:
                air_reasons.append(
                    f"미세먼지(PM10)가 {pm10_value:g}㎍/㎥로 "
                    "매우 나쁨 수준입니다."
                )
            elif pm10_value > 80:
                air_reasons.append(
                    f"미세먼지(PM10)가 {pm10_value:g}㎍/㎥로 "
                    "나쁨 수준입니다."
                )

        if pm25_value is not None:
            if pm25_value > 75:
                air_reasons.append(
                    f"초미세먼지(PM2.5)가 {pm25_value:g}㎍/㎥로 "
                    "매우 나쁨 수준입니다."
                )
            elif pm25_value > 35:
                air_reasons.append(
                    f"초미세먼지(PM2.5)가 {pm25_value:g}㎍/㎥로 "
                    "나쁨 수준입니다."
                )

        if o3_value is not None:
            if o3_value > 0.15:
                air_reasons.append(
                    f"오존 농도가 {o3_value:g}ppm으로 높아 "
                    "야외 활동에 주의가 필요합니다."
                )
            elif o3_value > 0.09:
                air_reasons.append(
                    f"오존 농도가 {o3_value:g}ppm으로 "
                    "주의가 필요한 수준입니다."
                )

        if not air_reasons and khai is not None:
            air_reasons.append(
                f"통합대기환경지수(KHAI)는 {khai}입니다."
            )

        if station and air_reasons:
            air_reasons.append(
                f"{station} 측정소의 최신 관측값을 기준으로 분석했습니다."
            )

    if air_score <= 0 and not air_reasons:
        air_description = (
            "현재 위치에서는 대기질로 인한 "
            "추가 위험이 감지되지 않았습니다."
        )
    elif air_reasons:
        air_description = " ".join(
            air_reasons[:3]
        )
    else:
        air_description = (
            f"대기 위험 점수가 {air_score:g}점으로 "
            "외부 활동 시 주의가 필요합니다."
        )

    factors = [
        {
            "type": "gps_deviation",
            "name": "GPS 이탈",
            "score": gps_score,
            "percentage": percentage(
                gps_score
            ),
            "description": gps_description,
        },
        {
            "type": "weather",
            "name": "기상",
            "score": weather_score,
            "percentage": percentage(
                weather_score
            ),
            "description": weather_description,
        },
        {
            "type": "air",
            "name": "대기",
            "score": air_score,
            "percentage": percentage(
                air_score
            ),
            "description": air_description,
        },
    ]

    return {
        "subject_id": subject_id,
        "total_score": total_score,
        "risk_level": risk_status.risk_level,
        "measured_at": risk_status.created_at,
        "factors": factors,
    }
