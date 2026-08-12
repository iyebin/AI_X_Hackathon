import requests


URL = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"

KEY = "cb83a3d8edb3968426800dfca5c696e9b91d78897f0558811095044644b8a3d7"


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