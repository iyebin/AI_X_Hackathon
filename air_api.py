import os
import requests
from fastapi import HTTPException

AIRKOREA_API_KEY = os.getenv("AIRKOREA_API_KEY")

BASE_URL = (
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc"
    "ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"
)


def get_air_quality(sido_name="광주"):
    if not AIRKOREA_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="AIRKOREA_API_KEY가 설정되지 않았습니다."
        )

    params = {
        "serviceKey": AIRKOREA_API_KEY,
        "returnType": "json",
        "numOfRows": 100,
        "pageNo": 1,
        "sidoName": sido_name,
        "ver": "1.0",
    }

    response = requests.get(
        BASE_URL,
        params=params,
        timeout=10
    )

    response.raise_for_status()

    return response.json()