import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { getAlerts } from '@/features/alerts/alerts-api';
import { getSavedSession } from '@/features/auth/current-session';

function asPositiveInteger(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

export default function RootLayout() {
  const router = useRouter();
  const handledAlertIds = useRef(new Set<string>());

  useEffect(() => {
    const openDangerModal = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      const alertId = String(data.alert_id ?? data.alertId ?? '');
      if (!alertId || handledAlertIds.current.has(alertId)) return;

      const session = await getSavedSession();
      if (!session) return;

      const alert = await getAlerts()
        .then((alerts) => alerts.find((item) => item.id === alertId))
        .catch(() => undefined);
      const subjectId = asPositiveInteger(data.subject_id ?? data.subjectId) ?? alert?.subjectId;
      const severity = String(data.risk_level ?? data.riskLevel ?? data.type ?? '').toLowerCase();
      const isDanger = severity === 'danger' || severity === 'risk' || alert?.kind === 'danger';
      if (!subjectId || !isDanger) return;

      handledAlertIds.current.add(alertId);
      router.push({
        pathname: '/danger-modal',
        params: {
          alertId,
          subjectId: String(subjectId),
          dangerScore: String(data.risk_score ?? data.riskScore ?? alert?.riskScore ?? ''),
          dangerReasons: String(data.reason ?? alert?.reason ?? alert?.message ?? ''),
          viewerRole: session.role,
        },
      });
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void openDangerModal(response);
    });

    return () => subscription.remove();
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
