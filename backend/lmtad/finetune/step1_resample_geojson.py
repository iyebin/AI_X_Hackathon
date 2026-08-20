"""
1단계: geojson 시간 간격을 5분 간격으로 변경, 시간 기준을 KST 로 수정

- 입력: LineString Feature(coordinates + properties.coordTimes, UTC ISO8601) 로 구성된 geojson
- 처리:
    1) 모든 시간을 UTC -> Asia/Seoul(KST) 로 변환
    2) 각 좌표를 5분 단위로 floor 한 버킷에 배정
    3) 같은 버킷에 여러 포인트가 있으면 "버킷 내 가장 마지막(최신) 포인트"를 대표 좌표로 채택
       (raw_gps_preprocess.py 의 "연속 중복 제거"와 동일하게, 없는 위치를 보간하지 않고
        실제 관측값만 사용한다 - 즉 데이터가 없는 5분 구간은 만들어내지 않고 비워둔다)
    4) 버킷의 시작 시각(5분 정각, KST)을 그 포인트의 시각으로 기록

- 출력: 동일한 FeatureCollection/LineString 구조를 유지하되
        coordTimes 가 KST, 5분 간격으로 정렬된 새 geojson
"""
import json
import sys
from datetime import datetime
from pathlib import Path

from common import (
    FINETUNE_DIR,
    INTERVAL_MINUTES,
    KST,
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
)


def parse_iso_utc(ts: str) -> datetime:
    """'2026-07-30T01:26:02.00000Z' 같은 문자열을 tz-aware datetime(UTC)으로 변환"""
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def floor_to_interval(dt_kst: datetime, minutes: int = INTERVAL_MINUTES) -> datetime:
    """KST datetime 을 minutes 단위로 내림(floor)"""
    total_minutes = dt_kst.hour * 60 + dt_kst.minute
    floored = (total_minutes // minutes) * minutes
    return dt_kst.replace(
        hour=floored // 60,
        minute=floored % 60,
        second=0,
        microsecond=0,
    )


def resample_feature(feature: dict, minutes: int = INTERVAL_MINUTES) -> dict | None:
    props = feature["properties"]
    geom = feature["geometry"]

    if geom["type"] != "LineString":
        raise ValueError(f"지원하지 않는 geometry type: {geom['type']}")

    coords = geom["coordinates"]
    coord_times = props.get("coordTimes")

    if not coord_times or len(coord_times) != len(coords):
        raise ValueError("coordTimes 와 coordinates 길이가 일치하지 않습니다.")

    # 버킷(5분 정각, KST) -> (좌표, 실제 관측 KST 시각)
    buckets: dict[datetime, tuple[list, datetime]] = {}

    for coord, raw_time in zip(coords, coord_times):
        dt_utc = parse_iso_utc(raw_time)
        dt_kst = dt_utc.astimezone(KST)
        bucket_start = floor_to_interval(dt_kst, minutes)

        # 같은 버킷 내에서는 가장 최신 관측치를 대표값으로 사용
        prev = buckets.get(bucket_start)
        if prev is None or dt_kst >= prev[1]:
            buckets[bucket_start] = (coord, dt_kst)

    if not buckets:
        return None

    ordered_buckets = sorted(buckets.keys())
    new_coords = [buckets[b][0] for b in ordered_buckets]
    new_coord_times = [b.isoformat() for b in ordered_buckets]

    new_props = {k: v for k, v in props.items() if k not in ("coordTimes", "time")}
    new_props["time"] = new_coord_times[0]
    new_props["coordTimes"] = new_coord_times
    new_props["timezone"] = "Asia/Seoul"
    new_props["interval_minutes"] = minutes
    new_props["original_point_count"] = len(coords)
    new_props["resampled_point_count"] = len(new_coords)

    return {
        "type": "Feature",
        "properties": new_props,
        "geometry": {
            "type": "LineString",
            "coordinates": new_coords,
        },
    }


def resample_geojson(input_path: Path, output_path: Path, minutes: int = INTERVAL_MINUTES) -> dict:
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if data.get("type") != "FeatureCollection":
        raise ValueError("FeatureCollection 형식의 geojson 이 아닙니다.")

    new_features = []
    total_before = 0
    total_after = 0

    for feature in data["features"]:
        resampled = resample_feature(feature, minutes=minutes)
        if resampled is None:
            continue
        total_before += resampled["properties"]["original_point_count"]
        total_after += resampled["properties"]["resampled_point_count"]
        new_features.append(resampled)

    new_data = {
        "type": "FeatureCollection",
        "features": new_features,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    summary = {
        "input": str(input_path),
        "output": str(output_path),
        "num_features": len(new_features),
        "total_points_before": total_before,
        "total_points_after": total_after,
        "interval_minutes": minutes,
    }
    return summary


def main():
    input_path = (
        Path(sys.argv[1])
        if len(sys.argv) > 1
        else RAW_DATA_DIR / "combined_20260730_to_20260815.geojson"
    )
    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else PROCESSED_DATA_DIR / "combined_20260730_to_20260815_5min_kst.geojson"
    )

    summary = resample_geojson(input_path, output_path)

    print("=== 1단계: 5분 간격 / KST 리샘플링 완료 ===")
    for key, value in summary.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
