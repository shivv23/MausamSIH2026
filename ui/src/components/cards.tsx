import { ChevronRight, Clock, ShieldCheck, MapPin, Share2, Sparkles, Volume2, ArrowUpRight, ArrowDownRight, Minus, Droplets, Wind } from 'lucide-react';
import type { Card, Homepage, Lang, MyDayItem } from '../lib/engine';
import { aqiBand, fmtHour, fmtTime, L, SEVERITY_COLOR, uvBand } from '../lib/engine';
import { t } from '../lib/i18n';
import { CARD_META, Chip, CONDITION_ICON, CONDITION_LABEL, heroGradient, PhaseBadge, ScoreRing, statusColor } from './ui';

/* ------------------------------------------------------------------ hero */
export function HeroCard({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const p = hp.params;
  const cond = hp.hourly[0].condition;
  const Icon = CONDITION_ICON[cond];
  const band = aqiBand(p.aqi);
  const uv = uvBand(p.uv);
  const today = hp.daily[0];
  return (
    <div className="relative overflow-hidden rounded-[28px] p-5 text-white shadow-[0_20px_40px_-20px_rgba(21,101,192,.55)]" style={{ backgroundImage: heroGradient(cond, hp.hour) }}>
      {/* decorative */}
      <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-black/10 blur-2xl" />
      {cond === 'rain' || cond === 'storm' ? <RainOverlay /> : null}

      <div className="relative flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            <MapPin size={11} /> {L(lang, hp.city.name, hp.city.nameHi)} · {hp.user.locations[0]?.label ?? t(lang, 'home')}
          </div>
          <div className="mt-3 flex items-start">
            <span className="text-[68px] font-extralight leading-[0.9] tracking-tighter">{p.temp}</span>
            <span className="mt-1 text-2xl font-light">°</span>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold">{L(lang, CONDITION_LABEL[cond][0], CONDITION_LABEL[cond][1])}</p>
          <p className="text-[12px] text-white/80">
            {t(lang, 'feels_like')} {p.feelsLike}° · H {today.hi}° L {today.lo}°
          </p>
        </div>
        <div className="mt-2 flex flex-col items-center">
          <Icon size={76} strokeWidth={1.25} className="drop-shadow-[0_8px_16px_rgba(0,0,0,.25)]" />
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-4 gap-2">
        <Stat label={t(lang, 'aqi')} value={String(p.aqi)} sub={L(lang, band.label, band.labelHi)} dot={band.color} />
        <Stat label={t(lang, 'uv')} value={String(p.uv)} sub={L(lang, uv.label, uv.labelHi)} dot={uv.color} />
        <Stat label={t(lang, 'humidity')} value={`${p.humidity}%`} sub={p.humidity > 80 ? L(lang, 'Sticky', 'चिपचिपा') : L(lang, 'OK', 'ठीक')} />
        <Stat label={t(lang, 'wind')} value={`${p.wind}`} sub="km/h" />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, dot }: { label: string; value: string; sub: string; dot?: string }) {
  return (
    <div className="rounded-2xl bg-white/12 px-2.5 py-2 backdrop-blur-sm ring-1 ring-white/10">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/70">{label}</div>
      <div className="mt-0.5 text-[17px] font-bold leading-none">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-white/85">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
        <span className="truncate">{sub}</span>
      </div>
    </div>
  );
}

function RainOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-30">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="rain-drop absolute block w-px rounded-full bg-gradient-to-b from-white/0 via-white to-white/0"
          style={{ left: `${(i * 53) % 100}%`, height: 40 + ((i * 17) % 30), animationDelay: `${(i * 0.13) % 1.2}s`, animationDuration: `${0.9 + ((i * 7) % 5) / 10}s` }}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- warning */
export function WarningCard({ card, lang, onExplain, compact = false }: { card: Card; lang: Lang; onExplain: (c: Card) => void; compact?: boolean }) {
  const color = SEVERITY_COLOR[card.severity ?? 'red'];
  const body = card.data.body as string | undefined;
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white shadow-[0_12px_32px_-16px_rgba(229,57,53,.45)] ring-2" style={{ borderColor: color, ['--tw-ring-color' as string]: color }}>
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="p-4 pl-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            </span>
            <span className="text-[10.5px] font-extrabold uppercase tracking-wider" style={{ color }}>
              {t(lang, 'pinned_official')} · {card.provenance.source} · {(card.severity ?? 'red').toUpperCase()}
            </span>
          </div>
          <Chip tone="slate" className="!py-0.5 !text-[9.5px]">
            <ShieldCheck size={10} /> {t(lang, 'never_ai')}
          </Chip>
        </div>
        <h3 className="mt-2 text-[16px] font-extrabold leading-tight tracking-tight text-slate-900">{card.summary}</h3>
        {!compact && body && <p className="mt-1.5 text-[12.5px] leading-snug text-slate-600">{body}</p>}
        {!compact && card.actions && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.actions.map((a) => (
              <span key={a} className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: `${color}14`, color }}>
                ✓ {a}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {t(lang, 'valid_for')} {card.data.validHours as number}
            {t(lang, 'hours_short')} · {t(lang, 'confidence')} {Math.round(card.explanation.confidence * 100)}%
          </span>
          <div className="flex items-center gap-1.5">
            <button className="rounded-full bg-slate-100 p-1.5 text-slate-600 active:scale-95">
              <Share2 size={13} />
            </button>
            <button onClick={() => onExplain(card)} className="rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white active:scale-95" style={{ background: color }}>
              {t(lang, 'view_advisory')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- impact */
export function ImpactCard({ card, lang, onExplain, rank }: { card: Card; lang: Lang; onExplain: (c: Card) => void; rank: number }) {
  const meta = CARD_META[card.type];
  const Icon = meta.icon;
  const isYellowOfficial = card.type === 'severe_warning';
  const accent = isYellowOfficial ? SEVERITY_COLOR[card.severity ?? 'yellow'] : meta.accent;
  const soft = isYellowOfficial ? '#FFF8E1' : meta.soft;
  return (
    <button
      onClick={() => onExplain(card)}
      className="card-enter group w-full rounded-[22px] bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,.05),0_10px_28px_-16px_rgba(16,24,40,.18)] ring-1 ring-slate-900/[.04] transition active:scale-[.985]"
      style={{ animationDelay: `${rank * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: soft, color: accent }}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">{card.title}</h3>
            <PhaseBadge phase={card.phase} lang={lang} severity={card.severity} />
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-slate-600">{card.summary}</p>
          {isYellowOfficial && typeof card.data.body === 'string' && <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{card.data.body}</p>}
        </div>
        {card.score !== undefined && card.score !== null && !Number.isNaN(card.score) && <ScoreRing score={card.score} label={card.level} />}
      </div>

      {(card.bestWindow || (card.factors && card.factors.length > 0)) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {card.bestWindow && (
            <Chip tone="green">
              <Clock size={11} /> {t(lang, 'best_window')} {card.bestWindow}
            </Chip>
          )}
          {card.factors?.slice(0, 3).map((f) => (
            <span key={f.name} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${f.impact === 'good' ? 'border-emerald-200 text-emerald-700' : f.impact === 'bad' ? 'border-red-200 text-red-600' : 'border-slate-200 text-slate-600'}`}>
              {f.impact === 'good' ? <ArrowUpRight size={10} /> : f.impact === 'bad' ? <ArrowDownRight size={10} /> : <Minus size={10} />}
              {L(lang, f.name, f.nameHi)} {f.value}
            </span>
          ))}
        </div>
      )}

      {card.actions && card.actions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {card.actions.slice(0, 3).map((a) => (
            <span key={a} className="rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: soft, color: accent }}>
              ✓ {a}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck size={12} className="text-emerald-600" /> {card.provenance.source} · {Math.round(card.explanation.confidence * 100)}%
        </span>
        <span className="inline-flex items-center gap-0.5 font-bold text-[#1565C0] group-active:translate-x-0.5">
          {t(lang, 'why')} <ChevronRight size={13} />
        </span>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- my day */
export function MyDayCard({ items, lang, onOpen }: { items: MyDayItem[]; lang: Lang; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card-enter w-full rounded-[22px] bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,.05),0_10px_28px_-16px_rgba(16,24,40,.18)] ring-1 ring-slate-900/[.04] active:scale-[.985]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-extrabold tracking-tight text-slate-900">{t(lang, 'my_day')}</h3>
          <p className="text-[11px] text-slate-500">{t(lang, 'weather_checked')}</p>
        </div>
        <ChevronRight size={16} className="text-slate-400" />
      </div>
      <div className="relative mt-3">
        <div className="absolute left-[22px] top-3 bottom-3 w-px bg-slate-200" />
        <ul className="space-y-2.5">
          {items.map((m) => {
            const Icon = CONDITION_ICON[m.point.condition];
            const color = statusColor(m.status);
            return (
              <li key={m.activity.time + m.activity.type} className="relative flex items-center gap-3">
                <div className="w-11 shrink-0 text-[11px] font-bold text-slate-500">{fmtTime(m.activity.time, lang).replace(/ (AM|PM|पूर्वाह्न|अपराह्न)/, '')}</div>
                <span className="relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold text-slate-800">{L(lang, m.activity.label, m.activity.labelHi)}</div>
                  <div className="truncate text-[10.5px] text-slate-500">{m.suggestion ? `→ ${m.suggestion}` : m.note}</div>
                </div>
                <div className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color }}>
                  <Icon size={14} className="text-slate-400" />
                  {m.point.temp}°
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------- brief */
export function BriefCard({ text, lang }: { text: string; lang: Lang }) {
  return (
    <div className="card-enter relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0F2A4A] to-[#1565C0] p-4 text-white shadow-[0_16px_32px_-20px_rgba(21,101,192,.7)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-xl bg-white/15">
            <Sparkles size={14} />
          </span>
          <div>
            <h3 className="text-[14px] font-extrabold tracking-tight">{t(lang, 'brief')}</h3>
            <p className="text-[10px] text-white/70">{t(lang, 'template_first')}</p>
          </div>
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-full bg-white/15 active:scale-95">
          <Volume2 size={14} />
        </button>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-white/95">{text}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- hourly */
export function HourlyStrip({ hp, lang }: { hp: Homepage; lang: Lang }) {
  return (
    <div className="card-enter rounded-[22px] bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,.05),0_10px_28px_-16px_rgba(16,24,40,.18)] ring-1 ring-slate-900/[.04]">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] font-extrabold text-slate-900">{t(lang, 'hourly')}</h3>
        <span className="text-[10.5px] text-slate-500">IMD · {hp.freshness}</span>
      </div>
      <div className="no-scrollbar -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1">
        {hp.hourly.slice(0, 24).map((h, i) => {
          const Icon = CONDITION_ICON[h.condition];
          return (
            <div key={h.hour} className={`flex w-[56px] shrink-0 flex-col items-center rounded-2xl py-2 ${i === 0 ? 'bg-[#1565C0] text-white' : 'text-slate-700'}`}>
              <span className={`whitespace-nowrap text-[10px] font-semibold ${i === 0 ? 'text-white/85' : 'text-slate-500'}`}>{i === 0 ? L(lang, 'Now', 'अभी') : lang === 'hi' ? fmtHour(h.hour, lang) : fmtHour(h.hour, lang).replace(' ', '')}</span>
              <Icon size={18} className="my-1.5" strokeWidth={2} />
              <span className="text-[13px] font-bold">{h.temp}°</span>
              <span className={`mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] font-semibold ${h.rainProb >= 40 ? (i === 0 ? 'text-white' : 'text-blue-600') : i === 0 ? 'text-white/60' : 'text-slate-400'}`}>
                <Droplets size={8} /> {h.rainProb}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- daily */
export function DailyStrip({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const min = Math.min(...hp.daily.map((d) => d.lo));
  const max = Math.max(...hp.daily.map((d) => d.hi));
  const span = Math.max(1, max - min);
  return (
    <div className="card-enter rounded-[22px] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,.05),0_10px_28px_-16px_rgba(16,24,40,.18)] ring-1 ring-slate-900/[.04]">
      <h3 className="text-[13px] font-extrabold text-slate-900">{t(lang, 'daily')}</h3>
      <ul className="mt-2 divide-y divide-slate-100">
        {hp.daily.map((d) => {
          const Icon = CONDITION_ICON[d.condition];
          return (
            <li key={d.label} className="flex items-center gap-3 py-2">
              <span className="w-12 text-[12.5px] font-bold text-slate-800">{L(lang, d.label, d.labelHi)}</span>
              <Icon size={18} className="text-slate-500" />
              <span className={`w-10 text-[11px] font-semibold ${d.rainProb >= 40 ? 'text-blue-600' : 'text-slate-400'}`}>{d.rainProb}%</span>
              <span className="w-7 text-right text-[12px] text-slate-500">{d.lo}°</span>
              <div className="relative h-1.5 flex-1 rounded-full bg-slate-100">
                <div
                  className="absolute h-1.5 rounded-full"
                  style={{ left: `${((d.lo - min) / span) * 100}%`, width: `${((d.hi - d.lo) / span) * 100}%`, background: 'linear-gradient(90deg,#38BDF8,#F59E0B)' }}
                />
              </div>
              <span className="w-7 text-[12px] font-bold text-slate-800">{d.hi}°</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
        <Wind size={10} /> {L(lang, 'Wind gusts up to', 'हवा के झोंके')} {hp.params.gust} km/h
      </div>
    </div>
  );
}
