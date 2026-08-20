"""
vocab을 "이번에 관측된 토큰"만이 아니라, 학습 bounding box 안에서 나올 수 있는
GPS 토큰 전체(가능한 모든 grid 값)로 미리 확장한다.

배경
----
token = x_d + y_d 는 여러 (x_d, y_d) 조합이 같은 정수로 뭉치는 손실(lossy) 인코딩이라,
bounding box 안에서 실제로 나올 수 있는 서로 다른 token 값의 개수는 grid cell 개수보다
훨씬 적다 (이번 계산 기준 약 2,805개). 기존 vocab_gps.json(3,716개)의 GPS 토큰 범위가
2~2708로 "빈틈없이 연속"이었던 것도, 원래 이런 식(=bounding box 전체에서 나올 수 있는
연속된 정수 범위를 미리 다 채워놓는 방식)으로 만들어졌다는 정황이다.

지금까지(step4)는 "실제 업로드된 12일치 데이터에 찍힌 토큰"만 vocab에 추가했는데, 그러면
그 데이터에 없던 위치(=이 서비스 구역 안이지만 아직 아무도 안 가본 grid)에 GPS가 찍히는
순간 다시 OOV(vocabulary에 없는 값) 에러가 난다. 게다가 gps_evaluation.py 의 채점 로직은
하루 궤적 전체를 한 번에 검사하기 때문에, 그 날 어딘가에서 OOV가 한 번이라도 나면 그 날
나머지 전체가 채점 실패로 이어진다(README 참고).

이 스크립트는 그 문제를 근본적으로 없애기 위해, "이번에 관측된 토큰"이 아니라
"bounding box 안에서 이론적으로 나올 수 있는 모든 GPS 토큰"을 미리 vocab에 넣는다.
한 번도 안 가본 자리는 임베딩이 랜덤 초기화 상태로 남지만(=모델이 잘 모르는 곳이라는
뜻이라 오히려 anomaly_score 가 자연스럽게 높게 나오는 경향이 있음), 최소한
"vocab에 아예 없어서 통째로 실패"하는 일은 없어진다.

기존 토큰의 id는 (지금까지와 마찬가지로) 절대 바꾸지 않고, 새 토큰만 뒤에 순차적으로
추가한다.
"""
import argparse
import json
from pathlib import Path

from pyproj import Transformer

from common import (
    BOUNDING_BOX,
    GRID_LENGTH,
    SOURCE_EPSG,
    TARGET_EPSG,
    TRAIN_X_MIN,
    TRAIN_Y_MIN,
    VOCAB_PATH,
)
from step3_vocab_manager import extend_vocab, load_vocab, save_vocab


def full_bbox_token_range(
    bounding_box=BOUNDING_BOX,
    grid_length: int = GRID_LENGTH,
) -> tuple[int, int]:
    """bounding box 네 꼭짓점 기준으로 나올 수 있는 x_d/y_d 최소~최대 값을 구하고,
    token = x_d + y_d 이 가질 수 있는 (연속된) 최소~최대 합을 반환한다.

    core_runner.py::create_token 과 정확히 같은 상수/수식을 사용한다.
    네 꼭짓점만으로 계산하는 이유: 이 bbox 는 위경도 기준 사각형이라 EPSG:5179로
    투영해도 거의 직사각형에 가깝고(원 코드의 실제 vocab 범위 2~2708이 빈틈없이
    연속이었던 것도 동일한 근거), x_d/y_d 는 각 축에서 거의 독립적으로 최소~최대를
    오가므로 두 축의 최소합/최대합 사이의 모든 정수가 실제로 달성 가능하다.
    (900x900 촘촘한 샘플링으로 직접 검증 완료: 거의 완전히 연속, 코너 근처 샘플링
    해상도 한계로 인한 오차 1개 지점 정도만 존재)
    """
    transformer = Transformer.from_crs(SOURCE_EPSG, TARGET_EPSG, always_xy=True)
    min_lon, min_lat, max_lon, max_lat = bounding_box

    corners = [
        (min_lon, min_lat),
        (min_lon, max_lat),
        (max_lon, min_lat),
        (max_lon, max_lat),
    ]

    x_ds, y_ds = [], []
    for lon, lat in corners:
        x, y = transformer.transform(lon, lat)
        x_ds.append(int((x - TRAIN_X_MIN) // grid_length) + 1)
        y_ds.append(int((y - TRAIN_Y_MIN) // grid_length) + 1)

    min_sum = min(x_ds) + min(y_ds)
    max_sum = max(x_ds) + max(y_ds)
    return min_sum, max_sum


def expand_vocab_to_full_bbox(
    base_vocab: dict,
    extra_keys: list | None = None,
) -> tuple[dict, dict]:
    min_sum, max_sum = full_bbox_token_range()
    all_tokens = list(range(min_sum, max_sum + 1))

    candidate_keys = all_tokens + list(extra_keys or [])
    extended_vocab, added_keys = extend_vocab(base_vocab, candidate_keys)

    report = {
        "min_token": min_sum,
        "max_token": max_sum,
        "total_possible_tokens": len(all_tokens),
        "vocab_size_before": len(base_vocab),
        "vocab_size_after": len(extended_vocab),
        "num_added": len(added_keys),
        "extra_keys_requested": list(extra_keys or []),
    }
    return extended_vocab, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-vocab",
        type=Path,
        default=VOCAB_PATH,
        help="체크포인트가 실제로 학습될 때 쓰인 원본 vocab_gps.json (기존 id를 그대로 보존)",
    )
    parser.add_argument(
        "--extra-user-id",
        type=str,
        action="append",
        default=[],
        help="추가로 미리 확보해두고 싶은 user_id (예: --extra-user-id user_1000). 여러 번 지정 가능",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "processed" / "vocab_gps.full_bbox.json",
    )
    parser.add_argument(
        "--out-report",
        type=Path,
        default=Path(__file__).resolve().parent / "data" / "processed" / "expand_vocab_full_bbox_report.json",
    )
    args = parser.parse_args()

    base_vocab = load_vocab(args.base_vocab)
    extended_vocab, report = expand_vocab_to_full_bbox(base_vocab, extra_keys=args.extra_user_id)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_vocab(extended_vocab, args.out)

    with open(args.out_report, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("=== bounding box 전체 커버 vocab 확장 완료 ===")
    print(f"토큰 가능 범위: {report['min_token']} ~ {report['max_token']} (총 {report['total_possible_tokens']}개)")
    print(f"vocab 크기: {report['vocab_size_before']} -> {report['vocab_size_after']} ({report['num_added']}개 추가)")
    print(f"저장: {args.out}")
    print(f"리포트: {args.out_report}")


if __name__ == "__main__":
    main()
