#python libraries
from pyproj import Transformer
import os
from sqlalchemy import text
from zoneinfo import ZoneInfo

#files
# from database import engine
# from database import SessionLocal
# from models import GPSRecord
# from gps_evaluation import score_gps_record
# from load_checkpoint import load_inference_model
from convert_checkpoint import *

from backend.database import engine, SessionLocal
from backend.models import GPSRecord
from backend.lmtad.gps_evaluation import score_gps_record
from backend.lmtad.load_checkpoint import load_inference_model


def check_server():
    #setting parameters
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres.zuubggonagdhdkphxzrq:ansimhackathon@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")

    #server check
    with engine.connect() as connection:
            result = connection.execute(
                text("SELECT current_database(), current_user")
            )
            database_name, user_name = result.one()
    
            print("Supabase 연결 성공")
            print("데이터베이스:", database_name)
            print("사용자:", user_name)

def search_all_gps():
    db = SessionLocal()
    
    try:
        records = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.gps_id.desc(),
            )
            .limit(10)
            .all()
        )

        print(f"조회된 GPS 수: {len(records)}")

        for record in records:
            print(
                {
                    "gps_id": record.gps_id,
                    "subject_id": record.subject_id,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "measured_at": record.measured_at,
                }
            )
    finally:
        db.close()

    return records

def search_latest_gps():
    db = SessionLocal()

    try:
        record = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.gps_id.desc(),
            )
            .first()
        )

        if record is None:
            print("조회된 GPS가 없습니다.")
        else:
            print("가장 최근 GPS:")
            print(
                {
                    "gps_id": record.gps_id,
                    "subject_id": record.subject_id,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "measured_at": record.measured_at,
                }
            )

        return record
    finally:
        db.close()

def create_token(x, y, all_records, grid_length=25):
    valid_records = [
        record
        for record in all_records
        if record.x is not None and record.y is not None
    ]

    if not valid_records:
        raise ValueError("x, y가 저장된 GPS 데이터가 없습니다.")

    x_min = min(record.x for record in valid_records)
    y_min = min(record.y for record in valid_records)

    x_d = int((float(x) - float(x_min)) // grid_length) + 1
    y_d = int((float(y) - float(y_min)) // grid_length) + 1

    token = x_d + y_d

    return x_d, y_d, token

def create_dayofweek(measured_at):
    if measured_at is None:
        raise ValueError("measured_at 값이 없습니다.")

    korea_time = measured_at.astimezone(
        ZoneInfo("Asia/Seoul")
    )

    return f"day_{korea_time.weekday()}"
    

def transfer_epsg(
    target_epsg="EPSG:5179",
    source_epsg="EPSG:4326",
    grid_length=25,
):
    record = search_latest_gps()

    if record is None:
        return None

    transformer = Transformer.from_crs(
        source_epsg,
        target_epsg,
        always_xy=True,
    )

    x, y = transformer.transform(
        float(record.longitude),
        float(record.latitude),
    )

    db = SessionLocal()

    try:
        # 이전 세션에서 반환된 객체를 현재 세션에 연결
        managed_record = db.merge(record)

        # 변환 좌표 저장
        managed_record.x = x
        managed_record.y = y

        # INSERT/UPDATE 내용을 같은 트랜잭션의 조회에 반영
        db.flush()

        # x, y가 계산된 전체 레코드 조회
        all_records = (
            db.query(GPSRecord)
            .filter(
                GPSRecord.x.isnot(None),
                GPSRecord.y.isnot(None),
            )
            .all()
        )

        # 격자 좌표와 토큰 계산
        x_d, y_d, token = create_token(
            x=x,
            y=y,
            all_records=all_records,
            grid_length=grid_length,
        )

        dayofweek = create_dayofweek(
            managed_record.measured_at
        )

        # 계산 결과 저장
        managed_record.x_d = x_d
        managed_record.y_d = y_d
        managed_record.token = token
        managed_record.dayofweek = dayofweek

        db.commit()
        db.refresh(managed_record)

        print("좌표 변환 및 토큰 저장 완료")
        print(
            {   
                "gps_id": managed_record.gps_id,
                "x": managed_record.x,
                "y": managed_record.y,
                "x_d": managed_record.x_d,
                "y_d": managed_record.y_d,
                "token": managed_record.token,
                "dayofweek": managed_record.dayofweek,
                "measured_at": managed_record.measured_at,
            }
        )

        return managed_record

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()



'''
EPSG
# 좌표가 지구상의 위치를 어떤 기준과 방식으로 표현하는지 정의하는 좌표 참조 시스템(CRS)의 식별 번호

# EPSG:4326
WGS 84
경도·위도
도(degree)

#EPSG:5179
Korea 2000 / Unified CS
평면 X·Y
미터
'''

def main():
    origin_checkpoint_path = "artifacts/ckptepoch_7_batch_387.pt"
    checkpoint_path = "artifacts/converted_ckptepoch_7_batch_387.pt"
    vocab_path = "artifacts/vocab_gps.json"

    # convert_checkpoint(checkpoint_path, output_checkpoint_path)

    inference = load_inference_model(checkpoint_path, vocab_path)
    check_server()
    processed_record = transfer_epsg()
    if processed_record is not None:
        score_gps_record(
            gps_id=processed_record.gps_id,
            model=inference["model"],
            dictionary=inference["dictionary"],
            device=inference["device"],
            block_size=inference["block_size"],
        )

if __name__ == "__main__":
    main()
    