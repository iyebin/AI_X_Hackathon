"""
이상(anomaly) 이동 시연용 재생목록(playbook) 생성.
 
시나리오: "낯선 장소로 이탈"
--------------------------
정상 이동(`demo_normal_carecenter_to_apartment.json`)과 똑같은 시간대에
(18:05 care center 출발) 출발하지만, 집(apartment)이 아니라 학습 bounding box
안에는 있지만 user_1100이 지금까지 한 번도 방문한 적 없는 곳으로 이동한다.
 
- 시간대는 평소와 동일하게 유지 -> "언제" 가 아니라 "어디" 가 이상 신호가 되도록 설계.
- 목적지는 bounding box 안이라서 vocab에는 이미 있다(3b단계에서 bbox 전체를
  미리 커버해놨기 때문). 다만 user_1100의 파인튜닝 데이터(apartment/transit/
  carecenter, token 1907~1927)에는 전혀 없던 낯선 token이라 "이 사용자에게는"
  이상치로 나올 것으로 기대된다 - 이게 이 프로젝트가 bounding box 전체를
  미리 vocab에 채워둔 이유이기도 하다(README 3b단계 참고).
 
care center(952229.0255528395, 1948843.0011594780) 좌표는 정상 이동 playbook과
동일한 실제 파인튜닝 좌표를 그대로 쓰고, 목적지는 --dest-lat/--dest-lon 으로
직접 지정하거나 기본값(약 10km 떨어진, bounding box 안의 지점)을 사용한다.
 
생성된 JSON은 `demo_replay.py`가 바로 읽을 수 있는 playbook 형식이라, 새 스크립트
없이 기존 `demo_replay.py --playbook <이 파일>` 로 그대로 재생하면 된다.
 
사용 예
-------
python generate_anomaly_playbook.py
python generate_anomaly_playbook.py --dest-lat 37.475 --dest-lon 127.045 --duration-min 60
"""
import argparse
import json
from pathlib import Path
 
from pyproj import Transformer
 
from common import BOUNDING_BOX, GRID_LENGTH, PROCESSED_DATA_DIR, TRAIN_X_MIN, TRAIN_Y_MIN
 
# demo_normal_carecenter_to_apartment.json 과 동일한 실제 care center 좌표 (EPSG:5179)
CARE_CENTER_X = 952229.0255528395
CARE_CENTER_Y = 1948843.0011594780
 
# 기본 "낯선 장소" 좌표: care center 로부터 약 10km, bounding box 안, user_1100 의
# 파인튜닝 데이터(apartment/transit/carecenter)와는 겹치지 않는 지점.
DEFAULT_DEST_LAT = 37.475
DEFAULT_DEST_LON = 127.045
 
