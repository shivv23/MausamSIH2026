import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BehaviorSignal, Card, Homepage, Lang, PersonaKey } from '../engine';
import { L, PERSONAS, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import { SectionHeader } from '../components/ui';
import { HeroCard, WarningCard, ImpactCard, MyDayCard, BriefCard, HourlyStrip, DailyStrip, HealthScoreCard } from '../components/cards';
import { ExplainSheet } from '../components/ExplainSheet';
import type { DisasterAlertWithPolygon, StalenessInfo } from '../types';

const SYMPTOM_KEY = '@mausam/symptoms';

interface Props {
  hp: Homepage;
  lang: Lang;
  offline: boolean;
  liveFresh?: boolean;
  liveStale?: boolean;
  liveBusy?: boolean;
  activeAlert?: DisasterAlertWithPolygon | null;
  staleness?: StalenessInfo;
  onOpenMyDay: () => void;
  onOpenAlerts: () => void;
  onOpenMe: () => void;
  onOpenMap: () => void;
  onOpenAdmin: () => void;
  onOpenNotifSettings: () => void;
  onOpenAR: () => void;
  onOpenSocial: () => void;
  onRedoOnboarding: () => void;
  onRetry: () => void;
  onCardSignal?: (type: Card['type'], signal: BehaviorSignal) => void;
}

export default function Home({
  hp,
  lang,
  offline,
  liveFresh,
  liveStale,
  liveBusy,
  activeAlert,
  staleness,
  onOpenMyDay,
  onOpenAlerts,
  onOpenMe,
  onOpenMap,
  onOpenAdmin,
  onOpenNotifSettings,
  onOpenAR,
  onOpenSocial,
  onRedoOnboarding,
  onRetry,
  onCardSignal,
}: Props) {
  const [filter, setFilter] = useState<PersonaKey | null>(null);
  const [explaining, setExplaining] = useState<Card | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Card['type'][]>([]);
  const [today, setToday] = useState<string[]>([]);
  const [learnFlash, setLearnFlash] = useState<string | null>(null);

  React.useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(SYMPTOM_KEY).then((raw) => {
      if (raw) {
        try {
          const m = JSON.parse(raw);
          setToday(m[todayKey] ?? []);
        } catch { /* ignore */ }
      }
    });
  }, []);

  const toggleSymptom = (key: string) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const next = today.includes(key) ? today.filter((k) => k !== key) : [...today, key];
    setToday(next);
    AsyncStorage.getItem(SYMPTOM_KEY).then((raw) => {
      const m = raw ? JSON.parse(raw) : {};
      m[todayKey] = next;
      AsyncStorage.setItem(SYMPTOM_KEY, JSON.stringify(m));
    });
  };

  const greetKey =
    hp.hour < 5
      ? 'good_night'
      : hp.hour < 12
      ? 'good_morning'
      : hp.hour < 17
      ? 'good_afternoon'
      : hp.hour < 22
      ? 'good_evening'
      : 'good_night';

  const visible = filter
    ? hp.cards.filter((c) => (c.persona === filter || c.type === 'severe_warning') && !hiddenTypes.includes(c.type))
    : hp.cards.filter((c) => !hiddenTypes.includes(c.type));

  const handleHide = (c: Card) => {
    setHiddenTypes((prev) => (prev.includes(c.type) ? prev : [...prev, c.type]));
    signal(c.type, 'dismiss');
  };
  const signal = (type: Card['type'], s: BehaviorSignal) => {
    onCardSignal?.(type, s);
    setLearnFlash(s === 'tap' ? `${type}|${s}` : `${type}|${s}`);
    clearTimeout(learnTimer.current);
    learnTimer.current = setTimeout(() => setLearnFlash(null), 1800);
  };
  const learnTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const alertCount =
    (activeAlert ? 1 : 0) +
    hp.pinned.length +
    hp.cards.filter((c) => c.phase === 'official' || (c.score !== undefined && c.score < 40)).length;

  const freshnessText =
    staleness
      ? lang === 'hi'
        ? staleness.lastUpdatedLabelHi
        : staleness.lastUpdatedLabel
      : `${t(lang, 'updated')} ${hp.freshness} · IMD · CPCB`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              {t(lang, greetKey)}, {L(lang, hp.user.name, hp.user.nameHi)}
            </Text>
            <View style={styles.updatedRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: offline || liveStale || staleness?.isStale ? '#F59E0B' : '#10B981' },
                ]}
              />
              <Text style={styles.updated}>
                {liveBusy ? t(lang, 'live_refreshing') : freshnessText}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenMap}>
              <Text style={{ fontSize: 18 }}>🗺️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenAdmin}>
              <Text style={{ fontSize: 18 }}>🛠️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={onOpenAlerts}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
              {alertCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{alertCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={onOpenMe}>
              <Text style={styles.avatarText}>{hp.user.name[0]}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline / Staleness Banner (§8.4) */}
        {(offline || liveStale || staleness?.isStale) ? (
          <View style={styles.offlineBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineText}>
                📡 {liveStale && !offline ? t(lang, 'live_stale') : t(lang, 'stale_badge_offline')}
                {liveBusy ? ` · ${t(lang, 'live_refreshing')}` : ''}
              </Text>
              <Text style={styles.offlineSub}>
                {L(lang, 'Showing local cached data · Geofence alerts active', 'स्थानीय कैश डेटा प्रदर्शित · जियोफ़ेंस अलर्ट सक्रिय')}
              </Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
              <Text style={styles.retryText}>{t(lang, 'stale_sync_now')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Live Admin-Triggered Geofenced Alert Banner (§13.2 Step 5) */}
        {activeAlert ? (
          <View
            style={[
              styles.pushCard,
              { borderColor: SEVERITY_COLOR[activeAlert.severity], shadowColor: SEVERITY_COLOR[activeAlert.severity] },
            ]}
          >
            <View style={styles.pushRow}>
              <Text style={[styles.pushApp, { color: SEVERITY_COLOR[activeAlert.severity] }]}>
                {activeAlert.source.toUpperCase()} LIVE ALERT · {activeAlert.region.toUpperCase()}
              </Text>
              <TouchableOpacity style={styles.viewMapPill} onPress={onOpenMap}>
                <Text style={styles.viewMapText}>🗺️ View Geofence →</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.pushTitle}>
              {activeAlert.severity === 'red' ? '🚨' : '⚠️'} {L(lang, activeAlert.headline, activeAlert.headlineHi)}
            </Text>
            <Text style={styles.pushBody} numberOfLines={3}>
              {L(lang, activeAlert.body, activeAlert.bodyHi)}
            </Text>
            <View style={styles.pushActions}>
              {activeAlert.actions.map((a, i) => (
                <View key={i} style={styles.pushActionPill}>
                  <Text style={styles.pushActionText}>
                    ✓ {L(lang, a, activeAlert.actionsHi?.[i] ?? a)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.pushOfficial}>🔒 {t(lang, 'push_official')}</Text>
          </View>
        ) : hp.scenario.warning ? (
          <View style={styles.pushCard}>
            <View style={styles.pushRow}>
              <Text style={styles.pushApp}>MAUSAM · {t(lang, 'push_now')} · {hp.scenario.warning.source}</Text>
              <Text style={styles.pushTime}>{t(lang, 'push_just_now')}</Text>
            </View>
            <Text style={styles.pushTitle}>
              {hp.scenario.warning.severity === 'red' ? '🚨' : '⚠️'}{' '}
              {L(lang, hp.scenario.warning.headline, hp.scenario.warning.headlineHi)}
            </Text>
            <Text style={styles.pushBody} numberOfLines={3}>
              {L(lang, hp.scenario.warning.body, hp.scenario.warning.bodyHi)}
            </Text>
            <View style={styles.pushActions}>
              {hp.scenario.warning.actions.map((a, i) => (
                <View key={i} style={styles.pushActionPill}>
                  <Text style={styles.pushActionText}>
                    ✓ {L(lang, a, hp.scenario.warning?.actionsHi?.[i] ?? a)}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.pushOfficial}>🔒 {t(lang, 'push_official')}</Text>
          </View>
        ) : null}

        {/* Hero Current Weather Card */}
        <HeroCard hp={hp} lang={lang} />

        {/* Composite Daily Health Score + symptom logging */}
        <HealthScoreCard hp={hp} lang={lang} today={today} onToggleSymptom={toggleSymptom} />

        {/* Behavior-learning hint */}
        {learnFlash ? (
          <View style={styles.learnHint}>
            <Text style={styles.learnHintText}>
              🧠 {learnFlash.endsWith('|tap') ? t(lang, 'learn_boosted') : t(lang, 'learn_dismissed')}
            </Text>
          </View>
        ) : null}

        {/* Pinned Warnings */}
        {hp.pinned.map((c) => (
          <WarningCard key={c.id} card={c} lang={lang} onExplain={setExplaining} onSignal={signal} />
        ))}

        {/* Persona Filter Chips */}
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
                  style={[
                    styles.personaChip,
                    active
                      ? { backgroundColor: m.color, borderColor: m.color }
                      : { backgroundColor: '#fff', borderColor: `${m.color}44` },
                  ]}
                  onPress={() => setFilter(active ? null : p)}
                >
                  <Text style={[styles.personaChipTextM, { color: active ? '#fff' : m.color }]}>
                    {m.icon} {L(lang, m.label, m.labelHi)}
                    {i === 0 ? ' ★' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Ranked Decision-Support Cards */}
        <View style={styles.cards}>
          {visible.slice(0, 2).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i} onSignal={signal} />
          ))}
          {hp.myDay.length > 0 ? <MyDayCard items={hp.myDay} lang={lang} onOpen={onOpenMyDay} /> : null}
          {visible.slice(2, 4).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i + 2} onSignal={signal} />
          ))}
          <BriefCard text={hp.brief} lang={lang} />
          {visible.slice(4).map((c, i) => (
            <ImpactCard key={c.id} card={c} lang={lang} onExplain={setExplaining} rank={i + 4} onSignal={signal} />
          ))}
          <HourlyStrip hp={hp} lang={lang} />
          <DailyStrip hp={hp} lang={lang} />
        </View>

        {/* Action Shortcuts */}
        <View style={styles.features}>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenMap}>
            <Text style={styles.featIcon}>🗺️</Text>
            <Text style={styles.featText}>{t(lang, 'nav_map')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenAR}>
            <Text style={styles.featIcon}>🔭</Text>
            <Text style={styles.featText}>{t(lang, 'ar_launch')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenSocial}>
            <Text style={styles.featIcon}>💬</Text>
            <Text style={styles.featText}>{t(lang, 'social_launch')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.featBtn} onPress={onOpenNotifSettings}>
            <Text style={styles.featIcon}>⚙️</Text>
            <Text style={styles.featText}>{t(lang, 'notifications')}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
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
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  updated: { fontSize: 11.5, color: colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  offlineText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  offlineSub: { fontSize: 10.5, color: '#B45309', marginTop: 1 },
  retryBtn: { backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  learnHint: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    shadowColor: '#16A34A',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  learnHintText: { fontSize: 12, fontWeight: '800', color: '#166534' },
  pushCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pushRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pushApp: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  pushTime: { fontSize: 10, color: colors.textSoft },
  viewMapPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  viewMapText: { fontSize: 10, fontWeight: '700', color: colors.primary },
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
  features: { flexDirection: 'row', gap: 8, marginTop: 18 },
  featBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    gap: 3,
  },
  featIcon: { fontSize: 18 },
  featText: { fontSize: 10.5, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
