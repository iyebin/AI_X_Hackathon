import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { getAlert } from '@/features/alerts/alerts-api';
import { getSavedSession } from '@/features/auth/current-session';

function asPositiveInteger(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function isDangerPush(data: Notifications.Notification['request']['content']['data'], alertKind?: string): boolean {
  const value = String(data.risk_level ?? data.riskLevel ?? data.type ?? '').toLowerCase();
  return ['danger', 'risk', 'risk_danger', 'risk_danger_repeat'].includes(value) || alertKind === 'danger';
}

export default function RootLayout() {
  const router = useRouter();
  const handledAlertIds = useRef(new Set<string>());

  useEffect(() => {
    const openDangerModal = async (
      data: Notifications.Notification['request']['content']['data'],
      notificationId?: string,
    ) => {
      const alertId = String(data.alert_id ?? data.alertId ?? '');
      const notificationKey = alertId || notificationId || [
        data.subject_id ?? data.subjectId ?? '',
        data.risk_level ?? data.riskLevel ?? data.type ?? '',
        data.sent_at ?? data.timestamp ?? '',
      ].join(':');
      if (handledAlertIds.current.has(notificationKey)) return;

      const session = await getSavedSession();
      if (!session) return;

      const alert = alertId ? await getAlert(alertId).catch(() => undefined) : undefined;
      const subjectId = asPositiveInteger(data.subject_id ?? data.subjectId) ?? alert?.subjectId;
      const isDanger = isDangerPush(data, alert?.kind);
      if (!subjectId || !isDanger) return;

      handledAlertIds.current.add(notificationKey);
      router.push({
        pathname: '/danger-modal',
        params: {
          alertId,
          subjectId: String(subjectId),
          dangerScore: String(data.risk_score ?? data.riskScore ?? alert?.riskScore ?? ''),
          dangerReasons: String(data.reason ?? alert?.reason ?? alert?.message ?? ''),
          alertCreatedAt: alert?.createdAt ?? '',
          riskSnapshot: alert?.riskSnapshot ? JSON.stringify(alert.riskSnapshot) : '',
          viewerRole: session.role,
        },
      });
    };

    // 앱이 백그라운드일 때 받은 푸시는 사용자가 직접 눌렀을 때만 모달을 엽니다.
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openDangerModal(
        response.notification.request.content.data,
        response.notification.request.identifier,
      );
    });

    // 앱이 화면 앞에 열려 있을 때 새 위험 푸시를 받으면 시스템 배너 대신 모달을 바로 엽니다.
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      void openDangerModal(notification.request.content.data, notification.request.identifier);
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
