import { useEffect, useRef, useState } from 'react';
import { Plus, Send, ShieldCheck, ChevronRight, Bell, Moon, Globe, Ruler, Lock, RotateCcw, MapPin, Home as HomeIcon, Briefcase, School as SchoolIcon, Sprout, Activity, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Card, Homepage, Lang, PersonaKey, AskAnswer } from '../../lib/engine';
import { answerQuestion, CONDITIONS, fmtTime, L, PERSONAS, SEVERITY_COLOR, SUGGESTED_QUESTIONS } from '../../lib/engine';
import { t } from '../../lib/i18n';
import { CARD_META, Chip, CONDITION_ICON, PhaseBadge, ScoreRing, statusColor } from '../ui';

/* ---------------------------------------------------------------- My Day */
export function MyDayScreen({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const good = hp.myDay.filter((m) => m.status === 'go').length;
  return (
    <div className="px-4 pb-6 pt-2">
      <ScreenTitle title={t(lang, 'myday_title')} sub={t(lang, 'myday_sub')} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(['go', 'shift', 'avoid'] as const).map((s) => {
          const n = hp.myDay.filter((m) => m.status === s).length;
          return (
            <div key={s} className="rounded-2xl bg-white p-3 ring-1 ring-slate-900/[.05]">
              <div className="text-[22px] font-extrabold" style={{ color: statusColor(s) }}>
                {n}
              </div>
              <div className="text-[10.5px] font-semibold text-slate-500">{t(lang, s === 'go' ? 'status_go' : s === 'shift' ? 'status_shift' : 'status_avoid')}</div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-5">
        <div className="absolute bottom-4 left-[62px] top-4 w-px bg-slate-200" />
        <ul className="space-y-3">
          {hp.myDay.map((m) => {
            const Icon = CONDITION_ICON[m.point.condition];
            const color = statusColor(m.status);
            return (
              <li key={m.activity.time + m.activity.type} className="relative flex gap-3">
                <div className="w-12 shrink-0 pt-3 text-right">
                  <div className="text-[13px] font-extrabold text-slate-800">{fmtTime(m.activity.time, lang).split(' ')[0]}</div>
                  <div className="text-[9.5px] font-semibold uppercase text-slate-400">{fmtTime(m.activity.time, lang).split(' ')[1]}</div>
                </div>
                <div className="relative z-10 mt-4 h-3 w-3 shrink-0 rounded-full ring-4 ring-[#F8FAFE]" style={{ background: color }} />
                <div className="card-enter flex-1 rounded-[20px] bg-white p-3.5 ring-1 ring-slate-900/[.05]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-extrabold tracking-tight text-slate-900">{L(lang, m.activity.label, m.activity.labelHi)}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                        <Icon size={12} /> {m.note}
                      </div>
                    </div>
                    <ScoreRing score={m.score} size={44} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide" style={{ background: `${color}1A`, color }}>
                      {t(lang, m.status === 'go' ? 'status_go' : m.status === 'shift' ? 'status_shift' : 'status_avoid')}
                    </span>
                    {m.suggestion && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1565C0]">
                        <Sparkles size={11} /> {m.suggestion}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-3 text-[12.5px] font-bold text-slate-500 active:scale-[.98]">
        <Plus size={15} /> {t(lang, 'add_activity')}
      </button>
      <p className="mt-3 text-center text-[10.5px] text-slate-400">
        {good}/{hp.myDay.length} {L(lang, 'plans on track · re-scored every 15 min', 'योजनाएँ ठीक · हर 15 मिनट पुनः स्कोर')}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- Ask */
interface Msg {
  role: 'user' | 'bot';
  text: string;
  source?: string;
  chips?: string[];
}

export function AskScreen({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'bot', text: t(lang, 'ask_intro') }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, typing]);

  const send = (q: string) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const a: AskAnswer = answerQuestion(q, hp, lang);
      setMsgs((m) => [...m, { role: 'bot', text: a.text, source: a.source, chips: a.chips?.filter(Boolean) }]);
      setTyping(false);
    }, 550);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-2">
        <ScreenTitle title={t(lang, 'ask_title')} sub={t(lang, 'ask_sub')} />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pt-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${m.role === 'user' ? 'rounded-[20px] rounded-br-md bg-[#1565C0] px-3.5 py-2.5 text-[13px] text-white shadow-md shadow-blue-200' : 'rounded-[20px] rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] text-slate-800 ring-1 ring-slate-900/[.05]'}`}>
              <p className="leading-relaxed">{m.text}</p>
              {m.chips && m.chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.chips.map((c) => (
                    <Chip key={c} tone="green">
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
              {m.source && (
                <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <ShieldCheck size={10} className="text-emerald-600" /> {m.source}
                </p>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-[20px] rounded-bl-md bg-white px-4 py-3 ring-1 ring-slate-900/[.05]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="px-4 pb-3 pt-2">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {SUGGESTED_QUESTIONS[lang].map((q) => (
            <button key={q} onClick={() => send(q)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#1565C0] ring-1 ring-blue-100 active:scale-95">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4 ring-1 ring-slate-900/[.08]"
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t(lang, 'ask_placeholder')} className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
          <button type="submit" className="grid h-9 w-9 place-items-center rounded-full bg-[#1565C0] text-white active:scale-95">
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Alerts */
export function AlertsScreen({ hp, lang, onExplain }: { hp: Homepage; lang: Lang; onExplain: (c: Card) => void }) {
  const [tab, setTab] = useState<'official' | 'derived' | 'informational'>('official');
  const all = [...hp.pinned, ...hp.cards];
  const list = all.filter((c) => (tab === 'official' ? c.phase === 'official' : tab === 'derived' ? c.phase === 'derived' && c.score !== undefined && c.score < 60 : c.phase === 'informational' || (c.phase === 'derived' && (c.score ?? 100) >= 60)));
  const counts = {
    official: all.filter((c) => c.phase === 'official').length,
    derived: all.filter((c) => c.phase === 'derived' && (c.score ?? 100) < 60).length,
    informational: all.filter((c) => c.phase === 'informational' || (c.phase === 'derived' && (c.score ?? 100) >= 60)).length,
  };
  return (
    <div className="px-4 pb-6 pt-2">
      <ScreenTitle title={t(lang, 'alerts_title')} sub={t(lang, 'alerts_sub')} />
      <div className="mt-3 grid grid-cols-3 rounded-2xl bg-slate-200/60 p-1">
        {(['official', 'derived', 'informational'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-bold transition ${tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {t(lang, k === 'official' ? 'phase_official' : k === 'derived' ? 'phase_derived' : 'phase_informational')}
            <span className={`rounded-full px-1.5 text-[10px] ${tab === k ? 'bg-slate-900 text-white' : 'bg-slate-300/70 text-slate-600'}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      <ul className="mt-3 space-y-2.5">
        {list.length === 0 && <li className="rounded-2xl bg-white p-6 text-center text-[12.5px] text-slate-500 ring-1 ring-slate-900/[.05]">{t(lang, 'no_alerts')}</li>}
        {list.map((c) => {
          const meta = CARD_META[c.type];
          const Icon = meta.icon;
          const accent = c.phase === 'official' ? SEVERITY_COLOR[c.severity ?? 'red'] : meta.accent;
          return (
            <li key={c.id}>
              <button onClick={() => onExplain(c)} className="card-enter flex w-full items-start gap-3 rounded-[20px] bg-white p-3.5 text-left ring-1 ring-slate-900/[.05] active:scale-[.985]">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}18`, color: accent }}>
                  <Icon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-extrabold text-slate-900">{c.title}</span>
                    <PhaseBadge phase={c.phase} lang={lang} severity={c.severity} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-600">{c.summary}</p>
                  <p className="mt-1 text-[10.5px] text-slate-400">
                    {c.provenance.source} · {new Date(c.provenance.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <ChevronRight size={16} className="mt-3 shrink-0 text-slate-300" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* notification priority explainer */}
      <div className="mt-5 rounded-[20px] bg-white p-4 ring-1 ring-slate-900/[.05]">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-[#1565C0]" />
          <h3 className="text-[13px] font-extrabold text-slate-900">{t(lang, 'notif_priority')}</h3>
        </div>
        <p className="mt-1 font-mono text-[10.5px] text-slate-500">{t(lang, 'notif_formula')}</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {[
            [L(lang, 'Severity', 'गंभीरता'), hp.pinned.length ? 1 : hp.scenario.warning ? 0.6 : 0.2],
            [L(lang, 'Location', 'स्थान'), 0.9],
            [L(lang, 'Activity', 'गतिविधि'), hp.myDay.some((m) => m.status !== 'go') ? 0.85 : 0.4],
            [L(lang, 'Time', 'समय'), hp.hour >= 6 && hp.hour <= 21 ? 0.8 : 0.3],
            [L(lang, 'Pref.', 'पसंद'), 0.7],
          ].map(([label, v]) => (
            <div key={label as string} className="text-center">
              <div className="mx-auto flex h-14 w-3 items-end overflow-hidden rounded-full bg-slate-100">
                <div className="w-full rounded-full bg-gradient-to-t from-[#1565C0] to-[#64B5F6]" style={{ height: `${(v as number) * 100}%` }} />
              </div>
              <div className="mt-1 text-[9.5px] font-semibold text-slate-500">{label as string}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-slate-400">
          {hp.hour >= 22 || hp.hour < 6 ? L(lang, 'Quiet hours active — only RED alerts break through.', 'शांत समय — केवल रेड अलर्ट आएँगे।') : L(lang, 'Quiet hours 10 PM – 6 AM. Red alerts always break through.', 'शांत समय रात 10 – सुबह 6। रेड अलर्ट हमेशा।')}
        </p>
      </div>

      {/* provider status */}
      <div className="mt-3 rounded-[20px] bg-white p-4 ring-1 ring-slate-900/[.05]">
        <h3 className="text-[13px] font-extrabold text-slate-900">{t(lang, 'provider_status')}</h3>
        <ul className="mt-2 space-y-1.5">
          {hp.providers.map((p) => (
            <li key={p.name} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-2 font-semibold text-slate-700">
                <span className={`h-2 w-2 rounded-full ${p.status === 'ok' ? 'bg-emerald-500' : p.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`} />
                {p.name}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {p.status} · {p.latencyMs} ms
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10.5px] text-slate-400">{L(lang, 'Fallback chain: IMD → cache. Provenance kept per card.', 'फ़ॉलबैक: IMD → कैश। हर कार्ड में स्रोत।')}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Profile */
export function ProfileScreen({ hp, lang, setLang, onRedoOnboarding }: { hp: Homepage; lang: Lang; setLang: (l: Lang) => void; onRedoOnboarding: () => void }) {
  const u = hp.user;
  const locIcon = { home: HomeIcon, work: Briefcase, school: SchoolIcon, farm: Sprout };
  const [toggles, setToggles] = useState({ briefing: true, severe: true, nudges: true, aqi: true });
  return (
    <div className="px-4 pb-6 pt-2">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#1565C0] to-[#64B5F6] text-[20px] font-extrabold text-white shadow-lg shadow-blue-200">{u.name[0]}</div>
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight text-slate-900">{L(lang, u.name, u.nameHi)}</h1>
          <p className="flex items-center gap-1 text-[11.5px] text-slate-500">
            <MapPin size={11} /> {L(lang, hp.city.name, hp.city.nameHi)}, {hp.city.state} · {u.id}@mausam
          </p>
        </div>
      </div>

      <Section title={t(lang, 'personas')} icon={Activity}>
        <div className="flex flex-wrap gap-1.5">
          {u.personas.map((p: PersonaKey, i) => {
            const m = PERSONAS[p];
            return (
              <span key={p} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: m.soft, color: m.color }}>
                {m.icon} {L(lang, m.label, m.labelHi)}
                {i === 0 && <span className="ml-0.5 rounded bg-white/70 px-1 text-[9px] uppercase">{t(lang, 'primary')}</span>}
              </span>
            );
          })}
        </div>
      </Section>

      <Section title={t(lang, 'health_profile')} icon={ShieldCheck}>
        <div className="flex flex-wrap gap-1.5">
          {u.conditions.length === 0 && <span className="text-[12px] text-slate-500">{t(lang, 'none')}</span>}
          {u.conditions.map((c) => (
            <Chip key={c} tone="red">
              {L(lang, CONDITIONS[c]?.label ?? c, CONDITIONS[c]?.labelHi ?? c)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title={t(lang, 'saved_places')} icon={MapPin}>
        <ul className="divide-y divide-slate-100">
          {u.locations.map((l) => {
            const I = locIcon[l.type];
            return (
              <li key={l.type + l.label} className="flex items-center gap-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <I size={15} />
                </span>
                <div className="flex-1">
                  <div className="text-[12.5px] font-bold text-slate-800">{t(lang, l.type)}</div>
                  <div className="text-[11px] text-slate-500">{l.label}</div>
                </div>
                <ChevronRight size={14} className="text-slate-300" />
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t(lang, 'activities')} icon={Activity}>
        <ul className="divide-y divide-slate-100">
          {u.activities.map((a) => (
            <li key={a.time + a.type} className="flex items-center justify-between py-2 text-[12.5px]">
              <span className="font-semibold text-slate-800">{L(lang, a.label, a.labelHi)}</span>
              <span className="font-mono text-[11px] text-slate-500">{fmtTime(a.time, lang)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t(lang, 'notifications')} icon={Bell}>
        <ul className="divide-y divide-slate-100">
          {[
            ['briefing', t(lang, 'morning_briefing'), '07:00'],
            ['severe', t(lang, 'severe_alerts'), t(lang, 'always_on')],
            ['nudges', t(lang, 'activity_nudges'), ''],
            ['aqi', t(lang, 'aqi_thresholds'), 'AQI > 150'],
          ].map(([k, label, sub]) => (
            <li key={k} className="flex items-center justify-between py-2">
              <div>
                <div className="text-[12.5px] font-semibold text-slate-800">{label}</div>
                {sub && <div className="text-[10.5px] text-slate-500">{sub}</div>}
              </div>
              <Toggle on={toggles[k as keyof typeof toggles]} locked={k === 'severe'} onChange={(v) => setToggles({ ...toggles, [k]: v })} />
            </li>
          ))}
          <li className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Moon size={14} className="text-slate-500" />
              <div className="text-[12.5px] font-semibold text-slate-800">{t(lang, 'quiet_hours')}</div>
            </div>
            <span className="font-mono text-[11px] text-slate-500">22:00 – 06:00</span>
          </li>
        </ul>
      </Section>

      <Section title={t(lang, 'language')} icon={Globe}>
        <div className="grid grid-cols-2 gap-2">
          {(['en', 'hi'] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-xl py-2 text-[12.5px] font-bold ring-1 transition ${lang === l ? 'bg-[#1565C0] text-white ring-[#1565C0]' : 'bg-white text-slate-700 ring-slate-200'}`}>
              {l === 'en' ? 'English' : 'हिन्दी'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10.5px] text-slate-400">+ தமிழ் · తెలుగు · বাংলা · मराठी · ગુજરાતી · ಕನ್ನಡ · മലയാളം · ଓଡ଼ିଆ · ਪੰਜਾਬੀ ({L(lang, 'lazy-loaded', 'लेज़ी-लोड')})</p>
      </Section>

      <Section title={t(lang, 'units')} icon={Ruler}>
        <div className="flex gap-2 text-[12px] font-bold">
          <span className="rounded-lg bg-[#1565C0] px-2.5 py-1 text-white">°C</span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-500">°F</span>
          <span className="ml-3 rounded-lg bg-[#1565C0] px-2.5 py-1 text-white">km/h</span>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-500">m/s</span>
        </div>
      </Section>

      <Section title={t(lang, 'data_privacy')} icon={Lock}>
        <p className="text-[12px] leading-relaxed text-slate-600">{t(lang, 'on_device')}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
          <CheckCircle2 size={13} /> {L(lang, 'Cache: 1.2 MB · APK 25 MB · works offline', 'कैश: 1.2 MB · APK 25 MB · ऑफ़लाइन चलता है')}
        </div>
      </Section>

      <button onClick={onRedoOnboarding} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-[12.5px] font-bold text-slate-600 ring-1 ring-slate-200 active:scale-[.98]">
        <RotateCcw size={14} /> {t(lang, 'redo_onboarding')}
      </button>
      <p className="mt-3 text-center text-[10px] text-slate-400">Mausam 2.0 · v0.9.0 · Team BugNotFound · SIH 2026</p>
    </div>
  );
}

function Toggle({ on, onChange, locked }: { on: boolean; onChange: (v: boolean) => void; locked?: boolean }) {
  return (
    <button onClick={() => !locked && onChange(!on)} className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-[#1565C0]' : 'bg-slate-300'} ${locked ? 'opacity-70' : ''}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

function Section({ title, icon: I, children }: { title: string; icon: typeof Bell; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[20px] bg-white p-4 ring-1 ring-slate-900/[.05]">
      <div className="mb-2.5 flex items-center gap-2">
        <I size={14} className="text-[#1565C0]" />
        <h3 className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">{title}</h1>
      {sub && <p className="text-[11.5px] text-slate-500">{sub}</p>}
    </div>
  );
}
