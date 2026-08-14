#!/usr/bin/env python3
"""
Kakao Local API를 이용해 전처리된 staypoint/venue 데이터에 맥락을 부여한다.

입력 파일(현재 업로드된 스키마 기준)
- venues.tsv
- staypoints.tsv

출력 파일
- enriched_venues.tsv
- enriched_staypoints.tsv
- pol_staypoints_context.tsv
- poi_candidates.tsv
- context_user_summary.tsv
- home_coordinates.json

실행 예시
    export KAKAO_REST_API_KEY="YOUR_REST_API_KEY"
    python kakao_staypoint_enrichment.py \
        --venues "output/venues.tsv" \
        --staypoints "output/staypoints.tsv" \
        --output-dir "output/kakao_context_output"

API 호출 없이 파일 구조만 확인
    python kakao_staypoint_enrichment.py --validate-only

주의
- HOME_CONFIG의 주소를 실제 수집한 주소로 교체해야 한다.
- 카카오 REST API 키는 코드에 직접 쓰지 않고 환경변수로 주입한다.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import sys
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# -----------------------------------------------------------------------------
# 1. 사용자 설정
# -----------------------------------------------------------------------------

# 실제 수집한 주소로 반드시 교체한다.
# radius_m은 GPS 품질과 주거 형태에 따라 70~150m 정도에서 조정한다.
HOME_CONFIG: dict[str, list[dict[str, Any]]] = {
    "1": [
        {
            "name": "거주지",
            "address": "서울시 노원구 동일로 192길 58",
            "radius_m": 50,
        },
    ],
    "2": [
        {
            "name": "본가",
            "address": "인천광역시 서구 비즈니스로 28번길 13",
            "radius_m": 50,
        },
        {
            "name": "자취방",
            "address": "서울시 노원구 공릉로 33길 16-10",
            "radius_m": 50,
        },
    ],
    "3": [
        {
            "name": "거주지",
            "address": "충청남도 천안시 서북구 불당 24로 38",
            "radius_m": 50,
        },
    ],
    "4": [
        {
            "name": "거주지",
            "address": "서울시 노원구 공릉로 43가길 21",
            "radius_m": 50,
        }
    ]

}
# HOME_CONFIG: dict[str, dict[str, Any]] = {
#     "1": {
#         "address": "서울시 노원구 동일로 192길 58",
#         "radius_m": 50,
#     },
#     "2": {
#         "address": "서울시 노원구 공릉로 33길 16-10",
#         "radius_m": 50,
#     },
#     "3" : {
#         "address": "충청남도 천안시 서북구 불당 24로 38",
#         "radius_m": 50,
#     },
#     "4": {
#         "address": "서울시 노원구 공릉로 43가길 21",
#         "radius_m": 50,
#     }
# }

# 개인정보 보호를 위해 거주지의 실제 주소를 최종 TSV에 저장할지 결정한다.
# False이면 context_label="거주지"만 남고 실제 주소는 출력하지 않는다.
INCLUDE_HOME_ADDRESS_IN_OUTPUT = False

CLASSIFIER_VERSION = "kakao-rule-v1.0"
DEFAULT_TIMEZONE = "Asia/Seoul"

# 카카오 공식 카테고리 그룹 코드.
# 호출량을 줄이고 싶으면 분석 목적에 필요 없는 코드를 제거한다.
ACTIVE_CATEGORY_CODES: tuple[str, ...] = (
    "MT1",  # 대형마트
    "CS2",  # 편의점
    "PS3",  # 어린이집, 유치원
    "SC4",  # 학교
    "AC5",  # 학원
    "PK6",  # 주차장
    "OL7",  # 주유소, 충전소
    "SW8",  # 지하철역
    "BK9",  # 은행
    "CT1",  # 문화시설
    "PO3",  # 공공기관
    "AT4",  # 관광명소
    "AD5",  # 숙박
    "FD6",  # 음식점
    "CE7",  # 카페
    "HP8",  # 병원
    "PM9",  # 약국
)

CATEGORY_GROUP_NAMES: dict[str, str] = {
    "MT1": "대형마트",
    "CS2": "편의점",
    "PS3": "어린이집, 유치원",
    "SC4": "학교",
    "AC5": "학원",
    "PK6": "주차장",
    "OL7": "주유소, 충전소",
    "SW8": "지하철역",
    "BK9": "은행",
    "CT1": "문화시설",
    "AG2": "중개업소",
    "PO3": "공공기관",
    "AT4": "관광명소",
    "AD5": "숙박",
    "FD6": "음식점",
    "CE7": "카페",
    "HP8": "병원",
    "PM9": "약국",
}

# 최종 분석용 맥락 라벨.
CATEGORY_CONTEXT_LABELS: dict[str, str] = {
    "MT1": "장보기",
    "CS2": "편의점",
    "PS3": "보육·유아교육",
    "SC4": "학교",
    "AC5": "교육",
    "PK6": "주차",
    "OL7": "주유·충전",
    "SW8": "대중교통",
    "BK9": "금융업무",
    "CT1": "문화생활",
    "AG2": "부동산업무",
    "PO3": "공공업무",
    "AT4": "관광·여가",
    "AD5": "숙박",
    "FD6": "식사",
    "CE7": "카페",
    "HP8": "병원",
    "PM9": "약국",
}

# 카테고리별 탐색 반경. 넓은 시설은 더 크게, 작은 점포는 더 작게 설정한다.
CATEGORY_RADIUS_M: dict[str, int] = {
    "MT1": 180,
    "CS2": 70,
    "PS3": 120,
    "SC4": 180,
    "AC5": 100,
    "PK6": 130,
    "OL7": 120,
    "SW8": 180,
    "BK9": 100,
    "CT1": 180,
    "AG2": 80,
    "PO3": 150,
    "AT4": 220,
    "AD5": 180,
    "FD6": 90,
    "CE7": 90,
    "HP8": 160,
    "PM9": 90,
}

# 후보 API 결과를 카테고리당 몇 개까지 받을지 지정한다. 공식 최대값은 15.
CATEGORY_RESULT_SIZE = 5

# 특정 매장명을 확정하는 기준.
EXACT_POI_MAX_DISTANCE_M = 100.0
EXACT_POI_MIN_SCORE = 0.53
EXACT_POI_MIN_MARGIN = 0.045
AREA_FALLBACK_MIN_DISTANCE_M = 220.0

# API 호출 사이의 아주 짧은 간격. 쿼터/부하 상황에 맞게 조정한다.
API_CALL_INTERVAL_SECONDS = 0.03


# -----------------------------------------------------------------------------
# 2. 예외와 자료형
# -----------------------------------------------------------------------------


class ConfigurationError(RuntimeError):
    """설정이 누락되거나 잘못된 경우."""


class DataValidationError(RuntimeError):
    """입력 데이터의 스키마 또는 참조 관계가 잘못된 경우."""


class KakaoApiError(RuntimeError):
    """카카오 Local API 호출 실패."""


class KakaoAuthenticationError(KakaoApiError):
    """카카오 API 키 인증 실패."""


@dataclass(frozen=True)
class HomeLocation:
    # userid: str
    # address: str
    # canonical_address: str
    # longitude: float
    # latitude: float
    # radius_m: float

    # class HomeLocation:
    userid: str
    name: str
    address: str
    canonical_address: str
    longitude: float
    latitude: float
    radius_m: float


# -----------------------------------------------------------------------------
# 3. 공통 유틸리티
# -----------------------------------------------------------------------------


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_json_dumps(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
    return max(lower, min(upper, value))


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 WGS84 경위도 간 대권거리를 미터로 계산한다."""
    radius_m = 6_371_008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(delta_lambda / 2.0) ** 2
    )
    return radius_m * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def detect_delimiter(path: Path) -> str:
    """확장자와 무관하게 첫 줄을 보고 탭 또는 쉼표 구분자를 선택한다."""
    with path.open("r", encoding="utf-8-sig") as handle:
        first_line = handle.readline()
    tab_count = first_line.count("\t")
    comma_count = first_line.count(",")
    return "\t" if tab_count >= comma_count else ","


