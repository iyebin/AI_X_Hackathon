import json
from itertools import product
from collections import Counter

BENCHMARK_FILE = "benchmark.jsonl"
OUTPUT_JSON = "risk_formula_validation.json"

# ---------------------------------------------------------
# 비교할 가중치 후보
# mobility + weather + air = 1.0
# ---------------------------------------------------------
WEIGHT_CANDIDATES = [
    (0.50, 0.30, 0.20),
    (0.55, 0.30, 0.15),
    (0.60, 0.25, 0.15),  # 현재 공식
    (0.65, 0.20, 0.15),
    (0.70, 0.20, 0.10),
]

# safe < warning_threshold
# warning_threshold <= score < danger_threshold
# danger_threshold <= score
THRESHOLD_CANDIDATES = [
    (35, 65),
    (40, 65),
    (40, 70),  # 현재 임계값이라고 가정
    (45, 70),
    (45, 75),
]


def load_items():
    items = []

    with open(BENCHMARK_FILE, "r", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)

            # messages 중 user content가 실제 입력 JSON
            user_message = next(
                m for m in row["messages"]
                if m["role"] == "user"
            )

            payload = json.loads(user_message["content"])

            items.append({
                "scenario_id": row.get("scenario_id"),
                "payload": payload,
                "baseline_level": payload["risk"]["risk_level"],
                "baseline_score": float(payload["risk"]["risk_score"]),
            })

    return items


def score_to_level(score, warning_threshold, danger_threshold):
    if score >= danger_threshold:
        return "danger"

    if score >= warning_threshold:
        return "warning"

    return "safe"


def severity_rank(level):
    return {
        "safe": 0,
        "warning": 1,
        "danger": 2,
    }[level]


def max_level(a, b):
    if severity_rank(a) >= severity_rank(b):
        return a
    return b


def severe_environment(payload):
    weather = payload.get("weather", {})
    air = payload.get("air", {})

    weather_level = str(
        weather.get("alert_level", "")
    ).lower()

    air_grade = str(
        air.get("cai_grade", "")
    ).lower()

    severe_weather = weather_level in {
        "warning",
        "alert",
        "severe",
        "경보",
    }

    severe_air = air_grade in {
        "very_bad",
        "very bad",
        "매우나쁨",
        "매우 나쁨",
    }

    return severe_weather or severe_air


def independent_required_level(payload):
    """
    가중치와 별개로 반드시 지켜야 하는 안전정책.

    1. 기상 warning 이상 -> 최소 warning
    2. 대기 very_bad -> 최소 warning
    3. mobility >= 75 + 심각 환경 -> 최소 danger
    """

    mobility = float(
        payload.get("mobility", {}).get("score", 0)
    )

    weather = payload.get("weather", {})
    air = payload.get("air", {})

    weather_level = str(
        weather.get("alert_level", "")
    ).lower()

    air_grade = str(
        air.get("cai_grade", "")
    ).lower()

    required = "safe"

    if weather_level in {
        "warning",
        "alert",
        "severe",
        "경보",
    }:
        required = max_level(required, "warning")

    if air_grade in {
        "very_bad",
        "very bad",
        "매우나쁨",
        "매우 나쁨",
    }:
        required = max_level(required, "warning")

    if mobility >= 75 and severe_environment(payload):
        required = "danger"

    return required


def calculate(
    payload,
    mobility_weight,
    weather_weight,
    air_weight,
    warning_threshold,
    danger_threshold,
):
    mobility = float(
        payload.get("mobility", {}).get("score", 0)
    )

    weather = float(
        payload.get("weather", {}).get("policy_score", 0)
    )

    air = float(
        payload.get("air", {}).get("policy_score", 0)
    )

    score = (
        mobility_weight * mobility
        + weather_weight * weather
        + air_weight * air
    )

    score = round(score, 1)

    raw_level = score_to_level(
        score,
        warning_threshold,
        danger_threshold,
    )

    required = independent_required_level(payload)

    final_level = max_level(raw_level, required)

    return score, raw_level, final_level, required


