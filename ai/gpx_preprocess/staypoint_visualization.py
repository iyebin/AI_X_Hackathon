from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from pyproj import Transformer

# 지도 배경은 선택 기능입니다.
try:
    import contextily as ctx

    CONTEXTILY_AVAILABLE = True
except ImportError:
    CONTEXTILY_AVAILABLE = False


# ============================================================
# 설정
# ============================================================

RAW_GPS_PATH = Path("output/raw_gps_points.tsv")
STAYPOINTS_PATH = Path("output/staypoints.tsv")
VENUES_PATH = Path("output/venues.tsv")

OUTPUT_DIR = Path("output/visualization")

# None이면 전체 사용자를 각각 그림으로 생성합니다.
# 특정 사용자만 보려면 "daon", "yebin", "yubeen" 등으로 설정하세요.
USER_ID: str | None = None

# 지도 타일을 표시할지 여부
# 인터넷 연결이 필요합니다.
USE_BASEMAP = True

# GPS 기록 공백이 이 값보다 크면 선을 끊습니다.
# 서로 관측되지 않은 두 위치를 직선으로 연결하는 것을 방지합니다.
MAX_LINE_GAP_MINUTES = 30

# staypoint를 실제 한 번의 체류 사건으로 표시
SHOW_STAYPOINTS = True

# venue를 반복 방문 장소 중심으로 추가 표시
SHOW_VENUES = True

# 체류 시간에 따라 마커 크기를 다르게 표시
SIZE_BY_DWELL_TIME = True

# 마커 크기 범위
MIN_MARKER_SIZE = 70
MAX_MARKER_SIZE = 240

# 지도 주변 여백 비율
MAP_PADDING_RATIO = 0.08


# ============================================================
# 데이터 읽기
# ============================================================

def read_input_files() -> tuple[
    pd.DataFrame,
    pd.DataFrame,
    pd.DataFrame | None,
]:
    if not RAW_GPS_PATH.exists():
        raise FileNotFoundError(
            f"파일을 찾을 수 없습니다: {RAW_GPS_PATH.resolve()}"
        )

    if not STAYPOINTS_PATH.exists():
        raise FileNotFoundError(
            f"파일을 찾을 수 없습니다: {STAYPOINTS_PATH.resolve()}"
        )

    raw = pd.read_csv(
        RAW_GPS_PATH,
        sep="\t",
    )

    stays = pd.read_csv(
        STAYPOINTS_PATH,
        sep="\t",
    )

    venues = None

    if VENUES_PATH.exists():
        venues = pd.read_csv(
            VENUES_PATH,
            sep="\t",
        )

    validate_columns(
        raw,
        {
            "uid",
            "source_file",
            "segment_id",
            "point_order",
            "datetime_utc",
            "lat",
            "lng",
        },
        "raw_gps_points.tsv",
    )

    validate_columns(
        stays,
        {
            "userid",
            "stay_id",
            "checkintime",
            "leaving_datetime",
            "dwell_minutes",
            "longitude",
            "latitude",
            "cluster",
            "venueid",
        },
        "staypoints.tsv",
    )

    raw["datetime_utc"] = pd.to_datetime(
        raw["datetime_utc"],
        utc=True,
        errors="coerce",
    )

    stays["checkintime"] = pd.to_datetime(
        stays["checkintime"],
        utc=True,
        errors="coerce",
    )

    stays["leaving_datetime"] = pd.to_datetime(
        stays["leaving_datetime"],
        utc=True,
        errors="coerce",
    )

    raw = raw.dropna(
        subset=[
            "uid",
            "datetime_utc",
            "lat",
            "lng",
        ]
    ).copy()

    stays = stays.dropna(
        subset=[
            "userid",
            "checkintime",
            "latitude",
            "longitude",
            "cluster",
        ]
    ).copy()

    raw["uid"] = raw["uid"].astype(str)
    stays["userid"] = stays["userid"].astype(str)
    stays["cluster"] = stays["cluster"].astype(int)

    if venues is not None:
        validate_columns(
            venues,
            {
                "userid",
                "cluster",
                "venueid",
                "longitude",
                "latitude",
            },
            "venues.tsv",
        )

        venues["userid"] = venues["userid"].astype(str)
        venues["cluster"] = venues["cluster"].astype(int)

    return raw, stays, venues


def validate_columns(
    df: pd.DataFrame,
    required: set[str],
    filename: str,
) -> None:
    missing = required - set(df.columns)

    if missing:
        raise ValueError(
            f"{filename}에 필요한 컬럼이 없습니다: "
            f"{sorted(missing)}"
        )


# ============================================================
# 지도 좌표계 변환
# ============================================================

