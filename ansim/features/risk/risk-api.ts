const API_BASE_URL = 'https://medal-bacterial-nvidia-customize.trycloudflare.com';

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface RiskFactor {
  key: string;
  title: string;
  percent: number;
  points?: number;
  description?: string;
}

export interface CurrentRiskStatus {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  measuredAt?: string;
  reason?: string;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normaliseLevel(value: unknown): RiskLevel {
  const level = String(value ?? '').trim().toLowerCase();
  if (['danger', 'risk', 'high', '위험'].includes(level)) return 'danger';
  if (['warning', 'caution', 'medium', '주의'].includes(level)) return 'warning';
  return 'safe';
}

function humaniseFactorName(key: string): string {
  const lowered = key.toLowerCase();
  if (/(gps|location|route|deviation)/.test(lowered)) return 'GPS 이탈';
  if (/(stop|stationary|stay)/.test(lowered)) return '장시간 정지';
  if (/(weather|heat|rain|wind)/.test(lowered)) return '기상';
  if (/(air|fine.?dust|pollution)/.test(lowered)) return '대기';
  return key.replace(/[_-]/g, ' ');
}

function toFactor(value: unknown, index: number): RiskFactor | null {
  const item = asRecord(value);
  if (!item) return null;

  const rawKey = asText(item.key ?? item.type ?? item.code ?? item.name ?? item.title) ?? `factor-${index}`;
  const percent = asNumber(item.percent ?? item.percentage ?? item.ratio ?? item.weight ?? item.risk_percent);
  const points = asNumber(item.points ?? item.score ?? item.risk_score);

  if (percent === undefined && points === undefined) return null;

  return {
    key: rawKey,
    title: asText(item.title ?? item.name ?? item.label) ?? humaniseFactorName(rawKey),
    // 퍼센트가 없으면 총 위험 점수와 항목 점수로 아래에서 계산합니다.
    percent: percent === undefined ? -1 : Math.max(0, Math.min(100, percent)),
    points,
    description: asText(item.description ?? item.reason ?? item.detail),
  };
}

function extractFactors(payload: UnknownRecord): RiskFactor[] {
  const candidates = [
    payload.factors,
    payload.risk_factors,
    payload.breakdown,
    payload.details,
    payload.components,
    payload.analysis,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const factors = candidate.map(toFactor).filter((factor): factor is RiskFactor => factor !== null);
      if (factors.length) return factors;
    }

    const record = asRecord(candidate);
    if (record) {
      const factors = Object.entries(record)
        .map(([key, item], index) => {
          const factor = toFactor(item, index);
          if (factor) return factor;
          const value = asNumber(item);
          return value === undefined
            ? null
            : { key, title: humaniseFactorName(key), percent: Math.max(0, Math.min(100, value)) };
        })
        .filter((factor): factor is RiskFactor => factor !== null);
      if (factors.length) return factors;
    }
  }

  // 백엔드가 배열 대신 항목별 점수만 내려주는 경우도 처리합니다.
  const scoreFields = [
    ['lmtad_score', 'GPS 이상', 'lmtad_reason'],
    ['gps_score', 'GPS 이탈', 'gps_reason'],
    ['gps_risk_score', 'GPS 이탈', 'gps_reason'],
    ['long_stop_score', '장시간 정지', 'long_stop_reason'],
    ['stationary_score', '장시간 정지', 'stationary_reason'],
    ['weather_score', '기상', 'weather_reason'],
    ['weather_risk_score', '기상', 'weather_reason'],
    ['air_score', '대기', 'air_reason'],
    ['air_quality_score', '대기', 'air_reason'],
    ['air_risk_score', '대기', 'air_reason'],
  ] as const;
  const scoreFactors = scoreFields.flatMap(([key, title, reasonKey]) => {
    const points = asNumber(payload[key]);
    return points === undefined
      ? []
      : [{ key, title, points, percent: -1, description: asText(payload[reasonKey]) }];
  });
  if (scoreFactors.length) return scoreFactors;

  return [];
}

function deriveFactorPercents(factors: RiskFactor[], totalScore: number): RiskFactor[] {
  return factors.map((factor) => ({
    ...factor,
    percent: factor.percent >= 0
      ? factor.percent
      : factor.points !== undefined && totalScore > 0
        ? Math.round((factor.points / totalScore) * 100)
        : 0,
  }));
}

function toCurrentRiskStatus(value: unknown): CurrentRiskStatus {
  const payload = asRecord(value) ?? {};
  const nested = asRecord(payload.risk_status ?? payload.data ?? payload.result);
  const source = nested ?? payload;
  const score = asNumber(source.risk_score ?? source.score ?? source.total_score ?? source.integrated_risk_score) ?? 0;

  return {
    level: normaliseLevel(source.risk_level ?? source.level ?? source.status ?? source.risk_grade),
    score: Math.max(0, Math.min(100, score)),
    factors: deriveFactorPercents(extractFactors(source), score),
    measuredAt: asText(source.measured_at ?? source.calculated_at ?? source.created_at ?? source.updated_at),
    reason: asText(source.reason ?? source.summary ?? source.message),
  };
}

export async function getCurrentRiskStatus(subjectId: number): Promise<CurrentRiskStatus> {
  const response = await fetch(`${API_BASE_URL}/subjects/${encodeURIComponent(String(subjectId))}/risk-status`);
  if (!response.ok) throw new Error('현재 위험도를 불러오지 못했습니다.');
  return toCurrentRiskStatus(await response.json());
}

export async function getRiskHistory(subjectId: number): Promise<CurrentRiskStatus[]> {
  const response = await fetch(`${API_BASE_URL}/subjects/${encodeURIComponent(String(subjectId))}/risk-history`);
  if (!response.ok) throw new Error('위험도 이력을 불러오지 못했습니다.');

  const payload: unknown = await response.json();
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload)?.history)
      ? (asRecord(payload)?.history as unknown[])
      : Array.isArray(asRecord(payload)?.items)
        ? (asRecord(payload)?.items as unknown[])
        : [];
  return list.map(toCurrentRiskStatus);
}
