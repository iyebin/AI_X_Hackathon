const API_BASE_URL = 'https://ai-x-hackathon-backend.onrender.com';

export type AuthRole = 'protected' | 'guardian';

type VerifyAuthCodeApiResponse = {
  valid: boolean;
  user_type: string;
  user_id: number;
  message?: string;
};

type UserProfileResponse = {
  id: number;
  name: string;
  phone?: string | null;
};

export type VerifiedUser = {
  role: AuthRole;
  userId: number;
  subjectId?: number;
  guardianId?: number;
  name: string;
  phone?: string;
};

// 백엔드 인증코드 발급/검증 연결 전 데모용 보호대상자 계정입니다.
// 서버 인증이 정상화되면 이 상수와 아래 임시 분기를 제거합니다.
const TEMPORARY_PROTECTED_USER = {
  authCode: '%6rD$1',
  id: 3,
  name: '김유빈',
  phone: '01011119999',
} as const;

const TEMPORARY_GUARDIAN_USER = {
  authCode: '7*4P@x',
  id: 3,
  name: '김다온',
  phone: '01029384756',
} as const;

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'detail' in data) {
    return String(data.detail);
  }

  if (typeof data === 'object' && data !== null && 'message' in data) {
    return String(data.message);
  }

  return fallback;
}

function normalizeRole(userType: string): AuthRole {
  const normalized = userType.trim().toLowerCase();

  if (['guardian', 'protector', 'caregiver', '보호자'].includes(normalized)) {
    return 'guardian';
  }

  if (['protected', 'subject', 'ward', '보호대상자'].includes(normalized)) {
    return 'protected';
  }

  throw new Error(`지원하지 않는 사용자 유형입니다: ${userType}`);
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getErrorMessage(data, '요청을 처리하지 못했습니다.'));
  }

  return data as T;
}

/**
 * Swagger API 계약:
 * 1) POST /auth-codes/verify { auth_code }
 * 2) 응답 user_type/user_id에 맞춰 보호대상자 또는 보호자 정보를 조회
 */
export async function verifyAuthCode(code: string, expectedRole: AuthRole): Promise<VerifiedUser> {
  const verification = await requestJson<VerifyAuthCodeApiResponse>('/auth-codes/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: code }),
  });

  if (!verification.valid && expectedRole === 'protected' && code.trim() === TEMPORARY_PROTECTED_USER.authCode) {
    return {
      role: 'protected',
      userId: TEMPORARY_PROTECTED_USER.id,
      subjectId: TEMPORARY_PROTECTED_USER.id,
      name: TEMPORARY_PROTECTED_USER.name,
      phone: TEMPORARY_PROTECTED_USER.phone,
    };
  }

  if (!verification.valid && expectedRole === 'guardian' && code.trim() === TEMPORARY_GUARDIAN_USER.authCode) {
    return {
      role: 'guardian',
      userId: TEMPORARY_GUARDIAN_USER.id,
      guardianId: TEMPORARY_GUARDIAN_USER.id,
      name: TEMPORARY_GUARDIAN_USER.name,
      phone: TEMPORARY_GUARDIAN_USER.phone,
    };
  }

  if (!verification.valid) {
    throw new Error(verification.message || '인증코드가 올바르지 않거나 만료되었습니다.');
  }

  const verifiedRole = normalizeRole(verification.user_type);
  if (verifiedRole !== expectedRole) {
    throw new Error('인증코드가 올바르지 않거나 만료되었습니다.');
  }

  const profilePath = verifiedRole === 'protected'
    ? `/subjects/${verification.user_id}`
    : `/guardians/${verification.user_id}`;
  const profile = await requestJson<UserProfileResponse>(profilePath);

  return {
    role: verifiedRole,
    userId: verification.user_id,
    subjectId: verifiedRole === 'protected' ? verification.user_id : undefined,
    guardianId: verifiedRole === 'guardian' ? verification.user_id : undefined,
    name: profile.name,
    phone: profile.phone ?? undefined,
  };
}
