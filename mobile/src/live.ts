// Live weather source: Open-Meteo (keyless, free, no auth).
// Fetches real current + hourly + daily data + air-quality for a city and maps
// it to the engine's WeatherParams / HourPoint / DayPoint shapes. IMD's official
// Aurora API is kept behind the backend adapter (needs a token) — swap the fetch
// here later if a live IMD token becomes available.
import type { Condition, DayPoint, HourPoint, LiveWeather, WeatherParams } from './engine';
import { clamp, round1 } from './engine';

export const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
export const AIR_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

interface HourlyRow {
  time: string[]; temperature_2m: number[]; relative_humidity_2m: number[];
  apparent_temperature: number[]; precipitation_probability: number[];
  precipitation: number[]; weather_code: number[]; wind_speed_10m: number[];
  wind_gusts_10m: number[]; visibility?: number[]; uv_index?: number[];
}
interface DailyRow {
  time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[];
  precipitation_probability_max: number[]; weather_code: number[];
  sunrise?: string[]; sunset?: string[];
}
interface ForecastResp { current?: Record<string, number | string>; hourly?: HourlyRow; daily?: DailyRow; }
interface AirResp { current?: Record<string, number | string>; }

// WMO weather codes -> our Condition + a localized-friendly label.
function wmoCondition(code: number, isDay: boolean, hour: number): Condition {
  const night = hour < 6 || hour >= 19;
  if (code >= 95) return 'storm';
  if (code >= 61 && code <= 82) return 'rain';
  if (code >= 51 && code <= 57) return 'rain';
  if (code >= 45 && code <= 48) return 'fog';
  if (code === 0 || code === 1) return night ? 'night' : 'sunny';
  if (code === 2 || code === 3) return night ? 'night' : 'cloudy';
  if (code >= 71 && code <= 77) return night ? 'night' : 'cold';
  if (code >= 85 && code <= 86) return night ? 'night' : 'cold';
  if (!isDay) return 'night';
  return 'partly';
}

// Real AQI band estimate from CPCB-standard conversion (PM2.5 is the dominant
// driver; broken-stick linear approximation of the standard concentration->AQI).
function aqiFromPm(pm25: number, pm10: number): number {
  const aqiFrom = (c: number, lo: number, hi: number, ilo: number, ihi: number) =>
    ((ihi - ilo) / (hi - lo)) * (c - lo) + ilo;
  const pm25Low = [0, 30, 60, 90, 120, 250];
  const pm25High = [30, 60, 90, 120, 250, 500];
  const iLow = [0, 50, 100, 200, 300, 400];
  const iHigh = [50, 100, 200, 300, 400, 500];
  const aqi25 = (() => {
    for (let i = 0; i < pm25Low.length; i++) {
      if (pm25 <= pm25High[i]) return aqiFrom(pm25, pm25Low[i], pm25High[i], iLow[i], iHigh[i]);
    }
    return 500;
  })();
  const pm10Low = [0, 50, 100, 250, 350, 430];
  const pm10High = [50, 100, 250, 350, 430, 600];
  const aqi10 = (() => {
    for (let i = 0; i < pm10Low.length; i++) {
      if (pm10 <= pm10High[i]) return aqiFrom(pm10, pm10Low[i], pm10High[i], iLow[i], iHigh[i]);
    }
    return 500;
  })();
  return Math.round(Math.max(aqi25, aqi10));
}

function num(v: number | string | undefined, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : fallback;
}

