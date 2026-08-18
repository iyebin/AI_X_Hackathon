from datetime import datetime, timezone

try:
    import models
    from air import get_air_quality_by_gps
    from weather import get_weather_by_gps
    from firebase_service import send_push_notification
    from risk_policy import (
        calculate_integrated_risk,
        lmtad_score_from_anomaly,
    )
except ImportError:
    from backend import models
    from backend.air import get_air_quality_by_gps
    from backend.weather import get_weather_by_gps
    from backend.firebase_service import send_push_notification
    from backend.risk_policy import (
        calculate_integrated_risk,
        lmtad_score_from_anomaly,
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _user_ids(db, model, subject_id: int, id_field: str) -> list[int]:
    rows = db.query(model).filter(model.subject_id == subject_id).all()
    return [getattr(row, id_field) for row in rows]


def _send_push(db, user_type: str, user_id: int, title: str, body: str, data: dict):
    tokens = (
        db.query(models.DeviceToken)
        .filter(
            models.DeviceToken.user_type == user_type,
            models.DeviceToken.user_id == user_id,
        )
        .all()
    )
    for device in tokens:
        try:
            send_push_notification(
                token=device.token,
                title=title,
                body=body,
                data={key: str(value) for key, value in data.items()},
            )
        except Exception as exc:
            print(f"[RISK PIPELINE] push failed {user_type}={user_id}: {exc}")


def _notify_transition(
    db,
    subject,
    previous_level: str | None,
    level: str,
    final_score: float,
    lmtad_score: float,
    weather_score: float | None,
    air_score: float | None,
):
    if previous_level == level:
        return

    guardian_ids = _user_ids(
        db, models.GuardianRegistration, subject.id, "guardian_id"
    )
    manager_ids = _user_ids(
        db, models.ManagerAssignment, subject.id, "manager_id"
    )

    if level == "danger":
        alert_type = "risk_danger"
        message = f"{subject.name}님이 위험 단계에 진입했습니다. (위험 점수: {final_score:g})"
        subject_push = True
        manager_push = True
    elif level == "caution":
        alert_type = "risk_caution"
        message = f"{subject.name}님이 주의 단계에 진입했습니다. (위험 점수: {final_score:g})"
        subject_push = True
        manager_push = False
    elif previous_level in {"caution", "danger"}:
        alert_type = "risk_recovered_safe"
        message = f"{subject.name}님의 위험 단계가 안전으로 변경되었습니다."
        subject_push = False
        manager_push = False
    else:
        return

    snapshot = {
        "risk_level": level,
        "risk_score": final_score,
        "lmtad_score": lmtad_score,
        "weather_score": weather_score,
        "air_score": air_score,
    }

    for guardian_id in guardian_ids:
        db.add(
            models.Alert(
                type=alert_type,
                subject_id=subject.id,
                guardian_id=guardian_id,
                message=message,
                risk_score=final_score,
                risk_snapshot=snapshot,
                is_read=False,
            )
        )
    db.commit()

    push_data = {
        "type": alert_type,
        "subject_id": subject.id,
        "risk_level": level,
        "risk_score": final_score,
    }
    for guardian_id in guardian_ids:
        _send_push(db, "guardian", guardian_id, "안심하랑께 위험도 알림", message, push_data)
    if subject_push:
        _send_push(db, "subject", subject.id, "안심하랑께 위험도 알림", message, push_data)
    if manager_push:
        for manager_id in manager_ids:
            _send_push(db, "institution_manager", manager_id, "안심하랑께 기관 위험 알림", message, push_data)


def process_ai_risk_result(
    db,
    *,
    subject_id: int,
    anomaly_score: float,
    threshold: float,
) -> dict:
    subject = db.get(models.Subject, subject_id)
    if subject is None:
        raise ValueError("보호대상자를 찾을 수 없습니다.")

    latest_gps = (
        db.query(models.GPSRecord)
        .filter(models.GPSRecord.subject_id == subject_id)
        .order_by(models.GPSRecord.measured_at.desc(), models.GPSRecord.gps_id.desc())
        .first()
    )
    if latest_gps is None:
        raise ValueError("GPS 기록이 없습니다.")

    previous = (
        db.query(models.RiskStatusHistory)
        .filter(models.RiskStatusHistory.subject_id == subject_id)
        .order_by(
            models.RiskStatusHistory.created_at.desc(),
            models.RiskStatusHistory.id.desc(),
        )
        .first()
    )

    # 새 GPS가 없으면 같은 환경/AI 결과를 반복 저장하지 않는다.
    if (
        previous is not None
        and previous.created_at is not None
        and latest_gps.measured_at is not None
        and _as_utc(previous.created_at) >= _as_utc(latest_gps.measured_at)
        and previous.lmtad_score is not None
    ):
        return {
            "risk_status_id": previous.id,
            "risk_score": float(previous.risk_score or 0),
            "risk_level": previous.risk_level,
            "lmtad_score": previous.lmtad_score,
            "weather_score": previous.weather_score,
            "air_score": previous.air_score,
            "evaluated_at": _as_utc(previous.created_at).isoformat(),
            "skipped_no_new_gps": True,
        }

    lmtad_score = lmtad_score_from_anomaly(anomaly_score, threshold)

    weather_score = None
    air_score = None
    try:
        weather_data = get_weather_by_gps(latest_gps.latitude, latest_gps.longitude)
        weather_score = weather_data.get("weather_risk_score")
    except Exception as exc:
        print(f"[RISK PIPELINE] weather lookup failed: {exc}")

    try:
        air_data = get_air_quality_by_gps(latest_gps.latitude, latest_gps.longitude)
        air_score = (air_data.get("air_quality") or {}).get("air_risk_score")
    except Exception as exc:
        print(f"[RISK PIPELINE] air lookup failed: {exc}")

    final_score, level = calculate_integrated_risk(
        lmtad_score, weather_score, air_score
    )

    previous_level = previous.risk_level if previous else None

    status = models.RiskStatusHistory(
        subject_id=subject_id,
        risk_level=level,
        risk_score=final_score,
        lmtad_score=lmtad_score,
        weather_score=weather_score,
        air_score=air_score,
        lmtad_reason=f"LM-TAD anomaly_score={anomaly_score:.4f}, threshold={threshold:.4f}",
        weather_reason="기상 위험점수 자동 조회" if weather_score is not None else "기상 위험점수 조회 실패",
        air_reason="대기 위험점수 자동 조회" if air_score is not None else "대기 위험점수 조회 실패",
    )
    db.add(status)
    db.commit()
    db.refresh(status)

    _notify_transition(
        db,
        subject,
        previous_level,
        level,
        final_score,
        lmtad_score,
        weather_score,
        air_score,
    )

    return {
        "risk_status_id": status.id,
        "risk_score": final_score,
        "risk_level": level,
        "lmtad_score": lmtad_score,
        "weather_score": weather_score,
        "air_score": air_score,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "skipped_no_new_gps": False,
    }
