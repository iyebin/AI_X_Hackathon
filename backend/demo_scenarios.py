DEMO_SCENARIOS = {
    "normal": {
        "name": "모든 위험 요소 정상",
        "latitude": 37.543317,
        "longitude": 126.946430,
        "lmtad_score": 5,
        "weather_score": 5,
        "air_score": 5,
        "lmtad_reason": "평소 이동 패턴과 일치합니다.",
        "weather_reason": "기상 상태가 안전 범위입니다.",
        "air_reason": "대기질이 좋음 수준입니다.",
        "weather": {
            "temperature": 24.0,
            "rainfall": 0.0,
            "wind_speed": 1.5,
        },
        "air": {
            "pm10": 20,
            "pm25": 8,
        },
    },

    "gps_abnormal": {
        "name": "GPS만 이상",
        "latitude": 37.620000,
        "longitude": 127.100000,
        "lmtad_score": 90,
        "weather_score": 5,
        "air_score": 5,
        "lmtad_reason": "평소 이동 경로에서 크게 벗어난 위치가 감지되었습니다.",
        "weather_reason": "기상 상태가 안전 범위입니다.",
        "air_reason": "대기질이 좋음 수준입니다.",
        "weather": {
            "temperature": 24.0,
            "rainfall": 0.0,
            "wind_speed": 1.5,
        },
        "air": {
            "pm10": 20,
            "pm25": 8,
        },
    },

    "weather_abnormal": {
        "name": "기상만 이상",
        "latitude": 37.543317,
        "longitude": 126.946430,
        "lmtad_score": 5,
        "weather_score": 95,
        "air_score": 5,
        "lmtad_reason": "평소 이동 패턴과 일치합니다.",
        "weather_reason": "폭우와 강풍이 감지되어 외출 시 주의가 필요합니다.",
        "air_reason": "대기질이 좋음 수준입니다.",
        "weather": {
            "temperature": 36.5,
            "rainfall": 45.0,
            "wind_speed": 18.0,
        },
        "air": {
            "pm10": 20,
            "pm25": 8,
        },
    },

    "air_abnormal": {
        "name": "대기만 이상",
        "latitude": 37.543317,
        "longitude": 126.946430,
        "lmtad_score": 5,
        "weather_score": 5,
        "air_score": 95,
        "lmtad_reason": "평소 이동 패턴과 일치합니다.",
        "weather_reason": "기상 상태가 안전 범위입니다.",
        "air_reason": "미세먼지와 초미세먼지가 매우 나쁨 수준입니다.",
        "weather": {
            "temperature": 24.0,
            "rainfall": 0.0,
            "wind_speed": 1.5,
        },
        "air": {
            "pm10": 180,
            "pm25": 95,
        },
    },

    "all_abnormal": {
        "name": "GPS·기상·대기 모두 이상",
        "latitude": 37.620000,
        "longitude": 127.100000,
        "lmtad_score": 90,
        "weather_score": 95,
        "air_score": 95,
        "lmtad_reason": "평소 이동 경로에서 크게 벗어난 위치가 감지되었습니다.",
        "weather_reason": "폭우와 강풍이 감지되어 외출 시 주의가 필요합니다.",
        "air_reason": "미세먼지와 초미세먼지가 매우 나쁨 수준입니다.",
        "weather": {
            "temperature": 36.5,
            "rainfall": 45.0,
            "wind_speed": 18.0,
        },
        "air": {
            "pm10": 180,
            "pm25": 95,
        },
    },
}


def get_demo_scenario(scenario: str) -> dict:
    if scenario not in DEMO_SCENARIOS:
        raise ValueError(
            f"지원하지 않는 시나리오입니다: {scenario}. "
            f"사용 가능: {', '.join(DEMO_SCENARIOS.keys())}"
        )

    result = DEMO_SCENARIOS[scenario].copy()

    total_score = round(
        result["lmtad_score"] * 0.60
        + result["weather_score"] * 0.25
        + result["air_score"] * 0.15,
        1,
    )

    if total_score >= 70:
        risk_level = "danger"
    elif total_score >= 40:
        risk_level = "caution"
    else:
        risk_level = "safe"

    result["scenario"] = scenario
    result["total_score"] = total_score
    result["risk_level"] = risk_level

    return result
