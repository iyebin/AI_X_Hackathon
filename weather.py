import math
import requests

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


WEATHER_URL = (
    "https://apis.data.go.kr/1360000/"
    "VilageFcstInfoService_2.0/"
    "getUltraSrtNcst"
)

KEY = "aaddafbd9f63ada9776bd4c16d3287772311bd17a96258e14f916079550aa21a"

def gps_to_grid(lat: float, lon: float):
    RE = 6371.00877
    GRID = 5.0
    SLAT1 = 30.0
    SLAT2 = 60.0
    OLON = 126.0
    OLAT = 38.0
    XO = 43
    YO = 136

    DEGRAD = math.pi / 180.0

    re = RE / GRID
    slat1 = SLAT1 * DEGRAD
    slat2 = SLAT2 * DEGRAD
    olon = OLON * DEGRAD
    olat = OLAT * DEGRAD

    sn = (
        math.tan(math.pi * 0.25 + slat2 * 0.5)
        / math.tan(math.pi * 0.25 + slat1 * 0.5)
    )

    sn = math.log(
        math.cos(slat1) / math.cos(slat2)
    ) / math.log(sn)

    sf = (
        math.tan(math.pi * 0.25 + slat1 * 0.5)
        ** sn
        * math.cos(slat1)
        / sn
    )

    ro = (
        math.tan(math.pi * 0.25 + olat * 0.5)
        ** (-sn)
        * re
        * sf
    )

    ra = (
        math.tan(
            math.pi * 0.25
            + lat * DEGRAD * 0.5
        )
        ** (-sn)
        * re
        * sf
    )

    theta = lon * DEGRAD - olon

    if theta > math.pi:
        theta -= 2.0 * math.pi

    if theta < -math.pi:
        theta += 2.0 * math.pi

    theta *= sn

    nx = int(
        math.floor(
            ra * math.sin(theta)
            + XO
            + 0.5
        )
    )

    ny = int(
        math.floor(
            ro
            - ra * math.cos(theta)
            + YO
            + 0.5
        )
    )

    return nx, ny

def get_base_datetime():
    now = datetime.now(
        ZoneInfo("Asia/Seoul")
    )

   
    if now.minute >= 45:
        target = now
    else:
        target = now - timedelta(hours=1)

    return (
        target.strftime("%Y%m%d"),
        target.strftime("%H00"),
    )
def fetch_weather(
    nx: int,
    ny: int,
    base_date: str,
    base_time: str,
):
    params = {
        "serviceKey": KEY,
        "pageNo": "1",
        "numOfRows": "1000",
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
    }

    response = requests.get(
        WEATHER_URL,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    return (
        data
        .get("response", {})
        .get("body", {})
        .get("items", {})
        .get("item", [])
    )

def get_weather_by_gps(
    latitude: float,
    longitude: float,
):
    nx, ny = gps_to_grid(
        latitude,
        longitude,
    )

    base_date, base_time = (
        get_base_datetime()
    )

    items = fetch_weather(
        nx,
        ny,
        base_date,
        base_time,
    )

    # 최신 시각 데이터가 아직 없으면
    # 한 시간 전 자료로 자동 재시도
    if not items:
        now = datetime.now(
            ZoneInfo("Asia/Seoul")
        )

        fallback = now - timedelta(hours=1)

        base_date = fallback.strftime("%Y%m%d")
        base_time = fallback.strftime("%H00")

        items = fetch_weather(
            nx,
            ny,
            base_date,
            base_time,
        )

    if not items:
        return {
            "gps": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "grid": {
                "nx": nx,
                "ny": ny,
            },
            "message": "사용 가능한 최신 기상 실황이 없습니다.",
        }

    weather = {}

    for item in items:
        weather[item["category"]] = (
            item["obsrValue"]
        )

    return {
        "gps": {
            "latitude": latitude,
            "longitude": longitude,
        },

        "grid": {
            "nx": nx,
            "ny": ny,
        },

        "base_date": base_date,
        "base_time": base_time,

        "temperature": weather.get("T1H"),
        "humidity": weather.get("REH"),
        "rainfall_1h": weather.get("RN1"),
        "precipitation_type": weather.get("PTY"),
        "wind_speed": weather.get("WSD"),
        "wind_direction": weather.get("VEC"),
    }