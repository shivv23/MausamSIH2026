import { useState } from 'react';
import { ArrowRight, ArrowLeft, Check, CloudSun, ShieldCheck, Lock, Bell } from 'lucide-react';
import type { Lang, PersonaKey, UserProfile, Activity } from '../../lib/engine';
import { CITIES, CONDITIONS, L, PERSONAS } from '../../lib/engine';
import { t } from '../../lib/i18n';

const DEFAULT_ACTIVITIES: Partial<Record<PersonaKey, Activity[]>> = {
  fitness: [{ type: 'run', label: 'Morning run', labelHi: 'सुबह की दौड़', time: '06:30' }],
  commuter: [{ type: 'commute', label: 'Office commute', labelHi: 'ऑफ़िस सफ़र', time: '09:00' }],
  parent: [
    { type: 'school_drop', label: 'School drop', labelHi: 'स्कूल छोड़ना', time: '07:45' },
    { type: 'school_pickup', label: 'School pickup', labelHi: 'स्कूल से लाना', time: '15:30' },
  ],
  agriculture: [{ type: 'farm_work', label: 'Field work', labelHi: 'खेत का काम', time: '06:00' }],
  events: [{ type: 'event', label: 'Outdoor event', labelHi: 'बाहरी आयोजन', time: '19:00' }],
  beach: [{ type: 'swim', label: 'Beach swim', labelHi: 'समुद्र में तैराकी', time: '07:00' }],
  travel: [{ type: 'travel', label: 'Weekend trip', labelHi: 'सप्ताहांत यात्रा', time: '08:00' }],
  health: [{ type: 'walk', label: 'Evening walk', labelHi: 'शाम की सैर', time: '18:00' }],
};

