import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Card, Homepage, Lang } from '../engine';
import { L, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors, CARD_META } from '../theme';
import { CardMetaIcon, PhaseBadge } from '../components/ui';

type Tab = 'official' | 'derived' | 'informational';

export default function Alerts({ hp, lang, onExplain }: { hp: Homepage; lang: Lang; onExplain: (c: Card) => void }) {
  const [tab, setTab] = useState<Tab>('official');
  const all = [...hp.pinned, ...hp.cards];
  const list = all.filter((c) =>
    tab === 'official' ? c.phase === 'official'
    : tab === 'derived' ? c.phase === 'derived' && c.score !== undefined && c.score < 60
    : c.phase === 'informational' || (c.phase === 'derived' && (c.score ?? 100) >= 60));
  const counts = {
    official: all.filter((c) => c.phase === 'official').length,
    derived: all.filter((c) => c.phase === 'derived' && (c.score ?? 100) < 60).length,
    informational: all.filter((c) => c.phase === 'informational' || (c.phase === 'derived' && (c.score ?? 100) >= 60)).length,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(lang, 'alerts_title')}</Text>
        <Text style={styles.sub}>{t(lang, 'alerts_sub')}</Text>

        <View style={styles.tabs}>
          {(['official', 'derived', 'informational'] as const).map((k) => (
            <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
                {t(lang, k === 'official' ? 'phase_official' : k === 'derived' ? 'phase_derived' : 'phase_informational')}
              </Text>
              <View style={[styles.tabCount, tab === k && styles.tabCountActive]}><Text style={[styles.tabCountText, tab === k && { color: '#fff' }]}>{counts[k]}</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        {list.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>{t(lang, 'no_alerts')}</Text></View>
        ) : (
          list.map((c) => {
            const meta = CARD_META[c.type] ?? CARD_META.mausam_brief;
            const accent = c.phase === 'official' ? SEVERITY_COLOR[c.severity ?? 'red'] : meta.accent;
            return (
              <Pressable key={c.id} style={styles.alertCard} onPress={() => onExplain(c)}>
                <CardMetaIcon type={c.type} size={19} />
                <View style={styles.alertMain}>
                  <View style={styles.alertTitleRow}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{c.title}</Text>
                    <PhaseBadge phase={c.phase} lang={lang} severity={c.severity} />
                  </View>
                  <Text style={styles.alertSummary} numberOfLines={2}>{c.summary}</Text>
                  <Text style={styles.alertMeta}>{c.provenance.source} · {timeOnly(c.provenance.issuedAt)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })
        )}

        {/* notification priority */}
        <View style={styles.infoCard}>
          <View style={styles.infoHead}>
            <Text style={{ fontSize: 15 }}>🔔</Text>
            <Text style={styles.infoTitle}>{t(lang, 'notif_priority')}</Text>
          </View>
          <Text style={styles.formula}>{t(lang, 'notif_formula')}</Text>
          <View style={styles.bars}>
            {[
              [L(lang, 'Severity', 'गंभीरता'), hp.pinned.length ? 1 : hp.scenario.warning ? 0.6 : 0.2],
              [L(lang, 'Location', 'स्थान'), 0.9],
              [L(lang, 'Activity', 'गतिविधि'), hp.myDay.some((m) => m.status !== 'go') ? 0.85 : 0.4],
              [L(lang, 'Time', 'समय'), hp.hour >= 6 && hp.hour <= 21 ? 0.8 : 0.3],
              [L(lang, 'Pref.', 'पसंद'), 0.7],
            ].map(([label, v]) => (
              <View key={label} style={styles.barItem}>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: `${(v as number) * 100}%` }]} />
                </View>
                <Text style={styles.barLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.quietHours}>
            {hp.hour >= 22 || hp.hour < 6
              ? L(lang, 'Quiet hours active — only RED alerts break through.', 'शांत समय — केवल रेड अलर्ट आएँगे।')
              : L(lang, 'Quiet hours 10 PM – 6 AM. Red alerts always break through.', 'शांत समय रात 10 – सुबह 6। रेड अलर्ट हमेशा।')}
          </Text>
        </View>

        {/* provider status */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle2}>{t(lang, 'provider_status')}</Text>
          {hp.providers.map((p) => (
            <View key={p.name} style={styles.provRow}>
              <View style={styles.provLeft}>
                <View style={[styles.provDot, { backgroundColor: p.status === 'ok' ? '#10B981' : p.status === 'degraded' ? '#F59E0B' : '#EF4444' }]} />
                <Text style={styles.provName}>{p.name}</Text>
              </View>
              <Text style={styles.provLatency}>{p.status} · {p.latencyMs} ms</Text>
            </View>
          ))}
          <Text style={styles.fallback}>{L(lang, 'Fallback chain: IMD → Open-Meteo → cache. Provenance kept per card.', 'फ़ॉलबैक: IMD → Open-Meteo → कैश। हर कार्ड में स्रोत।')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function timeOnly(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(226,232,240,0.6)', borderRadius: 16, padding: 4, marginTop: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.text },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(148,163,184,0.4)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabCountActive: { backgroundColor: colors.text },
  tabCountText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  emptyText: { fontSize: 12.5, color: colors.textMuted },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#fff', borderRadius: 20, padding: 14, marginTop: 10, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  alertMain: { flex: 1 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  alertTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text, flexShrink: 1 },
  alertSummary: { fontSize: 12, color: '#475569', marginTop: 3, lineHeight: 16 },
  alertMeta: { fontSize: 10.5, color: colors.textSoft, marginTop: 4 },
  chevron: { fontSize: 18, color: colors.textSoft, marginTop: 12 },
  infoCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 14, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  formula: { fontSize: 10.5, color: colors.textMuted, marginTop: 4, fontFamily: 'monospace' },
  bars: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 14 },
  barItem: { flex: 1, alignItems: 'center' },
  barTrack: { width: 12, height: 56, borderRadius: 6, backgroundColor: '#F1F5F9', justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: colors.primary },
  barLabel: { fontSize: 9.5, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  quietHours: { fontSize: 10.5, color: colors.textSoft, marginTop: 12 },
  infoTitle2: { fontSize: 13, fontWeight: '800', color: colors.text, marginBottom: 4 },
  provRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  provLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  provDot: { width: 8, height: 8, borderRadius: 4 },
  provName: { fontSize: 12, fontWeight: '600', color: '#334155' },
  provLatency: { fontSize: 11, color: colors.textSoft, fontFamily: 'monospace' },
  fallback: { fontSize: 10.5, color: colors.textSoft, marginTop: 8 },
});