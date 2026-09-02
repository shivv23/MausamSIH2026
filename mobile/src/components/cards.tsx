import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Card, Homepage, Lang, MyDayItem } from '../engine';
import { aqiBand, fmtHour, fmtTime, L, SEVERITY_COLOR, uvBand } from '../engine';
import { t } from '../i18n';
import { colors, CARD_META, CONDITION_ICON, CONDITION_LABEL, heroGradient, statusColor } from '../theme';
import { CardMetaIcon, Chip, PhaseBadge, ScoreRing } from './ui';

/* ------------------------------------------------------------------ hero */
export function HeroCard({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const p = hp.params;
  const cond = hp.hourly[0].condition;
  const band = aqiBand(p.aqi);
  const uv = uvBand(p.uv);
  const today = hp.daily[0];
  const [c1, c2] = heroGradient(cond, hp.hour);
  return (
    <LinearGradient colors={[c1, c2]} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}>
        <View style={styles.heroLeft}>
          <View style={styles.heroLoc}>
            <Text style={styles.heroLocText}>📍 {L(lang, hp.city.name, hp.city.nameHi)} · {hp.user.locations[0]?.label ?? t(lang, 'home')}</Text>
          </View>
          <View style={styles.heroTempRow}>
            <Text style={styles.heroTemp}>{p.temp}</Text>
            <Text style={styles.heroDeg}>°</Text>
          </View>
          <Text style={styles.heroCond}>{L(lang, CONDITION_LABEL[cond][0], CONDITION_LABEL[cond][1])}</Text>
          <Text style={styles.heroFeels}>
            {t(lang, 'feels_like')} {p.feelsLike}° · H {today.hi}° L {today.lo}°
          </Text>
        </View>
        <Text style={styles.heroIcon}>{CONDITION_ICON[cond]}</Text>
      </View>
      <View style={styles.heroStats}>
        <Stat label={t(lang, 'aqi')} value={String(p.aqi)} sub={L(lang, band.label, band.labelHi)} dot={band.color} />
        <Stat label={t(lang, 'uv')} value={String(p.uv)} sub={L(lang, uv.label, uv.labelHi)} dot={uv.color} />
        <Stat label={t(lang, 'humidity')} value={`${p.humidity}%`} sub={p.humidity > 80 ? t(lang, 'humidity_hi') : t(lang, 'humidity_ok')} />
        <Stat label={t(lang, 'wind')} value={`${p.wind}`} sub="km/h" />
      </View>
    </LinearGradient>
  );
}

