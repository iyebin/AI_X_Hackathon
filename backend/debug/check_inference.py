# backend/check_gps.py

import json
from pathlib import Path

from backend.database import SessionLocal
from backend.models import Inference


def main():
    db = SessionLocal()
    output_path = Path("gps_records.txt")

    try:
        records = (
            db.query(Inference)
            .order_by(Inference.gps_id.desc())
            .all()
        )

        print(f"조회된 GPS 수: {len(records)}")

        with output_path.open("w", encoding="utf-8") as file:
            for record in records:
                data = {
                    "gps_id": record.gps_id,
                    "subject_id": record.subject_id,
                    "token": record.token,
                    "token_probability": record.token_probability,
                    "anomaly_score": record.anomaly_score,
                    "scored_at": record.scored_at,
                }

                print(data)

                file.write(
                    json.dumps(
                        data,
                        ensure_ascii=False,
                        default=str,
                    )
                    + "\n"
                )

        print(f"저장 완료: {output_path.resolve()}")

    finally:
        db.close()


if __name__ == "__main__":
    main()