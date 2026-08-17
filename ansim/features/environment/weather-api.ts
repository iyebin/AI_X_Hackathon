const API_BASE_URL = 'https://ai-x-hackathon-backend.onrender.com';

type WeatherResponse = {
  temperature?: string | number;
  humidity?: string | number;
  rainfall_1h?: string | number;
  precipitation_type?: string | number;
};

export type WeatherSummary = {
  text: string;
  precipitationLabel?: string;
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

  return {
    precipitationLabel,
    text: `${firstLine}\n${humidity}\n${rainfall}`,
  };
}
