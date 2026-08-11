from __future__ import annotations

from pathlib import Path
import re
import xml.etree.ElementTree as ET

import numpy as np
import pandas as pd
import skmob
from pyproj import Transformer
from skmob.preprocessing import clustering, detection


# ============================================================
# 설정
# ============================================================

GPX_DIR = Path("gpx")
OUTPUT_DIR = Path("output")

# 논문에서 사용한 체류 지점 기준
STAY_RADIUS_M = 50.0
MIN_STAY_MINUTES = 30.0

# 반복 방문 장소를 묶을 반경
# 우선 논문 체류 반경과 같은 50m를 baseline으로 사용
VENUE_CLUSTER_RADIUS_M = 50.0

# 긴 데이터 공백 전후 위치가 서로 멀다면,
# 실제 이동 경로가 관측되지 않은 것으로 판단하여 궤적을 분리
UNOBSERVED_GAP_MINUTES = 120.0

# 한국 전역에서 사용할 수 있는 미터 기반 좌표계 예시
# 연구 지역에 맞는 좌표계를 확정하고 논문에 반드시 명시해야 함
PROJECTED_CRS = "EPSG:5179"

# 결과 시간대
OUTPUT_TIMEZONE = "Asia/Seoul"

# True이면 사용자별 하위 폴더까지 모두 탐색
SEARCH_RECURSIVELY = True


# ============================================================
# 유틸리티
# ============================================================

def local_name(tag: str) -> str:
    """
    XML namespace가 붙은 태그에서 실제 태그 이름만 반환합니다.

    예:
    {http://www.topografix.com/GPX/1/1}trkpt -> trkpt
    """
    return tag.rsplit("}", 1)[-1]


def get_child_text(
    element: ET.Element,
    child_name: str,
) -> str | None:
    """
    직접 자식 중 원하는 태그의 텍스트를 반환합니다.
    """
    for child in element:
        if local_name(child.tag) == child_name:
            return child.text

    return None


def infer_user_id(path: Path) -> str:
    """
    GPX 경로에서 사용자 ID를 생성합니다.

    우선순위:
    1. 사용자별 하위 폴더가 있으면 폴더 이름 사용
    2. 한 폴더에 파일이 있으면 파일명의 첫 '_' 또는 '-' 앞부분 사용

    예:
    gpx/user01/day01.gpx       -> user01
    gpx/user01_20260727.gpx    -> user01
    """

    relative_path = path.relative_to(GPX_DIR)

    # gpx/user01/day01.gpx 같은 구조
    if len(relative_path.parts) >= 2:
        return relative_path.parts[0]

    # gpx/user01_day01.gpx 같은 구조
    stem = path.stem
    user_id = re.split(r"[_-]", stem, maxsplit=1)[0]

    return user_id


# ============================================================
# 거리 계산
# ============================================================

def haversine_m(
    lat1: np.ndarray,
    lon1: np.ndarray,
    lat2: np.ndarray,
    lon2: np.ndarray,
) -> np.ndarray:
    """
    위경도 좌표 사이의 대권거리를 미터로 계산합니다.
    """
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

    a = np.clip(a, 0.0, 1.0)

    return (
        2.0
        * earth_radius_m
        * np.arctan2(
            np.sqrt(a),
            np.sqrt(1.0 - a),
        )
    )


# ============================================================
# GPX 파일 검색
# ============================================================

def find_gpx_files() -> list[Path]:
    if not GPX_DIR.exists():
        raise FileNotFoundError(
            f"GPX 폴더를 찾을 수 없습니다: {GPX_DIR.resolve()}"
        )

    if SEARCH_RECURSIVELY:
        paths = sorted(GPX_DIR.rglob("*.gpx"))
    else:
        paths = sorted(GPX_DIR.glob("*.gpx"))

    if not paths:
        raise FileNotFoundError(
            f"GPX 파일이 없습니다: {GPX_DIR.resolve()}"
        )

    return paths


# ============================================================
# GPX 한 파일 읽기
# ============================================================

