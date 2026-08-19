import { API_BASE_URL } from '../api/api-config';

export type GpsLocation = { latitude: number; longitude: number; measuredAt?: string };

type LatestGpsResponse = { latitude: number; longitude: number; measured_at?: string };

export async function getLatestGps(subjectId: number): Promise<GpsLocation> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/gps/latest/${subjectId}`);
  } catch {
    throw new Error('GPS 서버에 연결할 수 없습니다.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof data !== 'object' || data === null) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? String(data.detail) : '저장된 GPS 위치가 없습니다.';
    throw new Error(detail);
  }
  const gps = data as LatestGpsResponse;
  if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) throw new Error('GPS 좌표 형식이 올바르지 않습니다.');
  return { latitude: gps.latitude, longitude: gps.longitude, measuredAt: gps.measured_at };
}

export function formatTimeSince(measuredAt?: string): string {
  if (!measuredAt) return '정보 없음';

  // 백엔드는 반드시 Z 또는 +09:00이 포함된 ISO 8601 시간을 반환해야 합니다.
  const measuredTime = new Date(measuredAt);
  if (Number.isNaN(measuredTime.getTime())) return '정보 없음';

  const elapsedMilliseconds = Math.max(0, Date.now() - measuredTime.getTime());
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);
  if (elapsedMinutes < 1) return '방금';
  if (elapsedMinutes < 60) return `${elapsedMinutes}분`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}시간`;

  return `${Math.floor(elapsedHours / 24)}일`;
}