def convert_to_web_mercator(
    longitude: pd.Series,
    latitude: pd.Series,
) -> tuple[np.ndarray, np.ndarray]:
    """
    WGS84 위경도를 웹 지도용 EPSG:3857 좌표로 변환합니다.
    """

    transformer = Transformer.from_crs(
        "EPSG:4326",
        "EPSG:3857",
        always_xy=True,
    )

    x, y = transformer.transform(
        longitude.to_numpy(dtype=float),
        latitude.to_numpy(dtype=float),
    )

    return np.asarray(x), np.asarray(y)


# ============================================================
# 긴 시간 공백을 기준으로 궤적 선 분리
# ============================================================

def assign_line_blocks(
    user_raw: pd.DataFrame,
) -> pd.DataFrame:
    result = user_raw.copy()

    result = result.sort_values(
        [
            "source_file",
            "segment_id",
            "datetime_utc",
            "point_order",
        ],
        kind="stable",
    ).reset_index(drop=True)

    group_keys = [
        "source_file",
        "segment_id",
    ]

    previous_time = (
        result.groupby(group_keys)["datetime_utc"]
        .shift()
    )

    time_gap_minutes = (
        result["datetime_utc"] - previous_time
    ).dt.total_seconds() / 60

    source_or_segment_start = previous_time.isna()

    large_time_gap = (
        time_gap_minutes
        > MAX_LINE_GAP_MINUTES
    )

    result["new_line_block"] = (
        source_or_segment_start
        | large_time_gap
    )

    result["line_block"] = (
        result["new_line_block"]
        .cumsum()
        .astype(int)
    )

    return result


# ============================================================
# 마커 크기
# ============================================================

def calculate_marker_sizes(
    dwell_minutes: pd.Series,
) -> np.ndarray:
    if not SIZE_BY_DWELL_TIME:
        return np.full(
            len(dwell_minutes),
            110.0,
        )

    values = (
        pd.to_numeric(
            dwell_minutes,
            errors="coerce",
        )
        .fillna(0)
        .clip(lower=0)
        .to_numpy()
    )

    # 장기 체류 하나가 너무 커지는 것을 방지하기 위해
    # 제곱근 스케일을 사용합니다.
    scaled = np.sqrt(values)

    if len(scaled) == 0:
        return np.array([])

    min_value = float(scaled.min())
    max_value = float(scaled.max())

    if max_value == min_value:
        return np.full(
            len(scaled),
            (MIN_MARKER_SIZE + MAX_MARKER_SIZE) / 2,
        )

    normalized = (
        scaled - min_value
    ) / (
        max_value - min_value
    )

    return (
        MIN_MARKER_SIZE
        + normalized
        * (MAX_MARKER_SIZE - MIN_MARKER_SIZE)
    )


# ============================================================
# 지도 범위 설정
# ============================================================

def set_padded_limits(
    ax: plt.Axes,
    x_values: np.ndarray,
    y_values: np.ndarray,
) -> None:
    min_x = float(np.nanmin(x_values))
    max_x = float(np.nanmax(x_values))
    min_y = float(np.nanmin(y_values))
    max_y = float(np.nanmax(y_values))

    width = max_x - min_x
    height = max_y - min_y

    # 한 축의 이동 범위가 거의 없는 경우를 위한 최소 여백
    x_padding = max(
        width * MAP_PADDING_RATIO,
        500,
    )

    y_padding = max(
        height * MAP_PADDING_RATIO,
        500,
    )

    ax.set_xlim(
        min_x - x_padding,
        max_x + x_padding,
    )

    ax.set_ylim(
        min_y - y_padding,
        max_y + y_padding,
    )


# ============================================================
# 사용자 한 명 시각화
# ============================================================

