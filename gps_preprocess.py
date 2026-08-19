from datetime import datetime
from pyproj import Transformer


GRID_SIZE_M = 50

transformer = Transformer.from_crs(
    "EPSG:4326",
    "EPSG:5179",
    always_xy=True,
)


def gps_to_grid_token(
    latitude: float,
    longitude: float,
) -> str:
    x, y = transformer.transform(
        longitude,
        latitude,
    )

    grid_x = int(x // GRID_SIZE_M)
    grid_y = int(y // GRID_SIZE_M)

    return f"gps_{grid_x}_{grid_y}"


def records_to_gps_tokens(
    records,
    maximum_tokens: int,
) -> list[str]:
    records = sorted(
        records,
        key=lambda row: row.measured_at,
    )

    tokens = []

    for record in records:
        token = gps_to_grid_token(
            latitude=record.latitude,
            longitude=record.longitude,
        )

        # 연속 중복 제거
        if not tokens or tokens[-1] != token:
            tokens.append(token)

    return tokens[-maximum_tokens:]