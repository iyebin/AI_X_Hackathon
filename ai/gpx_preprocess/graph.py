from pathlib import Path
import xml.etree.ElementTree as ET

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


# ============================================================
# 설정
# ============================================================

# gpx 폴더 아래의 모든 .gpx 파일
GPX_DIR = Path("gpx")
GPX_PATHS = sorted(GPX_DIR.glob("*.gpx"))

# 하위 폴더까지 모두 찾고 싶으면 위 줄 대신 사용
# GPX_PATHS = sorted(GPX_DIR.rglob("*.gpx"))

OUTPUT_PATH = Path("gpx_gap_distribution_all.png")

TIME_LIMIT_SEC = 60
DISTANCE_LIMIT_M = 30

TIME_BIN_WIDTH_SEC = 1
DISTANCE_BIN_WIDTH_M = 0.5

NS = {
    "gpx": "http://www.topografix.com/GPX/1/1",
}# gpx 폴더 아래의 모든 .gpx 파일
GPX_DIR = Path("gpx")
GPX_PATHS = sorted(GPX_DIR.glob("*.gpx"))

# 하위 폴더까지 모두 찾고 싶으면 위 줄 대신 사용
# GPX_PATHS = sorted(GPX_DIR.rglob("*.gpx"))

OUTPUT_PATH = Path("gpx_gap_distribution_all.png")

TIME_LIMIT_SEC = 60
DISTANCE_LIMIT_M = 30

TIME_BIN_WIDTH_SEC = 1
DISTANCE_BIN_WIDTH_M = 0.5

NS = {
    "gpx": "http://www.topografix.com/GPX/1/1",
}
# 논문 그래프의 표시 범위
TIME_LIMIT_SEC = 60
DISTANCE_LIMIT_M = 30

# 막대 폭
TIME_BIN_WIDTH_SEC = 1
DISTANCE_BIN_WIDTH_M = 0.5


# GPX 1.1 기본 XML 네임스페이스
NS = {
    "gpx": "http://www.topografix.com/GPX/1/1",
}


# ============================================================
# 위경도 두 점 사이의 거리 계산
# Haversine 공식, 반환 단위는 meter
# ============================================================

def haversine_m(
    lat1: np.ndarray,
    lon1: np.ndarray,
    lat2: np.ndarray,
    lon2: np.ndarray,
) -> np.ndarray:
    earth_radius_m = 6_371_000.0

    lat1_rad = np.radians(lat1)
    lon1_rad = np.radians(lon1)
    lat2_rad = np.radians(lat2)
    lon2_rad = np.radians(lon2)

    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad

    a = (
        np.sin(delta_lat / 2.0) ** 2
        + np.cos(lat1_rad)
        * np.cos(lat2_rad)
        * np.sin(delta_lon / 2.0) ** 2
    )

    # 부동소수점 오차 방지
    a = np.clip(a, 0.0, 1.0)

    return (
        2.0
        * earth_radius_m
        * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    )


# ============================================================
# GPX 파일 읽기
# ============================================================

def read_gpx(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"GPX 파일을 찾을 수 없습니다: {path.resolve()}"
        )

    root = ET.parse(path).getroot()

    rows: list[dict] = []

    # GPX 파일에 여러 trkseg가 있을 수 있으므로
    # 각 segment를 따로 구분합니다.
    for segment_id, segment in enumerate(
        root.findall(".//gpx:trkseg", NS)
    ):
        points = segment.findall("gpx:trkpt", NS)

        for point_order, point in enumerate(points):
            time_node = point.find("gpx:time", NS)
            elevation_node = point.find("gpx:ele", NS)

            # 시간 정보가 없는 포인트는 간격 계산이 불가능
            if time_node is None or not time_node.text:
                continue

            rows.append(
                {
                    "segment_id": segment_id,
                    "point_order": point_order,
                    "time": time_node.text,
                    "latitude": float(point.attrib["lat"]),
                    "longitude": float(point.attrib["lon"]),
                    "elevation": (
                        float(elevation_node.text)
                        if elevation_node is not None
                        and elevation_node.text
                        else np.nan
                    ),
                }
            )

    if not rows:
        raise ValueError(
            "GPX 파일에서 trkpt 및 time 데이터를 찾지 못했습니다."
        )

    df = pd.DataFrame(rows)

    # GPX의 Z 시간은 UTC입니다.
    df["time"] = pd.to_datetime(
        df["time"],
        utc=True,
        errors="coerce",
    )

    df = (
        df.dropna(subset=["time"])
        .sort_values(
            ["segment_id", "time", "point_order"],
            kind="stable",
        )
        .reset_index(drop=True)
    )

    return df


