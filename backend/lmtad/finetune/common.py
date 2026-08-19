"""
파인튜닝 파이프라인 공통 상수/유틸.

backend/lmtad/core_runner.py 에 정의된 값과 로직을 그대로 재사용한다.
(TRAIN_X_MIN, TRAIN_Y_MIN, grid_length=25, EPSG:4326 -> EPSG:5179 변환,
 token = x_d + y_d, BOUNDING_BOX, dayofweek 규칙)

DB(SQLAlchemy) 의존성을 제거하고 순수 함수로 재구현했다.
"""
from pathlib import Path
from zoneinfo import ZoneInfo

from pyproj import Transformer

# ---------------------------------------------------------------------------
# core_runner.py 와 동일한 상수
# ---------------------------------------------------------------------------
SOURCE_EPSG = "EPSG:4326"
TARGET_EPSG = "EPSG:5179"

TRAIN_X_MIN = 922715.6460828016
TRAIN_Y_MIN = 1930202.4520962609
GRID_LENGTH = 25

# core_runner.py main() 의 BOUNDING_BOX
# [최소 경도, 최소 위도, 최대 경도, 최대 위도]
BOUNDING_BOX = (
    126.6233889470779,
    37.36953124923263,
    127.0869083706714,
    37.62778383803697,
)

KST = ZoneInfo("Asia/Seoul")

INTERVAL_MINUTES = 5

# ---------------------------------------------------------------------------
# 경로
# ---------------------------------------------------------------------------
FINETUNE_DIR = Path(__file__).resolve().parent
LMTAD_DIR = FINETUNE_DIR.parent
ARTIFACTS_DIR = LMTAD_DIR / "artifacts"

RAW_DATA_DIR = FINETUNE_DIR / "data" / "raw"
PROCESSED_DATA_DIR = FINETUNE_DIR / "data" / "processed"

VOCAB_PATH = ARTIFACTS_DIR / "vocab_gps.json"

_transformer = Transformer.from_crs(
    SOURCE_EPSG,
    TARGET_EPSG,
    always_xy=True,
)


def latlon_to_xy(lat: float, lon: float) -> tuple[float, float]:
    """WGS84(lat, lon) -> EPSG:5179(x, y)"""
    x, y = _transformer.transform(lon, lat)
    return x, y


def is_within_training_bbox(lat: float, lon: float) -> bool:
    """core_runner.py 의 학습 bounding box 내부인지 확인"""
    min_lon, min_lat, max_lon, max_lat = BOUNDING_BOX
    return (min_lon <= lon <= max_lon) and (min_lat <= lat <= max_lat)
