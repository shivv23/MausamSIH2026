// Design tokens — ported from the Design Studio look.
import type { Condition } from './engine';

export const colors = {
  primary: '#1565C0',
  primaryLight: '#64B5F6',
  surface: '#F8FAFE',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  textSoft: '#94A3B8',
  border: 'rgba(15,23,42,0.06)',
  bg: '#F8FAFE',
};

export const CARD_META: Record<
  string,
  { icon: string; accent: string; soft: string }
> = {
  severe_warning: { icon: '⚠️', accent: '#E53935', soft: '#FDECEA' },
  my_day: { icon: '📅', accent: '#1565C0', soft: '#E3F2FD' },
  mausam_brief: { icon: '✨', accent: '#6A1B9A', soft: '#F3E5F5' },
  aqi: { icon: '💨', accent: '#2E7D32', soft: '#E8F5E9' },
  uv: { icon: '☀️', accent: '#F9A825', soft: '#FFF8E1' },
  pollen: { icon: '🌸', accent: '#AD1457', soft: '#FCE4EC' },
  humidity: { icon: '💧', accent: '#0277BD', soft: '#E1F5FE' },
  heat_stress: { icon: '🔥', accent: '#D84315', soft: '#FBE9E7' },
  running_window: { icon: '👟', accent: '#F57C00', soft: '#FFF3E0' },
  cycling_window: { icon: '🚴', accent: '#F57C00', soft: '#FFF3E0' },
  outdoor_comfort: { icon: '🏋️', accent: '#F57C00', soft: '#FFF3E0' },
  school_commute: { icon: '🎒', accent: '#C2185B', soft: '#FCE4EC' },
  work_commute: { icon: '🚗', accent: '#455A64', soft: '#ECEFF1' },
  rain_timeline: { icon: '☔', accent: '#1565C0', soft: '#E3F2FD' },
  fog_alert: { icon: '🌫️', accent: '#546E7A', soft: '#ECEFF1' },
  farm_irrigation: { icon: '💧', accent: '#00695C', soft: '#E0F2F1' },
  farm_frost: { icon: '❄️', accent: '#00695C', soft: '#E0F2F1' },
  farm_planting: { icon: '🌱', accent: '#00695C', soft: '#E0F2F1' },
  beach_safety: { icon: '🌊', accent: '#1565C0', soft: '#E3F2FD' },
  tide_info: { icon: '🌊', accent: '#1565C0', soft: '#E3F2FD' },
  surf_conditions: { icon: '🌊', accent: '#1565C0', soft: '#E3F2FD' },
  event_weather: { icon: '⛺', accent: '#E65100', soft: '#FBE9E7' },
  travel_destination: { icon: '✈️', accent: '#6A1B9A', soft: '#F3E5F5' },
  packing_advisor: { icon: '🎒', accent: '#6A1B9A', soft: '#F3E5F5' },
  sunrise_sunset: { icon: '🌅', accent: '#EF6C00', soft: '#FFF3E0' },
};

export const CONDITION_ICON: Record<Condition, string> = {
  sunny: '☀️', partly: '⛅', cloudy: '☁️', rain: '🌧️', storm: '⛈️',
  haze: '🌫️', fog: '🌁', cold: '❄️', hot: '🔥', night: '🌙',
};

export const CONDITION_LABEL: Record<Condition, [string, string]> = {
  sunny: ['Clear', 'साफ़'], partly: ['Partly cloudy', 'आंशिक बादल'], cloudy: ['Cloudy', 'बादल'],
  rain: ['Rain', 'बारिश'], storm: ['Cyclonic storm', 'चक्रवाती तूफ़ान'], haze: ['Smog / haze', 'स्मॉग / धुंध'],
  fog: ['Fog', 'कोहरा'], cold: ['Cold & clear', 'ठंडा व साफ़'], hot: ['Heat wave', 'लू'], night: ['Clear night', 'साफ़ रात'],
};

/** Return [topColor, bottomColor] for the hero gradient per condition/day-night. */
export function heroGradient(c: Condition, hour: number): [string, string] {
  const night = hour < 6 || hour >= 19;
  switch (c) {
    case 'storm':
      return ['#1E1B4B', '#0F172A'];
    case 'rain':
      return night ? ['#1E293B', '#1E3A8A'] : ['#475569', '#1D4ED8'];
    case 'haze':
      return night ? ['#3F3A33', '#1F2937'] : ['#8C7B6B', '#6B5B4E'];
    case 'hot':
      return night ? ['#7C2D12', '#431407'] : ['#F59E0B', '#DC2626'];
    case 'cold':
    case 'fog':
      return night ? ['#1E3A5F', '#0F172A'] : ['#60A5FA', '#475569'];
    case 'partly':
      return night ? ['#0F2A4A', '#0B1220'] : ['#5EEAD4', '#2563EB'];
    case 'cloudy':
      return ['#64748B', '#475569'];
    case 'night':
      return ['#0B1F3A', '#0B1220'];
    case 'sunny':
    default:
      return night ? ['#0B1F3A', '#0B1220'] : ['#38BDF8', '#1D4ED8'];
  }
}

export function statusColor(status: 'go' | 'shift' | 'avoid'): string {
  return status === 'go' ? '#2E9E4A' : status === 'shift' ? '#F2B100' : '#E53935';
}

// shared card / screen styles
export const cardShadow = {
  shadowColor: '#1018280D',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 1,
  shadowRadius: 28,
  elevation: 3,
};

export function phaseColor(phase?: string): string {
  switch (phase) {
    case 'official': return '#E53935';
    case 'derived': return colors.primary;
    default: return colors.textMuted;
  }
}