def read_table(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"입력 파일을 찾을 수 없습니다: {path}")
    delimiter = detect_delimiter(path)
    logging.info("입력 로드: %s (구분자=%r)", path, delimiter)
    return pd.read_csv(path, sep=delimiter, encoding="utf-8-sig")


def require_columns(df: pd.DataFrame, required: Iterable[str], name: str) -> None:
    missing = sorted(set(required) - set(df.columns))
    if missing:
        raise DataValidationError(f"{name}에 필요한 열이 없습니다: {missing}")


def write_tsv(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, sep="\t", index=False, encoding="utf-8")
    logging.info("출력 저장: %s (%s행)", path, len(df))


# -----------------------------------------------------------------------------
# 4. JSON API 캐시
# -----------------------------------------------------------------------------


class JsonCache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data: dict[str, Any] = {}
        if self.path.exists():
            try:
                self._data = json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                logging.warning("캐시 파일을 읽지 못해 새로 시작합니다: %s", self.path)
                self._data = {}

    def get(self, key: str) -> Any | None:
        return self._data.get(key)

    def set(self, key: str, value: Any) -> None:
        self._data[key] = value
        temp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        temp_path.write_text(
            json.dumps(self._data, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )
        temp_path.replace(self.path)


# -----------------------------------------------------------------------------
# 5. Kakao Local API 클라이언트
# -----------------------------------------------------------------------------


class KakaoLocalClient:
    BASE_URL = "https://dapi.kakao.com/v2/local"

    def __init__(
        self,
        rest_api_key: str,
        cache_path: Path,
        call_interval_seconds: float = API_CALL_INTERVAL_SECONDS,
    ) -> None:
        if not rest_api_key.strip():
            raise ConfigurationError("KAKAO_REST_API_KEY 환경변수가 비어 있습니다.")

        self.headers = {
            "Authorization": f"KakaoAK {rest_api_key.strip()}",
            "User-Agent": "staypoint-context-enricher/1.0",
        }
        self.call_interval_seconds = max(0.0, call_interval_seconds)
        self.cache = JsonCache(cache_path)
        self.session = requests.Session()

        retry = Retry(
            total=4,
            connect=4,
            read=4,
            status=4,
            backoff_factor=0.6,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
        self.session.mount("https://", adapter)

    @staticmethod
    def _cache_key(endpoint: str, params: Mapping[str, Any]) -> str:
        payload = stable_json_dumps({"endpoint": endpoint, "params": dict(params)})
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _get(self, endpoint: str, params: Mapping[str, Any]) -> dict[str, Any]:
        cache_key = self._cache_key(endpoint, params)
        cached = self.cache.get(cache_key)
        if cached is not None:
            logging.debug("API 캐시 사용: %s %s", endpoint, params)
            return cached

        url = f"{self.BASE_URL}/{endpoint}"
        response = self.session.get(
            url,
            headers=self.headers,
            params=dict(params),
            timeout=(5, 15),
        )

        if response.status_code in (401, 403):
            raise KakaoAuthenticationError(
                f"카카오 API 인증 실패({response.status_code}). REST API 키와 앱 설정을 확인하세요."
            )

        if not response.ok:
            body = response.text[:500]
            raise KakaoApiError(
                f"카카오 API 호출 실패: {response.status_code} {url} / {body}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise KakaoApiError(f"카카오 API 응답이 JSON이 아닙니다: {url}") from exc

        self.cache.set(cache_key, data)
        if self.call_interval_seconds:
            time.sleep(self.call_interval_seconds)
        return data

    def geocode_address(self, address: str) -> dict[str, Any]:
        # exact 결과가 없으면 similar로 한 번 더 검색한다.
        for analyze_type in ("exact", "similar"):
            data = self._get(
                "search/address.json",
                {
                    "query": address,
                    "analyze_type": analyze_type,
                    "size": 1,
                },
            )
            documents = data.get("documents", [])
            if documents:
                doc = documents[0]
                road = doc.get("road_address") or {}
                parcel = doc.get("address") or {}
                return {
                    "longitude": float(doc["x"]),
                    "latitude": float(doc["y"]),
                    "canonical_address": (
                        road.get("address_name")
                        or parcel.get("address_name")
                        or address
                    ),
                    "building_name": road.get("building_name") or None,
                    "road_address": road.get("address_name") or None,
                    "parcel_address": parcel.get("address_name") or None,
                }
        raise ConfigurationError(f"거주지 주소를 좌표로 변환하지 못했습니다: {address}")

    def search_category(
        self,
        longitude: float,
        latitude: float,
        category_code: str,
        radius_m: int,
        size: int = CATEGORY_RESULT_SIZE,
    ) -> list[dict[str, Any]]:
        data = self._get(
            "search/category.json",
            {
                "category_group_code": category_code,
                "x": f"{longitude:.8f}",
                "y": f"{latitude:.8f}",
                "radius": int(radius_m),
                "sort": "distance",
                "size": min(max(int(size), 1), 15),
                "page": 1,
            },
        )
        return list(data.get("documents", []))

    def reverse_geocode(self, longitude: float, latitude: float) -> dict[str, Any] | None:
        data = self._get(
            "geo/coord2address.json",
            {
                "x": f"{longitude:.8f}",
                "y": f"{latitude:.8f}",
                "input_coord": "WGS84",
            },
        )
        documents = data.get("documents", [])
        if not documents:
            return None

        doc = documents[0]
        road = doc.get("road_address") or {}
        parcel = doc.get("address") or {}
        return {
            "address": parcel.get("address_name") or None,
            "road_address": road.get("address_name") or None,
            "building_name": road.get("building_name") or None,
            "region_1depth_name": (
                road.get("region_1depth_name")
                or parcel.get("region_1depth_name")
                or None
            ),
            "region_2depth_name": (
                road.get("region_2depth_name")
                or parcel.get("region_2depth_name")
                or None
            ),
            "region_3depth_name": (
                road.get("region_3depth_name")
                or parcel.get("region_3depth_name")
                or None
            ),
        }


# -----------------------------------------------------------------------------
# 6. 입력 데이터 검증
# -----------------------------------------------------------------------------


VENUE_REQUIRED_COLUMNS = {
    "userid",
    "cluster",
    "venueid",
    "longitude",
    "latitude",
    "x",
    "y",
    "visit_count",
    "total_dwell_minutes",
    "first_visit",
    "last_visit",
}

STAYPOINT_REQUIRED_COLUMNS = {
    "userid",
    "stay_id",
    "checkintime",
    "leaving_datetime",
    "dwell_minutes",
    "longitude",
    "latitude",
    "cluster",
    "venueid",
    "venuetype",
    "x",
    "y",
}


def validate_inputs(venues: pd.DataFrame, staypoints: pd.DataFrame) -> None:
    require_columns(venues, VENUE_REQUIRED_COLUMNS, "venues")
    require_columns(staypoints, STAYPOINT_REQUIRED_COLUMNS, "staypoints")

    if venues["venueid"].isna().any() or venues["userid"].isna().any():
        raise DataValidationError("venues의 userid 또는 venueid에 결측값이 있습니다.")
    if staypoints["stay_id"].isna().any() or staypoints["venueid"].isna().any():
        raise DataValidationError("staypoints의 stay_id 또는 venueid에 결측값이 있습니다.")

    if venues.duplicated(["userid", "venueid"]).any():
        duplicates = venues.loc[
            venues.duplicated(["userid", "venueid"], keep=False),
            ["userid", "venueid"],
        ]
        raise DataValidationError(
            "venues에 userid+venueid 중복이 있습니다:\n"
            + duplicates.to_string(index=False)
        )

    if staypoints["stay_id"].duplicated().any():
        raise DataValidationError("staypoints에 중복 stay_id가 있습니다.")

    for frame_name, frame in (("venues", venues), ("staypoints", staypoints)):
        for column in ("longitude", "latitude"):
            if frame[column].isna().any():
                raise DataValidationError(f"{frame_name}.{column}에 결측값이 있습니다.")
        invalid_lon = ~frame["longitude"].between(-180, 180)
        invalid_lat = ~frame["latitude"].between(-90, 90)
        if invalid_lon.any() or invalid_lat.any():
            raise DataValidationError(f"{frame_name}에 유효하지 않은 경위도가 있습니다.")

    venue_keys = set(zip(venues["userid"], venues["venueid"]))
    stay_keys = set(zip(staypoints["userid"], staypoints["venueid"]))
    missing_venues = sorted(stay_keys - venue_keys)
    if missing_venues:
        raise DataValidationError(
            f"staypoints가 참조하지만 venues에 없는 장소가 있습니다: {missing_venues[:10]}"
        )

    logging.info(
        "검증 완료: 사용자 %s명, venue %s건, staypoint %s건",
        venues["userid"].nunique(),
        len(venues),
        len(staypoints),
    )


# def parse_datetime_columns(venues: pd.DataFrame, staypoints: pd.DataFrame) -> None:
#     for column in ("first_visit", "last_visit"):
#         venues[column] = pd.to_datetime(venues[column], errors="coerce", format="mixed")
#     for column in ("checkintime", "leaving_datetime"):
#         staypoints[column] = pd.to_datetime(staypoints[column], errors="coerce", format="mixed")

#     if venues[["first_visit", "last_visit"]].isna().any().any():
#         raise DataValidationError("venues의 방문 시각을 파싱하지 못한 행이 있습니다.")
#     if staypoints[["checkintime", "leaving_datetime"]].isna().any().any():
#         raise DataValidationError("staypoints의 체류 시각을 파싱하지 못한 행이 있습니다.")

def parse_datetime_columns(venues: pd.DataFrame, staypoints: pd.DataFrame) -> None:
    for column in ("first_visit", "last_visit"):
        venues[column] = pd.to_datetime(
            venues[column],
            errors="coerce",
        )

    for column in ("checkintime", "leaving_datetime"):
        staypoints[column] = pd.to_datetime(
            staypoints[column],
            errors="coerce",
        )

    if venues[["first_visit", "last_visit"]].isna().any().any():
        raise DataValidationError(
            "venues의 방문 시각을 파싱하지 못한 행이 있습니다."
        )

    if staypoints[["checkintime", "leaving_datetime"]].isna().any().any():
        raise DataValidationError(
            "staypoints의 체류 시각을 파싱하지 못한 행이 있습니다."
        )


# -----------------------------------------------------------------------------
# 7. 거주지 초기화
# -----------------------------------------------------------------------------


def validate_home_config(userids: Sequence[str]) -> None:
    missing_users = sorted(set(userids) - set(HOME_CONFIG))
    if missing_users:
        raise ConfigurationError(f"HOME_CONFIG에 사용자가 없습니다: {missing_users}")

    placeholder_tokens = ("여기에", "입력", "실제 거주지")
    for userid in userids:
        config = HOME_CONFIG[userid]
        address = str(config.get("address", "")).strip()
        if not address or any(token in address for token in placeholder_tokens):
            raise ConfigurationError(
                f"HOME_CONFIG['{userid}']['address']를 실제 주소로 교체하세요."
            )
        radius_m = safe_float(config.get("radius_m"), -1)
        if radius_m <= 0:
            raise ConfigurationError(
                f"HOME_CONFIG['{userid}']['radius_m']는 0보다 커야 합니다."
            )


def build_home_locations(
    client: KakaoLocalClient,
    userids: Sequence[str],
) -> dict[str, list[HomeLocation]]:
    homes: dict[str, list[HomeLocation]] = {}

    for userid in sorted(userids):
        homes[userid] = []

        for index, config in enumerate(HOME_CONFIG[userid], start=1):
            name = str(config.get("name", f"거주지{index}")).strip()
            address = str(config["address"]).strip()
            geocoded = client.geocode_address(address)

            home = HomeLocation(
                userid=userid,
                name=name,
                address=address,
                canonical_address=str(geocoded["canonical_address"]),
                longitude=float(geocoded["longitude"]),
                latitude=float(geocoded["latitude"]),
                radius_m=float(config["radius_m"]),
            )
            homes[userid].append(home)

            logging.info(
                "거주지 좌표 변환 완료: 사용자 %s / %s / 반경 %.0fm",
                userid,
                name,
                home.radius_m,
            )

    return homes


def save_home_locations(homes: Mapping[str, HomeLocation], path: Path) -> None:
    # 이 파일에는 실제 주소와 좌표가 포함되므로 접근 권한을 제한해 관리한다.
    payload = {
        userid: {
            "address": home.address,
            "canonical_address": home.canonical_address,
            "longitude": home.longitude,
            "latitude": home.latitude,
            "radius_m": home.radius_m,
        }
        for userid, home in homes.items()
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    logging.info("거주지 좌표 저장: %s", path)


# -----------------------------------------------------------------------------
# 8. POI 후보 생성과 점수 계산
# -----------------------------------------------------------------------------


def triangular_fit(value: float, low: float, ideal_low: float, ideal_high: float, high: float) -> float:
    """구간 적합도를 0~1로 반환한다."""
    if value < low or value > high:
        return 0.0
    if ideal_low <= value <= ideal_high:
        return 1.0
    if value < ideal_low:
        denominator = max(ideal_low - low, 1e-9)
        return clamp((value - low) / denominator)
    denominator = max(high - ideal_high, 1e-9)
    return clamp((high - value) / denominator)


def circular_hour_distance(hour: float, target_hour: float) -> float:
    raw = abs(hour - target_hour) % 24.0
    return min(raw, 24.0 - raw)


def hour_window_score(hour: float, centers: Sequence[float], width_hours: float) -> float:
    if not centers:
        return 0.5
    distance = min(circular_hour_distance(hour, center) for center in centers)
    return clamp(1.0 - distance / max(width_hours, 1e-9))


def duration_fit_score(category_code: str, dwell_minutes: float) -> float:
    ranges: dict[str, tuple[float, float, float, float]] = {
        "MT1": (5, 20, 90, 240),
        "CS2": (0, 2, 20, 45),
        "PS3": (10, 60, 540, 720),
        "SC4": (15, 60, 600, 900),
        "AC5": (10, 40, 240, 480),
        "PK6": (0, 1, 20, 60),
        "OL7": (0, 2, 20, 45),
        "SW8": (0, 1, 20, 60),
        "BK9": (2, 10, 45, 120),
        "CT1": (10, 40, 240, 480),
        "AG2": (5, 20, 90, 180),
        "PO3": (5, 15, 90, 240),
        "AT4": (10, 30, 300, 720),
        "AD5": (60, 240, 900, 1_440),
        "FD6": (5, 20, 120, 240),
        "CE7": (5, 20, 180, 360),
        "HP8": (5, 20, 180, 480),
        "PM9": (0, 3, 30, 90),
    }
    low, ideal_low, ideal_high, high = ranges.get(
        category_code, (0, 10, 180, 480)
    )
    return triangular_fit(dwell_minutes, low, ideal_low, ideal_high, high)


def time_of_day_score(category_code: str, timestamp: pd.Timestamp) -> float:
    hour = timestamp.hour + timestamp.minute / 60.0
    centers_and_widths: dict[str, tuple[Sequence[float], float]] = {
        "MT1": ((11, 16, 19), 6),
        "CS2": ((8, 13, 19, 23), 8),
        "PS3": ((8, 16), 4),
        "SC4": ((8, 13), 5),
        "AC5": ((10, 16, 20), 5),
        "PK6": ((8, 13, 18, 22), 8),
        "OL7": ((8, 13, 18, 22), 8),
        "SW8": ((8, 18), 4),
        "BK9": ((11, 15), 4),
        "CT1": ((14, 19), 6),
        "AG2": ((11, 16), 5),
        "PO3": ((11, 15), 4),
        "AT4": ((11, 16), 7),
        "AD5": ((0, 22), 7),
        "FD6": ((8, 12.5, 19), 3),
        "CE7": ((10, 15, 20), 6),
        "HP8": ((10, 15), 6),
        "PM9": ((10, 15, 20), 6),
    }
    centers, width = centers_and_widths.get(category_code, ((12, 18), 8))
    return hour_window_score(hour, centers, width)


def temporal_context_score(category_code: str, venue_stays: pd.DataFrame) -> float:
    if venue_stays.empty:
        return 0.5

    scores: list[float] = []
    for row in venue_stays.itertuples(index=False):
        dwell = safe_float(getattr(row, "dwell_minutes", 0.0))
        timestamp = getattr(row, "checkintime")
        duration_score = duration_fit_score(category_code, dwell)
        hour_score = time_of_day_score(category_code, timestamp)
        scores.append(0.65 * duration_score + 0.35 * hour_score)

    return float(sum(scores) / len(scores))


def score_candidate(
    candidate: Mapping[str, Any],
    venue_row: Mapping[str, Any],
    venue_stays: pd.DataFrame,
) -> dict[str, float]:
    category_code = str(candidate.get("category_code") or "")
    distance_m = safe_float(candidate.get("distance_m"), default=999_999.0)
    radius_m = float(CATEGORY_RADIUS_M.get(category_code, 120))

    # 거리 점수는 카테고리별 검색 반경에 따라 지수적으로 감소한다.
    distance_scale = max(25.0, radius_m * 0.42)
    distance_score = math.exp(-distance_m / distance_scale)
    temporal_score = temporal_context_score(category_code, venue_stays)

    visit_count = max(1.0, safe_float(venue_row.get("visit_count"), 1.0))
    repeat_score = clamp(math.log1p(visit_count) / math.log1p(10.0))

    # 주차장/주유소/지하철은 장시간 체류의 실제 목적지가 아닐 가능성이 높다.
    median_dwell = safe_float(venue_stays["dwell_minutes"].median(), 0.0)
    long_stay_penalty = 0.0
    if category_code in {"PK6", "OL7", "SW8"} and median_dwell >= 90:
        long_stay_penalty = min(0.25, (median_dwell - 90.0) / 600.0)

    total_score = (
        0.68 * distance_score
        + 0.24 * temporal_score
        + 0.08 * repeat_score
        - long_stay_penalty
    )

    return {
        "distance_score": clamp(distance_score),
        "temporal_score": clamp(temporal_score),
        "repeat_score": clamp(repeat_score),
        "long_stay_penalty": clamp(long_stay_penalty),
        "total_score": clamp(total_score),
    }


def normalize_candidate(
    venue_row: Mapping[str, Any],
    doc: Mapping[str, Any],
    requested_category_code: str,
) -> dict[str, Any]:
    category_code = str(doc.get("category_group_code") or requested_category_code)
    return {
        "userid": str(venue_row["userid"]),
        "venueid": str(venue_row["venueid"]),
        "poi_id": str(doc.get("id") or ""),
        "poi_name": str(doc.get("place_name") or ""),
        "category_code": category_code,
        "category_group_name": str(
            doc.get("category_group_name")
            or CATEGORY_GROUP_NAMES.get(category_code, "")
        ),
        "category_name": str(doc.get("category_name") or ""),
        "phone": str(doc.get("phone") or ""),
        "address_name": str(doc.get("address_name") or ""),
        "road_address_name": str(doc.get("road_address_name") or ""),
        "poi_longitude": safe_float(doc.get("x"), float("nan")),
        "poi_latitude": safe_float(doc.get("y"), float("nan")),
        "place_url": str(doc.get("place_url") or ""),
        "distance_m": safe_float(doc.get("distance"), 999_999.0),
        "requested_category_code": requested_category_code,
    }


def collect_candidates(
    client: KakaoLocalClient,
    venue_row: Mapping[str, Any],
    category_codes: Sequence[str],
) -> tuple[list[dict[str, Any]], int]:
    candidates_by_id: dict[str, dict[str, Any]] = {}
    api_error_count = 0

    for category_code in category_codes:
        radius_m = CATEGORY_RADIUS_M.get(category_code, 120)
        try:
            documents = client.search_category(
                longitude=float(venue_row["longitude"]),
                latitude=float(venue_row["latitude"]),
                category_code=category_code,
                radius_m=radius_m,
                size=CATEGORY_RESULT_SIZE,
            )
        except KakaoAuthenticationError:
            raise
        except KakaoApiError as exc:
            api_error_count += 1
            logging.warning(
                "카테고리 검색 실패: %s / %s / %s",
                venue_row["venueid"],
                category_code,
                exc,
            )
            continue

        for doc in documents:
            candidate = normalize_candidate(venue_row, doc, category_code)
            poi_id = candidate["poi_id"]
            if not poi_id:
                continue
            existing = candidates_by_id.get(poi_id)
            if existing is None or candidate["distance_m"] < existing["distance_m"]:
                candidates_by_id[poi_id] = candidate

    return list(candidates_by_id.values()), api_error_count


def rank_candidates(
    candidates: Sequence[dict[str, Any]],
    venue_row: Mapping[str, Any],
    venue_stays: pd.DataFrame,
) -> list[dict[str, Any]]:
    ranked: list[dict[str, Any]] = []
    for candidate in candidates:
        score_parts = score_candidate(candidate, venue_row, venue_stays)
        ranked.append({**candidate, **score_parts})

    ranked.sort(
        key=lambda item: (
            -item["total_score"],
            item["distance_m"],
            item["poi_name"],
        )
    )
    for rank, candidate in enumerate(ranked, start=1):
        candidate["candidate_rank"] = rank
    return ranked


def choose_category_fallback(ranked: Sequence[dict[str, Any]]) -> tuple[str, float]:
    """매장 확정이 어려울 때 후보들을 카테고리별로 집계한다."""
    grouped: dict[str, list[float]] = defaultdict(list)
    for candidate in ranked:
        grouped[str(candidate["category_code"])].append(float(candidate["total_score"]))

    category_scores: list[tuple[float, str]] = []
    for code, scores in grouped.items():
        sorted_scores = sorted(scores, reverse=True)
        aggregate = sorted_scores[0] + 0.15 * sum(sorted_scores[1:3])
        category_scores.append((aggregate, code))

    category_scores.sort(reverse=True)
    if not category_scores:
        return "", 0.0
    score, code = category_scores[0]
    return code, clamp(score)


# -----------------------------------------------------------------------------
# 9. venue 맥락 판정
# -----------------------------------------------------------------------------


def base_context_record() -> dict[str, Any]:
    return {
        "home_distance_m": None,
        "context_type": None,
        "context_level": None,
        "context_label": None,
        "context_confidence": None,
        "context_source": None,
        "kakao_place_id": None,
        "kakao_place_name": None,
        "kakao_category_code": None,
        "kakao_category_group_name": None,
        "kakao_category_name": None,
        "kakao_phone": None,
        "kakao_place_url": None,
        "poi_distance_m": None,
        "address": None,
        "road_address": None,
        "region_1depth_name": None,
        "region_2depth_name": None,
        "region_3depth_name": None,
        "candidate_count": 0,
        "api_error_count": 0,
        "best_score": None,
        "second_score": None,
        "score_margin": None,
        "classifier_version": CLASSIFIER_VERSION,
        "processed_at_utc": utc_now_iso(),
    }


def make_home_context(home: HomeLocation, home_distance_m: float) -> dict[str, Any]:
    record = base_context_record()
    record.update(
        {
            "home_distance_m": round(home_distance_m, 3),
            "context_type": "HOME",
            "context_level": "home",
            "context_label": "거주지",
            "context_confidence": 1.0,
            "context_source": "hardcoded_home_address",
            "address": home.canonical_address if INCLUDE_HOME_ADDRESS_IN_OUTPUT else None,
        }
    )
    return record


def make_area_context(
    reverse_address: Mapping[str, Any] | None,
    home_distance_m: float,
    api_error_count: int,
    candidate_count: int,
) -> dict[str, Any]:
    record = base_context_record()
    record["home_distance_m"] = round(home_distance_m, 3)
    record["api_error_count"] = api_error_count
    record["candidate_count"] = candidate_count

    if not reverse_address:
        record.update(
            {
                "context_type": "UNKNOWN",
                "context_level": "unknown",
                "context_label": "알 수 없는 장소",
                "context_confidence": 0.0,
                "context_source": "none",
            }
        )
        return record

    region_3 = reverse_address.get("region_3depth_name")
    region_2 = reverse_address.get("region_2depth_name")
    region_1 = reverse_address.get("region_1depth_name")
    label = region_3 or region_2 or region_1 or "주소 기반 장소"

    record.update(
        {
            "context_type": "AREA",
            "context_level": "area",
            "context_label": label,
            "context_confidence": 0.25,
            "context_source": "kakao_reverse_geocoding",
            "address": reverse_address.get("address"),
            "road_address": reverse_address.get("road_address"),
            "region_1depth_name": region_1,
            "region_2depth_name": region_2,
            "region_3depth_name": region_3,
        }
    )
    return record


def make_poi_or_category_context(
    ranked: Sequence[dict[str, Any]],
    home_distance_m: float,
    api_error_count: int,
) -> dict[str, Any]:
    best = ranked[0]
    second_score = float(ranked[1]["total_score"]) if len(ranked) >= 2 else 0.0
    best_score = float(best["total_score"])
    margin = best_score - second_score if len(ranked) >= 2 else best_score

    # 점수와 1·2위 차이를 함께 반영한 보수적 신뢰도.
    confidence = clamp(
        0.68 * best_score
        + 0.32 * clamp(margin / 0.20)
    )

    exact_poi = (
        float(best["distance_m"]) <= EXACT_POI_MAX_DISTANCE_M
        and best_score >= EXACT_POI_MIN_SCORE
        and margin >= EXACT_POI_MIN_MARGIN
    )

    record = base_context_record()
    record.update(
        {
            "home_distance_m": round(home_distance_m, 3),
            "candidate_count": len(ranked),
            "api_error_count": api_error_count,
            "best_score": round(best_score, 6),
            "second_score": round(second_score, 6),
            "score_margin": round(margin, 6),
            "context_confidence": round(confidence, 6),
            # 진단을 위해 매장 확정 여부와 무관하게 최상위 후보를 보존한다.
            "kakao_place_id": best["poi_id"],
            "kakao_place_name": best["poi_name"],
            "kakao_category_code": best["category_code"],
            "kakao_category_group_name": best["category_group_name"],
            "kakao_category_name": best["category_name"],
            "kakao_phone": best["phone"] or None,
            "kakao_place_url": best["place_url"] or None,
            "poi_distance_m": round(float(best["distance_m"]), 3),
            "address": best["address_name"] or None,
            "road_address": best["road_address_name"] or None,
        }
    )

    if exact_poi:
        record.update(
            {
                "context_type": "POI",
                "context_level": "exact_poi",
                "context_label": CATEGORY_CONTEXT_LABELS.get(
                    str(best["category_code"]),
                    best["category_group_name"] or "기타 장소",
                ),
                "context_source": "kakao_category_search",
            }
        )
    else:
        category_code, category_score = choose_category_fallback(ranked)
        category_label = CATEGORY_CONTEXT_LABELS.get(
            category_code,
            CATEGORY_GROUP_NAMES.get(category_code, "기타 장소"),
        )
        # category 수준에서는 매장명이 아니라 안정적인 상위 맥락을 사용한다.
        record.update(
            {
                "context_type": "CATEGORY",
                "context_level": "category",
                "context_label": category_label,
                "context_confidence": round(min(confidence, 0.75 * category_score), 6),
                "context_source": "kakao_category_aggregation",
                "kakao_category_code": category_code,
                "kakao_category_group_name": CATEGORY_GROUP_NAMES.get(category_code),
            }
        )

    return record


def enrich_single_venue(
    client: KakaoLocalClient,
    venue_row: Mapping[str, Any],
    venue_stays: pd.DataFrame,
    homes: Sequence[HomeLocation],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    venue_lat = float(venue_row["latitude"])
    venue_lon = float(venue_row["longitude"])

    home_distances = [
        (
            home,
            haversine_m(
                venue_lat,
                venue_lon,
                home.latitude,
                home.longitude,
            ),
        )
        for home in homes
    ]

    # 여러 거주지 중 가장 가까운 곳
    nearest_home, home_distance_m = min(
        home_distances,
        key=lambda item: item[1],
    )

    # 반경 안에 들어오는 거주지가 있다면 HOME 처리
    matched_homes = [
        (home, distance)
        for home, distance in home_distances
        if distance <= home.radius_m
    ]

    if matched_homes:
        matched_home, matched_distance = min(
            matched_homes,
            key=lambda item: item[1],
        )
        return make_home_context(matched_home, matched_distance), []


def enrich_venues(
    client: KakaoLocalClient,
    venues: pd.DataFrame,
    staypoints: pd.DataFrame,
    homes: Mapping[str, HomeLocation],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    context_rows: list[dict[str, Any]] = []
    all_candidates: list[dict[str, Any]] = []

    grouped_stays = {
        key: group.copy()
        for key, group in staypoints.groupby(["userid", "venueid"], sort=False)
    }

    total = len(venues)
    for index, venue_series in venues.iterrows():
        venue = venue_series.to_dict()
        userid = str(venue["userid"])
        venueid = str(venue["venueid"])
        logging.info("장소 처리 %s/%s: %s", index + 1, total, venueid)

        venue_stays = grouped_stays.get(
            (userid, venueid),
            pd.DataFrame(columns=staypoints.columns),
        )
        # context, ranked_candidates = enrich_single_venue(
        #     client=client,
        #     venue_row=venue,
        #     venue_stays=venue_stays,
        #     home=homes[userid],
        # )
        context, ranked_candidates = enrich_single_venue(
            client=client,
            venue_row=venue,
            venue_stays=venue_stays,
            homes=homes[userid],
        )
        context_rows.append({"userid": userid, "venueid": venueid, **context})
        all_candidates.extend(ranked_candidates)

    context_df = pd.DataFrame(context_rows)
    enriched = venues.merge(
        context_df,
        on=["userid", "venueid"],
        how="left",
        validate="one_to_one",
    )

    candidate_df = pd.DataFrame(all_candidates)
    if candidate_df.empty:
        candidate_df = pd.DataFrame(
            columns=[
                "userid",
                "venueid",
                "candidate_rank",
                "poi_id",
                "poi_name",
                "category_code",
                "category_group_name",
                "category_name",
                "distance_m",
                "distance_score",
                "temporal_score",
                "repeat_score",
                "long_stay_penalty",
                "total_score",
                "address_name",
                "road_address_name",
                "poi_longitude",
                "poi_latitude",
                "phone",
                "place_url",
            ]
        )

    return enriched, candidate_df


# -----------------------------------------------------------------------------
# 10. staypoint/POL/요약 생성
# -----------------------------------------------------------------------------


def attach_context_to_staypoints(
    staypoints: pd.DataFrame,
    enriched_venues: pd.DataFrame,
) -> pd.DataFrame:
    context_columns = [
        "userid",
        "venueid",
        "home_distance_m",
        "context_type",
        "context_level",
        "context_label",
        "context_confidence",
        "context_source",
        "kakao_place_id",
        "kakao_place_name",
        "kakao_category_code",
        "kakao_category_group_name",
        "kakao_category_name",
        "kakao_phone",
        "kakao_place_url",
        "poi_distance_m",
        "address",
        "road_address",
        "region_1depth_name",
        "region_2depth_name",
        "region_3depth_name",
        "candidate_count",
        "api_error_count",
        "best_score",
        "second_score",
        "score_margin",
        "classifier_version",
        "processed_at_utc",
    ]

    enriched = staypoints.merge(
        enriched_venues[context_columns],
        on=["userid", "venueid"],
        how="left",
        validate="many_to_one",
    )
    enriched["venuetype_original"] = enriched["venuetype"]
    enriched["venuetype"] = enriched["context_label"].fillna("unknown")
    return enriched


def build_pol_staypoints(enriched_staypoints: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "userid",
        "checkintime",
        "venueid",
        "venuetype",
        "x",
        "y",
        "context_type",
        "context_level",
        "context_confidence",
        "kakao_place_id",
        "kakao_category_code",
    ]
    return enriched_staypoints[columns].copy()


def build_user_summary(
    enriched_venues: pd.DataFrame,
    enriched_staypoints: pd.DataFrame,
) -> pd.DataFrame:
    stay_base = (
        enriched_staypoints.groupby("userid", as_index=False)
        .agg(
            staypoint_count=("stay_id", "count"),
            total_dwell_minutes=("dwell_minutes", "sum"),
            mean_dwell_minutes=("dwell_minutes", "mean"),
        )
    )
    venue_base = (
        enriched_venues.groupby("userid", as_index=False)
        .agg(venue_count=("venueid", "count"))
    )

    context_counts = (
        enriched_staypoints.assign(_count=1)
        .pivot_table(
            index="userid",
            columns="context_type",
            values="_count",
            aggfunc="sum",
            fill_value=0,
        )
        .add_prefix("staypoint_context_")
        .reset_index()
    )

    summary = stay_base.merge(venue_base, on="userid", how="outer")
    summary = summary.merge(context_counts, on="userid", how="left")
    count_columns = [c for c in summary.columns if c.startswith("staypoint_context_")]
    summary[count_columns] = summary[count_columns].fillna(0).astype(int)
    return summary.sort_values("userid").reset_index(drop=True)


# -----------------------------------------------------------------------------
# 11. CLI와 실행
# -----------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Kakao POI 기반 staypoint 맥락 enrichment",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--venues",
        type=Path,
        default=Path("output/venues.tsv"),
        help="venues TSV 경로",
    )
    parser.add_argument(
        "--staypoints",
        type=Path,
        default=Path("output/staypoints.tsv"),
        help="staypoints TSV 경로",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output/kakao_context_output"),
        help="출력 폴더",
    )
    parser.add_argument(
        "--api-cache",
        type=Path,
        default=None,
        help="API JSON 캐시 경로. 생략하면 output-dir 아래에 생성",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="API를 호출하지 않고 입력 파일만 검증",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="디버그 로그 출력",
    )
    return parser

def convert_venueids(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.copy()

    frame["userid"] = frame["userid"].astype(str).str.strip()

    # 1_venue_003 → 003 추출
    venue_number = frame["venueid"].astype(str).str.extract(
        r"(\d+)$",
        expand=False,
    )

    if venue_number.isna().any():
        raise DataValidationError("venueid에서 venue 순번을 추출하지 못했습니다.")

    user_number = pd.to_numeric(frame["userid"], errors="raise").astype(int)
    venue_number = venue_number.astype(int)

    if venue_number.gt(999).any():
        raise DataValidationError("사용자별 venue 개수는 최대 999개여야 합니다.")

    # ID는 병합 오류 방지를 위해 문자열로 유지
    frame["venueid"] = (
        user_number * 1000 + venue_number
    ).astype(str)

    return frame


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    configure_logging(args.verbose)

    venues = convert_venueids(read_table(args.venues))
    staypoints = convert_venueids(read_table(args.staypoints))

    # 병합 및 groupby 키의 자료형 통일
    for frame in (venues, staypoints):
        frame["userid"] = frame["userid"].astype(str).str.strip()
        frame["venueid"] = frame["venueid"].astype(str).str.strip()

    parse_datetime_columns(venues, staypoints)
    validate_inputs(venues, staypoints)

    if args.validate_only:
        print(
            json.dumps(
                {
                    "status": "valid",
                    "users": sorted(venues["userid"].astype(str).unique().tolist()),
                    "venue_count": int(len(venues)),
                    "staypoint_count": int(len(staypoints)),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    userids = sorted(venues["userid"].astype(str).unique().tolist())
    validate_home_config(userids)

    api_key = os.getenv("KAKAO_REST_API_KEY", "").strip()
    if not api_key:
        raise ConfigurationError(
            "환경변수 KAKAO_REST_API_KEY가 없습니다. "
            "터미널에서 export KAKAO_REST_API_KEY='키'를 실행하세요."
        )

    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_path = args.api_cache or (output_dir / "kakao_api_cache.json")

    client = KakaoLocalClient(
        rest_api_key=api_key,
        cache_path=cache_path,
    )
    homes = build_home_locations(client, userids)
    save_home_locations(homes, output_dir / "home_coordinates.json")

    enriched_venues, candidate_df = enrich_venues(
        client=client,
        venues=venues,
        staypoints=staypoints,
        homes=homes,
    )
    enriched_staypoints = attach_context_to_staypoints(
        staypoints=staypoints,
        enriched_venues=enriched_venues,
    )
    pol_context = build_pol_staypoints(enriched_staypoints)
    user_summary = build_user_summary(enriched_venues, enriched_staypoints)

    write_tsv(enriched_venues, output_dir / "enriched_venues.tsv")
    write_tsv(enriched_staypoints, output_dir / "enriched_staypoints.tsv")
    write_tsv(pol_context, output_dir / "pol_staypoints_context.tsv")
    write_tsv(candidate_df, output_dir / "poi_candidates.tsv")
    write_tsv(user_summary, output_dir / "context_user_summary.tsv")

    print("\n완료")
    print(f"- 출력 폴더: {output_dir}")
    print(f"- venue: {len(enriched_venues)}건")
    print(f"- staypoint: {len(enriched_staypoints)}건")
    print(f"- POI 후보: {len(candidate_df)}건")
    print("- context_type 분포:")
    print(enriched_venues["context_type"].value_counts(dropna=False).to_string())
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ConfigurationError, DataValidationError, KakaoApiError, FileNotFoundError) as exc:
        logging.error("%s", exc)
        raise SystemExit(2) from exc
