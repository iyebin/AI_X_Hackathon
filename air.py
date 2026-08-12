import math
import requests

url = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"

def get_air_quality_by_station(station_name: str):

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
        AIR_URL,
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
        return None

    item = items[0]

    khai_raw = item.get("khaiValue")

    if khai_raw in (None, "-", ""):
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

response = requests.get(url, params=params)

data = response.json()
item = data['response']['body']['items'][0]

khai = int(item['khaiValue'])
grade = khai / 5

print(f"측정소명: {stationName}")
print(f"측정일시: {item['dataTime']}")
print(f"통합대기환경지수(CAI): {khai} 점")
print(f"미세먼지: {item['pm10Value']} μ g/m³")
print(f"초미세먼지: {item['pm25Value']} μ g/m³")
print(f"대기오염점수: {grade} 점")

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

def find_nearest_air_station(
    latitude: float,
    longitude: float,
):
    nearest = None
    min_distance = float("inf")

    for station in AIR_STATIONS:

        distance = haversine_km(
            latitude,
            longitude,
            station["latitude"],
            station["longitude"],
        )

        if distance < min_distance:
            min_distance = distance
            nearest = station

    return {
        **nearest,
        "distance_km": round(min_distance, 2),
    }

def get_air_quality_by_gps(
    latitude: float,
    longitude: float,
):

    station = find_nearest_air_station(
        latitude,
        longitude,
    )

    air = get_air_quality_by_station(
        station["name"]
    )

    return {
        "gps": {
            "latitude": latitude,
            "longitude": longitude,
        },

        "nearest_station": {
            "station_name": station["name"],
            "distance_km": station["distance_km"],
        },

        "air_quality": air,
    }