def evaluate_config(
    items,
    weights,
    thresholds,
):
    mw, ww, aw = weights
    warning_t, danger_t = thresholds

    total = len(items)

    baseline_agreement = 0
    level_changes = 0

    policy_violations_before_override = 0
    policy_violations_after_override = 0

    false_safe_before_override = 0
    false_safe_after_override = 0

    score_abs_diff_sum = 0.0

    level_counts = Counter()
    raw_level_counts = Counter()
    transitions = Counter()

    examples = []

    for item in items:
        payload = item["payload"]

        score, raw_level, final_level, required = calculate(
            payload,
            mw,
            ww,
            aw,
            warning_t,
            danger_t,
        )

        baseline = item["baseline_level"]

        if final_level == baseline:
            baseline_agreement += 1
        else:
            level_changes += 1

        score_abs_diff_sum += abs(
            score - item["baseline_score"]
        )

        if severity_rank(raw_level) < severity_rank(required):
            policy_violations_before_override += 1

        if severity_rank(final_level) < severity_rank(required):
            policy_violations_after_override += 1

        if required != "safe" and raw_level == "safe":
            false_safe_before_override += 1

        if required != "safe" and final_level == "safe":
            false_safe_after_override += 1

        raw_level_counts[raw_level] += 1
        level_counts[final_level] += 1

        transitions[
            f"{baseline}->{final_level}"
        ] += 1

        if (
            len(examples) < 10
            and baseline != final_level
        ):
            examples.append({
                "scenario_id": item["scenario_id"],
                "baseline_level": baseline,
                "new_level": final_level,
                "raw_level": raw_level,
                "required_level": required,
                "baseline_score": item["baseline_score"],
                "new_score": score,
            })

    agreement_rate = (
        baseline_agreement / total
        if total else 0
    )

    false_safe_rate = (
        false_safe_before_override / total
        if total else 0
    )

    # 안전서비스 관점 평가용 지표.
    # 실제 사고 예측 정확도가 아님.
    #
    # - override 이전 false-safe를 가장 강하게 벌점
    # - 정책 위반을 벌점
    # - 현재 설계와 지나치게 다른 경우도 소폭 벌점
    #
    # 이 score는 후보 비교용일 뿐
    # 실제 사고확률/정확도로 해석하면 안 됨.
    policy_score = (
        100
        - false_safe_before_override * 1.5
        - policy_violations_before_override * 0.5
        - level_changes * 0.01
    )

    return {
        "weights": {
            "mobility": mw,
            "weather": ww,
            "air": aw,
        },
        "thresholds": {
            "warning": warning_t,
            "danger": danger_t,
        },
        "total": total,
        "baseline_agreement": baseline_agreement,
        "baseline_agreement_rate": round(
            agreement_rate, 4
        ),
        "level_changes": level_changes,
        "mean_abs_score_change": round(
            score_abs_diff_sum / total, 3
        ),
        "false_safe_before_override":
            false_safe_before_override,
        "false_safe_after_override":
            false_safe_after_override,
        "policy_violations_before_override":
            policy_violations_before_override,
        "policy_violations_after_override":
            policy_violations_after_override,
        "raw_level_distribution":
            dict(raw_level_counts),
        "final_level_distribution":
            dict(level_counts),
        "transitions":
            dict(transitions),
        "policy_comparison_score":
            round(policy_score, 3),
        "changed_examples":
            examples,
    }


def main():
    items = load_items()

    print(f"Loaded scenarios: {len(items)}")

    results = []

    for weights, thresholds in product(
        WEIGHT_CANDIDATES,
        THRESHOLD_CANDIDATES,
    ):
        result = evaluate_config(
            items,
            weights,
            thresholds,
        )

        results.append(result)

    # 1순위: override 이전 false-safe 최소
    # 2순위: 정책 위반 최소
    # 3순위: 기준 설계와 안정성 높은 것
    # 4순위: 점수 변화 적은 것
    results.sort(
        key=lambda r: (
            r["false_safe_before_override"],
            r["policy_violations_before_override"],
            -r["baseline_agreement_rate"],
            r["mean_abs_score_change"],
        )
    )

    print()
    print("===== RISK FORMULA SENSITIVITY =====")
    print(
        "※ 실제 사고예측 정확도가 아니라 "
        "정책 일관성/민감도 분석입니다."
    )
    print()

    header = (
        "Rank | Weights(M/W/A) | Threshold(W/D) | "
        "False-safe | Policy violations | "
        "Baseline agree | Mean score Δ"
    )

    print(header)
    print("-" * len(header))

    for idx, r in enumerate(results[:15], start=1):
        w = r["weights"]
        t = r["thresholds"]

        print(
            f"{idx:>4} | "
            f"{w['mobility']:.2f}/"
            f"{w['weather']:.2f}/"
            f"{w['air']:.2f} | "
            f"{t['warning']}/{t['danger']} | "
            f"{r['false_safe_before_override']:>10} | "
            f"{r['policy_violations_before_override']:>17} | "
            f"{r['baseline_agreement_rate']:.4f} | "
            f"{r['mean_abs_score_change']:.3f}"
        )

    # 현재 설정 찾기
    current = None

    for r in results:
        w = r["weights"]
        t = r["thresholds"]

        if (
            w["mobility"] == 0.60
            and w["weather"] == 0.25
            and w["air"] == 0.15
            and t["warning"] == 40
            and t["danger"] == 70
        ):
            current = r
            break

    print()
    print("===== CURRENT CONFIG =====")

    if current:
        print(json.dumps(
            current,
            ensure_ascii=False,
            indent=2,
        ))

    print()
    print("===== BEST POLICY-STABLE CONFIG =====")
    print(json.dumps(
        results[0],
        ensure_ascii=False,
        indent=2,
    ))

    output = {
        "notice": (
            "이 결과는 실제 사고 예측 정확도가 아니라 "
            "합성 시나리오에 대한 정책 일관성 및 "
            "민감도 분석 결과임."
        ),
        "candidate_count": len(results),
        "current_config": current,
        "best_policy_stable_config": results[0],
        "all_results": results,
    }

    with open(
        OUTPUT_JSON,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            output,
            f,
            ensure_ascii=False,
            indent=2,
        )

    print()
    print(f"Saved: {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
