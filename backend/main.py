from math import asin, cos, radians, sin, sqrt

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db
from facility_api import fetch_facilities, request_raw_xml


# models.py에 정의된 테이블 생성
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="안심하랑께 백엔드",
    version="1.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# 공통 함수
# =========================================================

def haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """두 위도·경도 사이의 거리를 km 단위로 계산한다."""

    earth_radius = 6371.0

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    value = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    return earth_radius * 2 * asin(sqrt(value))


# =========================================================
# 기본 서버 확인
# =========================================================

@app.get("/")
def root():
    return {
        "message": "서버 작동 중",
        "docs": "/docs",
        "gps_page": "/gps-current",
    }


# =========================================================
# 공공데이터 API 원본 확인
# =========================================================

@app.get("/facilities/raw")
async def facilities_raw():
    """공공데이터 API 원본 응답과 XML 태그 확인용."""

    try:
        body, content_type = await request_raw_xml(
            page_index=1,
            page_size=10,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return {
        "content_type": content_type,
        "body": body[:10000],
    }


# =========================================================
# 1. 보호 대상자 등록·조회·수정·삭제
# =========================================================

@app.post(
    "/subjects",
    response_model=schemas.SubjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subject(
    data: schemas.SubjectCreate,
    db: Session = Depends(get_db),
):
    subject = models.Subject(**data.model_dump())

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return subject


@app.get(
    "/subjects",
    response_model=list[schemas.SubjectResponse],
)
def list_subjects(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(models.Subject).order_by(models.Subject.id)
    ).all()


@app.get(
    "/subjects/{subject_id}",
    response_model=schemas.SubjectResponse,
)
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    return subject


@app.patch(
    "/subjects/{subject_id}",
    response_model=schemas.SubjectResponse,
)
def update_subject(
    subject_id: int,
    data: schemas.SubjectUpdate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보를 하나 이상 입력해주세요.",
        )

    for field, value in update_data.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)

    return subject


@app.delete(
    "/subjects/{subject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    # 보호 대상자의 GPS 기록 삭제
    db.execute(
        delete(models.GPSRecord).where(
            models.GPSRecord.subject_id == subject_id
        )
    )

    # 보호 대상자와 보호자의 연결 관계 삭제
    db.execute(
        delete(models.SubjectGuardian).where(
            models.SubjectGuardian.subject_id == subject_id
        )
    )

    # 보호 대상자 삭제
    db.delete(subject)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================
# 2. 보호자 등록·조회·수정·삭제
# =========================================================

@app.post(
    "/guardians",
    response_model=schemas.GuardianResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_guardian(
    data: schemas.GuardianCreate,
    db: Session = Depends(get_db),
):
    guardian = models.Guardian(**data.model_dump())

    db.add(guardian)

    try:
        db.commit()
        db.refresh(guardian)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 보호자 연락처입니다.",
        )

    return guardian


@app.get(
    "/guardians",
    response_model=list[schemas.GuardianResponse],
)
def list_guardians(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(models.Guardian).order_by(models.Guardian.id)
    ).all()


@app.get(
    "/guardians/{guardian_id}",
    response_model=schemas.GuardianResponse,
)
def get_guardian(
    guardian_id: int,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, guardian_id)

    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호자가 없습니다.",
        )

    return guardian


@app.patch(
    "/guardians/{guardian_id}",
    response_model=schemas.GuardianResponse,
)
def update_guardian(
    guardian_id: int,
    data: schemas.GuardianUpdate,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, guardian_id)

    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호자가 없습니다.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보를 하나 이상 입력해주세요.",
        )

    for field, value in update_data.items():
        setattr(guardian, field, value)

    try:
        db.commit()
        db.refresh(guardian)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 등록된 보호자 연락처입니다.",
        )

    return guardian


@app.delete(
    "/guardians/{guardian_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_guardian(
    guardian_id: int,
    db: Session = Depends(get_db),
):
    guardian = db.get(models.Guardian, guardian_id)

    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호자가 없습니다.",
        )

    # 보호자와 보호 대상자의 연결 관계만 삭제
    db.execute(
        delete(models.SubjectGuardian).where(
            models.SubjectGuardian.guardian_id == guardian_id
        )
    )

    db.delete(guardian)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================
# 3. 보호 대상자와 보호자 연결·조회·수정·삭제
# =========================================================

@app.post(
    "/subject-guardians",
    response_model=schemas.LinkResponse,
    status_code=status.HTTP_201_CREATED,
)
def connect_subject_guardian(
    data: schemas.LinkCreate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, data.subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    guardian = db.get(models.Guardian, data.guardian_id)

    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호자가 없습니다.",
        )

    link = models.SubjectGuardian(**data.model_dump())

    db.add(link)

    try:
        db.commit()
        db.refresh(link)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 연결된 관계입니다.",
        )

    return link


