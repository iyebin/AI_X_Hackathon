# backend/check_gps.py

from backend.database import SessionLocal
from backend.models import GPSRecord

def main():
    db = SessionLocal()

    try:
        records = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.gps_id.desc(),
            )
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
                    "dayofeek": record.dayofweek
                }
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