export async function fetchLiveWeather(lat: number, lon: number, now: Date = new Date()): Promise<LiveWeather> {
  const q = `latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=5`;
  const weatherUrl = `${WEATHER_API}?${q}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index,visibility&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code`;
  const airUrl = `${AIR_API}?latitude=${lat}&longitude=${lon}&timezone=auto&current=pm2_5,pm10&forecast_days=1`;

  const [w, a] = await Promise.all([
    fetch(weatherUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`weather ${r.status}`)))),
    fetch(airUrl).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`air ${r.status}`)))),
  ] as [Promise<ForecastResp>, Promise<AirResp>]);

  const cur = w.current ?? {};
  const h = w.hourly;
  const d = w.daily;
  const air = a.current ?? {};

  const temp = num(cur.temperature_2m, 26);
  const humidity = num(cur.relative_humidity_2m, 60);
  const wind = num(cur.wind_speed_10m, 8);
  const gust = num(cur.wind_gusts_10m, Math.round(wind * 1.6));
  const precip = num(cur.precipitation, 0);
  const uv = num(cur.uv_index, 0);
  const visibility = num(cur.visibility, 10) / 1000; // m -> km
  const pm25 = num(air.pm2_5, 0);
  const pm10 = num(air.pm10, 0);
  const aqi = pm25 > 0 || pm10 > 0 ? aqiFromPm(pm25, pm10) : 60;
  const feels = num(cur.apparent_temperature, temp);
  const rainProb = Math.round((h && h.precipitation_probability[0] !== undefined) ? h.precipitation_probability[0] : precip > 0 ? 80 : 12);
  const hour = now.getHours();
  const cond: Condition = wmoCondition(num(cur.weather_code, 0), num(cur.is_day, 1) === 1, hour);

  // derive a neutral scenario base for params not exposed by Open-Meteo
  const params: WeatherParams = {
    temp: Math.round(temp),
    feelsLike: Math.round(feels),
    humidity: Math.round(humidity),
    wind: Math.round(wind),
    gust: Math.round(gust),
    precip: round1(precip),
    rainProb,
    visibility: round1(visibility > 0 ? visibility : 10),
    uv: round1(uv),
    aqi,
    pm25: round1(pm25),
    soil: 45, // not provided; keep neutral
    heatIndex: Math.round(feels),
    pollen: 3,
    condition: cond,
  };

  // hourly rows (align to the upcoming hours from `now` if available)
  const hourly: HourPoint[] = [];
  const hh = w.hourly;
  if (hh && Array.isArray(hh.time) && hh.time.length) {
    const startIdx = Math.max(0, hh.time.findIndex((t) => new Date(t).getTime() >= now.getTime()));
    for (let i = 0; i < 24; i++) {
      const idx = startIdx + i;
      if (idx >= hh.time.length) break;
      const hs = new Date(hh.time[idx]).getHours();
      hourly.push({
        hour: hs,
        temp: Math.round(num(hh.temperature_2m[idx], temp)),
        rainProb: clamp(Math.round(num(hh.precipitation_probability[idx], rainProb)), 0, 100),
        aqi,
        uv: round1(num(hh.uv_index?.[idx], 0)),
        wind: Math.round(num(hh.wind_speed_10m[idx], wind)),
        condition: wmoCondition(num(hh.weather_code[idx], 0), new Date(hh.time[idx]).getHours() < 6 || new Date(hh.time[idx]).getHours() >= 19 ? false : true, hs),
      });
    }
  }

  // daily rows
  const daily: DayPoint[] = [];
  if (d && Array.isArray(d.time) && d.time.length) {
    const DAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const DAY_HI = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];
    for (let i = 0; i < Math.min(5, d.time.length); i++) {
      const dt = new Date(d.time[i]);
      const rp = num(d.precipitation_probability_max?.[i], rainProb);
      daily.push({
        label: i === 0 ? 'Today' : DAY_EN[dt.getDay()],
        labelHi: i === 0 ? 'आज' : DAY_HI[dt.getDay()],
        hi: Math.round(num(d.temperature_2m_max[i], temp)),
        lo: Math.round(num(d.temperature_2m_min[i], temp - 6)),
        rainProb: clamp(Math.round(rp), 0, 100),
        condition: wmoCondition(num(d.weather_code?.[i], 0), true, 12),
      });
    }
  }

  return { params, hourly, daily, fetchedAt: now.toISOString(), stale: false };
}

/** Coerce an array/stream into a stable LiveWeather when the network is down. */
export function staleLiveWeather(prev: LiveWeather): LiveWeather {
  if (!prev) throw new Error('no cached weather');
  return { ...prev, stale: true, fetchedAt: prev.fetchedAt };
}