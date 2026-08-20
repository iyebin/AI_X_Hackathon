import { API_BASE_URL } from '../api/api-config';

type Person = {
  id: number;
  name: string;
  phone?: string | null;
  birth_date?: string | null;
  address?: string | null;
};

type GuardianRegistration = {
  guardian_id: number;
  subject_id: number;
  is_primary: boolean;
  contact_priority: number;
  guardian: Person;
  subject: Person & { subject_type?: string; special_notes?: string | null };
};

export type RelatedGuardian = Person & { isPrimary: boolean; contactPriority: number };
export type RelatedSubject = Person & { subjectType?: string; specialNotes?: string | null };

async function requestRegistrations(path: string): Promise<GuardianRegistration[]> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data)) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data
      ? String(data.detail)
      : '연결 정보를 가져오지 못했습니다.';
    throw new Error(detail);
  }
  return data as GuardianRegistration[];
}

export async function getGuardiansForSubject(subjectId: number): Promise<RelatedGuardian[]> {
  const registrations = await requestRegistrations(`/subjects/${subjectId}/guardians`);
  return registrations
    .map((registration) => ({ ...registration.guardian, isPrimary: registration.is_primary, contactPriority: registration.contact_priority }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.contactPriority - b.contactPriority);
}

export async function getSubjectsForGuardian(guardianId: number): Promise<RelatedSubject[]> {
  const registrations = await requestRegistrations(`/guardians/${guardianId}/subjects`);
  return registrations.map((registration) => ({
    ...registration.subject,
    subjectType: registration.subject.subject_type,
    specialNotes: registration.subject.special_notes,
  }));
}

/** 보호대상자 상세 정보를 직접 조회합니다. 위험 알림처럼 목록 파라미터가 없는 화면에서 사용합니다. */
export async function getSubjectProfile(subjectId: number): Promise<RelatedSubject> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/subjects/${subjectId}`);
  } catch {
    throw new Error('보호대상자 정보를 불러오지 못했습니다.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof data !== 'object' || data === null) {
    throw new Error('보호대상자 정보를 불러오지 못했습니다.');
  }

  const subject = data as Person & { subject_type?: string; special_notes?: string | null };
  return {
    ...subject,
    subjectType: subject.subject_type,
    specialNotes: subject.special_notes,
  };
}

export function getAge(birthDate?: string | null): string {
  if (!birthDate) return '나이 정보 없음';
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return '나이 정보 없음';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return `${age}세`;
}
