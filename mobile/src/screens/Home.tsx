import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Card, Homepage, Lang, PersonaKey } from '../engine';
import { L, PERSONAS } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import { SectionHeader } from '../components/ui';
import { HeroCard, WarningCard, ImpactCard, MyDayCard, BriefCard, HourlyStrip, DailyStrip } from '../components/cards';
import { ExplainSheet } from '../components/ExplainSheet';

interface Props {
  hp: Homepage;
  lang: Lang;
  offline: boolean;
  liveFresh?: boolean;
  liveStale?: boolean;
  liveBusy?: boolean;
  onOpenMyDay: () => void;
  onOpenAlerts: () => void;
  onOpenMe: () => void;
  onOpenAR: () => void;
  onOpenSocial: () => void;
  onRedoOnboarding: () => void;
  onRetry: () => void;
}

export default function Home({ hp, lang, offline, liveFresh, liveStale, liveBusy, onOpenMyDay, onOpenAlerts, onOpenMe, onOpenAR, onOpenSocial, onRedoOnboarding, onRetry }: Props) {
  const [filter, setFilter] = useState<PersonaKey | null>(null);
  const [explaining, setExplaining] = useState<Card | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Card['type'][]>([]);

  const greetKey = hp.hour < 5 ? 'good_night' : hp.hour < 12 ? 'good_morning' : hp.hour < 17 ? 'good_afternoon' : hp.hour < 22 ? 'good_evening' : 'good_night';
  const visible = filter
    ? hp.cards.filter((c) => (c.persona === filter || c.type === 'severe_warning') && !hiddenTypes.includes(c.type))
    : hp.cards.filter((c) => !hiddenTypes.includes(c.type));
  const handleHide = (c: Card) => setHiddenTypes((prev) => (prev.includes(c.type) ? prev : [...prev, c.type]));
  const alertCount = hp.pinned.length + hp.cards.filter((c) => c.phase === 'official' || (c.score !== undefined && c.score < 40)).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t(lang, greetKey)}, {L(lang, hp.user.name, hp.user.nameHi)}</Text>
            <View style={styles.updatedRow}>
              <View style={[styles.dot, { backgroundColor: offline ? '#F59E0B' : liveStale ? '#F59E0B' : '#10B981' }]} />
              <Text style={styles.updated}>
                {liveBusy ? t(lang, 'live_refreshing') : liveStale ? t(lang, 'live_stale') : t(lang, 'live_source')} · {hp.freshness}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenAlerts}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {alertCount > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeText}>{alertCount}</Text></View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={onOpenMe}>
              <Text style={styles.avatarText}>{hp.user.name[0]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {(offline || liveStale) ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              📡 {offline ? t(lang, 'offline_banner') : t(lang, 'live_stale')} · {hp.freshness}{liveBusy ? ` · ${t(lang, 'live_refreshing')}` : ''}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}><Text style={styles.retryText}>{t(lang, 'offline_retry')}</Text></TouchableOpacity>
          </View>
        ) : null}

        {/* simulated official push notification */}
        {hp.scenario.warning ? (
          <View style={styles.pushCard}>
            <View style={styles.pushRow}>
              <Text style={styles.pushApp}>MAUSAM · {t(lang, 'push_now')} · {hp.scenario.warning.source}</Text>
              <Text style={styles.pushTime}>{t(lang, 'push_just_now')}</Text>
            </View>
            <Text style={styles.pushTitle}>
              {hp.scenario.warning.severity === 'red' ? '🚨' : '⚠️'} {L(lang, hp.scenario.warning.headline, hp.scenario.warning.headlineHi)}
            </Text>
            <Text style={styles.pushBody} numberOfLines={3}>{L(lang, hp.scenario.warning.body, hp.scenario.warning.bodyHi)}</Text>
            <View style={styles.pushActions}>
              {hp.scenario.warning.actions.map((a, i) => (
                <View key={i} style={styles.pushActionPill}><Text style={styles.pushActionText}>✓ {L(lang, a, hp.scenario.warning?.actionsHi?.[i] ?? a)}</Text></View>
              ))}
            </View>
            <Text style={styles.pushOfficial}>🔒 {t(lang, 'push_official')}</Text>
          </View>
        ) : null}

        <HeroCard hp={hp} lang={lang} />

        {hp.pinned.map((c) => (
          <WarningCard key={c.id} card={c} lang={lang} onExplain={setExplaining} />
        ))}

        {/* persona chips */}
        <View style={{ marginTop: 4 }}>
          <SectionHeader title={t(lang, 'for_you')} sub={t(lang, 'ranked_by')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBar}>
            <TouchableOpacity
              style={[styles.personaChip, !filter ? styles.chipActiveDark : styles.chipInactive]}
              onPress={() => setFilter(null)}
            >
              <Text style={!filter ? styles.chipTextWhite : styles.chipTextDark}>{L(lang, 'All', 'सभी')}</Text>
            </TouchableOpacity>
            {hp.user.personas.map((p, i) => {
              const m = PERSONAS[p];
              const active = filter === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.personaChip, active ? { backgroundColor: m.color, borderColor: m.color } : { backgroundColor: '#fff', borderColor: `${m.color}44` }]}
                  onPress={() => setFilter(active ? null : p)}
                >
                  <Text style={[styles.personaChipTextM, { color: active ? '#fff' : m.color }]}>
                    {m.icon} {L(lang, m.label, m.labelHi)}{i === 0 ? ' ★' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ranked cards */}
        <View style={styles.cards}>
          {visible.slice(0, 2).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i} />
          ))}
          {hp.myDay.length > 0 ? <MyDayCard items={hp.myDay} lang={lang} onOpen={onOpenMyDay} /> : null}
          {visible.slice(2, 4).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i + 2} />
          ))}
          <BriefCard text={hp.brief} lang={lang} />
          {visible.slice(4).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i + 4} />
          ))}
          <HourlyStrip hp={hp} lang={lang} />
          <DailyStrip hp={hp} lang={lang} />
        </View>

        <View style={styles.features}>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenAR}>
            <Text style={styles.featIcon}>🔭</Text>
            <Text style={styles.featText}>{t(lang, 'ar_launch')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenSocial}>
            <Text style={styles.featIcon}>💬</Text>
            <Text style={styles.featText}>{t(lang, 'social_launch')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTrust}>{t(lang, 'footer_trust')}</Text>
          <Pressable onPress={onRedoOnboarding}>
            <Text style={styles.report}>🚩 {t(lang, 'report')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ExplainSheet card={explaining} lang={lang} onClose={() => setExplaining(null)} onHide={handleHide} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  updated: { fontSize: 11.5, color: colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)' },
  badge: { position: 'absolute', right: -2, top: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  offlineText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },
  retryBtn: { backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  retryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pushCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  pushRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pushApp: { fontSize: 10.5, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  pushTime: { fontSize: 10, color: colors.textSoft },
  pushTitle: { fontSize: 14, fontWeight: '800', color: colors.text, lineHeight: 19 },
  pushBody: { fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 17 },
  pushActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pushActionPill: { backgroundColor: '#FEE2E2', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  pushActionText: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  pushOfficial: { marginTop: 10, fontSize: 10, fontWeight: '600', color: '#047857' },
  chipBar: { paddingRight: 16, gap: 8, paddingBottom: 4 },
  personaChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipActiveDark: { backgroundColor: colors.text, borderColor: colors.text },
  chipInactive: { backgroundColor: '#fff', borderColor: '#E2E8F0' },
  chipTextWhite: { color: '#fff', fontSize: 11.5, fontWeight: '700' },
  chipTextDark: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  personaChipTextM: { fontSize: 11.5, fontWeight: '700' },
  cards: { marginTop: 6, gap: 14 },
  footer: { alignItems: 'center', paddingTop: 16 },
  footerTrust: { fontSize: 10.5, textAlign: 'center', color: colors.textSoft, lineHeight: 15 },
  report: { marginTop: 8, fontSize: 11, fontWeight: '700', color: colors.textMuted },
  features: { flexDirection: 'row', gap: 10, marginTop: 18 },
  featBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)', gap: 4 },
  featIcon: { fontSize: 20 },
  featText: { fontSize: 11.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
});