export function Onboarding({ lang, setLang, onComplete, onStepChange }: { lang: Lang; setLang: (l: Lang) => void; onComplete: (u: UserProfile) => void; onStepChange?: (step: number) => void }) {
  const [step, setStepRaw] = useState(0);
  const setStep = (s: number) => {
    setStepRaw(s);
    onStepChange?.(s);
  };
  const [personas, setPersonas] = useState<PersonaKey[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('pune');
  const [conds, setConds] = useState<string[]>([]);
  const [briefing, setBriefing] = useState('07:00');

  const toggle = (p: PersonaKey) => setPersonas((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : cur.length >= 3 ? cur : [...cur, p]));

  const finish = () => {
    const ps = personas.length ? personas : (['commuter'] as PersonaKey[]);
    const acts = ps.flatMap((p) => DEFAULT_ACTIVITIES[p] ?? []);
    const c = CITIES.find((x) => x.key === city)!;
    onComplete({
      id: 'you',
      name: name.trim() || L(lang, 'Friend', 'मित्र'),
      nameHi: name.trim() || 'मित्र',
      personas: ps,
      conditions: conds,
      activities: acts,
      locations: [{ type: 'home', label: c.name }, ...(ps.includes('agriculture') ? [{ type: 'farm' as const, label: L(lang, 'My farm', 'मेरा खेत') }] : []), ...(ps.includes('parent') ? [{ type: 'school' as const, label: L(lang, 'School', 'स्कूल') }] : [])],
      city,
      language: lang,
      behaviorBias: {},
    });
  };

  const total = 4;
  return (
    <div className="flex h-full flex-col bg-[#F8FAFE]">
      {step === 0 ? (
        <div className="relative flex flex-1 flex-col overflow-hidden text-white" style={{ backgroundImage: 'linear-gradient(165deg,#0F2A4A 0%,#1565C0 55%,#38BDF8 130%)' }}>
          <div className="pointer-events-none absolute -right-16 top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-10 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="relative flex flex-1 flex-col px-6 pt-16">
            <div className="grid h-16 w-16 place-items-center rounded-[22px] bg-white/15 ring-1 ring-white/30 backdrop-blur">
              <CloudSun size={34} strokeWidth={1.8} />
            </div>
            <p className="mt-6 text-[12px] font-bold uppercase tracking-[.2em] text-sky-200">Mausam 2.0 · IMD</p>
            <h1 className="mt-2 text-[34px] font-extrabold leading-[1.05] tracking-tight">{t(lang, 'ob_welcome_title')}</h1>
            <p className="mt-3 max-w-[300px] text-[14px] leading-relaxed text-white/85">{t(lang, 'ob_welcome_sub')}</p>
            <ul className="mt-6 space-y-2 text-[12.5px] text-white/90">
              {[
                [ShieldCheck, L(lang, 'Official IMD · CPCB · INCOIS data only', 'केवल आधिकारिक IMD · CPCB · INCOIS डेटा')],
                [Lock, L(lang, 'Personalised on-device · offline-first', 'डिवाइस पर व्यक्तिगत · ऑफ़लाइन-फ़र्स्ट')],
                [Bell, L(lang, 'Alerts only when they matter to you', 'अलर्ट तभी जब आपके लिए ज़रूरी हों')],
              ].map(([I, txt]) => {
                const Ic = I as typeof ShieldCheck;
                return (
                  <li key={txt as string} className="flex items-center gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
                      <Ic size={12} />
                    </span>
                    {txt as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative px-6 pb-10">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">{t(lang, 'ob_lang')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['en', 'hi'] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`rounded-2xl py-2.5 text-[13px] font-bold ring-1 transition ${lang === l ? 'bg-white text-[#1565C0] ring-white' : 'bg-white/10 text-white ring-white/25'}`}>
                  {l === 'en' ? 'English' : 'हिन्दी'}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[14px] font-extrabold text-[#0F2A4A] shadow-xl shadow-blue-900/30 active:scale-[.98]">
              {t(lang, 'ob_continue')} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* progress */}
          <div className="px-5 pt-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <button onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1">
                <ArrowLeft size={13} /> {t(lang, 'ob_back')}
              </button>
              <span>
                {t(lang, 'ob_step')} {step} {t(lang, 'ob_of')} {total - 1}
              </span>
            </div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[#1565C0]' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-4 pt-5">
            {step === 1 && (
              <>
                <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900">{t(lang, 'ob_persona_title')}</h2>
                <p className="mt-1 text-[12.5px] text-slate-500">{t(lang, 'ob_persona_sub')}</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => {
                    const m = PERSONAS[k];
                    const idx = personas.indexOf(k);
                    const on = idx >= 0;
                    return (
                      <button key={k} onClick={() => toggle(k)} className="relative rounded-[20px] p-3.5 text-left ring-2 transition active:scale-[.97]" style={on ? { background: m.soft, ['--tw-ring-color' as string]: m.color } : { background: '#fff', ['--tw-ring-color' as string]: 'rgba(15,23,42,.06)' }}>
                        <span className="text-[26px]">{m.icon}</span>
                        <div className="mt-2 text-[13.5px] font-extrabold text-slate-900">{L(lang, m.label, m.labelHi)}</div>
                        <div className="text-[10.5px] leading-snug text-slate-500">{L(lang, m.desc, m.descHi)}</div>
                        {on && (
                          <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-[10px] font-extrabold text-white" style={{ background: m.color }}>
                            {idx === 0 ? '★' : <Check size={12} />}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900">{t(lang, 'ob_context_title')}</h2>
                <p className="mt-1 text-[12.5px] text-slate-500">{t(lang, 'ob_context_sub')}</p>
                <label className="mt-5 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'ob_name')}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={L(lang, 'e.g. Priya', 'जैसे प्रिया')} className="mt-1.5 w-full rounded-2xl bg-white px-4 py-3 text-[14px] font-semibold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#1565C0]" />
                <label className="mt-4 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'ob_city')}</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CITIES.map((c) => (
                    <button key={c.key} onClick={() => setCity(c.key)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 transition ${city === c.key ? 'bg-[#1565C0] text-white ring-[#1565C0]' : 'bg-white text-slate-700 ring-slate-200'}`}>
                      {L(lang, c.name, c.nameHi)}
                    </button>
                  ))}
                </div>
                <label className="mt-4 block text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'ob_conditions')}</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(CONDITIONS).map(([k, v]) => {
                    const on = conds.includes(k);
                    return (
                      <button key={k} onClick={() => setConds(on ? conds.filter((x) => x !== k) : [...conds, k])} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 transition ${on ? 'bg-red-50 text-red-700 ring-red-300' : 'bg-white text-slate-700 ring-slate-200'}`}>
                        {L(lang, v.label, v.labelHi)}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-start gap-2 rounded-2xl bg-blue-50 p-3 text-[11.5px] leading-snug text-blue-800">
                  <Lock size={14} className="mt-0.5 shrink-0" /> {t(lang, 'on_device')}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900">{t(lang, 'ob_notif_title')}</h2>
                <p className="mt-1 text-[12.5px] text-slate-500">{t(lang, 'ob_notif_sub')}</p>
                <div className="mt-4 rounded-[20px] bg-white p-4 ring-1 ring-slate-900/[.05]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'daily_briefing')}</div>
                  <div className="mt-2 flex gap-1.5">
                    {['06:00', '06:30', '07:00', '07:30', '08:00'].map((h) => (
                      <button key={h} onClick={() => setBriefing(h)} className={`flex-1 rounded-xl py-2 text-[12px] font-bold ring-1 ${briefing === h ? 'bg-[#1565C0] text-white ring-[#1565C0]' : 'bg-white text-slate-700 ring-slate-200'}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-slate-100 rounded-[20px] bg-white px-4 ring-1 ring-slate-900/[.05]">
                  {[
                    [t(lang, 'severe_alerts'), t(lang, 'always_on'), true],
                    [t(lang, 'activity_nudges'), L(lang, 'Before each saved activity', 'हर गतिविधि से पहले'), false],
                    [t(lang, 'aqi_thresholds'), 'AQI > 150', false],
                  ].map(([label, sub, locked]) => (
                    <li key={label as string} className="flex items-center justify-between py-3">
                      <div>
                        <div className="text-[13px] font-semibold text-slate-800">{label as string}</div>
                        <div className="text-[10.5px] text-slate-500">{sub as string}</div>
                      </div>
                      <span className={`relative h-6 w-11 rounded-full bg-[#1565C0] ${locked ? 'opacity-70' : ''}`}>
                        <span className="absolute left-[22px] top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-[20px] bg-white p-4 ring-1 ring-slate-900/[.05]">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'quiet_hours')}</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-800">22:00 – 06:00 · {L(lang, 'red alerts still delivered', 'रेड अलर्ट फिर भी आएँगे')}</div>
                </div>
              </>
            )}
          </div>

          <div className="px-5 pb-6 pt-2">
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} disabled={step === 1 && personas.length === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1565C0] py-3.5 text-[14px] font-extrabold text-white shadow-lg shadow-blue-200 transition active:scale-[.98] disabled:opacity-40">
                {t(lang, 'ob_next')} <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={finish} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1565C0] py-3.5 text-[14px] font-extrabold text-white shadow-lg shadow-blue-200 active:scale-[.98]">
                {t(lang, 'ob_finish')} <ArrowRight size={16} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
