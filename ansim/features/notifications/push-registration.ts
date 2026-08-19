import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../api/api-config';

export type PushUserType = 'guardian' | 'subject';

type PushRegistration = {
  userId: number;
  userType: PushUserType;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // 앱이 화면에 열려 있을 때는 시스템 푸시를 띄우지 않습니다.
    // 사용자가 알림 탭에서 직접 선택할 수 있고, 백그라운드에서는 OS가 푸시를 표시합니다.
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

async function getFcmDeviceToken(): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('FCM 직접 발송은 현재 Android 기기에서만 지원합니다.');
  }

  await Notifications.setNotificationChannelAsync('risk-alerts', {
    name: '위험 알림',
    importance: Notifications.AndroidImportance.MAX,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF2525',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  const currentPermissions = await Notifications.getPermissionsAsync();
  let status = currentPermissions.status;
  if (status !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    status = requestedPermissions.status;
  }
  if (status !== 'granted') {
    throw new Error('알림 권한이 허용되지 않았습니다.');
  }

  // Firebase의 google-services.json이 포함된 Android 네이티브 빌드에서는
  // 이 값이 FCM registration token입니다.
  return (await Notifications.getDevicePushTokenAsync()).data;
}

async function sendTokenToServer(registration: PushRegistration, token: string) {
  if (__DEV__) {
    console.info('[FCM] registering device token on server', {
      userId: registration.userId,
      userType: registration.userType,
    });
  }

  const response = await fetch(`${API_BASE_URL}/push-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: registration.userId,
      user_type: registration.userType,
      push_token: token,
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => '');
    throw new Error(`푸시 토큰 전송 실패 (${response.status}): ${responseBody || '응답 본문 없음'}`);
  }
}

/**
 * 인증된 사용자가 메인 화면에 진입할 때 호출합니다.
 * 서버는 같은 사용자·기기의 토큰을 upsert 처리해야 합니다.
 */
export async function registerPushNotifications(registration: PushRegistration): Promise<string> {
  if (!Number.isInteger(registration.userId) || registration.userId <= 0) {
    throw new Error('푸시 알림을 등록할 사용자 정보가 없습니다.');
  }

  const token = await getFcmDeviceToken();
  if (__DEV__) {
    console.info('[FCM] device token issued', {
      userId: registration.userId,
      userType: registration.userType,
      token,
    });
  }
  try {
    await sendTokenToServer(registration, token);
  } catch (error) {
    console.error('[FCM] device token registration failed', error);
    throw error;
  }
  if (__DEV__) {
    console.info('[FCM] device token registered on server', {
      userId: registration.userId,
      userType: registration.userType,
    });
  }
  return token;
}
