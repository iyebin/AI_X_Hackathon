# backend/check_gps.py

from database import SessionLocal
from models import GPSRecord


def main():
    db = SessionLocal()

    try:
        records = (
            db.query(GPSRecord)
            .order_by(
                GPSRecord.measured_at.desc(),
                GPSRecord.id.desc(),
            )
            .limit(10)
            .all()
        )

        print(f"조회된 GPS 수: {len(records)}")

        for record in records:
            print(
                {
                    "id": record.id,
                    "subject_id": record.subject_id,
                    "latitude": record.latitude,
                    "longitude": record.longitude,
                    "measured_at": record.measured_at,
                }
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
