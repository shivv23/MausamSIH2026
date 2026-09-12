import { WifiOff, Bell, RefreshCw, Flag } from 'lucide-react';
import type { Card, Homepage, Lang, PersonaKey } from '../../lib/engine';
import { L, PERSONAS } from '../../lib/engine';
import { t } from '../../lib/i18n';
import { BriefCard, DailyStrip, HeroCard, HourlyStrip, ImpactCard, MyDayCard, WarningCard } from '../cards';
import { SectionHeader } from '../ui';

interface Props {
  hp: Homepage;
  lang: Lang;
  offline: boolean;
  onExplain: (c: Card) => void;
  onOpenMyDay: () => void;
  onOpenAlerts: () => void;
  filter: PersonaKey | null;
  setFilter: (p: PersonaKey | null) => void;
}

export function HomeScreen({ hp, lang, offline, onExplain, onOpenMyDay, onOpenAlerts, filter, setFilter }: Props) {
  const greetKey = hp.hour < 5 ? 'good_night' : hp.hour < 12 ? 'good_morning' : hp.hour < 17 ? 'good_afternoon' : hp.hour < 22 ? 'good_evening' : 'good_night';
  const visible = filter ? hp.cards.filter((c) => c.persona === filter || c.type === 'severe_warning') : hp.cards;
  const alertCount = hp.pinned.length + hp.cards.filter((c) => c.phase === 'official' || (c.score !== undefined && c.score < 40)).length;

  return (
    <div className="space-y-4 px-4 pb-6 pt-2">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">
            {t(lang, greetKey)}, {L(lang, hp.user.name, hp.user.nameHi)}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${offline ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {t(lang, 'updated')} {hp.freshness} · IMD · CPCB
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenAlerts} className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-900/[.06] active:scale-95">
            <Bell size={18} />
            {alertCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white ring-2 ring-[#F8FAFE]">{alertCount}</span>}
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#1565C0] to-[#64B5F6] text-[14px] font-extrabold text-white shadow-md shadow-blue-200">
            {hp.user.name[0]}
          </div>
        </div>
      </div>

      {offline && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
          <WifiOff size={15} />
          <span className="flex-1">
            {t(lang, 'offline_banner')} 07:42 · SQLite cache
          </span>
          <button className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">
            <RefreshCw size={11} /> {t(lang, 'offline_retry')}
          </button>
        </div>
      )}

      <HeroCard hp={hp} lang={lang} />

      {hp.pinned.map((c) => (
        <WarningCard key={c.id} card={c} lang={lang} onExplain={onExplain} />
      ))}

      {/* persona chips */}
      <div>
        <SectionHeader title={t(lang, 'for_you')} sub={t(lang, 'ranked_by')} />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button onClick={() => setFilter(null)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${!filter ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {L(lang, 'All', 'सभी')}
          </button>
          {hp.user.personas.map((p, i) => {
            const m = PERSONAS[p];
            const active = filter === p;
            return (
              <button
                key={p}
                onClick={() => setFilter(active ? null : p)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold ring-1 transition"
                style={active ? { background: m.color, color: '#fff', borderColor: m.color, boxShadow: `0 6px 14px -6px ${m.color}` } : { background: '#fff', color: m.color, borderColor: `${m.color}33`, ['--tw-ring-color' as string]: `${m.color}33` }}
              >
                {m.icon} {L(lang, m.label, m.labelHi)}
                {i === 0 && <span className="ml-1 opacity-70">★</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ranked cards */}
      <div className="space-y-3">
        {visible.slice(0, 2).map((c, i) => (
          <ImpactCard key={c.id} card={c} lang={lang} onExplain={onExplain} rank={i} />
        ))}
        {hp.myDay.length > 0 && <MyDayCard items={hp.myDay} lang={lang} onOpen={onOpenMyDay} />}
        {visible.slice(2, 4).map((c, i) => (
          <ImpactCard key={c.id} card={c} lang={lang} onExplain={onExplain} rank={i + 2} />
        ))}
        <BriefCard text={hp.brief} lang={lang} />
        {visible.slice(4).map((c, i) => (
          <ImpactCard key={c.id} card={c} lang={lang} onExplain={onExplain} rank={i + 4} />
        ))}
        <HourlyStrip hp={hp} lang={lang} />
        <DailyStrip hp={hp} lang={lang} />
      </div>

      <div className="px-2 pt-1 text-center">
        <p className="text-[10.5px] leading-relaxed text-slate-400">{t(lang, 'footer_trust')}</p>
        <button className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
          <Flag size={11} /> {t(lang, 'report')}
        </button>
      </div>
    </div>
  );
}
