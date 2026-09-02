import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Lang, Phase, Severity } from '../engine';
import { scoreColor, SEVERITY_COLOR, L } from '../engine';
import { t } from '../i18n';
import { colors, CARD_META } from '../theme';

export function ScoreRing({ score, label, size = 64 }: { score: number; label?: string; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF2F7" strokeWidth={6} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.3, fontWeight: '800', color, letterSpacing: -0.5 }}>{score}</Text>
      {label ? (
        <Text style={{ fontSize: size * 0.11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1 }}>{label}</Text>
      ) : null}
    </View>
  );
}

export function PhaseBadge({ phase, lang, severity }: { phase: Phase; lang: Lang; severity?: Severity }) {
  let bg: string; let fg: string; let key: 'phase_official' | 'phase_derived' | 'phase_informational';
  if (phase === 'official') { bg = severity ? SEVERITY_COLOR[severity] : '#E53935'; fg = '#fff'; key = 'phase_official'; }
  else if (phase === 'derived') { bg = '#E3F2FD'; fg = '#1565C0'; key = 'phase_derived'; }
  else { bg = '#F1F5F9'; fg = '#64748B'; key = 'phase_informational'; }
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{t(lang, key)}</Text>
    </View>
  );
}

type ChipTone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'white';
const CHIP_TONES: Record<ChipTone, { bg: string; fg: string }> = {
  slate: { bg: '#F1F5F9', fg: '#334155' },
  blue: { bg: '#EFF6FF', fg: '#1D4ED8' },
  green: { bg: '#ECFDF5', fg: '#047857' },
  amber: { bg: '#FFFBEB', fg: '#B45309' },
  red: { bg: '#FEF2F2', fg: '#B91C1C' },
  white: { bg: 'rgba(255,255,255,0.15)', fg: '#fff' },
};

export function Chip({ children, tone = 'slate' }: { children: React.ReactNode; tone?: ChipTone }) {
  const tn = CHIP_TONES[tone];
  return <View style={[s.chip, { backgroundColor: tn.bg }]}><Text style={[s.chipText, { color: tn.fg }]}>{children}</Text></View>;
}

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={s.secHead}>
      <View style={{ flex: 1 }}>
        <Text style={s.secTitle}>{title}</Text>
        {sub ? <Text style={s.secSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/** Horizontal chip scroll row (personas / filters). */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
      {children}
    </ScrollView>
  );
}

export function CardMetaIcon({ type, size = 20 }: { type: string; size?: number }) {
  const meta = CARD_META[type] ?? CARD_META.mausam_brief;
  return (
    <View style={[s.metaBox, { backgroundColor: meta.soft }]}>
      <Text style={{ fontSize: size, color: meta.accent }}>{meta.icon}</Text>
    </View>
  );
}

export { L };

const s = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  chipText: { fontSize: 11, fontWeight: '600' },
  secHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4, marginBottom: 8 },
  secTitle: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  secSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  metaBox: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});