import json
import os

import firebase_admin
from firebase_admin import credentials, messaging


def initialize_firebase():
    # 이미 초기화되어 있으면 그대로 사용
    if firebase_admin._apps:
        return True

    firebase_credentials = os.getenv("FIREBASE_CREDENTIALS")

    # 아직 Firebase Service Account를 못 받은 상태
    if not firebase_credentials:
        print("[FCM] FIREBASE_CREDENTIALS not configured")
        return False

    try:
        credential_dict = json.loads(firebase_credentials)

        cred = credentials.Certificate(
            credential_dict
        )

        firebase_admin.initialize_app(cred)

        print("[FCM] Firebase initialized")

        return True

    except Exception as e:
        print(
            f"[FCM] Firebase initialization failed: {e}"
        )
        return False


def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
):
    firebase_ready = initialize_firebase()

    # 지금처럼 Firebase 인증정보가 없는 경우
    # 실제 전송 대신 Render 로그로 확인
    if not firebase_ready:
        print(
            "[FCM MOCK]",
            {
                "token": token,
                "title": title,
                "body": body,
                "data": data,
            },
        )

        return "mock_sent"

    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data=data or {},
        token=token,
    )

    response = messaging.send(message)

    print(f"[FCM] Push sent: {response}")

    return response