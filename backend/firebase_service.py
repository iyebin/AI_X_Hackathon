import json
import os

import firebase_admin
from firebase_admin import credentials, messaging


def initialize_firebase():
    if firebase_admin._apps:
        return True

    firebase_credentials = os.getenv("FIREBASE_CREDENTIALS")

    if not firebase_credentials:
        print("[FCM] FIREBASE_CREDENTIALS not configured")
        return False

    try:
        credential_dict = json.loads(firebase_credentials)
        cred = credentials.Certificate(credential_dict)
        firebase_admin.initialize_app(cred)
        print("[FCM] Firebase initialized")
        return True
    except Exception as e:
        print(f"[FCM] Firebase initialization failed: {e}")
        return False


def send_push_notification(
    token: str,
    title: str,
    body: str,
    data: dict | None = None,
):
    firebase_ready = initialize_firebase()

    # 인증정보가 없을 때는 실제 발송 성공처럼 보이지 않도록 결과명을 명확히 한다.
    if not firebase_ready:
        print(
            "[FCM MOCK - NOT SENT]",
            {
                "token": token,
                "title": title,
                "body": body,
                "data": data,
            },
        )
        return "mock_not_sent"

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