@app.get(
    "/subject-guardians",
    response_model=list[schemas.LinkResponse],
)
def list_links(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(models.SubjectGuardian).order_by(
            models.SubjectGuardian.id
        )
    ).all()


@app.get(
    "/subject-guardians/{link_id}",
    response_model=schemas.LinkResponse,
)
def get_subject_guardian_link(
    link_id: int,
    db: Session = Depends(get_db),
):
    link = db.get(models.SubjectGuardian, link_id)

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결 관계가 없습니다.",
        )

    return link


@app.patch(
    "/subject-guardians/{link_id}",
    response_model=schemas.LinkResponse,
)
def update_subject_guardian_link(
    link_id: int,
    data: schemas.LinkUpdate,
    db: Session = Depends(get_db),
):
    link = db.get(models.SubjectGuardian, link_id)

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결 관계가 없습니다.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보를 하나 이상 입력해주세요.",
        )

    if "subject_id" in update_data:
        subject = db.get(
            models.Subject,
            update_data["subject_id"],
        )

        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="변경할 보호 대상자가 없습니다.",
            )

    if "guardian_id" in update_data:
        guardian = db.get(
            models.Guardian,
            update_data["guardian_id"],
        )

        if guardian is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="변경할 보호자가 없습니다.",
            )

    for field, value in update_data.items():
        setattr(link, field, value)

    try:
        db.commit()
        db.refresh(link)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 연결된 관계입니다.",
        )

    return link


@app.delete(
    "/subject-guardians/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subject_guardian_link(
    link_id: int,
    db: Session = Depends(get_db),
):
    link = db.get(models.SubjectGuardian, link_id)

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결 관계가 없습니다.",
        )

    db.delete(link)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================
# 4. GPS 저장·조회·수정·삭제
# =========================================================

@app.post(
    "/gps-records",
    response_model=schemas.GPSResponse,
    status_code=status.HTTP_201_CREATED,
)
def save_gps(
    data: schemas.GPSCreate,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, data.subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    record = models.GPSRecord(**data.model_dump())

    db.add(record)
    db.commit()
    db.refresh(record)

    return record


@app.get(
    "/gps-records",
    response_model=list[schemas.GPSResponse],
)
def list_gps_records(
    subject_id: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    query = select(models.GPSRecord)

    if subject_id is not None:
        query = query.where(
            models.GPSRecord.subject_id == subject_id
        )

    query = query.order_by(
        models.GPSRecord.measured_at.desc()
    )

    return db.scalars(query).all()


@app.get(
    "/gps-records/{gps_id}",
    response_model=schemas.GPSResponse,
)
def get_gps_record(
    gps_id: int,
    db: Session = Depends(get_db),
):
    record = db.get(models.GPSRecord, gps_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GPS 기록이 없습니다.",
        )

    return record


@app.patch(
    "/gps-records/{gps_id}",
    response_model=schemas.GPSResponse,
)
def update_gps_record(
    gps_id: int,
    data: schemas.GPSUpdate,
    db: Session = Depends(get_db),
):
    record = db.get(models.GPSRecord, gps_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GPS 기록이 없습니다.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수정할 정보를 하나 이상 입력해주세요.",
        )

    if "subject_id" in update_data:
        subject = db.get(
            models.Subject,
            update_data["subject_id"],
        )

        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="변경할 보호 대상자가 없습니다.",
            )

    for field, value in update_data.items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)

    return record


@app.delete(
    "/gps-records/{gps_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_gps_record(
    gps_id: int,
    db: Session = Depends(get_db),
):
    record = db.get(models.GPSRecord, gps_id)

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GPS 기록이 없습니다.",
        )

    db.delete(record)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.delete("/subjects/{subject_id}/gps-records")
def delete_subject_gps_records(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    result = db.execute(
        delete(models.GPSRecord).where(
            models.GPSRecord.subject_id == subject_id
        )
    )

    db.commit()

    return {
        "message": "해당 보호 대상자의 GPS 기록을 모두 삭제했습니다.",
        "subject_id": subject_id,
        "deleted_count": result.rowcount,
    }


@app.get(
    "/subjects/{subject_id}/latest-location",
    response_model=schemas.GPSResponse,
)
def latest_location(
    subject_id: int,
    db: Session = Depends(get_db),
):
    subject = db.get(models.Subject, subject_id)

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="보호 대상자가 없습니다.",
        )

    record = db.scalar(
        select(models.GPSRecord)
        .where(
            models.GPSRecord.subject_id == subject_id
        )
        .order_by(
            models.GPSRecord.measured_at.desc()
        )
        .limit(1)
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="저장된 GPS 위치가 없습니다.",
        )

    return record


