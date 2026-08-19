LMTAD_WEIGHT = 0.60
WEATHER_WEIGHT = 0.25
AIR_WEIGHT = 0.15

SAFE_MAX_EXCLUSIVE = 40.0
CAUTION_MAX_EXCLUSIVE = 70.0


def clamp_risk_score(value: float) -> float:
    return round(min(100.0, max(0.0, float(value))), 2)


def risk_level_from_score(score: float) -> str:
    score = clamp_risk_score(score)
    if score >= CAUTION_MAX_EXCLUSIVE:
        return "danger"
    if score >= SAFE_MAX_EXCLUSIVE:
        return "caution"
    return "safe"


def lmtad_score_from_anomaly(
    anomaly_score: float,
    threshold: float,
) -> float:
    """LM-TAD anomaly score를 서비스용 0~100 점수로 정규화한다.

    threshold 지점을 danger 진입 기준인 70점에 맞춘다.
    """
    if threshold <= 0:
        raise ValueError("ANOMALY_THRESHOLD는 0보다 커야 합니다.")

    ratio = max(0.0, float(anomaly_score) / float(threshold))
    if ratio <= 1.0:
        return clamp_risk_score(ratio * 70.0)

    return clamp_risk_score(
        70.0 + min(30.0, (ratio - 1.0) * 30.0)
    )


def calculate_integrated_risk(
    lmtad_score: float | None,
    weather_score: float | None,
    air_score: float | None,
) -> tuple[float, str]:
    """가용한 세부 점수를 GPS 60%/기상 25%/대기 15% 비율로 통합한다.

    일부 외부 점수가 없으면 존재하는 항목의 가중치만 다시 정규화한다.
    """
    parts = [
        (lmtad_score, LMTAD_WEIGHT),
        (weather_score, WEATHER_WEIGHT),
        (air_score, AIR_WEIGHT),
    ]
    available = [
        (clamp_risk_score(score), weight)
        for score, weight in parts
        if score is not None
    ]

    if not available:
        raise ValueError("통합 위험도 계산에 사용할 점수가 없습니다.")

    weight_sum = sum(weight for _, weight in available)
    final_score = clamp_risk_score(
        sum(score * weight for score, weight in available)
        / weight_sum
    )
    return final_score, risk_level_from_score(final_score)
