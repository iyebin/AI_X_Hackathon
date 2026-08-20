import json
import math
import random
from pathlib import Path

import pandas as pd


SEED = 42
TOTAL = 30000

random.seed(SEED)

GPS_PATH = Path("facility_csv/gps_seoul_incheon.csv")
FACILITY_PATH = Path("facilities_import.csv")

OUT_DIR = Path("llm_dataset")
OUT_DIR.mkdir(exist_ok=True)


SUBJECT_TYPES = [
    "elderly",
    "child",
    "disability",
    "dementia",
    "general",
]

WEATHER_CASES = [
    ("normal", None, 0),
    ("hot", "폭염주의보", 15),
    ("very_hot", "폭염경보", 25),
    ("rain", "호우주의보", 18),
    ("heavy_rain", "호우경보", 30),
    ("strong_wind", "강풍주의보", 15),
]

AIR_CASES = [
    ("good", 0),
    ("normal", 5),
    ("bad", 12),
    ("very_bad", 20),
]


def haversine(lat1, lon1, lat2, lon2):
    r = 6371.0

    p1 = math.radians(lat1)
    p2 = math.radians(lat2)

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(p1)
        * math.cos(p2)
        * math.sin(dlon / 2) ** 2
    )

    return 2 * r * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a),
    )


def risk_level(score):
    if score >= 70:
        return "danger"
    if score >= 40:
        return "warning"
    return "safe"


def nearest_facilities_for_point(
    latitude,
    longitude,
    facilities,
    limit=3,
):
    rows = []

    for _, facility in facilities.iterrows():
        lat = float(facility["latitude"])
        lon = float(facility["longitude"])

        distance = haversine(
            latitude,
            longitude,
            lat,
            lon,
        )

        rows.append({
            "name": str(facility["name"]),
            "address": str(
                facility.get("address", "")
            ),
            "distance_km": round(distance, 2),
        })

    rows.sort(
        key=lambda item: item["distance_km"]
    )

    return rows[:limit]


def create_answer(
    subject_type,
    level,
    lmtad_score,
    weather_warning,
    air_condition,
    nearby,
):
    reasons = []

    if lmtad_score >= 75:
        reasons.append(
            "평소 이동 패턴에서 큰 이상이 감지되었습니다"
        )
    elif lmtad_score >= 45:
        reasons.append(
            "평소 이동 패턴과 일부 차이가 감지되었습니다"
        )

    if weather_warning:
        reasons.append(
            f"{weather_warning}가 발효 중입니다"
        )

    if air_condition == "very_bad":
        reasons.append(
            "대기질이 매우 나쁜 상태입니다"
        )
    elif air_condition == "bad":
        reasons.append(
            "대기질이 좋지 않습니다"
        )

    if not reasons:
        reasons.append(
            "현재 뚜렷한 위험 요인이 감지되지 않았습니다"
        )

    if level == "danger":
        action = (
            "보호자에게 즉시 알리고 대상자의 "
            "현재 위치와 안전 상태를 확인하세요."
        )
    elif level == "warning":
        action = (
            "대상자의 위치와 이동 상태를 확인하고 "
            "위험 변화 여부를 지속적으로 확인하세요."
        )
    else:
        action = (
            "현재 상태를 유지하면서 이동 및 "
            "환경 변화를 지속적으로 확인하세요."
        )

    if subject_type == "child" and level != "safe":
        action += " 아동이 보호자와 함께 있는지 확인하세요."
    elif subject_type == "elderly" and level != "safe":
        action += " 낙상이나 이동 곤란 여부도 확인하세요."
    elif subject_type == "dementia" and level != "safe":
        action += " 배회 또는 경로 이탈 여부를 우선 확인하세요."
    elif subject_type == "disability" and level != "safe":
        action += " 이동 지원이 필요한 상태인지 확인하세요."

    if nearby:
        nearest = nearby[0]
        facility_text = (
            f"필요한 경우 약 {nearest['distance_km']}km 거리의 "
            f"{nearest['name']}을 확인할 수 있습니다."
        )
    else:
        facility_text = (
            "현재 확인 가능한 주변 복지시설 정보가 없습니다."
        )

    return {
        "summary": " ".join(reasons) + ".",
        "main_reason": reasons[0] + ".",
        "recommended_action": action,
        "facility_recommendation": facility_text,
    }


gps = pd.read_csv(GPS_PATH)

facilities = pd.read_csv(
    FACILITY_PATH,
    low_memory=False,
)

facilities = facilities[
    facilities["latitude"].notna()
    & facilities["longitude"].notna()
].copy()

gps = gps.reset_index(drop=True)

print(f"GPS 포인트: {len(gps)}")
print(f"시설 수: {len(facilities)}")
print("주변시설 캐시 생성 시작...")


