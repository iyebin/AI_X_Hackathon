"""
시연용: 실시간 GPS 수집 대신, 미리 만들어둔 좌표 시퀀스를 실제 GPS가 들어오는 것처럼
`POST /gps` 로 순서대로 전송한다.
 
배경
----
`submain` 브랜치의 `backend/main.py::save_gps` (`POST /gps`)는 디바이스가 보내는
실시간 GPS 대신, 누구든 좌표를 직접 넣어도 똑같이 동작한다(디바이스와 API 를
구분하지 않음). 요청 형식(schemas.GPSCreate):
 
    {"subject_id": int, "latitude": float, "longitude": float, "measured_at": <ISO8601, optional>}
 
이 스크립트는 `demo_normal_carecenter_to_apartment.json` 같은 "재생목록"(playbook)
파일을 읽어서, 각 지점을 실제 시간 간격(또는 --speed 로 배속)에 맞춰 순서대로
`POST /gps` 로 보낸다. `measured_at` 은 스크립트를 실행하는 실제 현재 시각(KST) 기준으로
오프셋을 더해서 채우기 때문에, 오늘 날짜/요일 기준으로 정상적으로 채점된다.
 
playbook 형식 (demo_normal_carecenter_to_apartment.json 참고):
    {
      "points": [
        {"offset_min": 0, "latitude": ..., "longitude": ..., "venue": "carecenter"},
        {"offset_min": 5, "latitude": ..., "longitude": ..., "venue": "transit"},
        ...
      ]
    }
 
사용 예
-------
# 실제 속도(5분 간격 그대로) 로 재생, 지금 이 순간부터 시작
python demo_replay.py \
    --api-base http://localhost:8000 \
    --subject-id 1100 \
    --playbook data/processed/demo_normal_carecenter_to_apartment.json
 
# 12배속(실제 5분 -> 25초) 으로 빠르게 시연
python demo_replay.py --api-base http://localhost:8000 --subject-id 1100 \
    --playbook data/processed/demo_normal_carecenter_to_apartment.json --speed 12
 
# 서버에 실제로 보내지 않고 무슨 요청이 나갈지만 확인
python demo_replay.py --subject-id 1100 \
    --playbook data/processed/demo_normal_carecenter_to_apartment.json --dry-run
 
# 지점 하나 저장할 때마다 바로 POST /subjects/{subject_id}/gps-inference 호출
# (gps1 저장 -> inference -> gps2 저장 -> inference -> ...)
python demo_replay.py --api-base http://localhost:8000 --subject-id 1100 \
    --playbook data/processed/demo_normal_carecenter_to_apartment.json \
    --speed 12 --run-inference
"""
import argparse
import json
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
 
import requests
 
KST = ZoneInfo("Asia/Seoul")
 
 
def load_playbook(path: Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    points = sorted(data["points"], key=lambda p: p["offset_min"])
    if not points:
        raise ValueError(f"{path} 에 points 가 없습니다.")
    return points
 
 
def run(
    api_base: str,
    subject_id: int,
    points: list[dict],
    speed: float = 1.0,
    dry_run: bool = False,
    timeout: float = 5.0,
    run_inference: bool = False,
    inference_timeout: float = 30.0,
):
    start_wall = datetime.now(KST)
    t0 = time.monotonic()
    base_offset = points[0]["offset_min"]
 
    for point_index, point in enumerate(points):
        # 재생 시작 시점을 playbook 의 첫 지점 시각으로 맞추고, 이후 지점들은
        # (offset_min - base_offset) 을 --speed 로 나눠서 실제 대기 시간을 정한다.
        elapsed_target_sec = (point["offset_min"] - base_offset) * 60.0 / speed
        now_elapsed = time.monotonic() - t0
        wait_sec = elapsed_target_sec - now_elapsed
        if wait_sec > 0:
            time.sleep(wait_sec)
 
        measured_at = start_wall.fromtimestamp(
            start_wall.timestamp() + (point["offset_min"] - base_offset) * 60.0,
            tz=KST,
        )
        date_str = measured_at.date().isoformat()
 
        payload = {
            "subject_id": subject_id,
            "latitude": point["latitude"],
            "longitude": point["longitude"],
            "measured_at": measured_at.isoformat(),
        }
 
        label = f"[{point.get('venue', '?')}] offset={point['offset_min']}min"
        if dry_run:
            print(f"(dry-run) POST {api_base}/gps  {label}  {payload}")
        else:
            try:
                resp = requests.post(f"{api_base}/gps", json=payload, timeout=timeout)
                resp.raise_for_status()
                print(
                    f"OK  {label}  status={resp.status_code}  gps_id={resp.json().get('gps_id')}"
                )
            except Exception as exc:  # noqa: BLE001 - 시연 스크립트라 넓게 잡고 계속 진행
                print(f"FAIL {label}  error={exc}")
                # 저장 자체가 실패했으면 이 지점은 inference 호출도 건너뛴다.
                continue
 
        if not run_inference:
            continue
 
        # 각 지점을 저장한 직후 바로 그 시점까지의 궤적으로 inference 를 호출한다
        # (gps1 저장 -> inference -> gps2 저장 -> inference -> ...).
        # 참고: run_gps_inference 는 그날 GPS 레코드가 2개 미만이면
        # "GPS 데이터가 부족합니다" 로 422 를 반환한다 - 재생 첫 지점에서는
        # 정상적으로 실패할 수 있다.
        url = f"{api_base}/subjects/{subject_id}/gps-inference"
        params = {"target_date": date_str}
 
        if dry_run:
            print(f"(dry-run) POST {url}  params={params}")
            continue
 
        try:
            resp = requests.post(url, params=params, timeout=inference_timeout)
            resp.raise_for_status()
            result = resp.json()
            print(
                f"  -> inference OK  target_date={date_str}  risk_level={result.get('risk_level')}  "
                f"anomaly_score={result.get('anomaly_score')}  "
                f"lmtad_score={result.get('lmtad_score')}  "
                f"point_count={result.get('point_count')}"
            )
        except Exception as exc:  # noqa: BLE001
            print(f"  -> inference FAIL  target_date={date_str}  error={exc}")
 
 
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-base", type=str, default="https://ai-x-hackathon-backend.onrender.com")
    parser.add_argument("--subject-id", type=int, required=True, help="Supabase subjects.id", default=5)
    parser.add_argument("--playbook", type=Path, required=True)
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="배속. 1.0=실제 5분 간격 그대로, 12=5분->25초로 압축 등",
    )
    parser.add_argument("--dry-run", action="store_true", help="실제로 전송하지 않고 요청 내용만 출력")
    parser.add_argument(
        "--run-inference",
        action="store_true",
        default=True,
        help=(
            "각 지점을 저장할 때마다 바로 POST /subjects/{subject_id}/gps-inference 를 "
            "호출해서 채점까지 실행 (gps1 저장 -> inference -> gps2 저장 -> inference -> ...)"
        ),
    )
    parser.add_argument(
        "--inference-timeout",
        type=float,
        default=30.0,
        help="gps-inference 호출 timeout(초). 모델 추론이라 기본 GPS POST보다 여유있게 잡음",
    )
    args = parser.parse_args()
 
    points = load_playbook(args.playbook)
    run(
        api_base=args.api_base,
        subject_id=args.subject_id,
        points=points,
        speed=args.speed,
        dry_run=args.dry_run,
        run_inference=args.run_inference,
        inference_timeout=args.inference_timeout,
    )
 
 
if __name__ == "__main__":
    main()