import os
import requests
from fastapi import HTTPException

GWANGJU_AIR_API_KEY = os.getenv("GWANGJU_AIR_API_KEY")

def get_gwangju_air_network():
    if not GWANGJU_AIR_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GWANGJU_AIR_API_KEY가 설정되지 않았습니다."
        )

    # 공공데이터포털 활용신청 화면에 표시되는 실제 endpoint 사용
    url = "여기에_광주대기오염측정망_API_URL"

    params = {
        "serviceKey": GWANGJU_AIR_API_KEY,
        "page": 1,
        "perPage": 100,
        "returnType": "JSON",
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    return response.json()