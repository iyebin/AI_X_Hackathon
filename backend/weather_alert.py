import csv
import io
import os
import requests

from dotenv import load_dotenv

load_dotenv()


KMA_APIHUB_KEY = os.getenv("KMA_APIHUB_KEY")

WEATHER_WARNING_URL = (
    "https://apihub.kma.go.kr/api/typ01/url/"
    "wrn_now_data.php"
)


def get_current_weather_warnings():
    if not KMA_APIHUB_KEY:
        return {
            "warnings": [],
            "message": "KMA_APIHUB_KEY가 설정되지 않았습니다.",
        }

    params = {
        "fe": "f",
        "tm": "",
        "disp": "0",
        "help": "0",
        "authKey": KMA_APIHUB_KEY,
    }

    try:
        response = requests.get(
            WEATHER_WARNING_URL,
            params=params,
            timeout=15,
        )
        response.raise_for_status()

    except requests.exceptions.Timeout:
        return {
            "warnings": [],
            "message": "기상특보 API 응답 시간이 초과되었습니다.",
        }

    except requests.exceptions.RequestException as e:
        print(f"[WEATHER WARNING ERROR] {e}")

        return {
            "warnings": [],
            "message": "기상특보 조회에 실패했습니다.",
        }

    warnings = []

    reader = csv.reader(
        io.StringIO(response.text)
    )

    for row in reader:
        if not row:
            continue

        # 주석 행 제거
        if row[0].strip().startswith("#"):
            continue

        if len(row) < 9:
            continue

        reg_up = row[0].strip()
        reg_up_name = row[1].strip()
        reg_id = row[2].strip()
        region_name = row[3].strip()
        issued_at = row[4].strip()
        effective_at = row[5].strip()
        warning_type = row[6].strip()
        warning_level = row[7].strip()
        command = row[8].strip()

        warnings.append({
            "region_upper_code": reg_up,
            "region_upper_name": reg_up_name,
            "region_code": reg_id,
            "region_name": region_name,
            "issued_at": issued_at,
            "effective_at": effective_at,
            "warning_type": warning_type,
            "warning_level": warning_level,
            "command": command,
        })

    return {
        "warnings": warnings,
        "count": len(warnings),
    }

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY")

KAKAO_REGION_URL = (
    "https://dapi.kakao.com/v2/local/geo/"
    "coord2regioncode.json"
)


def get_region_from_gps(
    latitude: float,
    longitude: float,
):
    if not KAKAO_REST_API_KEY:
        return None

    headers = {
        "Authorization": f"KakaoAK {KAKAO_REST_API_KEY}"
    }

    params = {
        "x": longitude,
        "y": latitude,
    }

    try:
        response = requests.get(
            KAKAO_REGION_URL,
            headers=headers,
            params=params,
            timeout=10,
        )
        response.raise_for_status()

    except requests.RequestException as e:
        print(f"[KAKAO REGION ERROR] {e}")
        return None

    documents = response.json().get(
        "documents",
        [],
    )

    if not documents:
        return None

    region = next(
        (
            item
            for item in documents
            if item.get("region_type") == "H"
        ),
        documents[0],
    )

    return {
        "region_1depth": region.get(
            "region_1depth_name"
        ),
        "region_2depth": region.get(
            "region_2depth_name"
        ),
        "region_3depth": region.get(
            "region_3depth_name"
        ),
    }

def get_warning_for_gps(
    latitude: float,
    longitude: float,
):
    region = get_region_from_gps(
        latitude,
        longitude,
    )

    if not region:
        return {
            "region": None,
            "warnings": [],
            "highest_level": None,
        }

    warning_data = get_current_weather_warnings()
    warnings = warning_data.get("warnings", [])

    city = region.get("region_2depth")

    # 예: "부천시 원미구" → "부천시"
    base_city = (
        city.split()[0]
        if city
        else None
    )

    matched = []

    for warning in warnings:
        warning_region = warning.get(
            "region_name",
            "",
        )

        if not city:
            continue

        # 전체 행정구역명 또는 시 단위 이름으로 매칭
        if (
            city in warning_region
            or (
                base_city
                and base_city in warning_region
            )
        ):
            matched.append(warning)
    # 높은 단계 우선
    level_priority = {
        "예비": 1,
        "주의": 2,
        "경보": 3,
    }

    highest_level = None
    highest_priority = 0

    for warning in matched:
        level = warning.get("warning_level")
        priority = level_priority.get(level, 0)

        if priority > highest_priority:
            highest_priority = priority
            highest_level = level

    result = {
        "region": region,
        "warnings": matched,
        "highest_level": highest_level,
    }

    message = warning_data.get("message")

    if message:
        result["status"] = "error"
        result["message"] = message
    else:
        result["status"] = "ok"

        if not matched:
            result["message"] = (
                "현재 해당 지역에 발효된 기상특보가 없습니다."
            )

    return result