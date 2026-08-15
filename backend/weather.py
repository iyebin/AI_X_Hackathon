import math
import requests

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from weather_alert import get_warning_for_gps


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

def get_base_datetime(hours_ago: int = 0):
    now = datetime.now(
        ZoneInfo("Asia/Seoul")
    )

    target = now - timedelta(hours=hours_ago)

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

    items = []
    used_date = None
    used_time = None

    # 현재 시간부터 최대 3시간 전까지 확인
    for hours_ago in range(4):

        base_date, base_time = (
            get_base_datetime(hours_ago)
        )

        items = fetch_weather(
            nx,
            ny,
            base_date,
            base_time,
        )

        if items:
            used_date = base_date
            used_time = base_time
            break

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
    weather_risk_score = calculate_weather_risk_score(
        weather.get("T1H"),
        weather.get("RN1"),
        weather.get("WSD"),
    )

    # 현재 GPS 위치의 기상특보 조회
    warning_data = get_warning_for_gps(
        latitude,
        longitude,
    )

    # 특보 단계에 따라 기상 위험점수 보정
    weather_risk_score = apply_weather_warning_score(
        weather_risk_score,
        warning_data.get("highest_level"),
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

        "base_date": used_date,
        "base_time": used_time,

        "temperature": weather.get("T1H"),
        "humidity": weather.get("REH"),
        "rainfall_1h": weather.get("RN1"),
        "precipitation_type": weather.get("PTY"),
        "wind_speed": weather.get("WSD"),
        "wind_direction": weather.get("VEC"),

        "weather_risk_score": weather_risk_score,
        "weather_warning": warning_data,
        }

def calculate_weather_risk_score(
    temperature,
    rainfall_1h,
    wind_speed,
) -> float:

    # 문자열 → 숫자 변환
    try:
        temperature = float(temperature)
    except (TypeError, ValueError):
        temperature = None

    try:
        rainfall = float(rainfall_1h)
    except (TypeError, ValueError):
        rainfall = 0.0

    try:
        wind = float(wind_speed)
    except (TypeError, ValueError):
        wind = 0.0

    # -------------------------
    # 기온 위험도
    # -------------------------
    temperature_score = 0

    if temperature is not None:
        if temperature >= 38:
            temperature_score = 100
        elif temperature >= 35:
            temperature_score = 70
        elif temperature >= 33:
            temperature_score = 40
        elif temperature >= 30:
            temperature_score = 20

        elif temperature <= -10:
            temperature_score = 100
        elif temperature <= -5:
            temperature_score = 60
        elif temperature <= 0:
            temperature_score = 30

    # -------------------------
    # 강수 위험도
    # -------------------------
    if rainfall >= 30:
        rainfall_score = 100
    elif rainfall >= 15:
        rainfall_score = 60
    elif rainfall >= 5:
        rainfall_score = 30
    elif rainfall > 0:
        rainfall_score = 10
    else:
        rainfall_score = 0

    # -------------------------
    # 풍속 위험도
    # -------------------------
    if wind >= 20:
        wind_score = 100
    elif wind >= 15:
        wind_score = 80
    elif wind >= 10:
        wind_score = 50
    elif wind >= 5:
        wind_score = 20
    else:
        wind_score = 0

    # 가장 위험한 기상 요소 사용
    return float(
        max(
            temperature_score,
            rainfall_score,
            wind_score,
        )
    )


def apply_weather_warning_score(
    weather_score: float,
    warning_level: str | None,
) -> float:

    if warning_level == "예비":
        return max(
            weather_score,
            50.0,
        )

    if warning_level == "주의":
        return max(
            weather_score,
            70.0,
        )

    if warning_level == "경보":
        return max(
            weather_score,
            100.0,
        )

    return weather_score
