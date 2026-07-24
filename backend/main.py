from math import asin, cos, radians, sin, sqrt

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db
from facility_api import fetch_facilities, request_raw_xml

Base.metadata.create_all(bind=engine)

app = FastAPI(title="안심하랑께 백엔드", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    value = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    return earth_radius * 2 * asin(sqrt(value))


@app.get("/")
def root():
    return {
        "message": "서버 작동 중",
        "docs": "/docs",
        "gps_page": "/gps-current",
    }




@app.get("/facilities/raw")
async def facilities_raw():
    """공공데이터 API 원본 응답과 XML 태그 확인용."""
    try:
        body, content_type = await request_raw_xml(page_index=1, page_size=10)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {
        "content_type": content_type,
        "body": body[:10000],
    }


# 1. 보호 대상자 등록 및 조회
@app.post("/subjects", response_model=schemas.SubjectResponse, status_code=201)
def create_subject(data: schemas.SubjectCreate, db: Session = Depends(get_db)):
    subject = models.Subject(**data.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@app.get("/subjects", response_model=list[schemas.SubjectResponse])
def list_subjects(db: Session = Depends(get_db)):
    return db.scalars(select(models.Subject).order_by(models.Subject.id)).all()


# 2. 보호자 등록 및 조회
@app.post("/guardians", response_model=schemas.GuardianResponse, status_code=201)
def create_guardian(data: schemas.GuardianCreate, db: Session = Depends(get_db)):
    guardian = models.Guardian(**data.model_dump())
    db.add(guardian)
    try:
        db.commit()
        db.refresh(guardian)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 등록된 보호자 연락처입니다.")
    return guardian


@app.get("/guardians", response_model=list[schemas.GuardianResponse])
def list_guardians(db: Session = Depends(get_db)):
    return db.scalars(select(models.Guardian).order_by(models.Guardian.id)).all()


# 3. 보호 대상자와 보호자 연결
@app.post("/subject-guardians", response_model=schemas.LinkResponse, status_code=201)
def connect_subject_guardian(
    data: schemas.LinkCreate,
    db: Session = Depends(get_db),
):
    if db.get(models.Subject, data.subject_id) is None:
        raise HTTPException(status_code=404, detail="보호 대상자가 없습니다.")
    if db.get(models.Guardian, data.guardian_id) is None:
        raise HTTPException(status_code=404, detail="보호자가 없습니다.")

    link = models.SubjectGuardian(**data.model_dump())
    db.add(link)
    try:
        db.commit()
        db.refresh(link)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="이미 연결된 관계입니다.")
    return link


@app.get("/subject-guardians", response_model=list[schemas.LinkResponse])
def list_links(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.SubjectGuardian).order_by(models.SubjectGuardian.id)
    ).all()


# 4. GPS 저장 및 최신 위치 조회
@app.post("/gps-records", response_model=schemas.GPSResponse, status_code=201)
def save_gps(data: schemas.GPSCreate, db: Session = Depends(get_db)):
    if db.get(models.Subject, data.subject_id) is None:
        raise HTTPException(status_code=404, detail="보호 대상자가 없습니다.")

    record = models.GPSRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get(
    "/subjects/{subject_id}/latest-location",
    response_model=schemas.GPSResponse,
)
def latest_location(subject_id: int, db: Session = Depends(get_db)):
    record = db.scalar(
        select(models.GPSRecord)
        .where(models.GPSRecord.subject_id == subject_id)
        .order_by(models.GPSRecord.measured_at.desc())
        .limit(1)
    )
    if record is None:
        raise HTTPException(status_code=404, detail="저장된 GPS 위치가 없습니다.")
    return record


# 브라우저 GPS를 자동으로 가져와 저장하는 간단한 프론트 페이지
@app.get("/gps-current", response_class=HTMLResponse)
def gps_current_page():
    return '''
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>현재 위치 저장</title>
<style>
body{font-family:Arial,sans-serif;max-width:600px;margin:50px auto;padding:20px}
input,button{width:100%;box-sizing:border-box;padding:12px;margin-top:10px;font-size:16px}
pre{background:#f3f3f3;padding:15px;white-space:pre-wrap}
</style>
</head>
<body>
<h2>현재 위치 자동 저장</h2>
<input id="subjectId" type="number" min="1" value="1" placeholder="보호 대상자 ID">
<button onclick="saveLocation()">현재 위치 가져와서 저장</button>
<pre id="result">대기 중</pre>
<script>
function saveLocation() {
  const result = document.getElementById("result");
  const subjectId = Number(document.getElementById("subjectId").value);

  if (!subjectId) {
    result.textContent = "보호 대상자 ID를 입력하세요.";
    return;
  }

  if (!navigator.geolocation) {
    result.textContent = "이 브라우저는 GPS를 지원하지 않습니다.";
    return;
  }

  result.textContent = "현재 위치 확인 중...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const response = await fetch("/gps-records", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          subject_id: subjectId,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      });

      const data = await response.json();
      result.textContent = response.ok
        ? "저장 성공\n" + JSON.stringify(data, null, 2)
        : "저장 실패\n" + JSON.stringify(data, null, 2);
    },
    (error) => {
      result.textContent = "위치 권한 또는 GPS 오류: " + error.message;
    },
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
  );
}
</script>
</body>
</html>
'''


# 5. 전라남도 복지시설 API 목록 동기화
@app.post("/facilities/sync")
async def sync_facilities(db: Session = Depends(get_db)):
    try:
        api_items = await fetch_facilities()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    created = 0
    updated = 0

    for data in api_items:
        facility = db.scalar(
            select(models.Facility).where(
                models.Facility.external_id == data["external_id"]
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


@app.get("/facilities", response_model=list[schemas.FacilityResponse])
def list_facilities(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Facility).order_by(models.Facility.name)
    ).all()


# 6. 현재 위치 기준 가까운 복지시설 조회
@app.get(
    "/facilities/nearby",
    response_model=list[schemas.NearbyFacilityResponse],
)
def nearby_facilities(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=10, gt=0, le=100),
    limit: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    result = []

    for facility in db.scalars(select(models.Facility)).all():
        distance = haversine_km(
            latitude,
            longitude,
            facility.latitude,
            facility.longitude,
        )

        if distance <= radius_km:
            result.append({
                "id": facility.id,
                "external_id": facility.external_id,
                "name": facility.name,
                "address": facility.address,
                "latitude": facility.latitude,
                "longitude": facility.longitude,
                "distance_km": round(distance, 3),
            })

    result.sort(key=lambda item: item["distance_km"])
    return result[:limit]