_transformer = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)
_inv_transformer = Transformer.from_crs("EPSG:5179", "EPSG:4326", always_xy=True)
 
 
def xy_to_token(x: float, y: float, grid_length: int = GRID_LENGTH) -> int:
    x_d = int((x - TRAIN_X_MIN) // grid_length) + 1
    y_d = int((y - TRAIN_Y_MIN) // grid_length) + 1
    return x_d + y_d
 
 
def is_within_bbox(lat: float, lon: float) -> bool:
    min_lon, min_lat, max_lon, max_lat = BOUNDING_BOX
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat
 
 
def build_anomaly_playbook(
    dest_lat: float = DEFAULT_DEST_LAT,
    dest_lon: float = DEFAULT_DEST_LON,
    duration_min: int = 60,
    linger_min: int = 10,
    interval_min: int = 5,
) -> tuple[dict, dict]:
    if not is_within_bbox(dest_lat, dest_lon):
        raise ValueError(
            f"목적지 ({dest_lat}, {dest_lon}) 가 학습 bounding box {BOUNDING_BOX} 밖입니다. "
            "이 범위 밖이면 vocab 에 아예 없는 토큰이 나와서 채점 자체가 실패합니다."
        )
 
    dest_x, dest_y = _transformer.transform(dest_lon, dest_lat)
 
    num_steps = duration_min // interval_min
    points = []
 
    # care center -> 낯선 장소: 직선 보간 (정상 이동 playbook 과 동일한 방식)
    for i in range(num_steps + 1):
        ratio = i / num_steps
        x = CARE_CENTER_X + (dest_x - CARE_CENTER_X) * ratio
        y = CARE_CENTER_Y + (dest_y - CARE_CENTER_Y) * ratio
        lon, lat = _inv_transformer.transform(x, y)
        offset = i * interval_min
        venue = "carecenter" if i == 0 else ("unfamiliar_location" if i == num_steps else "transit")
        points.append(
            {
                "offset_min": offset,
                "latitude": round(lat, 8),
                "longitude": round(lon, 8),
                "venue": venue,
            }
        )
 
    # 낯선 장소에 계속 머무름 (평소처럼 집으로 안 돌아옴 -> 이동 자체도 이상 신호에 더해짐)
    last_offset = num_steps * interval_min
    for extra in range(interval_min, linger_min + interval_min, interval_min):
        lon, lat = _inv_transformer.transform(dest_x, dest_y)
        points.append(
            {
                "offset_min": last_offset + extra,
                "latitude": round(lat, 8),
                "longitude": round(lon, 8),
                "venue": "unfamiliar_location",
            }
        )
 
    care_token = xy_to_token(CARE_CENTER_X, CARE_CENTER_Y)
    dest_token = xy_to_token(dest_x, dest_y)
 
    # user_1100 파인튜닝 데이터에서 실제로 관측된 token 범위(demo_normal 생성 시 확인함)
    known_tokens = set(range(1907, 1928))
 
    report = {
        "scenario": "낯선 장소로 이탈 (평소와 동일한 시간대, 다른 목적지)",
        "care_center_token": care_token,
        "destination_token": dest_token,
        "destination_is_known_to_user_1100": dest_token in known_tokens,
        "distance_from_care_center_m": round(
            ((dest_x - CARE_CENTER_X) ** 2 + (dest_y - CARE_CENTER_Y) ** 2) ** 0.5, 1
        ),
        "num_points": len(points),
    }
 
    playbook = {
        "description": (
            "이상 이동: care center 에서 평소 이동 시간대(18:05 출발)에 출발하지만, "
            "apartment 가 아니라 user_1100 이 한 번도 방문한 적 없는 낯선 장소로 이동 "
            "(위치 이상 시나리오). bounding box 안이라 vocab 에는 있지만, user_1100 "
            "파인튜닝 데이터에는 없던 token 이라 이상치로 나올 것으로 기대."
        ),
        "user_ref": "user_1100 (finetune vocab)",
        "interval_minutes": interval_min,
        "points": points,
    }
 
    return playbook, report
 
 
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest-lat", type=float, default=DEFAULT_DEST_LAT)
    parser.add_argument("--dest-lon", type=float, default=DEFAULT_DEST_LON)
    parser.add_argument(
        "--duration-min", type=int, default=60, help="care center -> 낯선 장소 이동 소요 시간(분)"
    )
    parser.add_argument(
        "--linger-min", type=int, default=10, help="도착 후 낯선 장소에 머무는 시간(분)"
    )
    parser.add_argument("--interval-min", type=int, default=5)
    parser.add_argument(
        "--out",
        type=Path,
        default=PROCESSED_DATA_DIR / "demo_anomaly_unfamiliar_location.json",
    )
    parser.add_argument(
        "--out-report",
        type=Path,
        default=PROCESSED_DATA_DIR / "demo_anomaly_unfamiliar_location_report.json",
    )
    args = parser.parse_args()
 
    playbook, report = build_anomaly_playbook(
        dest_lat=args.dest_lat,
        dest_lon=args.dest_lon,
        duration_min=args.duration_min,
        linger_min=args.linger_min,
        interval_min=args.interval_min,
    )
 
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(playbook, f, ensure_ascii=False, indent=2)
    with open(args.out_report, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
 
    print("=== 이상 이동 playbook 생성 완료 ===")
    print(f"care center token: {report['care_center_token']}")
    print(f"목적지 token: {report['destination_token']}")
    print(f"user_1100 이 이 목적지를 알고 있음? {report['destination_is_known_to_user_1100']}")
    print(f"care center 로부터 거리: {report['distance_from_care_center_m']}m")
    print(f"지점 수: {report['num_points']}")
    print(f"저장: {args.out}")
    print(f"리포트: {args.out_report}")
    print()
    print("재생 커맨드 예시:")
    print(
        f"  python demo_replay.py --api-base http://<서버주소> --subject-id 1100 "
        f"--playbook {args.out} --speed 60 --run-inference"
    )