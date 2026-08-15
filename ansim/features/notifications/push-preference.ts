import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PushUserType } from './push-registration';

type PushUser = {
  userId: number;
  userType: PushUserType;
};

const preferenceKey = ({ userId, userType }: PushUser) => `ansim:push-enabled:${userType}:${userId}`;

export async function isPushNotificationEnabled(user: PushUser): Promise<boolean> {
  const savedValue = await AsyncStorage.getItem(preferenceKey(user));
  return savedValue !== 'false';
}

export async function setPushNotificationEnabled(user: PushUser, enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(preferenceKey(user), String(enabled));
}
