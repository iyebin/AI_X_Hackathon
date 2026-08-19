import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, View } from 'react-native';
import { getSavedSession, setCurrentGuardian } from '@/features/auth/current-session';
import { getAlert } from '@/features/alerts/alerts-api';
import { setProtectorPhone } from '@/features/contacts/protector-contact-store';

function asPositiveInteger(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : undefined;
}

function isRiskModalPush(data: Notifications.Notification['request']['content']['data'], alertKind?: string): boolean {
  const value = String(data.risk_level ?? data.riskLevel ?? data.type ?? '').toLowerCase();
  return ['danger', 'risk', 'risk_danger', 'risk_danger_repeat', 'caution', 'warning', 'risk_caution'].includes(value)
    || alertKind === 'danger'
    || alertKind === 'warning';
}

export default function LoadingScreen() {
  const router = useRouter();
  const spinValue = useRef(new Animated.Value(0)).current;
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();

    if (!isMounted) {
      return () => animation.stop();
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const session = await getSavedSession();
          if (!session) {
            router.replace('/select-type');
            return;
          }

          if (session.role === 'guardian') {
            setCurrentGuardian(session.userId, session.userName);
            router.replace({ pathname: '/protector-select', params: { guardianId: String(session.userId) } });
            void (async () => {
              const response = await Notifications.getLastNotificationResponseAsync();
              if (!response) return;

              const data = response.notification.request.content.data;
              const alertId = String(data.alert_id ?? data.alertId ?? '');
              const alert = alertId ? await getAlert(alertId).catch(() => undefined) : undefined;
              const subjectId = asPositiveInteger(data.subject_id ?? data.subjectId) ?? alert?.subjectId;
              if (subjectId && isRiskModalPush(data, alert?.kind)) {
                setTimeout(() => {
                  router.push({
                    pathname: '/danger-modal',
                    params: {
                      alertId,
                      subjectId: String(subjectId),
                      dangerScore: String(data.risk_score ?? data.riskScore ?? alert?.riskScore ?? ''),
                      dangerReasons: String(data.reason ?? alert?.reason ?? alert?.message ?? ''),
                      alertCreatedAt: alert?.createdAt ?? '',
                      riskSnapshot: alert?.riskSnapshot ? JSON.stringify(alert.riskSnapshot) : '',
                      riskLevel: String(data.risk_level ?? data.riskLevel ?? alert?.kind ?? ''),
                    },
                  });
                }, 700);
              }
              await Notifications.clearLastNotificationResponseAsync();
            })().catch(() => {});
            return;
          }

          if (session.protectorPhone) setProtectorPhone(session.protectorPhone);
          router.replace({
            pathname: '/protected-main',
            params: {
              subjectId: String(session.userId),
              userName: session.userName,
              protectorPhone: session.protectorPhone,
            },
          });
          void (async () => {
            const response = await Notifications.getLastNotificationResponseAsync();
            if (!response) return;

            const data = response.notification.request.content.data;
            const alertId = String(data.alert_id ?? data.alertId ?? '');
            const alert = alertId ? await getAlert(alertId).catch(() => undefined) : undefined;
            const receivedSubjectId = asPositiveInteger(data.subject_id ?? data.subjectId) ?? alert?.subjectId ?? session.userId;
            if (receivedSubjectId && isRiskModalPush(data, alert?.kind)) {
              setTimeout(() => {
                router.push({
                  pathname: '/danger-modal',
                  params: {
                    alertId,
                    subjectId: String(receivedSubjectId),
                    dangerScore: String(data.risk_score ?? data.riskScore ?? alert?.riskScore ?? ''),
                    dangerReasons: String(data.reason ?? alert?.reason ?? alert?.message ?? ''),
                    alertCreatedAt: alert?.createdAt ?? '',
                    riskSnapshot: alert?.riskSnapshot ? JSON.stringify(alert.riskSnapshot) : '',
                    riskLevel: String(data.risk_level ?? data.riskLevel ?? alert?.kind ?? ''),
                    viewerRole: 'protected',
                  },
                });
              }, 700);
            }
            await Notifications.clearLastNotificationResponseAsync();
          })().catch(() => {});
        } catch {
          router.replace('/select-type');
        }
      })();
    }, 2500);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [isMounted, router, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/images/loading_bg.png')}
        style={styles.backgroundImage}
        resizeMode="contain">
        <View style={styles.spinnerContainer}>
          <Animated.Image
            source={require('@/assets/images/loading_sp.png')}
            style={[styles.spinnerImage, { transform: [{ rotate: spin }] }]}
            resizeMode="contain"
          />
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerContainer: { marginTop: 350 },
  spinnerImage: { width: 70, height: 70 },
});