def read_one_gpx(path: Path) -> pd.DataFrame:
    """
    GPX 파일을 일반 GPS 포인트 테이블로 변환합니다.

    반환 컬럼:
    uid, source_file, segment_id, point_order,
    datetime, lat, lng, elevation
    """

    root = ET.parse(path).getroot()

    rows: list[dict] = []
    user_id = infer_user_id(path)

    segments = [
        element
        for element in root.iter()
        if local_name(element.tag) == "trkseg"
    ]

    for segment_index, segment in enumerate(segments):
        point_order = 0

        for point in segment:
            if local_name(point.tag) != "trkpt":
                continue

            latitude_text = point.attrib.get("lat")
            longitude_text = point.attrib.get("lon")
            time_text = get_child_text(point, "time")
            elevation_text = get_child_text(point, "ele")

            if (
                latitude_text is None
                or longitude_text is None
                or time_text is None
            ):
                continue

            try:
                latitude = float(latitude_text)
                longitude = float(longitude_text)
            except ValueError:
                continue

            try:
                elevation = (
                    float(elevation_text)
                    if elevation_text is not None
                    else np.nan
                )
            except ValueError:
                elevation = np.nan

            rows.append(
                {
                    "uid": user_id,
                    "source_file": str(path),
                    "segment_id": segment_index,
                    "point_order": point_order,
                    "datetime_text": time_text,
                    "lat": latitude,
                    "lng": longitude,
                    "elevation": elevation,
                }
            )

            point_order += 1

    if not rows:
        raise ValueError(
            f"유효한 trkpt가 없습니다: {path.name}"
        )

    df = pd.DataFrame(rows)

    # GPX의 Z 타임스탬프는 UTC
    df["datetime_utc"] = pd.to_datetime(
        df["datetime_text"],
        utc=True,
        errors="coerce",
    )

    df = df.dropna(
        subset=["datetime_utc", "lat", "lng"]
    )

    # scikit-mobility에는 UTC 기준 timezone-naive datetime 전달
    df["datetime"] = (
        df["datetime_utc"]
        .dt.tz_convert("UTC")
        .dt.tz_localize(None)
    )

    return df


# ============================================================
# 전체 GPX 읽기
# ============================================================

def load_all_gpx() -> pd.DataFrame:
    paths = find_gpx_files()
    frames: list[pd.DataFrame] = []

    print(f"검색된 GPX 파일: {len(paths):,}개")

    for path in paths:
        try:
            frame = read_one_gpx(path)
            frames.append(frame)

            print(
                f"[완료] {path.name}: "
                f"{len(frame):,} points"
            )

        except (ET.ParseError, ValueError, OSError) as error:
            print(f"[건너뜀] {path}: {error}")

    if not frames:
        raise ValueError(
            "분석 가능한 GPX 파일이 하나도 없습니다."
        )

    points = pd.concat(
        frames,
        ignore_index=True,
    )

    # 좌표 범위 검증
    points = points[
        points["lat"].between(-90, 90)
        & points["lng"].between(-180, 180)
    ].copy()

    # 사용자와 시간 순서로 정렬
    points = points.sort_values(
        ["uid", "datetime", "source_file", "point_order"],
        kind="stable",
    ).reset_index(drop=True)

    # 같은 사용자에게 정확히 같은 시간과 좌표가 중복 저장된 경우 제거
    points = points.drop_duplicates(
        subset=["uid", "datetime", "lat", "lng"],
        keep="first",
    )

    # 같은 사용자에게 같은 시각이지만 서로 다른 좌표가 있는 경우
    # 첫 번째 포인트만 유지
    points = points.drop_duplicates(
        subset=["uid", "datetime"],
        keep="first",
    ).reset_index(drop=True)

    return points


# ============================================================
# 긴 데이터 공백 처리
# ============================================================

