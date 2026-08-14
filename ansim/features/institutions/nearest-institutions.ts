const API_BASE_URL = 'https://ai-x-hackathon-backend.onrender.com';

// 개발용: 실제 보호대상자 GPS 대신 광주 좌표로 주변 기관을 확인합니다.
// 실제 연동 전환 시 false로 바꾸면 subject_id의 최신 GPS 기준 API를 다시 사용합니다.
const USE_DEVELOPMENT_LOCATION = false;
export const FACILITY_SEARCH_LOCATION = { latitude: 35.1761242132813, longitude: 126.884475122385 };

export type FacilityCategory = '전체' | '복지관' | '노인센터' | '병원' | '기타';

export type Facility = {
  facilityId: string;
  name: string;
  category: Exclude<FacilityCategory, '전체'>;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  operatingHours: string;
  distance: string;
};

export type NearestInstitutionsResult = {
  facilities: Facility[];
  currentLocation: { latitude: number; longitude: number };
};

type InstitutionResponse = {
  id: number;
  name: string;
  institution_type: string;
  address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km: number;
};

function categoryFromServer(type: string): Exclude<FacilityCategory, '전체'> {
  if (type === 'hospital') return '병원';
  if (type === 'elderly' || type === 'dementia') return '노인센터';
  if (type === 'general' || type === 'disability' || type === 'child') return '복지관';
  return '기타';
}

function formatDistance(kilometers: number) {
  if (kilometers < 1) return `${Math.round(kilometers * 1000)}m`;
  return `${kilometers.toFixed(1)}km`;
}

export async function getNearestInstitutions(subjectId: number): Promise<NearestInstitutionsResult> {
  const endpoint = USE_DEVELOPMENT_LOCATION
    ? `/institutions/nearest?latitude=${FACILITY_SEARCH_LOCATION.latitude}&longitude=${FACILITY_SEARCH_LOCATION.longitude}&radius_km=30&limit=100`
    : `/subjects/${subjectId}/institutions/nearest?radius_km=30&limit=100`;
  const response = await fetch(`${API_BASE_URL}${endpoint}`);
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof data !== 'object' || data === null || !('institutions' in data) || !Array.isArray(data.institutions)) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? String(data.detail) : '가까운 복지시설을 불러오지 못했습니다.';
    throw new Error(detail);
  }

  const currentLocation = 'current_location' in data && typeof data.current_location === 'object' && data.current_location !== null
    ? data.current_location as { latitude?: number; longitude?: number }
    : FACILITY_SEARCH_LOCATION;
  const facilities = (data.institutions as InstitutionResponse[]).map((institution) => ({
    facilityId: String(institution.id),
    name: institution.name,
    category: categoryFromServer(institution.institution_type),
    address: institution.address ?? '주소 정보 없음',
    latitude: institution.latitude ?? 0,
    longitude: institution.longitude ?? 0,
    phone: institution.phone ?? '',
    operatingHours: '운영시간 정보 없음',
    distance: formatDistance(institution.distance_km),
  }));

  return {
    facilities,
    currentLocation: Number.isFinite(currentLocation.latitude) && Number.isFinite(currentLocation.longitude)
      ? { latitude: currentLocation.latitude as number, longitude: currentLocation.longitude as number }
      : FACILITY_SEARCH_LOCATION,
  };
}