# ---------------------------------------------------------
# 핵심 최적화:
# 실제 GPS 599개에 대해서만 주변시설을 한 번 계산한다.
# ---------------------------------------------------------

facility_cache = {}

for idx, gps_row in gps.iterrows():
    latitude = float(gps_row["latitude"])
    longitude = float(gps_row["longitude"])

    facility_cache[idx] = nearest_facilities_for_point(
        latitude,
        longitude,
        facilities,
        limit=3,
    )

    if (
        (idx + 1) % 50 == 0
        or idx + 1 == len(gps)
    ):
        percent = (
            (idx + 1)
            / len(gps)
            * 100
        )

        print(
            f"[시설 캐시] "
            f"{idx + 1}/{len(gps)} "
            f"({percent:.1f}%)"
        )

print("주변시설 캐시 완료")
print("30,000개 학습 시나리오 생성 시작...")


records = []

for i in range(TOTAL):
    gps_idx = random.randrange(
        len(gps)
    )

    gps_row = gps.iloc[gps_idx]

    latitude = float(
        gps_row["latitude"]
    )
    longitude = float(
        gps_row["longitude"]
    )

    # 너무 동일한 좌표만 반복하지 않도록
    # 소폭 위치 변동
    latitude += random.uniform(
        -0.003,
        0.003,
    )
    longitude += random.uniform(
        -0.003,
        0.003,
    )

    subject_type = random.choice(
        SUBJECT_TYPES
    )

    (
        weather_condition,
        weather_warning,
        weather_score,
    ) = random.choice(
        WEATHER_CASES
    )

    (
        air_condition,
        air_score,
    ) = random.choice(
        AIR_CASES
    )

    mode = random.random()

    if mode < 0.45:
        lmtad_score = random.randint(
            0,
            35,
        )
    elif mode < 0.75:
        lmtad_score = random.randint(
            36,
            69,
        )
    else:
        lmtad_score = random.randint(
            70,
            100,
        )

    score = round(
        0.65 * lmtad_score
        + 0.20 * weather_score
        + 0.15 * air_score,
        1,
    )

    if (
        lmtad_score >= 85
        and (
            weather_score >= 18
            or air_score >= 12
        )
    ):
        score = max(
            score,
            random.uniform(
                70,
                95,
            ),
        )

    score = round(
        min(
            100,
            max(
                0,
                score,
            ),
        ),
        1,
    )

    level = risk_level(
        score
    )

    nearby = facility_cache[
        gps_idx
    ]

    user_payload = {
        "subject": {
            "subject_type": subject_type,
        },
        "location": {
            "latitude": round(
                latitude,
                6,
            ),
            "longitude": round(
                longitude,
                6,
            ),
            "source": "gps",
        },
        "risk": {
            "risk_score": score,
            "risk_level": level,
            "lmtad_score": lmtad_score,
            "weather_score": weather_score,
            "air_score": air_score,
        },
        "environment": {
            "weather_condition": weather_condition,
            "weather_warning": weather_warning,
            "air_condition": air_condition,
        },
        "nearby_facilities": nearby,
    }

    answer = create_answer(
        subject_type=subject_type,
        level=level,
        lmtad_score=lmtad_score,
        weather_warning=weather_warning,
        air_condition=air_condition,
        nearby=nearby,
    )

    records.append({
        "messages": [
            {
                "role": "system",
                "content": (
                    "당신은 안전취약계층 위험상황 설명 AI입니다. "
                    "입력된 위험도와 환경정보를 변경하거나 새로 계산하지 말고, "
                    "위험 이유와 보호자가 취할 행동을 간결하고 정확하게 설명하세요. "
                    "반드시 JSON 형식으로 답하세요."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    user_payload,
                    ensure_ascii=False,
                ),
            },
            {
                "role": "assistant",
                "content": json.dumps(
                    answer,
                    ensure_ascii=False,
                ),
            },
        ]
    })

    if (
        (i + 1) % 1000 == 0
        or i + 1 == TOTAL
    ):
        percent = (
            (i + 1)
            / TOTAL
            * 100
        )

        print(
            f"[시나리오] "
            f"{i + 1}/{TOTAL} "
            f"({percent:.1f}%)"
        )


random.shuffle(
    records
)

train_end = int(
    len(records) * 0.8
)

valid_end = int(
    len(records) * 0.9
)

datasets = {
    "train.jsonl":
        records[:train_end],

    "validation.jsonl":
        records[
            train_end:valid_end
        ],

    "test.jsonl":
        records[
            valid_end:
        ],
}

for filename, rows in datasets.items():
    path = (
        OUT_DIR
        / filename
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as f:
        for row in rows:
            f.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                )
                + "\n"
            )

    print(
        filename,
        len(rows),
    )

print(
    "완료:",
    OUT_DIR.resolve(),
)
