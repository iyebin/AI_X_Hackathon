import * as Location from 'expo-location';
import { NativeModules, Platform } from 'react-native';

type GpsModule = {
  startTracking: (subjectId: number) => void;
  stopTracking: () => void;
};

function getGpsModule(): GpsModule {
  if (Platform.OS !== 'android') {
    throw new Error('GPS 백그라운드 추적은 현재 Android 앱에서만 지원합니다.');
  }

  const gpsModule = NativeModules.GpsModule as GpsModule | undefined;
  if (!gpsModule) {
    throw new Error('GPS 모듈을 찾을 수 없습니다. Android 개발용 앱을 다시 설치해 주세요.');
  }

  return gpsModule;
}

export async function startGpsTracking(subjectId: number) {
  const foregroundPermission = await Location.requestForegroundPermissionsAsync();
  if (foregroundPermission.status !== 'granted') {
    throw new Error('위치 권한이 필요합니다.');
  }

  const backgroundPermission = await Location.requestBackgroundPermissionsAsync();
  if (backgroundPermission.status !== 'granted') {
    throw new Error('백그라운드 위치 권한을 항상 허용해 주세요.');
  }

  getGpsModule().startTracking(subjectId);
}

export function stopGpsTracking() {
  getGpsModule().stopTracking();
}
