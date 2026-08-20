import { API_BASE_URL } from '../api/api-config';

type WeatherResponse = {
  temperature?: string | number;
  humidity?: string | number;
  rainfall_1h?: string | number;
  precipitation_type?: string | number;
  advisory?: string;
  weather_advisory?: string;
  special_alert?: string;
  warning?: string;
};

type WeatherWarningResponse = {
  warnings?: unknown;
  warning?: unknown;
  message?: unknown;
  highest_level?: unknown;
};

export type WeatherSummary = {
  text: string;
  headline: string;
  precipitationLabel?: string;
  advisory?: string;
};

const precipitationLabels: Record<string, string> = {
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '4': '소나기',
};

function textValue(value: string | number | undefined, fallback: string): string {
  return value === undefined || value === null || value === '' ? fallback : String(value);
}

export async function getWeatherWarning(subjectId: number): Promise<string | undefined> {
  const response = await fetch(`${API_BASE_URL}/environment/weather-warning/${subjectId}`);
  if (!response.ok) throw new Error('기상 특보 정보를 불러오지 못했습니다.');

  // 백엔드가 JSON 문자열 또는 text/plain 중 어느 형태로 반환해도 처리합니다.
  const raw = await response.text();
  let warning = raw.trim();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') {
      warning = parsed.trim();
    } else if (parsed && typeof parsed === 'object') {
      const payload = parsed as WeatherWarningResponse;
      const warningItems = Array.isArray(payload.warnings)
        ? payload.warnings
        : payload.warning === undefined || payload.warning === null
          ? []
          : [payload.warning];
      const labels = warningItems
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (!item || typeof item !== 'object') return '';
          const record = item as Record<string, unknown>;
          return [record.name, record.title, record.warning, record.message, record.type]
            .find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
            ?.trim() ?? '';
        })
        .filter(Boolean);
      // warnings: [] / highest_level: null 은 '특보 없음'입니다. JSON 원문을 표시하지 않습니다.
      warning = labels.join('\n');
    }
  } catch {
    // text/plain 응답은 원문 그대로 사용합니다.
  }
  // 특보가 없을 때 서버가 빈 문자열 또는 Swagger 예시값을 반환해도 화면에는 노출하지 않습니다.
  return warning && !['string', 'null', 'undefined'].includes(warning.toLowerCase()) ? warning : undefined;
}

export async function getWeatherSummary(subjectId: number): Promise<WeatherSummary> {
  const [response, weatherWarning] = await Promise.all([
    fetch(`${API_BASE_URL}/environment/weather/${subjectId}`),
    getWeatherWarning(subjectId).catch(() => undefined),
  ]);
  if (!response.ok) throw new Error('날씨 정보를 불러오지 못했습니다.');

  const weather = await response.json() as WeatherResponse;
  const precipitationLabel = precipitationLabels[String(weather.precipitation_type ?? '0')];
  const temperature = `기온 ${textValue(weather.temperature, '-')}℃`;
  const humidity = `습도 ${textValue(weather.humidity, '-')}%`;
  const rainfall = `강수량 ${textValue(weather.rainfall_1h, '-')}mm`;
  const firstLine = precipitationLabel
    ? `${precipitationLabel} · ${temperature}`
    : temperature;
  const advisory = [weatherWarning, weather.advisory, weather.weather_advisory, weather.special_alert, weather.warning]
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim();

  return {
    precipitationLabel,
    headline: firstLine,
    advisory,
    text: `${firstLine}\n${humidity}\n${rainfall}`,
  };
}