def assign_trajectory_blocks(
    points: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, str]]:
    """
    관측되지 않은 긴 이동 때문에 잘못된 stay point가 생기는 것을
    줄이기 위해 사용자 궤적을 block으로 분리합니다.

    시간 공백이 2시간 이상이더라도 전후 좌표가 50m 이내이면
    동일 장소에 계속 머물렀을 가능성이 있으므로 분리하지 않습니다.

    시간 공백이 크고 전후 좌표도 50m 이상 떨어져 있으면 분리합니다.
    """

    result = points.copy()

    grouped = result.groupby(
        "uid",
        sort=False,
    )

    previous_time = grouped[
        "datetime"
    ].shift()

    previous_lat = grouped[
        "lat"
    ].shift()

    previous_lng = grouped[
        "lng"
    ].shift()

    result["time_gap_sec"] = (
        result["datetime"] - previous_time
    ).dt.total_seconds()

    has_previous = (
        previous_lat.notna()
        & previous_lng.notna()
    )

    result["distance_gap_m"] = np.nan

    result.loc[
        has_previous,
        "distance_gap_m",
    ] = haversine_m(
        previous_lat[has_previous].to_numpy(),
        previous_lng[has_previous].to_numpy(),
        result.loc[has_previous, "lat"].to_numpy(),
        result.loc[has_previous, "lng"].to_numpy(),
    )

    long_unobserved_move = (
        result["time_gap_sec"]
        > UNOBSERVED_GAP_MINUTES * 60.0
    ) & (
        result["distance_gap_m"]
        > STAY_RADIUS_M
    )

    first_point = previous_time.isna()

    result["new_block"] = (
        first_point | long_unobserved_move
    )

    result["block_number"] = (
        result.groupby("uid")["new_block"]
        .cumsum()
        .astype(int)
    )

    result["block_uid"] = (
        result["uid"].astype(str)
        + "__block_"
        + result["block_number"].astype(str)
    )

    block_to_user = (
        result[
            ["block_uid", "uid"]
        ]
        .drop_duplicates()
        .set_index("block_uid")["uid"]
        .to_dict()
    )

    return result, block_to_user


# ============================================================
# 체류 지점 추출
# ============================================================

def detect_staypoints(
    points: pd.DataFrame,
) -> pd.DataFrame:
    """
    scikit-mobility의 stay_locations를 사용합니다.

    논문 기준:
    - 공간 반경 50m
    - 최소 체류 시간 30분
    """

    points_with_blocks, block_to_user = (
        assign_trajectory_blocks(points)
    )

    mobility_input = points_with_blocks[
        [
            "block_uid",
            "lat",
            "lng",
            "datetime",
        ]
    ].rename(
        columns={
            "block_uid": "uid",
        }
    )

    trajectory = skmob.TrajDataFrame(
        mobility_input,
        latitude="lat",
        longitude="lng",
        datetime="datetime",
        user_id="uid",
    )

    stays = detection.stay_locations(
        trajectory,

        # 체류 위치 중심 병합 관련 기본 비율
        stop_radius_factor=0.5,

        # 논문 기준
        minutes_for_a_stop=MIN_STAY_MINUTES,
        spatial_radius_km=STAY_RADIUS_M / 1000.0,

        # 체류 종료 시각 생성
        leaving_time=True,
    )

    stays = pd.DataFrame(
        stays
    ).reset_index(drop=True)

    if stays.empty:
        raise ValueError(
            "설정된 기준으로 체류 지점이 추출되지 않았습니다."
        )

    # 임시 block uid를 실제 사용자 ID로 복원
    stays["uid"] = (
        stays["uid"]
        .astype(str)
        .map(block_to_user)
    )

    stays = stays.dropna(
        subset=["uid"]
    ).reset_index(drop=True)

    return stays


# ============================================================
# 반복 방문 장소 클러스터링
# ============================================================

