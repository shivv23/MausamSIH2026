import { useMemo, useState } from 'react';
import { Copy, Check, Download, SlidersHorizontal, Palette, FileText, Wifi, WifiOff, Sparkles, Play, Clock, Languages } from 'lucide-react';
import type { Homepage, Lang, ScenarioKey } from '../../lib/engine';
import { CITIES, DEMO_USERS, PERSONAS, SCENARIOS } from '../../lib/engine';
import { buildPrompt } from '../../lib/prompt';
import { heroGradient } from '../ui';

export interface DemoState {
  userId: string;
  cityKey: string;
  scenarioKey: ScenarioKey | 'auto';
  hour: number | 'live';
  lang: Lang;
  offline: boolean;
  onboarding: boolean;
}

export type StudioTab = 'controls' | 'design' | 'prompt';

interface Props {
  state: DemoState;
  set: (patch: Partial<DemoState>) => void;
  hp: Homepage;
  tab: StudioTab;
  setTab: (t: StudioTab) => void;
  hasCustom: boolean;
}

const SCRIPTS: { label: string; desc: string; patch: Partial<DemoState> }[] = [
  { label: 'Cyclone · Kochi', desc: 'RED pinned warnings override personalisation', patch: { userId: 'asha', cityKey: 'kochi', scenarioKey: 'cyclone', hour: 9 } },
  { label: 'AQI spike · Delhi', desc: 'Asthma profile pushes AQI to #1', patch: { userId: 'ananya', cityKey: 'delhi', scenarioKey: 'aqi_spike', hour: 6 } },
  { label: 'Frost night · Punjab', desc: 'Farmer, Hindi, 9 PM frost guidance', patch: { userId: 'ramesh', cityKey: 'chandigarh', scenarioKey: 'frost_night', hour: 21, lang: 'hi' } },
  { label: 'Rainy commute · Mumbai', desc: 'School run + event at risk', patch: { userId: 'asha', cityKey: 'mumbai', scenarioKey: 'rainy_commute', hour: 7 } },
  { label: 'Clean-air morning · Pune', desc: 'Positive nudge to run outside', patch: { userId: 'ananya', cityKey: 'pune', scenarioKey: 'clean_air_morning', hour: 6 } },
  { label: 'Heat wave · Bengaluru', desc: 'Orange warning + heat stress card', patch: { userId: 'ananya', cityKey: 'bengaluru', scenarioKey: 'heatwave', hour: 13 } },
];

