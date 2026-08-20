"""
2단계: backend/lmtad/core_runner.py 의 토큰 생성 구조를 그대로 사용해 토큰 생성

core_runner.py 의 create_token() 은 DB(GPSRecord, SQLAlchemy)에 의존하고 있어서,
동일한 수식(EPSG:4326 -> EPSG:5179 변환, TRAIN_X_MIN/TRAIN_Y_MIN, grid_length=25,
token = x_d + y_d)을 DB 없이도 쓸 수 있도록 순수 함수로 옮겨왔다.

원본(core_runner.py):
    TRAIN_X_MIN = 922715.6460828016
    TRAIN_Y_MIN = 1930202.4520962609

    def create_token(target_x, target_y, all_records, transformer, grid_length=25):
        x_d = int((target_x - TRAIN_X_MIN) // grid_length) + 1
        y_d = int((target_y - TRAIN_Y_MIN) // grid_length) + 1
        token = x_d + y_d
        return x_d, y_d, token

    def create_dayofweek(measured_at):
        korea_time = measured_at.astimezone(ZoneInfo("Asia/Seoul"))
        return f"day_{korea_time.weekday()}"
"""
from datetime import datetime

from common import GRID_LENGTH, KST, TRAIN_X_MIN, TRAIN_Y_MIN, latlon_to_xy


def create_token(
    lat: float,
    lon: float,
    grid_length: int = GRID_LENGTH,
) -> tuple[int, int, int]:
    """core_runner.py::create_token 과 동일한 수식.

    DB에서 전체 GPS 레코드를 조회해 x_min/y_min 을 다시 구하는 대신,
    core_runner.py 가 실제로 사용하는 고정 상수 TRAIN_X_MIN/TRAIN_Y_MIN 을 그대로 사용한다.
    """
    x, y = latlon_to_xy(lat, lon)

    x_d = int((x - TRAIN_X_MIN) // grid_length) + 1
    y_d = int((y - TRAIN_Y_MIN) // grid_length) + 1

    token = x_d + y_d

    return x_d, y_d, token


def create_dayofweek(measured_at: datetime) -> str:
    """core_runner.py::create_dayofweek 과 동일"""
    if measured_at is None:
        raise ValueError("measured_at 값이 없습니다.")

    if measured_at.tzinfo is None:
        raise ValueError("measured_at 은 tz-aware datetime 이어야 합니다.")

    korea_time = measured_at.astimezone(KST)
    return f"day_{korea_time.weekday()}"


if __name__ == "__main__":
    # 간단한 동작 확인
    sample_lat, sample_lon = 37.62268301914548, 127.0783336263856
    x_d, y_d, token = create_token(sample_lat, sample_lon)
    print(f"lat={sample_lat}, lon={sample_lon} -> x_d={x_d}, y_d={y_d}, token={token}")