def cluster_repeated_places(
    stays: pd.DataFrame,
) -> pd.DataFrame:
    """
    같은 사용자가 서로 다른 날짜에 방문한 가까운 stay point를
    하나의 반복 방문 장소 cluster로 묶습니다.

    사용자별로 독립적으로 클러스터링합니다.
    """

    clustered_parts: list[pd.DataFrame] = []

    for user_id, user_stays in stays.groupby(
        "uid",
        sort=False,
    ):
        user_stays = (
            user_stays
            .sort_values("datetime")
            .reset_index(drop=True)
        )

        user_tdf = skmob.TrajDataFrame(
            user_stays,
            latitude="lat",
            longitude="lng",
            datetime="datetime",
            user_id="uid",
        )

        clustered = clustering.cluster(
            user_tdf,
            cluster_radius_km=(
                VENUE_CLUSTER_RADIUS_M / 1000.0
            ),

            # 한 번만 방문한 장소도 venue로 유지
            min_samples=1,
        )

        clustered = pd.DataFrame(
            clustered
        ).reset_index(drop=True)

        clustered["uid"] = user_id

        # cluster를 1부터 시작하도록 변경
        clustered["cluster"] = (
            clustered["cluster"]
            .astype(int)
            + 1
        )

        clustered_parts.append(
            clustered
        )

    result = pd.concat(
        clustered_parts,
        ignore_index=True,
    )

    return result


# ============================================================
# LM-TAD용 테이블 생성
# ============================================================