export function Studio({ state, set, hp, tab, setTab, hasCustom }: Props) {
  const tabs: { key: StudioTab; icon: typeof Palette; label: string }[] = [
    { key: 'controls', icon: SlidersHorizontal, label: 'Demo controls' },
    { key: 'design', icon: Palette, label: 'Design system' },
    { key: 'prompt', icon: FileText, label: 'OpenCode prompt' },
  ];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-white/[.04] ring-1 ring-white/10 backdrop-blur-xl">
      <div className="flex shrink-0 gap-1 border-b border-white/10 p-2">
        {tabs.map(({ key, icon: I, label }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-[12px] font-bold transition ${tab === key ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:bg-white/5'}`}>
            <I size={14} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 text-slate-200">
        {tab === 'controls' && <Controls state={state} set={set} hp={hp} hasCustom={hasCustom} />}
        {tab === 'design' && <DesignSystem hp={hp} />}
        {tab === 'prompt' && <PromptTab hp={hp} />}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- controls */
function Controls({ state, set, hp, hasCustom }: { state: DemoState; set: (p: Partial<DemoState>) => void; hp: Homepage; hasCustom: boolean }) {
  return (
    <div className="space-y-6">
      <Block title="Demo scripts" icon={Play} hint="One-tap judge scenarios">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SCRIPTS.map((s) => (
            <button key={s.label} onClick={() => set({ ...s.patch, onboarding: false })} className="rounded-2xl bg-white/5 p-3 text-left ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[.98]">
              <div className="text-[12.5px] font-extrabold text-white">{s.label}</div>
              <div className="text-[11px] text-slate-400">{s.desc}</div>
            </button>
          ))}
        </div>
      </Block>

      <Block title="User" icon={Sparkles} hint="Demo personas from backend _personas_for()">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {DEMO_USERS.map((u) => (
            <button key={u.id} onClick={() => set({ userId: u.id, cityKey: u.city, lang: u.language, onboarding: false })} className={`rounded-2xl p-2.5 text-left ring-1 transition ${state.userId === u.id ? 'bg-white text-slate-900 ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}>
              <div className="text-[12.5px] font-extrabold">{u.name}</div>
              <div className={`mt-0.5 flex flex-wrap gap-0.5 text-[10px] ${state.userId === u.id ? 'text-slate-600' : 'text-slate-400'}`}>{u.personas.map((p) => PERSONAS[p].icon).join(' ')} · {u.city}</div>
            </button>
          ))}
          <button onClick={() => (hasCustom ? set({ userId: 'you', onboarding: false }) : set({ onboarding: true }))} className={`rounded-2xl p-2.5 text-left ring-1 transition ${state.userId === 'you' ? 'bg-white text-slate-900 ring-white' : 'bg-white/5 ring-white/20 hover:bg-white/10'}`}>
            <div className="text-[12.5px] font-extrabold">{hasCustom ? 'You' : '+ New'}</div>
            <div className={`text-[10px] ${state.userId === 'you' ? 'text-slate-600' : 'text-slate-400'}`}>{hasCustom ? 'from onboarding' : 'run onboarding'}</div>
          </button>
        </div>
      </Block>

      <Block title="City" icon={Clock} hint={`Auto scenario: ${CITIES.find((c) => c.key === state.cityKey)?.defaultScenario}`}>
        <div className="flex flex-wrap gap-1.5">
          {CITIES.map((c) => (
            <Pill key={c.key} on={state.cityKey === c.key} onClick={() => set({ cityKey: c.key })}>
              {c.name}
              {c.coastal ? ' 🌊' : c.farm ? ' 🌾' : ''}
            </Pill>
          ))}
        </div>
      </Block>

      <Block title="Weather scenario" icon={Sparkles} hint="Mirrors providers/mock.py SCENARIOS">
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => set({ scenarioKey: 'auto' })} className={`rounded-2xl p-2 text-left ring-1 transition ${state.scenarioKey === 'auto' ? 'bg-white text-slate-900 ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`}>
            <div className="text-[16px]">🎯</div>
            <div className="text-[11px] font-extrabold">Auto</div>
            <div className={`text-[9.5px] ${state.scenarioKey === 'auto' ? 'text-slate-500' : 'text-slate-400'}`}>by city</div>
          </button>
          {SCENARIOS.map((s) => {
            const on = state.scenarioKey === s.key;
            return (
              <button key={s.key} onClick={() => set({ scenarioKey: s.key })} className={`relative overflow-hidden rounded-2xl p-2 text-left ring-1 transition ${on ? 'text-white ring-white' : 'bg-white/5 ring-white/10 hover:bg-white/10'}`} style={on ? { backgroundImage: heroGradient(s.condition, 12) } : undefined}>
                <div className="text-[16px]">{s.emoji}</div>
                <div className="text-[11px] font-extrabold leading-tight">{s.label}</div>
                <div className={`mt-0.5 line-clamp-2 text-[9.5px] leading-tight ${on ? 'text-white/80' : 'text-slate-400'}`}>{s.desc}</div>
                {s.warning && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: s.warning.severity === 'red' ? '#E53935' : s.warning.severity === 'orange' ? '#F57C00' : '#F2B100' }} />}
              </button>
            );
          })}
        </div>
      </Block>

      <Block title="Time of day" icon={Clock} hint="Drives greeting, gradient & time-relevance weight">
        <div className="flex items-center gap-3">
          <input type="range" min={0} max={23} value={state.hour === 'live' ? hp.hour : state.hour} onChange={(e) => set({ hour: Number(e.target.value) })} className="flex-1 accent-sky-400" />
          <span className="w-14 rounded-lg bg-white/10 px-2 py-1 text-center font-mono text-[12px] font-bold text-white">{String(hp.hour).padStart(2, '0')}:00</span>
          <Pill on={state.hour === 'live'} onClick={() => set({ hour: 'live' })}>
            Live
          </Pill>
        </div>
      </Block>

      <div className="grid grid-cols-2 gap-3">
        <Block title="Language" icon={Languages}>
          <div className="flex gap-1.5">
            <Pill on={state.lang === 'en'} onClick={() => set({ lang: 'en' })}>
              English
            </Pill>
            <Pill on={state.lang === 'hi'} onClick={() => set({ lang: 'hi' })}>
              हिन्दी
            </Pill>
          </div>
        </Block>
        <Block title="Network" icon={state.offline ? WifiOff : Wifi}>
          <div className="flex gap-1.5">
            <Pill on={!state.offline} onClick={() => set({ offline: false })}>
              Online
            </Pill>
            <Pill on={state.offline} onClick={() => set({ offline: true })}>
              Offline
            </Pill>
          </div>
        </Block>
      </div>

      <Block title="Live ranking" icon={SlidersHorizontal} hint="What the engine chose, and why">
        <ol className="space-y-1">
          {[...hp.pinned, ...hp.cards].map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-[11.5px]">
              <span className="w-4 font-mono text-slate-500">{i + 1}</span>
              <span className="flex-1 truncate font-semibold text-white">{c.title}</span>
              <span className={`rounded px-1 text-[9px] font-extrabold uppercase ${c.phase === 'official' ? 'bg-red-500/20 text-red-300' : c.phase === 'derived' ? 'bg-sky-500/20 text-sky-300' : 'bg-white/10 text-slate-300'}`}>{c.phase}</span>
              <span className="w-10 text-right font-mono text-slate-400">{c.rank}</span>
            </li>
          ))}
        </ol>
      </Block>
    </div>
  );
}

/* ---------------------------------------------------------- design system */
function DesignSystem({ hp }: { hp: Homepage }) {
  const swatch = (name: string, hex: string) => (
    <div key={name + hex} className="flex items-center gap-2 rounded-xl bg-white/5 p-1.5 pr-2.5 ring-1 ring-white/10">
      <span className="h-7 w-7 shrink-0 rounded-lg ring-1 ring-white/20" style={{ background: hex }} />
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold text-white">{name}</div>
        <div className="font-mono text-[9.5px] text-slate-400">{hex}</div>
      </div>
    </div>
  );
  return (
    <div className="space-y-6">
      <Block title="Core palette" icon={Palette} hint="Blueprint §8.3 tokens, extended">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {swatch('primary', '#1565C0')}
          {swatch('primaryLight', '#64B5F6')}
          {swatch('primaryDeep', '#0F2A4A')}
          {swatch('surface', '#F8FAFE')}
          {swatch('text', '#0F172A')}
          {swatch('textMuted', '#64748B')}
        </div>
      </Block>
      <Block title="Score scale (0–100)" icon={Palette} hint="Never the only signal — level text always accompanies">
        <div className="flex overflow-hidden rounded-xl ring-1 ring-white/10">
          {[
            ['Avoid', '#E53935', '0–19'],
            ['Poor', '#F57C00', '20–39'],
            ['Fair', '#F2B100', '40–59'],
            ['Good', '#7CB342', '60–79'],
            ['Excellent', '#2E9E4A', '80–100'],
          ].map(([l, c, r]) => (
            <div key={l} className="flex-1 px-1.5 py-2 text-center" style={{ background: c }}>
              <div className="text-[10px] font-extrabold text-white">{l}</div>
              <div className="text-[9px] text-white/80">{r}</div>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Alert phases & severity" icon={Palette}>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['OFFICIAL · RED', '#E53935', '#fff'],
            ['OFFICIAL · ORANGE', '#F57C00', '#fff'],
            ['OFFICIAL · YELLOW', '#F2B100', '#fff'],
            ['DERIVED', '#E3F2FD', '#1565C0'],
            ['INFO', '#F1F5F9', '#64748B'],
          ].map(([l, bg, fg]) => (
            <span key={l} className="rounded-md px-2 py-1 text-[10px] font-extrabold tracking-wider" style={{ background: bg, color: fg }}>
              {l}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Official orange/red → pinned above personalisation, never LLM-generated. Yellow ranks normally with urgency 1.0.</p>
      </Block>
      <Block title="Persona accents" icon={Palette}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {Object.entries(PERSONAS).map(([k, p]) => (
            <div key={k} className="flex items-center gap-2 rounded-xl p-2" style={{ background: p.soft }}>
              <span className="text-[16px]">{p.icon}</span>
              <div>
                <div className="text-[11px] font-extrabold" style={{ color: p.color }}>
                  {p.label}
                </div>
                <div className="font-mono text-[9px] text-slate-500">{p.color}</div>
              </div>
            </div>
          ))}
        </div>
      </Block>
      <Block title="Hero gradients by condition" icon={Palette} hint="Night variants darken automatically">
        <div className="grid grid-cols-4 gap-1.5">
          {(['sunny', 'partly', 'rain', 'storm', 'haze', 'hot', 'cold', 'night'] as const).map((c) => (
            <div key={c} className="h-14 rounded-xl p-1.5 text-[10px] font-bold text-white ring-1 ring-white/10" style={{ backgroundImage: heroGradient(c, 12) }}>
              {c}
            </div>
          ))}
        </div>
      </Block>
      <Block title="Type & shape" icon={FileText}>
        <div className="rounded-2xl bg-white p-4 text-slate-900">
          <div className="flex items-end gap-3">
            <span className="text-[56px] font-extralight leading-none tracking-tighter">26°</span>
            <div className="pb-2">
              <div className="text-[22px] font-extrabold tracking-tight">Heading 22 / 800</div>
              <div className="text-[15px] font-extrabold">Section 15 / 800</div>
              <div className="text-[13px] text-slate-600">Body 13 / 400 · line-height 1.45</div>
              <div className="text-[11px] font-semibold text-slate-500">Caption 11 / 600</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[10.5px] text-slate-500">
            <span className="rounded-[22px] bg-slate-100 px-3 py-1.5">card r22</span>
            <span className="rounded-[28px] bg-slate-100 px-3 py-1.5">hero r28</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">chip r999</span>
            <span className="rounded-2xl bg-slate-100 px-3 py-1.5">tile r16</span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-slate-400">Plus Jakarta Sans · Noto Sans Devanagari (HI) · shadow 0 10 28 -16 rgba(16,24,40,.18) + hairline ring</p>
        </div>
      </Block>
      <Block title="Card anatomy" icon={FileText} hint="Every ImpactCard, top to bottom">
        <ol className="space-y-1 text-[11.5px] text-slate-300">
          {[
            'Icon tile — persona soft background, 40×40, r16',
            'Title (15/800) + PhaseBadge (official / derived / info)',
            'Summary — 1–2 sentence decision, numbers inline',
            'ScoreRing 64px right-aligned, colour by band, level label',
            'Best-window chip (green) + ≤3 factor chips ↗ ↘ –',
            'Optional ✓ action chips in persona tint',
            'Footer: shield + source · confidence%  |  "Why? ›" (opens ExplainSheet)',
          ].map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-sky-500/20 font-mono text-[9.5px] font-bold text-sky-300">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </Block>
      <Block title="Ranking formula" icon={SlidersHorizontal}>
        <code className="block rounded-xl bg-black/30 p-3 font-mono text-[10.5px] leading-relaxed text-sky-200">
          Score = 0.30·Interest + 0.20·Context + 0.25·Urgency
          <br />+ 0.10·Time + 0.10·Location + 0.05·Behavior
          <br />
          <span className="text-slate-400">// official orange/red → pinned (score + 2.0)</span>
          <br />
          <span className="text-slate-400">// current #1: {hp.cards[0]?.title ?? '—'} → {hp.cards[0]?.rank ?? '—'}</span>
        </code>
      </Block>
      <Block title="Screen inventory" icon={FileText}>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {['Onboarding · 4 steps', 'Home · ranked cards', 'Explain sheet · modal', 'My Day · timeline', 'Ask · template chat', 'Alerts · 3 phases', 'Me · profile & prefs', 'Offline · cached state'].map((s) => (
            <div key={s} className="rounded-xl bg-white/5 px-2.5 py-2 font-semibold text-slate-200 ring-1 ring-white/10">
              {s}
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}

/* ------------------------------------------------------------------ prompt */
function PromptTab({ hp }: { hp: Homepage }) {
  const text = useMemo(() => buildPrompt(hp), [hp]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const download = () => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MAUSAM_UI_BRIEF.md';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-2xl bg-sky-500/10 p-3 text-[12px] leading-relaxed text-sky-100 ring-1 ring-sky-400/20">
        Paste this into OpenCode inside the repo (<code className="font-mono text-[11px]">cd MausamSIH2026 && opencode</code>). It encodes the tokens, screens, component props, API contract and acceptance checklist you see in this prototype — and it updates live with the current scenario (<b>{hp.user.name} · {hp.city.name} · {hp.scenario.label}</b>) so the example JSON matches what's on screen.
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-[13px] font-extrabold text-slate-900 transition active:scale-[.98]">
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy prompt'}
        </button>
        <button onClick={download} className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-[13px] font-bold text-white ring-1 ring-white/15 transition active:scale-[.98]">
          <Download size={15} /> .md
        </button>
      </div>
      <textarea readOnly value={text} className="min-h-[420px] flex-1 resize-none rounded-2xl bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-slate-200 outline-none ring-1 ring-white/10" />
    </div>
  );
}

/* --------------------------------------------------------------- helpers */
function Block({ title, icon: I, hint, children }: { title: string; icon: typeof Palette; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <I size={13} className="text-sky-300" />
        <h3 className="text-[11px] font-extrabold uppercase tracking-[.14em] text-slate-300">{title}</h3>
        {hint && <span className="ml-auto truncate text-[10.5px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold ring-1 transition active:scale-95 ${on ? 'bg-white text-slate-900 ring-white' : 'bg-white/5 text-slate-200 ring-white/10 hover:bg-white/10'}`}>
      {children}
    </button>
  );
}