def plot_user(
    user_id: str,
    raw: pd.DataFrame,
    stays: pd.DataFrame,
    venues: pd.DataFrame | None,
) -> None:
    user_raw = raw[
        raw["uid"] == user_id
    ].copy()

    user_stays = stays[
        stays["userid"] == user_id
    ].copy()

    if user_raw.empty:
        print(
            f"[건너뜀] {user_id}: GPS 포인트가 없습니다."
        )
        return

    user_raw = assign_line_blocks(
        user_raw
    )

    raw_x, raw_y = convert_to_web_mercator(
        user_raw["lng"],
        user_raw["lat"],
    )

    user_raw["map_x"] = raw_x
    user_raw["map_y"] = raw_y

    if not user_stays.empty:
        stay_x, stay_y = convert_to_web_mercator(
            user_stays["longitude"],
            user_stays["latitude"],
        )

        user_stays["map_x"] = stay_x
        user_stays["map_y"] = stay_y

    user_venues = None

    if venues is not None:
        user_venues = venues[
            venues["userid"] == user_id
        ].copy()

        if not user_venues.empty:
            venue_x, venue_y = convert_to_web_mercator(
                user_venues["longitude"],
                user_venues["latitude"],
            )

            user_venues["map_x"] = venue_x
            user_venues["map_y"] = venue_y

    figure, ax = plt.subplots(
        figsize=(10, 11),
    )

    # --------------------------------------------------------
    # 1. 전체 GPS 궤적
    # --------------------------------------------------------

    for _, block in user_raw.groupby(
        "line_block",
        sort=False,
    ):
        if len(block) < 2:
            continue

        ax.plot(
            block["map_x"],
            block["map_y"],
            linewidth=1.6,
            alpha=0.85,
            zorder=2,
        )

    # 시작점
    first_point = user_raw.iloc[0]

    ax.scatter(
        first_point["map_x"],
        first_point["map_y"],
        marker="o",
        s=90,
        edgecolors="black",
        linewidths=1,
        zorder=5,
        label="Trajectory start",
    )

    # 종료점
    last_point = user_raw.iloc[-1]

    ax.scatter(
        last_point["map_x"],
        last_point["map_y"],
        marker="X",
        s=100,
        edgecolors="black",
        linewidths=1,
        zorder=5,
        label="Trajectory end",
    )

    # --------------------------------------------------------
    # 2. staypoint: 한 번의 체류 사건
    # --------------------------------------------------------

    if SHOW_STAYPOINTS and not user_stays.empty:
        marker_sizes = calculate_marker_sizes(
            user_stays["dwell_minutes"]
        )

        scatter = ax.scatter(
            user_stays["map_x"],
            user_stays["map_y"],
            c=user_stays["cluster"],
            cmap="tab20",
            s=marker_sizes,
            marker="D",
            edgecolors="black",
            linewidths=1.1,
            alpha=0.88,
            zorder=6,
            label="Stay point",
        )

        # 각 체류 사건 옆에 cluster 번호 표시
        for row in user_stays.itertuples():
            ax.annotate(
                str(row.cluster),
                xy=(row.map_x, row.map_y),
                xytext=(5, 5),
                textcoords="offset points",
                fontsize=8,
                zorder=8,
            )

        colorbar = figure.colorbar(
            scatter,
            ax=ax,
            fraction=0.035,
            pad=0.02,
        )

        colorbar.set_label(
            "Stay cluster"
        )

    # --------------------------------------------------------
    # 3. venue: 반복 방문 장소 중심
    # --------------------------------------------------------

    if (
        SHOW_VENUES
        and user_venues is not None
        and not user_venues.empty
    ):
        ax.scatter(
            user_venues["map_x"],
            user_venues["map_y"],
            facecolors="none",
            edgecolors="black",
            s=300,
            marker="o",
            linewidths=2,
            zorder=7,
            label="Repeated venue center",
        )

    # --------------------------------------------------------
    # 4. 지도 범위와 배경
    # --------------------------------------------------------

    set_padded_limits(
        ax,
        user_raw["map_x"].to_numpy(),
        user_raw["map_y"].to_numpy(),
    )

    if USE_BASEMAP:
        if CONTEXTILY_AVAILABLE:
            try:
                ctx.add_basemap(
                    ax,
                    crs="EPSG:3857",
                    source=ctx.providers.OpenStreetMap.Mapnik,
                    attribution_size=6,
                    zorder=0,
                )
            except Exception as error:
                print(
                    f"[지도 배경 실패] {user_id}: {error}"
                )
        else:
            print(
                "contextily가 설치되지 않아 "
                "지도 배경을 생략합니다."
            )

    ax.set_title(
        f"{user_id}: trajectory and extracted stay points\n"
        f"GPS points={len(user_raw):,}, "
        f"stay points={len(user_stays):,}, "
        f"venues={0 if user_venues is None else len(user_venues):,}"
    )

    ax.set_xlabel("Web Mercator X")
    ax.set_ylabel("Web Mercator Y")

    ax.legend(
        loc="best",
        fontsize=8,
    )

    ax.set_aspect(
        "equal",
        adjustable="box",
    )

    figure.tight_layout()

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    output_path = (
        OUTPUT_DIR
        / f"{user_id}_trajectory_staypoints.png"
    )

    figure.savefig(
        output_path,
        dpi=250,
        bbox_inches="tight",
    )

    plt.show()
    plt.close(figure)

    print(
        f"[저장 완료] {output_path.resolve()}"
    )


# ============================================================
# 전체 실행
# ============================================================

def main() -> None:
    raw, stays, venues = read_input_files()

    available_users = sorted(
        set(raw["uid"])
        & set(stays["userid"])
    )

    print(
        "GPS와 staypoint가 모두 존재하는 사용자:",
        ", ".join(available_users),
    )

    if USER_ID is not None:
        if USER_ID not in set(raw["uid"]):
            raise ValueError(
                f"raw GPS에 사용자가 없습니다: {USER_ID}"
            )

        plot_user(
            USER_ID,
            raw,
            stays,
            venues,
        )

        return

    for user_id in available_users:
        plot_user(
            user_id,
            raw,
            stays,
            venues,
        )


if __name__ == "__main__":
    main()