const API_BASE_URL = 'https://ai-x-hackathon-backend.onrender.com';
import { CurrentRiskStatus, parseRiskStatus } from '@/features/risk/risk-api';

export type AlertKind = 'danger' | 'warning' | 'info';
export type AlertRecipientType = 'guardian' | 'subject' | 'institution_manager';

export interface AppAlert {
  id: string;
  subjectId?: number;
  guardianId?: number;
  recipientType?: AlertRecipientType;
  recipientId?: number;
  type: string;
  title: string;
  reason?: string;
  message?: string;
  createdAt?: string;
  riskScore?: number;
  riskSnapshot?: CurrentRiskStatus;
  isRead: boolean;
  kind: AlertKind;
}

type AlertPayload = Record<string, unknown>;

export interface GetAlertsOptions {
  subjectId?: number;
  recipientType?: AlertRecipientType;
  recipientId?: number;
  isRead?: boolean;
  alertType?: string;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getKind(payload: AlertPayload, title: string, message?: string): AlertKind {
  // 위험 알림은 type이 모두 risk로 저장될 수 있으므로, 실제 분석 단계가 있으면 그것을 우선합니다.
  const snapshot = payload.risk_snapshot ?? payload.riskSnapshot;
  const snapshotLevel = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>).risk_level ?? (snapshot as Record<string, unknown>).riskLevel
    : undefined;
  const riskLevel = asText(payload.risk_level ?? payload.riskLevel ?? snapshotLevel)?.toLowerCase();
  if (['danger', 'risk', 'high', '위험'].includes(riskLevel ?? '')) return 'danger';
  if (['warning', 'caution', 'medium', '주의'].includes(riskLevel ?? '')) return 'warning';
  if (['safe', 'normal', 'low', '안전'].includes(riskLevel ?? '')) return 'info';

  const value = [payload.alert_type, payload.type, payload.level, payload.severity, title, message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/danger|risk|high|위험|긴급/.test(value)) return 'danger';
  if (/warning|caution|medium|주의|경고/.test(value)) return 'warning';
  return 'info';
}

function extractReason(explicitReason: string | undefined, message?: string): string | undefined {
  if (explicitReason) return explicitReason;
  if (!message) return undefined;

  // 예: "김유빈님 위험 감지 : GPS 이탈 및 장시간 정지 감지 (위험 점수 : 85)"
  // 위험 모달에는 분석 이유 부분만 표시합니다.
  const afterLabel = message.includes(':') ? message.slice(message.indexOf(':') + 1) : message;
  const withoutScore = afterLabel.replace(/\s*\(\s*위험\s*점수\s*:\s*[^)]*\)\s*$/u, '');
  return withoutScore.trim() || undefined;
}

function extractRiskSnapshot(value: unknown): CurrentRiskStatus | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const snapshot = parseRiskStatus(value);
  return snapshot.score !== 0 || snapshot.factors.length > 0 || snapshot.measuredAt ? snapshot : undefined;
}

function toAppAlert(payload: AlertPayload): AppAlert | null {
  const id = payload.id ?? payload.alert_id;
  if (id === undefined || id === null) return null;

  const explicitReason = asText(payload.reason);
  const message = asText(payload.message) ?? asText(payload.content) ?? asText(payload.description);
  const reason = extractReason(explicitReason, message);
  const title =
    asText(payload.title) ??
    asText(payload.alert_type) ??
    asText(payload.type) ??
    message ??
    '새 알림';

  return {
    id: String(id),
    subjectId: asNumber(payload.subject_id ?? payload.subjectId),
    guardianId: asNumber(payload.guardian_id ?? payload.guardianId),
    recipientType: asText(payload.recipient_type ?? payload.recipientType) as AlertRecipientType | undefined,
    recipientId: asNumber(payload.recipient_id ?? payload.recipientId),
    type: asText(payload.type) ?? asText(payload.alert_type) ?? '',
    title,
    reason,
    message: message === title ? undefined : message,
    createdAt:
      asText(payload.created_at) ??
      asText(payload.alerted_at) ??
      asText(payload.timestamp) ??
      asText(payload.createdAt),
    riskScore: asNumber(payload.risk_score ?? payload.riskScore),
    riskSnapshot: extractRiskSnapshot(payload.risk_snapshot ?? payload.riskSnapshot),
    isRead: Boolean(payload.is_read ?? payload.read ?? false),
    kind: getKind(payload, title, message),
  };
}

function toSearchParams(options: GetAlertsOptions): string {
  const params = new URLSearchParams();
  if (options.recipientType) params.set('recipient_type', options.recipientType);
  if (Number.isInteger(options.recipientId) && (options.recipientId ?? 0) > 0) params.set('recipient_id', String(options.recipientId));
  if (typeof options.isRead === 'boolean') params.set('is_read', String(options.isRead));
  if (options.alertType) params.set('alert_type', options.alertType);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeOptions(subjectIdOrOptions?: number | GetAlertsOptions): GetAlertsOptions {
  return typeof subjectIdOrOptions === 'number'
    ? { subjectId: subjectIdOrOptions }
    : subjectIdOrOptions ?? {};
}

export async function getAlerts(subjectIdOrOptions?: number | GetAlertsOptions): Promise<AppAlert[]> {
  const options = normalizeOptions(subjectIdOrOptions);
  const response = await fetch(`${API_BASE_URL}/alerts${toSearchParams(options)}`);
  if (!response.ok) throw new Error('알림을 불러오지 못했습니다.');

  const payload: unknown = await response.json();
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { alerts?: unknown[] })?.alerts)
      ? (payload as { alerts: unknown[] }).alerts
      : Array.isArray((payload as { items?: unknown[] })?.items)
        ? (payload as { items: unknown[] }).items
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

  return items
    .filter((item): item is AlertPayload => Boolean(item) && typeof item === 'object')
    .map(toAppAlert)
    .filter((item): item is AppAlert => item !== null)
    .filter((item) => options.subjectId === undefined || item.subjectId === undefined || item.subjectId === options.subjectId)
    .sort((left, right) => Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? ''));
}

export async function getAlert(alertId: string): Promise<AppAlert> {
  const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}`);
  if (!response.ok) throw new Error('알림을 불러오지 못했습니다.');

  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('알림 응답 형식이 올바르지 않습니다.');
  const alert = toAppAlert(payload as AlertPayload);
  if (!alert) throw new Error('알림 응답 형식이 올바르지 않습니다.');
  return alert;
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/alerts/${encodeURIComponent(alertId)}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('알림을 읽음 처리하지 못했습니다.');
}
