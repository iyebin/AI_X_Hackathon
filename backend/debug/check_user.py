# backend/check_gps.py

from backend.database import SessionLocal
from backend.models import Subject


def main():
    db = SessionLocal()

    try:
        records = (
            db.query(Subject)
            .all()
        )

        print(f"조회된 GPS 수: {len(records)}")

        for record in records:
            print(
                {
                    "id": record.id,
                    "name": record.name,
                    "auth_code": record.auth_code,
                    "gender": record.gender,
                }
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
