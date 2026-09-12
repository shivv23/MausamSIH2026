import type { ComponentType } from 'react';
import {
  Sun, Moon, Cloud, CloudSun, CloudRain, CloudLightning, CloudFog, Snowflake, Thermometer, Haze,
  Wind, Footprints, Bike, Car, School, Umbrella, Sprout, Waves, Tent, Plane, Backpack, Sunrise,
  AlertTriangle, Activity, Flower2, Droplets, Flame, Eye, CalendarDays, Sparkles, type LucideProps,
} from 'lucide-react';
import type { CardType, Condition, Phase, Lang, Severity } from '../lib/engine';
import { scoreColor, SEVERITY_COLOR } from '../lib/engine';
import { t } from '../lib/i18n';

type Icon = ComponentType<LucideProps>;

export const CONDITION_ICON: Record<Condition, Icon> = {
  sunny: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  haze: Haze,
  fog: CloudFog,
  cold: Snowflake,
  hot: Thermometer,
  night: Moon,
};

export const CONDITION_LABEL: Record<Condition, [string, string]> = {
  sunny: ['Clear', 'साफ़'],
  partly: ['Partly cloudy', 'आंशिक बादल'],
  cloudy: ['Cloudy', 'बादल'],
  rain: ['Rain', 'बारिश'],
  storm: ['Cyclonic storm', 'चक्रवाती तूफ़ान'],
  haze: ['Smog / haze', 'स्मॉग / धुंध'],
  fog: ['Fog', 'कोहरा'],
  cold: ['Cold & clear', 'ठंडा व साफ़'],
  hot: ['Heat wave', 'लू'],
  night: ['Clear night', 'साफ़ रात'],
};

/** Hero gradient per condition (day / night). */
export function heroGradient(c: Condition, hour: number): string {
  const night = hour < 6 || hour >= 19;
  switch (c) {
    case 'storm':
      return 'linear-gradient(160deg,#1E1B4B 0%,#312E81 45%,#0F172A 100%)';
    case 'rain':
      return night ? 'linear-gradient(160deg,#1E293B 0%,#334155 55%,#1E3A8A 100%)' : 'linear-gradient(160deg,#475569 0%,#64748B 45%,#1D4ED8 100%)';
    case 'haze':
      return night ? 'linear-gradient(160deg,#3F3A33 0%,#57504A 50%,#1F2937 100%)' : 'linear-gradient(160deg,#8C7B6B 0%,#A38F7C 45%,#6B5B4E 100%)';
    case 'hot':
      return night ? 'linear-gradient(160deg,#7C2D12 0%,#9A3412 50%,#431407 100%)' : 'linear-gradient(160deg,#F59E0B 0%,#F97316 50%,#DC2626 100%)';
    case 'cold':
    case 'fog':
      return night ? 'linear-gradient(160deg,#1E3A5F 0%,#334E7A 50%,#0F172A 100%)' : 'linear-gradient(160deg,#60A5FA 0%,#818CF8 55%,#475569 100%)';
    case 'partly':
      return night ? 'linear-gradient(160deg,#0F2A4A 0%,#1E3A8A 55%,#0B1220 100%)' : 'linear-gradient(160deg,#5EEAD4 0%,#38BDF8 45%,#2563EB 100%)';
    case 'cloudy':
      return 'linear-gradient(160deg,#64748B 0%,#94A3B8 50%,#475569 100%)';
    case 'night':
      return 'linear-gradient(160deg,#0B1F3A 0%,#1E3A8A 60%,#0B1220 100%)';
    case 'sunny':
    default:
      return night ? 'linear-gradient(160deg,#0B1F3A 0%,#1E3A8A 60%,#0B1220 100%)' : 'linear-gradient(160deg,#38BDF8 0%,#0EA5E9 40%,#1D4ED8 100%)';
  }
}

