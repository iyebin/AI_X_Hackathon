import math
import requests


URL = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"

KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"

AIR_STATIONS = [
    # 광주
    {
        "name": "우산동(광주)",
        "latitude": 35.173,
        "longitude": 126.923,
    },

    # 남원
    {
        "name": "죽항동",
        "latitude": 35.410,
        "longitude": 127.386,
    },
]

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

    response = requests.get(
        URL,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    items = (
        data
        .get("response", {})
        .get("body", {})
        .get("items", [])
    )

    if not items:
        return {
            "station_name": station_name,
            "message": "대기질 데이터가 없습니다.",
        }

    item = items[0]

    khai_raw = item.get("khaiValue")

    if khai_raw in (None, "", "-"):
        khai = None
        grade = None
    else:
        khai = int(khai_raw)
        grade = khai / 5

    return {
        "station_name": station_name,
        "data_time": item.get("dataTime"),
        "khai": khai,
        "pm10": item.get("pm10Value"),
        "pm25": item.get("pm25Value"),
        "o3": item.get("o3Value"),
        "no2": item.get("no2Value"),
        "co": item.get("coValue"),
        "so2": item.get("so2Value"),
        "air_risk_score": grade,
    }

def haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
):
    radius = 6371.0

    lat1 = math.radians(lat1)
    lon1 = math.radians(lon1)
    lat2 = math.radians(lat2)
    lon2 = math.radians(lon2)

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )

    return radius * c

def get_air_quality_by_gps(
    latitude: float,
    longitude: float,
):
    nearest_station = None
    nearest_distance = float("inf")

    for station in AIR_STATIONS:
        distance = haversine_km(
            latitude,
            longitude,
            station["latitude"],
            station["longitude"],
        )

        if distance < nearest_distance:
            nearest_distance = distance
            nearest_station = station

    if nearest_station is None:
        return {
            "message": "가까운 대기 측정소를 찾을 수 없습니다."
        }

    air_quality = get_air_quality(
        nearest_station["name"]
    )

    return {
        "gps": {
            "latitude": latitude,
            "longitude": longitude,
        },
        "nearest_station": {
            "name": nearest_station["name"],
            "distance_km": round(nearest_distance, 2),
        },
        "air_quality": air_quality,
    }