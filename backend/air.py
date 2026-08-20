import os
import requests
from pyproj import Transformer


AIR_QUALITY_URL = (
    "http://apis.data.go.kr/B552584/"
    "ArpltnInforInqireSvc/"
    "getMsrstnAcctoRltmMesureDnsty"
)

NEARBY_STATION_URL = (
    "http://apis.data.go.kr/B552584/"
    "MsrstnInfoInqireSvc/"
    "getNearbyMsrstnList"
)

# 기존 Render 설정을 깨지 않기 위해 현재 키를 fallback으로 유지하되,
# 운영에서는 AIRKOREA_API_KEY 환경변수를 우선 사용한다.
_LEGACY_KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"
KEY = os.getenv("AIRKOREA_API_KEY", _LEGACY_KEY)

if KEY == _LEGACY_KEY:
    print("[AIR API] AIRKOREA_API_KEY 미설정: legacy key fallback 사용 중")


def get_air_quality(station_name: str):
    params = {
        "serviceKey": KEY,
        "returnType": "json",
        "numOfRows": "1",
        "pageNo": "1",
        "stationName": station_name,
        "dataTerm": "DAILY",
        "ver": "1.0",
    }

    import time

    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            print(
                f"[AIR API] air quality attempt "
                f"{attempt}/{max_retries}"
            )

            response = requests.get(
                AIR_QUALITY_URL,
                params=params,
                timeout=15,
            )

            print(
                "[AIR API] air quality status:",
                response.status_code,
            )

            response.raise_for_status()

            data = response.json()

            items = (
                data.get("response", {})
                .get("body", {})
                .get("items", [])
            )

            if not items:
                return {
                    "station_name": station_name,
                    "message": "대기질 데이터가 없습니다.",
                    "air_risk_score": None,
                }

            item = items[0]

            khai_raw = item.get("khaiValue")

            if khai_raw in (None, "", "-"):
                khai = None
                air_risk_score = None
            else:
                khai = int(khai_raw)
                air_risk_score = min(
                    100.0,
                    max(0.0, khai / 5.0),
                )

            return {
                "station_name": station_name,
                "data_time": item.get("dataTime"),
                "khai": khai,
                "khai_grade": item.get("khaiGrade"),
                "o3": item.get("o3Value"),
                "o3_grade": item.get("o3Grade"),
                "no2": item.get("no2Value"),
                "no2_grade": item.get("no2Grade"),
                "co": item.get("coValue"),
                "co_grade": item.get("coGrade"),
                "pm10": item.get("pm10Value"),
                "pm10_grade": item.get("pm10Grade"),
                "pm25": item.get("pm25Value"),
                "pm25_grade": item.get("pm25Grade"),
                "so2": item.get("so2Value"),
                "so2_grade": item.get("so2Grade"),
                "p3": item.get("o3Value"),
                "som10": item.get("pm10Value"),
                "o2": item.get("so2Value"),
                "air_risk_score": air_risk_score,
            }

        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
        ) as e:
            print(
                f"[AIR API] air quality attempt "
                f"{attempt} timeout/connection: {e}"
            )

        except requests.exceptions.HTTPError as e:
            status_code = (
                e.response.status_code
                if e.response is not None
                else None
            )

            print(
                f"[AIR API] air quality attempt "
                f"{attempt} HTTP error: "
                f"{status_code} {e}"
            )

            if status_code is not None and status_code < 500:
                return {
                    "station_name": station_name,
                    "message": "대기질 정보를 불러오지 못했습니다.",
                    "air_risk_score": None,
                }

        except requests.exceptions.RequestException as e:
            print(
                f"[AIR API] air quality request error: {e}"
            )
            return {
                "station_name": station_name,
                "message": "대기질 정보를 불러오지 못했습니다.",
                "air_risk_score": None,
            }

        except ValueError as e:
            print(
                f"[AIR API] air quality JSON parsing error: {e}"
            )
            return {
                "station_name": station_name,
                "message": "대기질 응답 형식 오류입니다.",
                "air_risk_score": None,
            }

        if attempt < max_retries:
            time.sleep(2)

    return {
        "station_name": station_name,
        "message": "대기질 API 재시도 후에도 실패했습니다.",
        "air_risk_score": None,
    }


def gps_to_tm(
    latitude: float,
    longitude: float,
):
    transformer = Transformer.from_crs(
        "EPSG:4326",
        "EPSG:2097",
        always_xy=True,
    )
    return transformer.transform(
        longitude,
        latitude,
    )


def find_nearest_station(
    latitude: float,
    longitude: float,
):
    tm_x, tm_y = gps_to_tm(
        latitude,
        longitude,
    )

    params = {
        "serviceKey": KEY,
        "returnType": "json",
        "tmX": tm_x,
        "tmY": tm_y,
        "ver": "1.1",
    }

    import time

    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            print(
                f"[AIR API] nearest station attempt "
                f"{attempt}/{max_retries}"
            )

            response = requests.get(
                NEARBY_STATION_URL,
                params=params,
                timeout=15,
            )

            print(
                "[AIR API] nearest station status:",
                response.status_code,
            )

            response.raise_for_status()

            data = response.json()

            items = (
                data.get("response", {})
                .get("body", {})
                .get("items", [])
            )

            if not items:
                print(
                    "[AIR API] nearest station: "
                    "items가 비어 있습니다."
                )
                return None

            nearest = items[0]

            return {
                "station_name": nearest.get("stationName"),
                "address": nearest.get("addr"),
                "distance": nearest.get("tm"),
            }

        except (
            requests.exceptions.Timeout,
            requests.exceptions.ConnectionError,
        ) as e:
            print(
                f"[AIR API] attempt {attempt} timeout/connection: {e}"
            )

        except requests.exceptions.HTTPError as e:
            status_code = (
                e.response.status_code
                if e.response is not None
                else None
            )

            print(
                f"[AIR API] attempt {attempt} HTTP error: "
                f"{status_code} {e}"
            )

            # 5xx는 외부 서버 일시 장애일 가능성이 있으므로 재시도
            if status_code is not None and status_code < 500:
                return None

        except requests.exceptions.RequestException as e:
            print(
                f"[AIR API] attempt {attempt} request error: {e}"
            )
            return None

        except ValueError as e:
            print(
                f"[AIR API] JSON parsing error: {e}"
            )
            return None

        if attempt < max_retries:
            time.sleep(2)

    print(
        "[AIR API] nearest station: "
        "3회 재시도 후에도 실패했습니다."
    )
    return None


def get_air_quality_by_gps(
    latitude: float,
    longitude: float,
):
    station = find_nearest_station(
        latitude,
        longitude,
    )

    if station is None:
        return {
            "gps": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "message": "가까운 대기 측정소를 찾을 수 없습니다.",
        }

    air_quality = get_air_quality(
        station["station_name"]
    )

    return {
        "gps": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "nearest_station": station,
        "air_quality": air_quality,
    }
