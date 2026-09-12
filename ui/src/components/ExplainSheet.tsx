import { useState } from 'react';
import { X, ShieldCheck, ThumbsUp, ThumbsDown, Flag, EyeOff, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { Card, Lang } from '../lib/engine';
import { L, SEVERITY_COLOR } from '../lib/engine';
import { t } from '../lib/i18n';
import { CARD_META, PhaseBadge, ScoreRing } from './ui';

const RANK_KEYS = [
  ['interest', 'r_interest', 0.3],
  ['context', 'r_context', 0.2],
  ['urgency', 'r_urgency', 0.25],
  ['time', 'r_time', 0.1],
  ['location', 'r_location', 0.1],
  ['behavior', 'r_behavior', 0.05],
] as const;

export function ExplainSheet({ card, lang, onClose }: { card: Card; lang: Lang; onClose: () => void }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const meta = CARD_META[card.type];
  const Icon = meta.icon;
  const accent = card.type === 'severe_warning' ? SEVERITY_COLOR[card.severity ?? 'red'] : meta.accent;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const total = RANK_KEYS.reduce((acc, [k, , w]) => acc + card.explanation.ranking[k] * w, 0);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="sheet-enter relative max-h-[88%] overflow-y-auto rounded-t-[28px] bg-white pb-8 shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/95 px-5 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: `${accent}18`, color: accent }}>
              <Icon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[17px] font-extrabold tracking-tight text-slate-900">{card.title}</h3>
                <PhaseBadge phase={card.phase} lang={lang} severity={card.severity} />
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{card.summary}</p>
            </div>
            <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
              <X size={15} />
            </button>
          </div>
          <div className="mt-3 h-px bg-slate-100" />
        </div>

        <div className="space-y-5 px-5 pt-4">
          {/* why */}
          <section>
            <h4 className="text-[12px] font-extrabold uppercase tracking-wider text-[#1565C0]">{t(lang, 'why_seeing')}</h4>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-800">{card.explanation.why}</p>
          </section>

          {/* ranking */}
          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'ranking_breakdown')}</h4>
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-700">
                Σ = {(total * 100).toFixed(0)}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5">
              {RANK_KEYS.map(([k, label, w]) => {
                const v = card.explanation.ranking[k];
                return (
                  <li key={k} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-[76px] font-semibold text-slate-700">{t(lang, label)}</span>
                    <span className="w-8 font-mono text-[10px] text-slate-400">w{w}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v * 100}%`, background: accent }} />
                    </div>
                    <span className="w-8 text-right font-mono text-[10.5px] font-bold text-slate-700">{Math.round(v * 100)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 font-mono text-[9.5px] text-slate-400">Score = w1·Interest + w2·Context + w3·Urgency + w4·Time + w5·Location + w6·Behavior{card.phase === 'official' ? ' · pinned' : ''}</p>
          </section>

          {/* factors */}
          {card.factors && card.factors.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">{t(lang, 'factors')}</h4>
                {card.score !== undefined && <ScoreRing score={card.score} label={card.level} size={46} />}
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-1.5">
                {card.factors.map((f) => (
                  <li key={f.name} className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-[11.5px] ${f.impact === 'good' ? 'border-emerald-100 bg-emerald-50/50' : f.impact === 'bad' ? 'border-red-100 bg-red-50/50' : 'border-slate-100 bg-slate-50'}`}>
                    <span className="font-semibold text-slate-700">{L(lang, f.name, f.nameHi)}</span>
                    <span className={`inline-flex items-center gap-0.5 font-bold ${f.impact === 'good' ? 'text-emerald-700' : f.impact === 'bad' ? 'text-red-600' : 'text-slate-600'}`}>
                      {f.impact === 'good' ? <ArrowUpRight size={11} /> : f.impact === 'bad' ? <ArrowDownRight size={11} /> : <Minus size={11} />}
                      {f.value}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* provenance */}
          <section className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
            <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-slate-800">
              <ShieldCheck size={14} className="text-emerald-600" /> {t(lang, 'source')}: {card.provenance.source}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <dt className="text-slate-500">{t(lang, 'issued')}</dt>
              <dd className="font-semibold text-slate-800">{fmt(card.provenance.issuedAt)}</dd>
              <dt className="text-slate-500">{t(lang, 'valid_until')}</dt>
              <dd className="font-semibold text-slate-800">{fmt(card.provenance.validUntil)}</dd>
              <dt className="text-slate-500">{t(lang, 'confidence')}</dt>
              <dd className="flex items-center gap-2 font-semibold text-slate-800">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${card.explanation.confidence * 100}%` }} />
                </div>
                {Math.round(card.explanation.confidence * 100)}%
              </dd>
              <dt className="text-slate-500">{t(lang, 'licence')}</dt>
              <dd className="font-semibold text-slate-800">{card.provenance.licence}</dd>
            </dl>
          </section>

          {/* feedback */}
          <section>
            {feedback ? (
              <p className="rounded-2xl bg-emerald-50 px-3 py-2.5 text-[12px] font-semibold text-emerald-700">{t(lang, 'thanks_feedback')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['helpful', ThumbsUp, t(lang, 'helpful')],
                  ['not_helpful', ThumbsDown, t(lang, 'not_helpful')],
                  ['inaccurate', Flag, t(lang, 'inaccurate')],
                ].map(([k, I, label]) => {
                  const Ic = I as typeof ThumbsUp;
                  return (
                    <button key={k as string} onClick={() => setFeedback(k as string)} className="flex flex-col items-center gap-1 rounded-2xl border border-slate-200 py-2.5 text-[11px] font-bold text-slate-700 active:scale-95">
                      <Ic size={16} /> {label as string}
                    </button>
                  );
                })}
              </div>
            )}
            <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[12px] font-bold text-slate-500 active:scale-[.98]">
              <EyeOff size={14} /> {t(lang, 'hide_like_this')}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