export const CARD_META: Record<CardType, { icon: Icon; accent: string; soft: string }> = {
  severe_warning: { icon: AlertTriangle, accent: '#E53935', soft: '#FDECEA' },
  my_day: { icon: CalendarDays, accent: '#1565C0', soft: '#E3F2FD' },
  mausam_brief: { icon: Sparkles, accent: '#6A1B9A', soft: '#F3E5F5' },
  aqi: { icon: Wind, accent: '#2E7D32', soft: '#E8F5E9' },
  uv: { icon: Sun, accent: '#F9A825', soft: '#FFF8E1' },
  pollen: { icon: Flower2, accent: '#AD1457', soft: '#FCE4EC' },
  humidity: { icon: Droplets, accent: '#0277BD', soft: '#E1F5FE' },
  heat_stress: { icon: Flame, accent: '#D84315', soft: '#FBE9E7' },
  running_window: { icon: Footprints, accent: '#F57C00', soft: '#FFF3E0' },
  cycling_window: { icon: Bike, accent: '#F57C00', soft: '#FFF3E0' },
  outdoor_comfort: { icon: Activity, accent: '#F57C00', soft: '#FFF3E0' },
  school_commute: { icon: School, accent: '#C2185B', soft: '#FCE4EC' },
  work_commute: { icon: Car, accent: '#455A64', soft: '#ECEFF1' },
  rain_timeline: { icon: Umbrella, accent: '#1565C0', soft: '#E3F2FD' },
  fog_alert: { icon: Eye, accent: '#546E7A', soft: '#ECEFF1' },
  farm_irrigation: { icon: Droplets, accent: '#00695C', soft: '#E0F2F1' },
  farm_frost: { icon: Snowflake, accent: '#00695C', soft: '#E0F2F1' },
  farm_planting: { icon: Sprout, accent: '#00695C', soft: '#E0F2F1' },
  beach_safety: { icon: Waves, accent: '#1565C0', soft: '#E3F2FD' },
  tide_info: { icon: Waves, accent: '#1565C0', soft: '#E3F2FD' },
  surf_conditions: { icon: Waves, accent: '#1565C0', soft: '#E3F2FD' },
  event_weather: { icon: Tent, accent: '#E65100', soft: '#FBE9E7' },
  travel_destination: { icon: Plane, accent: '#6A1B9A', soft: '#F3E5F5' },
  packing_advisor: { icon: Backpack, accent: '#6A1B9A', soft: '#F3E5F5' },
  sunrise_sunset: { icon: Sunrise, accent: '#EF6C00', soft: '#FFF3E0' },
};

export function ScoreRing({ score, label, size = 64 }: { score: number; label?: string; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F7" strokeWidth={6} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1), stroke .4s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-extrabold tracking-tight text-slate-900" style={{ fontSize: size * 0.32, color }}>
          {score}
        </span>
        {label && <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>}
      </div>
    </div>
  );
}

export function PhaseBadge({ phase, lang, severity }: { phase: Phase; lang: Lang; severity?: Severity }) {
  const map: Record<Phase, { bg: string; fg: string; key: 'phase_official' | 'phase_derived' | 'phase_informational' }> = {
    official: { bg: severity ? SEVERITY_COLOR[severity] : '#E53935', fg: '#fff', key: 'phase_official' },
    derived: { bg: '#E3F2FD', fg: '#1565C0', key: 'phase_derived' },
    informational: { bg: '#F1F5F9', fg: '#64748B', key: 'phase_informational' },
  };
  const m = map[phase];
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-[2px] text-[9.5px] font-extrabold uppercase tracking-wider" style={{ background: m.bg, color: m.fg }}>
      {t(lang, m.key)}
    </span>
  );
}

export function Chip({ children, tone = 'slate', className = '' }: { children: React.ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'white'; className?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    white: 'bg-white/15 text-white backdrop-blur',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function SectionHeader({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-2.5 flex items-end justify-between px-1">
      <div>
        <h2 className="text-[15px] font-extrabold tracking-tight text-slate-900">{title}</h2>
        {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
      </div>
      {action && (
        <button onClick={onAction} className="text-[12px] font-bold text-[#1565C0]">
          {action}
        </button>
      )}
    </div>
  );
}

export function statusColor(status: 'go' | 'shift' | 'avoid') {
  return status === 'go' ? '#2E9E4A' : status === 'shift' ? '#F2B100' : '#E53935';
}

export function fmtClock(hour: number, minute = 0): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')}`;
}
