from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import models
from gps_preprocess import records_to_gps_tokens


SEOUL = ZoneInfo("Asia/Seoul")


def load_daily_gps(
    db,
    subject_id: int,
    target_date: date,
):
    start = datetime.combine(
        target_date,
        datetime.min.time(),
        tzinfo=SEOUL,
    )
    end = start + timedelta(days=1)

    return (
        db.query(models.GPSRecord)
        .filter(
            models.GPSRecord.subject_id == subject_id,
            models.GPSRecord.measured_at >= start,
            models.GPSRecord.measured_at < end,
        )
        .order_by(
            models.GPSRecord.measured_at.asc()
        )
        .all()
    )


def run_gps_inference(
    db,
    runtime,
    subject_id: int,
    target_date: date,
):
    records = load_daily_gps(
        db=db,
        subject_id=subject_id,
        target_date=target_date,
    )

    if len(records) < 2:
        raise ValueError("GPS 데이터가 부족합니다.")

    gps_tokens = records_to_gps_tokens(
        records=records,
        maximum_tokens=runtime.block_size - 3,
    )

    user_token = f"user_{subject_id}"
    weekday_token = f"day_{target_date.weekday()}"

    tokens, token_ids = runtime.encode_trajectory(
        user_token=user_token,
        weekday_token=weekday_token,
        trajectory_tokens=gps_tokens,
    )

    score = runtime.predict(token_ids)

    if runtime.threshold is None:
        raise RuntimeError(
            "ANOMALY_THRESHOLD가 없습니다."
        )

    return {
        "subject_id": subject_id,
        "target_date": target_date,
        "point_count": len(records),
        "gps_token_count": len(gps_tokens),
        "tokens": tokens,
        "anomaly_score": score,
        "threshold": runtime.threshold,
        "is_anomaly": score >= runtime.threshold,
    }