# =========================================================
# 브라우저에서 현재 위치 가져와 GPS 저장
# =========================================================

@app.get(
    "/gps-current",
    response_class=HTMLResponse,
)
def gps_current_page():
    return """
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>현재 위치 저장</title>

    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
        }

        input,
        button {
            width: 100%;
            box-sizing: border-box;
            padding: 12px;
            margin-top: 10px;
            font-size: 16px;
        }

        button {
            cursor: pointer;
        }

        pre {
            background: #f3f3f3;
            padding: 15px;
            white-space: pre-wrap;
            border-radius: 8px;
        }
    </style>
</head>

<body>
    <h2>현재 위치 자동 저장</h2>

    <input
        id="subjectId"
        type="number"
        min="1"
        value="1"
        placeholder="보호 대상자 ID"
    >

    <button onclick="saveLocation()">
        현재 위치 가져와서 저장
    </button>

    <pre id="result">대기 중</pre>

    <script>
        function saveLocation() {
            const result = document.getElementById("result");
            const subjectId = Number(
                document.getElementById("subjectId").value
            );

            if (!subjectId) {
                result.textContent =
                    "보호 대상자 ID를 입력하세요.";
                return;
            }

            if (!navigator.geolocation) {
                result.textContent =
                    "이 브라우저는 GPS를 지원하지 않습니다.";
                return;
            }

            result.textContent = "현재 위치 확인 중...";

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const response = await fetch(
                            "/gps-records",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    subject_id: subjectId,
                                    latitude:
                                        position.coords.latitude,
                                    longitude:
                                        position.coords.longitude
                                })
                            }
                        );

                        const data = await response.json();

                        result.textContent = response.ok
                            ? "저장 성공\\n"
                                + JSON.stringify(data, null, 2)
                            : "저장 실패\\n"
                                + JSON.stringify(data, null, 2);

                    } catch (error) {
                        result.textContent =
                            "서버 요청 오류: " + error.message;
                    }
                },

                (error) => {
                    result.textContent =
                        "위치 권한 또는 GPS 오류: "
                        + error.message;
                },

                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        }
    </script>
</body>
</html>
"""


# =========================================================
# 5. 전라남도 복지시설 동기화·조회
# =========================================================

@app.post("/facilities/sync")
async def sync_facilities(
    db: Session = Depends(get_db),
):
    try:
        api_items = await fetch_facilities()

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    created = 0
    updated = 0

    for data in api_items:
        facility = db.scalar(
            select(models.Facility).where(
                models.Facility.external_id
                == data["external_id"]
            )
        )

        if facility is None:
            db.add(models.Facility(**data))
            created += 1

        else:
            facility.name = data["name"]
            facility.address = data["address"]
            facility.latitude = data["latitude"]
            facility.longitude = data["longitude"]
            updated += 1

    db.commit()

    return {
        "received": len(api_items),
        "created": created,
        "updated": updated,
    }


@app.get(
    "/facilities",
    response_model=list[schemas.FacilityResponse],
)
def list_facilities(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(models.Facility).order_by(
            models.Facility.name
        )
    ).all()


@app.get(
    "/facilities/{facility_id}",
    response_model=schemas.FacilityResponse,
)
def get_facility(
    facility_id: int,
    db: Session = Depends(get_db),
):
    facility = db.get(models.Facility, facility_id)

    if facility is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="복지시설이 없습니다.",
        )

    return facility


# =========================================================
# 6. 현재 위치 기준 가까운 복지시설 조회
# =========================================================

@app.get(
    "/facilities/nearby",
    response_model=list[schemas.NearbyFacilityResponse],
)
def nearby_facilities(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(
        default=10,
        gt=0,
        le=100,
    ),
    limit: int = Query(
        default=5,
        ge=1,
        le=50,
    ),
    db: Session = Depends(get_db),
):
    result = []

    facilities = db.scalars(
        select(models.Facility)
    ).all()

    for facility in facilities:
        distance = haversine_km(
            latitude,
            longitude,
            facility.latitude,
            facility.longitude,
        )

        if distance <= radius_km:
            result.append(
                {
                    "id": facility.id,
                    "external_id": facility.external_id,
                    "name": facility.name,
                    "address": facility.address,
                    "latitude": facility.latitude,
                    "longitude": facility.longitude,
                    "distance_km": round(distance, 3),
                }
            )

    result.sort(
        key=lambda item: item["distance_km"]
    )

    return result[:limit]