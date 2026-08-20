const API_BASE_URL = 'https://medal-bacterial-nvidia-customize.trycloudflare.com';

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

export async function getWeatherSummary(subjectId: number): Promise<WeatherSummary> {
  const response = await fetch(`${API_BASE_URL}/environment/weather/${subjectId}`);
  if (!response.ok) throw new Error('날씨 정보를 불러오지 못했습니다.');

  const weather = await response.json() as WeatherResponse;
  const precipitationLabel = precipitationLabels[String(weather.precipitation_type ?? '0')];
  const temperature = `기온 ${textValue(weather.temperature, '-')}℃`;
  const humidity = `습도 ${textValue(weather.humidity, '-')}%`;
  const rainfall = `강수량 ${textValue(weather.rainfall_1h, '-')}mm`;
  const firstLine = precipitationLabel
    ? `${precipitationLabel} · ${temperature}`
    : temperature;
  const advisory = [weather.advisory, weather.weather_advisory, weather.special_alert, weather.warning]
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim();

  return {
    precipitationLabel,
    headline: firstLine,
    advisory,
    text: `${firstLine}\n${humidity}\n${rainfall}`,
  };
}
