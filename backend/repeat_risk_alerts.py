from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from backend import models
from backend.database import SessionLocal
from backend.firebase_service import send_push_notification


DANGEROUS_RISK_LEVELS = {
    "danger", "emergency", "critical", "위험", "긴급", "심각"
}
RISK_ALERT_TYPES = {
    "risk",  # legacy
    "risk_danger",
    "risk_danger_repeat",
}
REPEAT_ALERT_TYPE = "risk_danger_repeat"


def main():
    db = SessionLocal()

    try:
        now = datetime.now(timezone.utc)
        five_minutes_ago = now - timedelta(minutes=5)

        latest_status_subquery = (
            db.query(
                models.RiskStatusHistory.subject_id,
                func.max(models.RiskStatusHistory.id).label("latest_id"),
            )
            .group_by(models.RiskStatusHistory.subject_id)
            .subquery()
        )

        latest_statuses = (
            db.query(models.RiskStatusHistory)
            .join(
                latest_status_subquery,
                models.RiskStatusHistory.id == latest_status_subquery.c.latest_id,
            )
            .all()
        )

        sent_subjects = 0
        sent_pushes = 0

        for status in latest_statuses:
            risk_level = status.risk_level.strip().lower() if status.risk_level else ""
            if risk_level not in DANGEROUS_RISK_LEVELS:
                continue

            subject = db.get(models.Subject, status.subject_id)
            if not subject:
                continue

            recent_alert = (
                db.query(models.Alert)
                .filter(
                    models.Alert.subject_id == status.subject_id,
                    models.Alert.type.in_(RISK_ALERT_TYPES),
                    models.Alert.created_at >= five_minutes_ago,
                )
                .order_by(models.Alert.created_at.desc())
                .first()
            )
            if recent_alert:
                print(
                    "[RISK CRON] skip:",
                    f"subject={status.subject_id}",
                    "recent danger alert exists",
                )
                continue

            guardian_links = (
                db.query(models.GuardianRegistration)
                .filter(models.GuardianRegistration.subject_id == status.subject_id)
                .all()
            )
            if not guardian_links:
                print("[RISK CRON] no guardian:", status.subject_id)
                continue

            created_alerts = []
            for link in guardian_links:
                alert = models.Alert(
                    type=REPEAT_ALERT_TYPE,
                    subject_id=status.subject_id,
                    guardian_id=link.guardian_id,
                    message=f"{subject.name}님의 위험 상태가 계속 감지되고 있습니다.",
                    risk_score=status.risk_score,
                    risk_snapshot={
                        "risk_level": risk_level,
                        "risk_score": status.risk_score,
                        "lmtad_score": status.lmtad_score,
                        "weather_score": status.weather_score,
                        "air_score": status.air_score,
                    },
                    is_read=False,
                )
                db.add(alert)
                created_alerts.append(alert)

            db.commit()

            for alert in created_alerts:
                db.refresh(alert)
                tokens = (
                    db.query(models.DeviceToken)
                    .filter(
                        models.DeviceToken.user_type == "guardian",
                        models.DeviceToken.user_id == alert.guardian_id,
                    )
                    .all()
                )
                for device in tokens:
                    try:
                        send_push_notification(
                            token=device.token,
                            title="위험 알림",
                            body=f"{subject.name}님의 위험 상태가 계속되고 있습니다.",
                            data={
                                "type": REPEAT_ALERT_TYPE,
                                "subject_id": str(status.subject_id),
                                "guardian_id": str(alert.guardian_id),
                                "risk_level": risk_level,
                                "risk_score": str(status.risk_score or ""),
                            },
                        )
                        sent_pushes += 1
                    except Exception as exc:
                        print(
                            "[RISK CRON] push failed:",
                            f"guardian={alert.guardian_id}",
                            exc,
                        )

            sent_subjects += 1

        print(
            "[RISK CRON] completed:",
            f"subjects={sent_subjects},",
            f"pushes={sent_pushes}",
        )

    except Exception as exc:
        db.rollback()
        print("[RISK CRON] ERROR:", exc)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
