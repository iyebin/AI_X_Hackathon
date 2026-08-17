#python libraries
from pyproj import Transformer
import os
from sqlalchemy import text

#files
from database import engine
from database import SessionLocal
from models import GPSRecord


def __init__():
    #setting parameters
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres.zuubggonagdhdkphxzrq:ansimhackathon@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres")
    target_epsg = "EPSG:5179"
    output_epsg = "EPSG:4326"
    

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



def transfer_epsg(TARGET_EPSG, output_epsg, record, output_dir):

    db = SessionLocal()

    transformer = Transformer.from_crs(
        output_epsg, #경위도
        TARGET_EPSG, #평면 좌표
        always_xy=True
    )

    record = search_latest_gps

    longitude = record.longitude
    latitude = record.latitude

    x, y = transformer.transform(longitude, latitude)

    record.x = x
    record.y = y

    db.commit()
    db.refresh(record)

    print("x:", x)
    print("y:", y)

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
    pass
    