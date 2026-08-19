"""Gemini를 이용해 환경 관측값을 짧은 안전 안내 문장으로 바꿉니다.

이 모듈은 위치, 이름, 연락처 등 개인 식별정보를 Gemini에 전달하지 않습니다.
호출 실패 또는 API 키 미설정 시 ``None``을 반환해 기존 규칙 기반 설명을
그대로 사용할 수 있게 합니다.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import requests


GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)
CACHE_TTL_SECONDS = 600
_description_cache: dict[str, tuple[float, str]] = {}


def _cached_description(cache_key: str) -> str | None:
    cached = _description_cache.get(cache_key)
    if not cached:
        return None

    created_at, description = cached
    if time.monotonic() - created_at >= CACHE_TTL_SECONDS:
        _description_cache.pop(cache_key, None)
        return None

    return description


def generate_environment_description(
    *,
    factor_name: str,
    observations: dict[str, Any],
) -> str | None:
    """관측값만 근거로 기상/대기질 설명을 생성합니다.

    반환값은 화면에 바로 표시 가능한 한두 문장입니다. Gemini를 위험 판단기로
    사용하지 않으며 점수와 등급도 변경하지 않습니다.
    """

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    cache_key = json.dumps(
        {"factor_name": factor_name, "observations": observations},
        ensure_ascii=False,
        sort_keys=True,
        default=str,
    )
    cached = _cached_description(cache_key)
    if cached is not None:
        return cached

    prompt = f"""
너는 보호자 앱의 안전 안내 문구 작성 도우미다.
아래는 '{factor_name}'에 관한 실제 관측값 JSON이다.

규칙:
1. JSON에 있는 값과 기상특보만 근거로 한국어 1~2문장(최대 180자)을 작성한다.
2. 제공되지 않은 수치, 원인, 건강 상태, 예측을 만들지 않는다.
3. 위험 점수나 위험 등급을 판단하거나 변경하지 않는다.
4. 개인 이름, GPS 좌표, 주소를 언급하지 않는다.
5. JSON 객체 하나만 반환한다: {{"description":"문장"}}

관측값:
{json.dumps(observations, ensure_ascii=False, default=str)}
""".strip()

    try:
        response = requests.post(
            GEMINI_URL,
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0,
                    "maxOutputTokens": 180,
                    "responseMimeType": "application/json",
                },
            },
            timeout=5,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        description = json.loads(text).get("description")
        if not isinstance(description, str) or not description.strip():
            return None

        description = " ".join(description.split())[:180]
        _description_cache[cache_key] = (time.monotonic(), description)
        return description
    except (KeyError, IndexError, TypeError, ValueError, requests.RequestException) as exc:
        print(f"[GEMINI] {factor_name} 설명 생성 실패: {exc}")
        return None
