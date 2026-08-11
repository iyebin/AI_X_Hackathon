from pathlib import Path
import math
import xml.etree.ElementTree as ET

import matplotlib.pyplot as plt
import pandas as pd
import os


# ============================================================
# 설정
# ============================================================

GPX_DIR = Path("gpx")

# 하위 폴더까지 모두 탐색할지 여부
SEARCH_RECURSIVELY = True

# 파일명에서 사용자 이름 추출 방식
# True면 user1_day1.gpx -> user1 로 묶음
# False면 파일 하나당 subplot 하나씩 그림
GROUP_BY_PREFIX_BEFORE_UNDERSCORE = True

# 저장 파일명
OUTPUT_PATH = Path("gpx/gpx_trajectory_grid.png")

# 한 줄에 몇 개 subplot을 둘지
N_COLS = 8

# subplot 크기
SUBPLOT_WIDTH = 2.3
SUBPLOT_HEIGHT = 2.0

# GPX 네임스페이스
NS = {
    "gpx": "http://www.topografix.com/GPX/1/1",
}


# ============================================================
# GPX 파일 찾기
# ============================================================

def find_gpx_files(directory: Path) -> list[Path]:
    if not directory.exists():
        raise FileNotFoundError(
            f"GPX 폴더를 찾을 수 없습니다: {directory.resolve()}"
        )

    if SEARCH_RECURSIVELY:
        paths = sorted(directory.rglob("*.gpx"))
    else:
        paths = sorted(directory.glob("*.gpx"))

    if not paths:
        raise FileNotFoundError(
            f"GPX 파일이 없습니다: {directory.resolve()}"
        )

    return paths


# ============================================================
# 사용자 이름 추출
# ============================================================

def get_group_name(path: Path) -> str:
    stem = path.stem

    if GROUP_BY_PREFIX_BEFORE_UNDERSCORE and "_" in stem:
        return stem.split("_")[0]

    return stem


# ============================================================
# GPX 읽기
# ============================================================

def read_gpx(path: Path) -> pd.DataFrame:
    root = ET.parse(path).getroot()

    rows = []

    segments = root.findall(".//gpx:trkseg", NS)

    for segment_id, segment in enumerate(segments):
        points = segment.findall("gpx:trkpt", NS)

        for point_order, point in enumerate(points):
            lat = point.attrib.get("lat")
            lon = point.attrib.get("lon")
            time_node = point.find("gpx:time", NS)

            if lat is None or lon is None:
                continue

            rows.append(
                {
                    "source_file": path.name,
                    "group_name": get_group_name(path),
                    "segment_id": segment_id,
                    "point_order": point_order,
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "time": time_node.text if time_node is not None else None,
                }
            )

    if not rows:
        raise ValueError(
            f"유효한 GPS 포인트가 없습니다: {path.name}"
        )

    df = pd.DataFrame(rows)

    if "time" in df.columns:
        df["time"] = pd.to_datetime(
            df["time"],
            utc=True,
            errors="coerce",
        )

    return df


# ============================================================
# 모든 GPX 읽어서 사용자별로 묶기
# ============================================================

def load_grouped_trajectories(paths: list[Path]) -> dict[str, pd.DataFrame]:
    grouped_frames: dict[str, list[pd.DataFrame]] = {}

    for path in paths:
        try:
            df = read_gpx(path)
            group_name = df["group_name"].iloc[0]

            if group_name not in grouped_frames:
                grouped_frames[group_name] = []

            grouped_frames[group_name].append(df)

            print(f"[완료] {path.name}")

        except Exception as error:
            print(f"[건너뜀] {path.name}: {error}")

    if not grouped_frames:
        raise ValueError("읽을 수 있는 GPX 파일이 없습니다.")

    grouped_result: dict[str, pd.DataFrame] = {}

    for group_name, frames in grouped_frames.items():
        merged = pd.concat(frames, ignore_index=True)

        merged = merged.sort_values(
            by=["source_file", "segment_id", "time", "point_order"],
            kind="stable",
            na_position="last",
        ).reset_index(drop=True)

        grouped_result[group_name] = merged

    return grouped_result


# ============================================================
# 개별 subplot 하나 그리기
# ============================================================

def plot_single_trajectory(ax, df: pd.DataFrame, title: str) -> None:
    # 파일 간, segment 간 선이 잘못 이어지지 않도록
    # source_file + segment_id 단위로 따로 그림
    segment_keys = (
        df["source_file"].astype(str)
        + "::seg"
        + df["segment_id"].astype(str)
    )

    df = df.copy()
    df["segment_key"] = segment_keys

    for _, seg_df in df.groupby("segment_key", sort=False):
        if len(seg_df) < 2:
            ax.scatter(
                seg_df["longitude"],
                seg_df["latitude"],
                s=4,
            )
        else:
            ax.plot(
                seg_df["longitude"],
                seg_df["latitude"],
                linewidth=1.0,
            )

    ax.set_title(title, fontsize=8)

    # 축 눈금은 작게
    ax.tick_params(labelsize=5)

    # 경도/위도 비율 왜곡을 줄이기 위해 equal 적용
    ax.set_aspect("equal", adjustable="datalim")


# ============================================================
# 전체 grid plot
# ============================================================

def plot_trajectory_grid(
    grouped_data: dict[str, pd.DataFrame],
    output_path: Path,
) -> None:
    group_names = sorted(grouped_data.keys())

    n_items = len(group_names)
    n_cols = N_COLS
    n_rows = math.ceil(n_items / n_cols)

    fig, axes = plt.subplots(
        n_rows,
        n_cols,
        figsize=(
            n_cols * SUBPLOT_WIDTH,
            n_rows * SUBPLOT_HEIGHT,
        ),
    )

    # axes를 1차원으로 펴기
    if n_rows == 1 and n_cols == 1:
        axes = [axes]
    elif n_rows == 1 or n_cols == 1:
        axes = list(axes)
    else:
        axes = axes.flatten()

    for ax, group_name in zip(axes, group_names):
        df = grouped_data[group_name]
        plot_single_trajectory(ax, df, group_name)

    # 남는 빈 subplot 숨기기
    for ax in axes[len(group_names):]:
        ax.axis("off")

    fig.suptitle(
        "Trajectory Visualization of All Participants",
        fontsize=14,
    )

    plt.tight_layout(rect=[0, 0, 1, 0.97])

    fig.savefig(
        output_path,
        dpi=200,
        bbox_inches="tight",
    )

    plt.show()
    plt.close(fig)


# ============================================================
# 요약 정보 출력
# ============================================================

def print_summary(grouped_data: dict[str, pd.DataFrame]) -> None:
    print("-" * 72)
    print(f"사용자(또는 그룹) 수: {len(grouped_data):,}")

    total_points = 0

    for group_name, df in grouped_data.items():
        n_points = len(df)
        total_points += n_points
        print(f"{group_name}: {n_points:,} points")

    print("-" * 72)
    print(f"전체 GPS 포인트 수: {total_points:,}")


# ============================================================
# 실행
# ============================================================

def main() -> None:
    gpx_paths = find_gpx_files(GPX_DIR)

    print(f"검색된 GPX 파일: {len(gpx_paths):,}개")
    print(f"검색 폴더: {GPX_DIR.resolve()}")

    grouped_data = load_grouped_trajectories(gpx_paths)

    print_summary(grouped_data)

    plot_trajectory_grid(
        grouped_data,
        OUTPUT_PATH,
    )

    print("-" * 72)
    print(f"시각화 저장 완료: {OUTPUT_PATH.resolve()}")


if __name__ == "__main__":
    main()