# ============================================================
# 연속 GPS 포인트 사이의 시간 및 거리 계산
# ============================================================

def calculate_gaps(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()

    # 같은 trkseg 안에서만 이전 포인트와 비교
    result["time_gap_sec"] = (
        result.groupby("segment_id")["time"]
        .diff()
        .dt.total_seconds()
    )

    previous_latitude = (
        result.groupby("segment_id")["latitude"].shift()
    )
    previous_longitude = (
        result.groupby("segment_id")["longitude"].shift()
    )

    has_previous_point = (
        previous_latitude.notna()
        & previous_longitude.notna()
    )

    result["distance_gap_m"] = np.nan

    result.loc[
        has_previous_point,
        "distance_gap_m",
    ] = haversine_m(
        previous_latitude[has_previous_point].to_numpy(),
        previous_longitude[has_previous_point].to_numpy(),
        result.loc[
            has_previous_point,
            "latitude",
        ].to_numpy(),
        result.loc[
            has_previous_point,
            "longitude",
        ].to_numpy(),
    )

    # 시간이 역전되거나 같은 시각인 데이터 제거
    result = result[
        (result["time_gap_sec"] > 0)
        & result["distance_gap_m"].notna()
    ].copy()

    return result


# ============================================================
# 시간 간격 그래프에서 y축을 끊을 범위 계산
# ============================================================

def calculate_broken_axis_range(
    percentages: np.ndarray,
) -> tuple[float, float, float]:
    positive_values = percentages[
        percentages > 0
    ]

    peak = float(positive_values.max())

    if len(positive_values) < 2:
        return (
            peak * 0.15,
            peak * 0.75,
            peak * 1.05,
        )

    sorted_values = np.sort(positive_values)[::-1]

    # 막대 높이가 갑자기 크게 달라지는 위치 탐색
    ratios = (
        sorted_values[:-1]
        / np.maximum(sorted_values[1:], 1e-12)
    )

    break_index = int(np.argmax(ratios))

    lowest_high_value = sorted_values[break_index]
    highest_low_value = sorted_values[break_index + 1]

    lower_axis_max = highest_low_value * 1.25
    upper_axis_min = lowest_high_value * 0.85
    upper_axis_max = peak * 1.05

    # 두 영역이 겹칠 경우 안전한 기본값 사용
    if upper_axis_min <= lower_axis_max:
        lower_axis_max = peak * 0.45
        upper_axis_min = peak * 0.60

    return (
        float(lower_axis_max),
        float(upper_axis_min),
        float(upper_axis_max),
    )


# ============================================================
# 그래프 생성
# ============================================================

def plot_distributions(
    gaps: pd.DataFrame,
    output_path: Path,
) -> None:
    time_gaps = gaps["time_gap_sec"].to_numpy()
    distance_gaps = gaps["distance_gap_m"].to_numpy()

    # ----------------------------------------
    # 그래프 1: 60초 이하 시간 간격
    # ----------------------------------------

    time_for_plot = time_gaps[
        time_gaps <= TIME_LIMIT_SEC
    ]

    time_bins = np.arange(
        0,
        TIME_LIMIT_SEC + TIME_BIN_WIDTH_SEC,
        TIME_BIN_WIDTH_SEC,
    )

    time_counts, time_edges = np.histogram(
        time_for_plot,
        bins=time_bins,
    )

    # 분모는 60초 이하 데이터가 아니라 전체 유효 포인트 쌍
    # 따라서 60초 이하 비율도 함께 반영됩니다.
    time_percent = (
        time_counts
        / len(time_gaps)
        * 100.0
    )

    time_centers = (
        time_edges[:-1]
        + time_edges[1:]
    ) / 2.0

    time_widths = np.diff(time_edges)

    (
        lower_axis_max,
        upper_axis_min,
        upper_axis_max,
    ) = calculate_broken_axis_range(
        time_percent
    )

    # ----------------------------------------
    # Figure 배치
    # 위쪽 두 축은 y축이 끊어진 시간 그래프
    # 아래쪽은 거리 그래프
    # ----------------------------------------

    figure = plt.figure(
        figsize=(8, 10)
    )

    grid = figure.add_gridspec(
        4,
        1,
        height_ratios=[
            1.0,
            2.2,
            0.35,
            3.0,
        ],
        hspace=0.08,
    )

    time_top_axis = figure.add_subplot(
        grid[0]
    )

    time_bottom_axis = figure.add_subplot(
        grid[1],
        sharex=time_top_axis,
    )

    distance_axis = figure.add_subplot(
        grid[3]
    )

    # 동일한 시간 막대를 위·아래 축에 모두 그림
    for axis in (
        time_top_axis,
        time_bottom_axis,
    ):
        axis.bar(
            time_centers,
            time_percent,
            width=time_widths,
            align="center",
        )

        axis.set_xlim(
            0,
            TIME_LIMIT_SEC,
        )

    time_bottom_axis.set_ylim(
        0,
        lower_axis_max,
    )

    time_top_axis.set_ylim(
        upper_axis_min,
        upper_axis_max,
    )

    # 두 축의 맞닿은 선 숨기기
    time_top_axis.spines[
        "bottom"
    ].set_visible(False)

    time_bottom_axis.spines[
        "top"
    ].set_visible(False)

    time_top_axis.tick_params(
        axis="x",
        which="both",
        bottom=False,
        labelbottom=False,
    )

    time_bottom_axis.set_xlabel(
        "Time gap between points (sec)"
    )

    time_bottom_axis.set_ylabel(
        "Percent (%)"
    )

    # 끊어진 y축을 나타내는 대각선
    break_size = 0.012

    top_break_options = {
        "transform": time_top_axis.transAxes,
        "clip_on": False,
    }

    bottom_break_options = {
        "transform": time_bottom_axis.transAxes,
        "clip_on": False,
    }

    time_top_axis.plot(
        (-break_size, break_size),
        (-break_size, break_size),
        **top_break_options,
    )

    time_top_axis.plot(
        (1 - break_size, 1 + break_size),
        (-break_size, break_size),
        **top_break_options,
    )

    time_bottom_axis.plot(
        (-break_size, break_size),
        (1 - break_size, 1 + break_size),
        **bottom_break_options,
    )

    time_bottom_axis.plot(
        (1 - break_size, 1 + break_size),
        (1 - break_size, 1 + break_size),
        **bottom_break_options,
    )

    # ----------------------------------------
    # 그래프 2: 30m 이하 거리 간격
    # ----------------------------------------

    distance_for_plot = distance_gaps[
        distance_gaps <= DISTANCE_LIMIT_M
    ]

    distance_bins = np.arange(
        0,
        DISTANCE_LIMIT_M
        + DISTANCE_BIN_WIDTH_M,
        DISTANCE_BIN_WIDTH_M,
    )

    distance_axis.hist(
        distance_for_plot,
        bins=distance_bins,
    )

    distance_axis.set_xlim(
        0,
        DISTANCE_LIMIT_M,
    )

    distance_axis.set_xlabel(
        "Distance gap between points (m)"
    )

    distance_axis.set_ylabel(
        "Number of point pairs"
    )

    figure.savefig(
        output_path,
        dpi=200,
        bbox_inches="tight",
    )

    plt.show()


# ============================================================
# 실행
# ============================================================

def main() -> None:
    if not GPX_DIR.exists():
        raise FileNotFoundError(
            f"GPX 폴더를 찾을 수 없습니다: {GPX_DIR.resolve()}"
        )

    if not GPX_PATHS:
        raise FileNotFoundError(
            f"{GPX_DIR.resolve()} 폴더에 GPX 파일이 없습니다."
        )

    all_gaps: list[pd.DataFrame] = []
    summary_rows: list[dict] = []

    total_points = 0
    success_count = 0

    print(f"검색된 GPX 파일: {len(GPX_PATHS):,}개")
    print("-" * 70)

    for path in GPX_PATHS:
        try:
            # 파일 하나를 읽고
            points = read_gpx(path)

            # 반드시 해당 파일 내부에서 먼저 간격 계산
            gaps = calculate_gaps(points)

            if gaps.empty:
                print(f"[건너뜀] {path.name}: 유효한 포인트 쌍이 없음")
                continue

            gaps["source_file"] = path.name
            all_gaps.append(gaps)

            point_count = len(points)
            gap_count = len(gaps)

            time_under_60 = (
                gaps["time_gap_sec"] <= TIME_LIMIT_SEC
            )

            distance_under_30 = (
                gaps["distance_gap_m"] <= DISTANCE_LIMIT_M
            )

            summary_rows.append(
                {
                    "file": path.name,
                    "point_count": point_count,
                    "gap_count": gap_count,
                    "time_under_60_count": int(
                        time_under_60.sum()
                    ),
                    "time_under_60_percent": (
                        time_under_60.mean() * 100
                    ),
                    "distance_under_30_count": int(
                        distance_under_30.sum()
                    ),
                    "distance_under_30_percent": (
                        distance_under_30.mean() * 100
                    ),
                    "median_time_gap_sec": (
                        gaps["time_gap_sec"].median()
                    ),
                    "median_distance_gap_m": (
                        gaps["distance_gap_m"].median()
                    ),
                }
            )

            total_points += point_count
            success_count += 1

            print(
                f"[완료] {path.name}\n"
                f"       포인트: {point_count:,}개, "
                f"포인트 쌍: {gap_count:,}개"
            )

        except ET.ParseError as error:
            print(
                f"[XML 오류] {path.name}: {error}"
            )

        except (ValueError, KeyError, TypeError) as error:
            print(
                f"[데이터 오류] {path.name}: {error}"
            )

        except OSError as error:
            print(
                f"[파일 오류] {path.name}: {error}"
            )

    if not all_gaps:
        raise ValueError(
            "분석 가능한 GPX 파일이 하나도 없습니다."
        )

    # 파일별 간격 계산이 끝난 결과만 결합
    combined_gaps = pd.concat(
        all_gaps,
        ignore_index=True,
    )

    summary = pd.DataFrame(summary_rows)

    # 파일별 통계 저장
    summary_path = Path("gpx_file_summary.csv")
    summary.to_csv(
        summary_path,
        index=False,
        encoding="utf-8-sig",
    )

    time_under_60 = (
        combined_gaps["time_gap_sec"]
        <= TIME_LIMIT_SEC
    )

    distance_under_30 = (
        combined_gaps["distance_gap_m"]
        <= DISTANCE_LIMIT_M
    )

    print("-" * 70)
    print(f"정상 처리 파일: {success_count:,}개")
    print(f"전체 GPS 포인트: {total_points:,}개")
    print(
        "전체 연속 포인트 쌍: "
        f"{len(combined_gaps):,}개"
    )

    print(
        "60초 이하 시간 간격: "
        f"{time_under_60.sum():,}개 "
        f"({time_under_60.mean() * 100:.2f}%)"
    )

    print(
        "30m 이하 거리 간격: "
        f"{distance_under_30.sum():,}개 "
        f"({distance_under_30.mean() * 100:.2f}%)"
    )

    print(
        "전체 시간 간격 중앙값: "
        f"{combined_gaps['time_gap_sec'].median():.2f}초"
    )

    print(
        "전체 거리 간격 중앙값: "
        f"{combined_gaps['distance_gap_m'].median():.2f}m"
    )

    # 기존 그래프 함수 그대로 사용
    plot_distributions(
        combined_gaps,
        OUTPUT_PATH,
    )

    print(
        f"그래프 저장 완료: {OUTPUT_PATH.resolve()}"
    )

    print(
        f"파일별 통계 저장 완료: {summary_path.resolve()}"
    )


if __name__ == "__main__":
    main()