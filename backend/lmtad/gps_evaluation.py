import math
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import torch
from torch.nn import functional as F

from database import SessionLocal
from models import GPSRecord


KST = ZoneInfo("Asia/Seoul")


@torch.no_grad()
def score_gps_record(
    gps_id,
    model,
    dictionary,
    device,
    block_size,
):
    db = SessionLocal()

    try:
        target_record = (
            db.query(GPSRecord)
            .filter(
                GPSRecord.gps_id == gps_id,
                GPSRecord.token.isnot(None),
            )
            .first()
        )

        if target_record is None:
            raise ValueError(
                f"추론 가능한 GPS를 찾지 못했습니다: {gps_id}"
            )

        measured_at_kst = target_record.measured_at.astimezone(KST)
        target_date = measured_at_kst.date()

        # 원본 전처리는 오전 4시 이전 데이터를 제외
        if measured_at_kst.time() < time(4, 0):
            print("오전 4시 이전 GPS는 추론 대상에서 제외합니다.")
            return None

        start_at = datetime.combine(
            target_date,
            time(4, 0),
            tzinfo=KST,
        )

        end_at = datetime.combine(
            target_date + timedelta(days=1),
            time(0, 0),
            tzinfo=KST,
        )

        # 해당 GPS까지 같은 사용자의 당일 궤적 조회
        daily_records = (
            db.query(GPSRecord)
            .filter(
                GPSRecord.subject_id == target_record.subject_id,
                GPSRecord.measured_at >= start_at,
                GPSRecord.measured_at <= target_record.measured_at,
                GPSRecord.measured_at < end_at,
                GPSRecord.token.isnot(None),
            )
            .order_by(
                GPSRecord.measured_at.asc(),
                GPSRecord.gps_id.asc(),
            )
            .all()
        )

        if not daily_records:
            raise ValueError("당일 GPS 궤적이 없습니다.")

        # 첨부 데이터는 한 궤적당 최대 26개
        # GPS-only 모델의 block_size는 user/day/EOT 공간까지 포함
        max_gps_count = block_size - 3

        if len(daily_records) > max_gps_count:
            daily_records = daily_records[-max_gps_count:]

        semantic_sequence = [
            f"user_{target_record.subject_id}",
            target_record.dayofweek,
            *[str(record.token) for record in daily_records],
        ]

        missing_values = [
            value
            for value in semantic_sequence
            if str(value) not in dictionary.vocab
        ]

        if missing_values:
            raise ValueError(
                "학습 vocabulary에 없는 값이 있습니다: "
                f"{missing_values}"
            )

        token_ids = dictionary.encode(semantic_sequence)

        # 마지막 GPS 토큰 직전까지 모델에 입력
        input_ids = torch.tensor(
            [token_ids[:-1]],
            dtype=torch.long,
            device=device,
        )

        latest_token_id = token_ids[-1]

        model.eval()
        logits, _ = model(input_ids)

        next_token_probabilities = F.softmax(
            logits[0, -1, :],
            dim=-1,
        )

        probability = next_token_probabilities[
            latest_token_id
        ].item()

        # 예상하기 어려운 GPS일수록 높은 점수
        anomaly_score = -math.log2(
            max(probability, 1e-12)
        )
        
        target_record.token_probability = probability
        target_record.anomaly_score = anomaly_score
        target_record.scored_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(target_record)

        result = {
            "gps_id": target_record.gps_id,
            "subject_id": target_record.subject_id,
            "gps_token": target_record.token,
            "trajectory_length": len(daily_records),
            "token_probability": probability,
            "anomaly_score": anomaly_score,
        }

        print(result)
        return result

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()