def create_output_tables(
    clustered_stays: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    result = clustered_stays.copy()

    result["datetime"] = pd.to_datetime(
        result["datetime"],
        errors="coerce",
    )

    result["leaving_datetime"] = pd.to_datetime(
        result["leaving_datetime"],
        errors="coerce",
    )

    # scikit-mobility에 전달했던 naive 시각을 UTC로 복원하고
    # 한국 시각으로 변환
    result["checkintime"] = (
        result["datetime"]
        .dt.tz_localize("UTC")
        .dt.tz_convert(OUTPUT_TIMEZONE)
    )

    result["leaving_datetime_local"] = (
        result["leaving_datetime"]
        .dt.tz_localize("UTC")
        .dt.tz_convert(OUTPUT_TIMEZONE)
    )

    result["dwell_minutes"] = (
        result["leaving_datetime"]
        - result["datetime"]
    ).dt.total_seconds() / 60.0

    result = result.sort_values(
        ["uid", "checkintime"],
        kind="stable",
    ).reset_index(drop=True)

    result["stay_number"] = (
        result.groupby("uid")
        .cumcount()
        + 1
    )

    result["stay_id"] = (
        result["uid"].astype(str)
        + "_stay_"
        + result["stay_number"]
        .astype(str)
        .str.zfill(4)
    )

    result["venueid"] = (
        result["uid"].astype(str)
        + "_venue_"
        + result["cluster"]
        .astype(int)
        .astype(str)
        .str.zfill(3)
    )

    # POI 매칭 전에는 unknown으로 둠
    result["venuetype"] = "unknown"

    # 위경도(WGS84)를 미터 기반 좌표로 변환
    transformer = Transformer.from_crs(
        "EPSG:4326",
        PROJECTED_CRS,
        always_xy=True,
    )

    x_values, y_values = transformer.transform(
        result["lng"].to_numpy(),
        result["lat"].to_numpy(),
    )

    result["x"] = x_values
    result["y"] = y_values

    staypoints = result[
        [
            "uid",
            "stay_id",
            "checkintime",
            "leaving_datetime_local",
            "dwell_minutes",
            "lng",
            "lat",
            "cluster",
            "venueid",
            "venuetype",
            "x",
            "y",
        ]
    ].rename(
        columns={
            "uid": "userid",
            "lng": "longitude",
            "lat": "latitude",
            "leaving_datetime_local": "leaving_datetime",
        }
    )

    # 반복 방문 장소별 요약 테이블
    venue_summary = (
        staypoints
        .groupby(
            [
                "userid",
                "cluster",
                "venueid",
            ],
            as_index=False,
        )
        .agg(
            longitude=("longitude", "median"),
            latitude=("latitude", "median"),
            x=("x", "median"),
            y=("y", "median"),
            visit_count=("stay_id", "count"),
            total_dwell_minutes=(
                "dwell_minutes",
                "sum",
            ),
            first_visit=(
                "checkintime",
                "min",
            ),
            last_visit=(
                "checkintime",
                "max",
            ),
        )
    )

    return staypoints, venue_summary


# ============================================================
# 사용자별 요약 통계
# ============================================================

def create_user_summary(
    raw_points: pd.DataFrame,
    staypoints: pd.DataFrame,
) -> pd.DataFrame:
    point_summary = (
        raw_points
        .groupby("uid")
        .size()
        .rename("gps_point_count")
    )

    stay_summary = (
        staypoints
        .groupby("userid")
        .agg(
            staypoint_count=("stay_id", "count"),
            venue_count=("venueid", "nunique"),
            total_dwell_minutes=(
                "dwell_minutes",
                "sum",
            ),
        )
    )

    summary = (
        point_summary
        .to_frame()
        .join(
            stay_summary,
            how="left",
        )
        .fillna(
            {
                "staypoint_count": 0,
                "venue_count": 0,
                "total_dwell_minutes": 0,
            }
        )
        .reset_index()
        .rename(columns={"uid": "userid"})
    )

    return summary


# ============================================================
# 실행
# ============================================================

def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    raw_points = load_all_gpx()

    print("-" * 72)
    print(
        f"전체 GPS 포인트: "
        f"{len(raw_points):,}개"
    )

    print(
        f"사용자 수: "
        f"{raw_points['uid'].nunique():,}명"
    )

    stays = detect_staypoints(
        raw_points
    )

    print(
        f"추출된 체류 사건: "
        f"{len(stays):,}개"
    )

    clustered_stays = (
        cluster_repeated_places(stays)
    )

    staypoints, venue_summary = (
        create_output_tables(
            clustered_stays
        )
    )

    user_summary = create_user_summary(
        raw_points,
        staypoints,
    )

    # 원본 GPS 포인트도 CSV로 저장
    raw_output = raw_points.copy()

    raw_output["datetime_local"] = (
        raw_output["datetime_utc"]
        .dt.tz_convert(OUTPUT_TIMEZONE)
    )

    raw_output[
        [
            "uid",
            "source_file",
            "segment_id",
            "point_order",
            "datetime_utc",
            "datetime_local",
            "lat",
            "lng",
            "elevation",
        ]
    ].to_csv(
        OUTPUT_DIR / "raw_gps_points.tsv",
        sep="\t",
        index=False,
        encoding="utf-8",
    )

    staypoints.to_csv(
        OUTPUT_DIR / "staypoints.tsv",
        sep="\t",
        index=False,
        encoding="utf-8",
    )

    venue_summary.to_csv(
        OUTPUT_DIR / "venues.tsv",
        sep="\t",
        index=False,
        encoding="utf-8",
    )

    user_summary.to_csv(
        OUTPUT_DIR / "user_summary.tsv",
        sep="\t",
        index=False,
        encoding="utf-8",
    )

    pol_table = staypoints[
        [
            "userid",
            "checkintime",
            "venueid",
            "venuetype",
            "x",
            "y",
        ]
    ].copy()

    pol_table.to_csv(
        OUTPUT_DIR / "pol_staypoints.tsv",
        sep="\t",
        index=False,
        encoding="utf-8",
    )

    print("-" * 72)

    print(
        f"반복 방문 장소 수: "
        f"{staypoints['venueid'].nunique():,}개"
    )

    print(
        "결과 저장 완료:"
    )

    print(
        OUTPUT_DIR.resolve()
        / "raw_gps_points.tsv"
    )

    print(
        OUTPUT_DIR.resolve()
        / "staypoints.tsv"
    )

    print(
        OUTPUT_DIR.resolve()
        / "venues.tsv"
    )

    print(
        OUTPUT_DIR.resolve()
        / "user_summary.tsv"
    )


if __name__ == "__main__":
    main()