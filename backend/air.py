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

    try:
        response = requests.get(
            AIR_QUALITY_URL,
            params=params,
            timeout=15,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return {
            "station_name": station_name,
            "message": "대기질 API 응답 시간이 초과되었습니다.",
            "air_risk_score": None,
        }
    except requests.exceptions.RequestException as e:
        print(f"[AIR API ERROR] air quality: {e}")
        return {
            "station_name": station_name,
            "message": "대기질 정보를 불러오지 못했습니다.",
            "air_risk_score": None,
        }

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
        "p3": item.get("o3Value"),
        "o3_grade": item.get("o3Grade"),
        "no2": item.get("no2Value"),
        "no2_grade": item.get("no2Grade"),
        "co": item.get("coValue"),
        "co_grade": item.get("coGrade"),
        "som10": item.get("pm10Value"),
        "pm10_grade": item.get("pm10Grade"),
        "pm25": item.get("pm25Value"),
        "pm25_grade": item.get("pm25Grade"),
        "o2": item.get("so2Value"),
        "so2_grade": item.get("so2Grade"),
        "air_risk_score": air_risk_score,
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

    try:
        response = requests.get(
            NEARBY_STATION_URL,
            params=params,
            timeout=15,
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.RequestException as e:
        print(f"[AIR API ERROR] nearest station: {e}")
        return None

    data = response.json()
    items = (
        data.get("response", {})
        .get("body", {})
        .get("items", [])
    )

    if not items:
        return None

    nearest = items[0]
    return {
        "station_name": nearest.get("stationName"),
        "address": nearest.get("addr"),
        "distance": nearest.get("tm"),
    }


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
