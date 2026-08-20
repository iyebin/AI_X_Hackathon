"""
5단계 (+ 3,4단계 통합 실행): 5분 간격 geojson -> data_grouped.tsv 생성

흐름
----
1. 1단계에서 만든 5분 간격/KST geojson 을 읽는다.
2. 포인트별로 2단계(core_runner.py 구조)의 create_token 으로 GPS 토큰을 만든다.
   - 학습 bounding box 밖의 포인트는 이번 개인 맞춤 모델의 대상이 아니므로 제외한다
     (제외된 개수는 리포트에 남긴다).
3. (user_id, KST 날짜) 로 묶어서 하루 단위 궤적(토큰 시퀀스)을 만든다.
   - dayofweek 는 core_runner.py::create_dayofweek 규칙(day_0~day_6)을 그대로 사용.
   - 연속으로 동일한 토큰이 반복되면(같은 자리에 5분 이상 머무름) 1개로 합친다.
     backend/gps_preprocess.py 의 "연속 중복 제거"와 동일한 정책이며,
     --no-dedup 옵션으로 끌 수 있다.
4. 이번에 새로 등장한 토큰(GPS 격자 토큰 + 신규 user_id 토큰)이 vocab_gps.json 에
   이미 있는지 확인한다(3단계).
   - 이미 있으면: 그대로 사용 -> 기존 체크포인트에서 바로 이어서 학습 가능
   - 없으면(= bounding box 안이지만 agent 가 방문한 적 없던 자리, 혹은 신규 user_id):
     vocab 을 확장한다(4단계). 기존 id 는 절대 바꾸지 않고 뒤에 이어붙인다.
5. data_grouped.tsv (user_id, date, dayofweek, token) 와 확장된 vocab 을 저장한다.
"""
import argparse
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import pandas as pd

from common import ARTIFACTS_DIR, PROCESSED_DATA_DIR, VOCAB_PATH, is_within_training_bbox
from step2_gps_tokenizer import create_dayofweek, create_token
from step3_vocab_manager import (
    check_tokens,
    extend_vocab,
    load_vocab,
    next_available_user_id,
    save_vocab,
)


def iter_points(geojson_data: dict):
    """5분 간격 geojson 의 모든 (lat, lon, kst_datetime) 를 시간순으로 yield"""
    points = []
    for feature in geojson_data["features"]:
        geom = feature["geometry"]
        coord_times = feature["properties"]["coordTimes"]
        for (lon, lat, *_rest), raw_time in zip(geom["coordinates"], coord_times):
            dt = datetime.fromisoformat(raw_time)  # 이미 KST(tz-aware)로 저장되어 있음
            points.append((dt, lat, lon))

    points.sort(key=lambda p: p[0])
    yield from points


def dedup_consecutive(tokens: list[int]) -> list[int]:
    deduped = []
    for token in tokens:
        if not deduped or deduped[-1] != token:
            deduped.append(token)
    return deduped