function Stat({ label, value, sub, dot }: { label: string; value: string; sub: string; dot?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statSubRow}>
        {dot ? <View style={[styles.statDot, { backgroundColor: dot }]} /> : null}
        <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- warning */
export function WarningCard({ card, lang, onExplain }: { card: Card; lang: Lang; onExplain: (c: Card) => void }) {
  const color = SEVERITY_COLOR[card.severity ?? 'red'];
  const body = card.data.body as string | undefined;
  return (
    <Pressable style={[styles.warnCard, { borderColor: color }]} onPress={() => onExplain(card)}>
      <View style={[styles.warnBar, { backgroundColor: color }]} />
      <View style={styles.warnBody}>
        <View style={styles.warnHeadRow}>
          <View style={styles.warnHead}>
            <View style={[styles.warnDot, { backgroundColor: color }]} />
            <Text style={[styles.warnTag, { color }]}>
              {t(lang, 'pinned_official')} · {card.provenance.source} · {(card.severity ?? 'red').toUpperCase()}
            </Text>
          </View>
          <Chip tone="slate"><Text style={{ fontSize: 9.5 }}>🛡 {t(lang, 'never_ai')}</Text></Chip>
        </View>
        <Text style={styles.warnTitle}>{card.summary}</Text>
        {body ? <Text style={styles.warnBodyTxt}>{body}</Text> : null}
        {card.actions ? (
          <View style={styles.warnActions}>
            {card.actions.map((a) => (
              <Text key={a} style={[styles.warnAction, { color, backgroundColor: `${color}14` }]}>✓ {a}</Text>
            ))}
          </View>
        ) : null}
        <View style={styles.warnFoot}>
          <Text style={styles.warnValid}>
            {t(lang, 'valid_for')} {card.data.validHours as number}{t(lang, 'hours_short')} · {t(lang, 'confidence')} {Math.round(card.explanation.confidence * 100)}%
          </Text>
          <Pressable style={[styles.warnBtn, { backgroundColor: color }]} onPress={() => onExplain(card)}>
            <Text style={styles.warnBtnText}>{t(lang, 'view_advisory')}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- impact */
export function ImpactCard({ card, lang, onExplain, rank }: { card: Card; lang: Lang; onExplain: (c: Card) => void; rank: number }) {
  const meta = CARD_META[card.type] ?? CARD_META.mausam_brief;
  const isYellowOfficial = card.type === 'severe_warning';
  const accent = isYellowOfficial ? SEVERITY_COLOR[card.severity ?? 'yellow'] : meta.accent;
  const soft = isYellowOfficial ? '#FFF8E1' : meta.soft;
  const hasScore = card.score !== undefined && card.score !== null && !Number.isNaN(card.score);
  return (
    <Pressable style={[styles.impact, { transform: [] }]} onPress={() => onExplain(card)}>
      <View style={styles.impactTop}>
        <CardMetaIcon type={card.type} />
        <View style={styles.impactMain}>
          <View style={styles.impactTitleRow}>
            <Text style={styles.impactTitle} numberOfLines={1}>{card.title}</Text>
            <PhaseBadge phase={card.phase} lang={lang} severity={card.severity} />
          </View>
          <Text style={styles.impactSummary}>{card.summary}</Text>
        </View>
        {hasScore ? <ScoreRing score={card.score!} label={card.level} /> : null}
      </View>

      {card.bestWindow || (card.factors && card.factors.length > 0) ? (
        <View style={styles.chipRow}>
          {card.bestWindow ? (
            <Chip tone="green"><Text>🕑 {t(lang, 'best_window')} {card.bestWindow}</Text></Chip>
          ) : null}
          {card.factors?.slice(0, 3).map((f) => (
            <View key={f.name} style={[styles.factor,
              f.impact === 'good' ? styles.factorGood : f.impact === 'bad' ? styles.factorBad : styles.factorNeutral]}>
              <Text style={[styles.factorText, f.impact === 'good' ? { color: '#047857' } : f.impact === 'bad' ? { color: '#DC2626' } : { color: '#475569' }]}>
                {(f.impact === 'good' ? '▲' : f.impact === 'bad' ? '▼' : '–')} {L(lang, f.name, f.nameHi)} {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {card.actions && card.actions.length > 0 ? (
        <View style={styles.chipRow}>
          {card.actions.slice(0, 3).map((a) => (
            <Text key={a} style={[styles.actionPill, { backgroundColor: soft, color: accent }]}>✓ {a}</Text>
          ))}
        </View>
      ) : null}

      <View style={styles.impactFoot}>
        <Text style={styles.impactSrc}>🛡 {card.provenance.source} · {Math.round(card.explanation.confidence * 100)}%</Text>
        <Text style={styles.impactWhy}>Why? ▶</Text>
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- my day */
export function MyDayCard({ items, lang, onOpen }: { items: MyDayItem[]; lang: Lang; onOpen: () => void }) {
  return (
    <Pressable style={styles.myDayCard} onPress={onOpen}>
      <View style={styles.myDayHead}>
        <View>
          <Text style={styles.myDayTitle}>{t(lang, 'my_day')}</Text>
          <Text style={styles.myDaySub}>{t(lang, 'weather_checked')}</Text>
        </View>
        <Text style={styles.myDayChev}>›</Text>
      </View>
      <View style={styles.myDayList}>
        {items.map((m) => {
          const color = statusColor(m.status);
          return (
            <View key={m.activity.time + m.activity.type} style={styles.myDayRow}>
              <Text style={styles.myDayTime}>{fmtTime(m.activity.time, lang).replace(/ (AM|PM|पूर्वाह्न|अपराह्न)/, '')}</Text>
              <View style={[styles.myDayDot, { backgroundColor: color }]} />
              <View style={styles.myDayMain}>
                <Text style={styles.myDayLabel} numberOfLines={1}>{L(lang, m.activity.label, m.activity.labelHi)}</Text>
                <Text style={styles.myDayHint} numberOfLines={1}>{m.suggestion ? `→ ${m.suggestion}` : m.note}</Text>
              </View>
              <Text style={[styles.myDayTemp, { color }]}>{CONDITION_ICON[m.point.condition]} {m.point.temp}°</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- brief */
export function BriefCard({ text, lang }: { text: string; lang: Lang }) {
  const [speaking, setSpeaking] = React.useState(false);
  const [spoken, setSpoken] = React.useState(false);
  return (
    <LinearGradient colors={['#0F2A4A', '#1565C0']} style={styles.brief} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.briefGlow} />
      <View style={styles.briefHead}>
        <View style={styles.briefHeadLeft}>
          <View style={styles.briefIcon}><Text style={{ fontSize: 14 }}>✨</Text></View>
          <View>
            <Text style={styles.briefTitle}>{t(lang, 'brief')}</Text>
            <Text style={styles.briefSub}>{t(lang, 'template_first')}</Text>
          </View>
        </View>
        <Pressable
          style={[styles.briefSpeak, speaking && styles.briefSpeakActive]}
          onPress={() => {
            setSpeaking((v) => !v);
            if (!spoken) { setSpoken(true); setTimeout(() => setSpeaking(false), 2600); }
            else setSpeaking(false);
          }}
        >
          <Text>{speaking ? '🔊' : spoken ? '🔁' : '🔊'}</Text>
        </Pressable>
      </View>
      {spoken && !speaking && <Text style={styles.briefSpoken}>🔊 {t(lang, 'brief_read')}</Text>}
      <Text style={styles.briefText}>{speaking ? `${text} 🔊` : text}</Text>
    </LinearGradient>
  );
}

/* ---------------------------------------------------------------- hourly */
export function HourlyStrip({ hp, lang }: { hp: Homepage; lang: Lang }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeadRow}>
        <Text style={styles.cardTitle}>{t(lang, 'hourly')}</Text>
        <Text style={styles.cardSub}>IMD · {hp.freshness}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {hp.hourly.slice(0, 12).map((h, i) => (
          <View key={h.hour} style={[styles.hourlyItem, i === 0 && styles.hourlyNow]}>
            <Text style={[styles.hourlyTime, i === 0 ? { color: 'rgba(255,255,255,0.85)' } : { color: colors.textMuted }]}>
              {i === 0 ? (lang === 'hi' ? 'अभी' : 'Now') : lang === 'hi' ? fmtHour(h.hour, lang) : fmtHour(h.hour, lang)}
            </Text>
            <Text style={styles.hourlyIcon}>{CONDITION_ICON[h.condition]}</Text>
            <Text style={[styles.hourlyTemp, i === 0 && { color: '#fff' }]}>{h.temp}°</Text>
            <Text style={[styles.hourlyRain, h.rainProb >= 40 ? { color: i === 0 ? '#fff' : '#2563EB' } : i === 0 ? { color: 'rgba(255,255,255,0.6)' } : { color: colors.textSoft }]}>
              💧 {h.rainProb}%
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/* ----------------------------------------------------------------- daily */
export function DailyStrip({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const min = Math.min(...hp.daily.map((d) => d.lo));
  const max = Math.max(...hp.daily.map((d) => d.hi));
  const span = Math.max(1, max - min);
  return (
    <View style={styles.card}>
      <Text style={[styles.cardTitle, { marginBottom: 6 }]}>{t(lang, 'daily')}</Text>
      {hp.daily.map((d) => (
        <View key={d.label} style={styles.dailyRow}>
          <Text style={styles.dailyDay}>{L(lang, d.label, d.labelHi)}</Text>
          <Text style={styles.dailyIcon}>{CONDITION_ICON[d.condition]}</Text>
          <Text style={[styles.dailyRain, d.rainProb >= 40 && { color: '#2563EB' }]}>{d.rainProb}%</Text>
          <Text style={styles.dailyLo}>{d.lo}°</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { left: `${((d.lo - min) / span) * 100}%`, width: `${((d.hi - d.lo) / span) * 100}%` }]} />
          </View>
          <Text style={styles.dailyHi}>{d.hi}°</Text>
        </View>
      ))}
      <Text style={styles.dailyGust}>💨 {L(lang, 'Wind gusts up to', 'हवा के झोंके')} {hp.params.gust} km/h</Text>
    </View>
  );
}

const cardBase = {
  backgroundColor: colors.card,
  borderRadius: 22,
  shadowColor: '#101828',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.08,
  shadowRadius: 28,
  elevation: 2,
};

const styles = StyleSheet.create({
  card: { ...cardBase, padding: 14 },
  cardTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 10.5, color: colors.textMuted },
  cardHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },

  hero: { borderRadius: 28, overflow: 'hidden', padding: 20, shadowColor: '#1565C0', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 6 },
  heroGlow: { position: 'absolute', right: -40, top: -56, width: 192, height: 192, borderRadius: 96, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLeft: { flex: 1 },
  heroLoc: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  heroLocText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroTempRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  heroTemp: { color: '#fff', fontSize: 68, fontWeight: '200', lineHeight: 62, letterSpacing: -2, includeFontPadding: false },
  heroDeg: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: 2 },
  heroCond: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 4, marginBottom: 2 },
  heroFeels: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  heroIcon: { fontSize: 76, marginTop: 8 },
  heroStats: { flexDirection: 'row', gap: 8, marginTop: 18 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 2 },
  statSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statSub: { color: 'rgba(255,255,255,0.85)', fontSize: 9 },

  warnCard: { borderRadius: 24, backgroundColor: colors.card, borderWidth: 2, overflow: 'hidden', shadowColor: '#E53935', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 3 },
  warnBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 7 },
  warnBody: { padding: 16, paddingLeft: 22 },
  warnHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  warnTag: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 1 },
  warnDot: { width: 10, height: 10, borderRadius: 5 },
  warnTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8, lineHeight: 20, letterSpacing: -0.3 },
  warnBodyTxt: { fontSize: 12.5, color: '#475569', marginTop: 6, lineHeight: 17 },
  warnActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  warnAction: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '600', overflow: 'hidden' },
  warnFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  warnValid: { fontSize: 11, color: colors.textMuted },
  warnBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  warnBtnText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },

  impact: { ...cardBase, padding: 16 },
  impactTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  impactMain: { flex: 1 },
  impactTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  impactTitle: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  impactSummary: { fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 17 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  factor: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  factorGood: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  factorBad: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  factorNeutral: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  factorText: { fontSize: 10.5, fontWeight: '600' },
  actionPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '600', overflow: 'hidden' },
  impactFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  impactSrc: { fontSize: 11, color: colors.textMuted },
  impactWhy: { fontSize: 11, fontWeight: '700', color: colors.primary },

  myDayCard: { ...cardBase, padding: 16 },
  myDayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myDayTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  myDaySub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  myDayChev: { fontSize: 18, color: colors.textSoft },
  myDayList: { marginTop: 12 },
  myDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  myDayTime: { width: 44, fontSize: 11, fontWeight: '700', color: colors.textMuted },
  myDayDot: { width: 10, height: 10, borderRadius: 5 },
  myDayMain: { flex: 1 },
  myDayLabel: { fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  myDayHint: { fontSize: 10.5, color: colors.textMuted, marginTop: 1 },
  myDayTemp: { fontSize: 10.5, fontWeight: '700' },

  brief: { borderRadius: 22, overflow: 'hidden', padding: 16, shadowColor: '#1565C0', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 5 },
  briefGlow: { position: 'absolute', right: -32, top: -32, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.1)' },
  briefHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  briefHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  briefIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  briefTitle: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  briefSub: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  briefSpeak: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  briefSpeakActive: { backgroundColor: 'rgba(255,255,255,0.45)', transform: [{ scale: 1.08 }] },
  briefSpoken: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700', marginTop: 12 },
  briefText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, lineHeight: 19, marginTop: 12 },

  hourlyItem: { width: 56, alignItems: 'center', paddingVertical: 8, borderRadius: 16, marginRight: 4 },
  hourlyNow: { backgroundColor: colors.primary },
  hourlyTime: { fontSize: 10, fontWeight: '600' },
  hourlyIcon: { fontSize: 18, marginVertical: 6 },
  hourlyTemp: { fontSize: 13, fontWeight: '700', color: colors.text },
  hourlyRain: { fontSize: 9.5, fontWeight: '600', marginTop: 2 },

  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  dailyDay: { width: 48, fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  dailyIcon: { fontSize: 18 },
  dailyRain: { width: 42, fontSize: 11, fontWeight: '600', color: colors.textSoft },
  dailyLo: { width: 26, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  trackFill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: '#38BDF8' },
  dailyHi: { width: 26, fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'right' },
  dailyGust: { fontSize: 10, color: colors.textSoft, marginTop: 8 },
});

export default {}