def build_data_grouped(
    resampled_geojson_path: Path,
    user_id: str | None,
    vocab_path: Path,
    dedup: bool = True,
):
    with open(resampled_geojson_path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    vocab = load_vocab(vocab_path)

    if user_id is None:
        user_id = next_available_user_id(vocab)

    dayofweek_by_date: dict[str, str] = {}
    tokens_by_date: dict[str, list[int]] = defaultdict(list)

    total_points = 0
    excluded_out_of_bbox = 0

    for dt, lat, lon in iter_points(geojson_data):
        total_points += 1

        if not is_within_training_bbox(lat, lon):
            excluded_out_of_bbox += 1
            continue

        date_str = dt.date().isoformat()
        _, _, token = create_token(lat, lon)

        tokens_by_date[date_str].append(token)
        dayofweek_by_date[date_str] = create_dayofweek(dt)

    rows = []
    raw_token_count = 0
    deduped_token_count = 0

    for date_str in sorted(tokens_by_date.keys()):
        raw_tokens = tokens_by_date[date_str]
        raw_token_count += len(raw_tokens)

        day_tokens = dedup_consecutive(raw_tokens) if dedup else raw_tokens
        deduped_token_count += len(day_tokens)

        rows.append(
            {
                "user_id": user_id,
                "date": date_str,
                "dayofweek": repr([dayofweek_by_date[date_str]]),
                "token": repr(day_tokens),
            }
        )

    data_df = pd.DataFrame(rows, columns=["user_id", "date", "dayofweek", "token"])

    # --- vocab 확인 및 확장 (3, 4단계) -----------------------------------
    all_gps_tokens = sorted({t for tokens in tokens_by_date.values() for t in tokens})
    candidate_keys = list(all_gps_tokens) + [user_id]

    membership = check_tokens(vocab, candidate_keys)
    missing_keys = [key for key, present in membership.items() if not present]

    extended_vocab, added_keys = extend_vocab(vocab, candidate_keys)

    report = {
        "user_id": user_id,
        "total_points_in_resampled_geojson": total_points,
        "excluded_out_of_bbox_points": excluded_out_of_bbox,
        "num_days": len(rows),
        "raw_token_count_before_dedup": raw_token_count,
        "token_count_after_dedup": deduped_token_count,
        "dedup_enabled": dedup,
        "distinct_gps_tokens_seen": len(all_gps_tokens),
        "tokens_missing_from_vocab": missing_keys,
        "vocab_size_before": len(vocab),
        "vocab_size_after": len(extended_vocab),
        "vocab_extended": len(added_keys) > 0,
        "keys_added_to_vocab": added_keys,
    }

    return data_df, extended_vocab, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        type=Path,
        default=PROCESSED_DATA_DIR / "combined_20260730_to_20260815_5min_kst.geojson",
        help="1단계에서 생성한 5분 간격/KST geojson 경로",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="지정하지 않으면 vocab_gps.json 기준 다음 번호(user_N)를 자동 부여",
    )
    parser.add_argument(
        "--vocab",
        type=Path,
        default=VOCAB_PATH,
        help="기준이 되는 원본 vocab_gps.json 경로",
    )
    parser.add_argument(
        "--no-dedup",
        action="store_true",
        help="같은 자리에 머무를 때 생기는 연속 동일 토큰을 합치지 않고 5분 간격 그대로 유지",
    )
    parser.add_argument(
        "--out-tsv",
        type=Path,
        default=PROCESSED_DATA_DIR / "data_grouped.tsv",
    )
    parser.add_argument(
        "--out-vocab",
        type=Path,
        default=PROCESSED_DATA_DIR / "vocab_gps.finetune.json",
        help="원본 artifacts/vocab_gps.json 은 건드리지 않고, 확장된 vocab 을 별도 파일로 저장한다"
        " (파인튜닝이 끝난 뒤 배포용 vocab 으로 교체).",
    )
    parser.add_argument(
        "--out-report",
        type=Path,
        default=PROCESSED_DATA_DIR / "build_data_grouped_report.json",
    )
    args = parser.parse_args()

    data_df, extended_vocab, report = build_data_grouped(
        resampled_geojson_path=args.input,
        user_id=args.user_id,
        vocab_path=args.vocab,
        dedup=not args.no_dedup,
    )

    args.out_tsv.parent.mkdir(parents=True, exist_ok=True)
    data_df.to_csv(args.out_tsv, sep="\t", index=False)

    save_vocab(extended_vocab, args.out_vocab)

    with open(args.out_report, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("=== 5단계: data_grouped.tsv 생성 완료 (3~4단계 vocab 처리 포함) ===")
    print(f"user_id: {report['user_id']}")
    print(f"data_grouped.tsv: {args.out_tsv} ({len(data_df)} rows / days)")
    print(f"vocab: {args.out_vocab} (size {report['vocab_size_before']} -> {report['vocab_size_after']})")
    print(f"vocab 확장 여부: {report['vocab_extended']} (추가된 key {len(report['keys_added_to_vocab'])}개)")
    print(f"bounding box 밖이라 제외된 포인트: {report['excluded_out_of_bbox_points']} / {report['total_points_in_resampled_geojson']}")
    print(f"리포트: {args.out_report}")


if __name__ == "__main__":
    main()
