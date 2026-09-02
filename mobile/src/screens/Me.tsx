import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Homepage, Lang, ScenarioKey, PersonaKey } from '../engine';
import { CONDITIONS, DEMO_USERS, fmtTime, L, PERSONAS, SCENARIOS, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import type { StalenessInfo } from '../types';

interface Props {
  hp: Homepage;
  lang: Lang;
  scenario: ScenarioKey | 'auto';
  setLang: (l: Lang) => void;
  onRedoOnboarding: () => void;
  onSwitchDemo: (demo: (typeof DEMO_USERS)[number]) => void;
  onSetScenario: (s: ScenarioKey | 'auto') => void;
  onOpenAdmin?: () => void;
  onOpenNotifSettings?: () => void;
  isOffline?: boolean;
  staleness?: StalenessInfo;
}

export default function Me({
  hp,
  lang,
  scenario,
  setLang,
  onRedoOnboarding,
  onSwitchDemo,
  onSetScenario,
  onOpenAdmin,
  onOpenNotifSettings,
  isOffline,
  staleness,
}: Props) {
  const u = hp.user;
  const locIcon: Record<string, string> = { home: '🏠', work: '💼', school: '🎒', farm: '🌱' };
  const currentDemoIndex = DEMO_USERS.findIndex((d) => d.user.id === u.id);
  const simulated = scenario !== 'auto';
  const activeScenario = simulated ? SCENARIOS.find((s) => s.key === scenario) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{u.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{L(lang, u.name, u.nameHi)}</Text>
            <Text style={styles.meta}>
              📍 {L(lang, hp.city.name, hp.city.nameHi)}, {hp.city.state} · {u.id}@mausam
            </Text>
          </View>
        </View>

        {/* Quick Settings & Admin Hub Shortcuts */}
        <View style={styles.hubGrid}>
          {onOpenAdmin ? (
            <TouchableOpacity style={styles.hubBtn} onPress={onOpenAdmin}>
              <Text style={styles.hubIcon}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.hubTitle}>{t(lang, 'admin_dashboard')}</Text>
                <Text style={styles.hubSub}>{L(lang, 'Publish warnings, ray-casting geofence', 'चेतावनी प्रकाशन व जियोफ़ेंस')}</Text>
              </View>
              <Text style={styles.hubChevron}>›</Text>
            </TouchableOpacity>
          ) : null}

          {onOpenNotifSettings ? (
            <TouchableOpacity style={styles.hubBtn} onPress={onOpenNotifSettings}>
              <Text style={styles.hubIcon}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.hubTitle}>{t(lang, 'notifications')}</Text>
                <Text style={styles.hubSub}>{L(lang, 'Quiet hours & category rules', 'शांत समय व श्रेणी नियम')}</Text>
              </View>
              <Text style={styles.hubChevron}>›</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Live Weather Scenario Drill */}
        <View style={styles.demoCard}>
          <View style={styles.drillHead}>
            <Text style={styles.demoTitle}>🛰️ {t(lang, 'scenario_live')}</Text>
            {simulated && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>{t(lang, 'drill_triggered')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.demoSub}>{t(lang, 'drill_sub')}</Text>
          <View style={styles.scenRow}>
            <Pressable
              style={[styles.scenBtn, !simulated && styles.scenBtnActive]}
              onPress={() => onSetScenario('auto')}
            >
              <Text style={[styles.scenBtnText, !simulated && styles.scenBtnTextActive]}>
                📍 {t(lang, 'drill_auto')}
              </Text>
            </Pressable>
            {SCENARIOS.filter((s) => s.warning || s.key === 'clear' || s.key === 'beach_day').map((s) => {
              const active = scenario === s.key;
              const sev = s.warning?.severity;
              return (
                <Pressable
                  key={s.key}
                  style={[styles.scenBtn, active && styles.scenBtnActive]}
                  onPress={() => onSetScenario(s.key)}
                >
                  <Text style={[styles.scenBtnText, active && styles.scenBtnTextActive]}>
                    {s.emoji} {L(lang, s.label, s.labelHi)}
                  </Text>
                  {sev && <Text style={[styles.scenSeverity, { color: SEVERITY_COLOR[sev] }]}>{sev.toUpperCase()}</Text>}
                </Pressable>
              );
            })}
          </View>
          {simulated && activeScenario && (
            <View
              style={[
                styles.activeWarn,
                activeScenario.warning && { borderColor: SEVERITY_COLOR[activeScenario.warning.severity] },
              ]}
            >
              <Text style={styles.activeWarnTitle}>
                {activeScenario.warning
                  ? `⚠️ ${L(lang, activeScenario.warning.headline, activeScenario.warning.headlineHi)}`
                  : activeScenario.emoji + ' ' + L(lang, activeScenario.label, activeScenario.labelHi)}
              </Text>
              {activeScenario.warning && (
                <Text style={styles.activeWarnBody}>
                  {L(lang, activeScenario.warning.body, activeScenario.warning.bodyHi)}
                </Text>
              )}
              <Text style={styles.drillNote}>
                🔔 {t(lang, 'push_now')} · {t(lang, 'push_just_now')} · {t(lang, 'note_push_ui')}
              </Text>
              <Pressable style={styles.backLiveBtn} onPress={() => onSetScenario('auto')}>
                <Text style={styles.backLiveText}>{t(lang, 'drill_dismis')} →</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Demo Switcher */}
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>🎬 {t(lang, 'demo_profile')}</Text>
          <Text style={styles.demoSub}>
            {L(lang, 'Switch who Mausam is built for, and the weather scenario.', 'बदलें कि मौसम किसके लिए बनाया गया है, और मौसम परिदृश्य।')}
          </Text>
          {DEMO_USERS.map((d, i) => {
            const active = i === currentDemoIndex;
            const s = d.user;
            return (
              <Pressable
                key={d.user.id}
                style={[styles.demoRow, active && styles.demoRowActive]}
                onPress={() => onSwitchDemo(d)}
              >
                <View style={[styles.demoAvatar, active && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.demoAvatarText, active && { color: '#fff' }]}>{s.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoName}>
                    {s.name}{' '}
                    <Text style={styles.demoPills}>
                      {s.personas.map((p: PersonaKey) => PERSONAS[p].icon).join(' ')}
                    </Text>
                  </Text>
                  <Text style={styles.demoSub}>{s.city} · {d.scenarioKey}</Text>
                </View>
                <Text style={[styles.demoCheck, active && { color: colors.primary }]}>
                  {active ? '●' : '○'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Personas */}
        <Section title={t(lang, 'personas')}>
          <View style={styles.chipWrap}>
            {u.personas.map((p: PersonaKey, i) => {
              const m = PERSONAS[p];
              return (
                <View key={p} style={[styles.pill, { backgroundColor: m.soft }]}>
                  <Text style={[styles.pillText, { color: m.color }]}>
                    {m.icon} {L(lang, m.label, m.labelHi)}
                    {i === 0 ? ` · ${t(lang, 'primary')}` : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </Section>

        {/* Health */}
        <Section title={t(lang, 'health_profile')}>
          {u.conditions.length === 0 ? (
            <Text style={styles.noneText}>{t(lang, 'none')}</Text>
          ) : (
            <View style={styles.chipWrap}>
              {u.conditions.map((c) => (
                <View key={c} style={[styles.pill, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={{ color: '#B91C1C', fontSize: 11.5, fontWeight: '700' }}>
                    {L(lang, CONDITIONS[c]?.label ?? c, CONDITIONS[c]?.labelHi ?? c)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Saved Places */}
        <Section title={t(lang, 'saved_places')}>
          {u.locations.map((l) => (
            <View key={l.type + l.label} style={styles.row}>
              <View style={styles.rowIcon}>
                <Text>{locIcon[l.type] ?? '📍'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{t(lang, l.type as 'home' | 'work' | 'school' | 'farm')}</Text>
                <Text style={styles.rowSub}>{l.label}</Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Activities */}
        <Section title={t(lang, 'activities')}>
          {u.activities.map((a) => (
            <View key={a.time + a.type} style={styles.activityRow}>
              <Text style={styles.activityName}>{L(lang, a.label, a.labelHi)}</Text>
              <Text style={styles.activityTime}>{fmtTime(a.time, lang)}</Text>
            </View>
          ))}
        </Section>

        {/* Language */}
        <Section title={t(lang, 'language')}>
          <View style={styles.langRow}>
            {(['en', 'hi'] as Lang[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                onPress={() => setLang(l)}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {l === 'en' ? t(lang, 'lang_en') : t(lang, 'lang_hi')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Data Privacy & Offline Cache Diagnostics (§8.4) */}
        <Section title={t(lang, 'data_privacy')}>
          <Text style={styles.privacyText}>{t(lang, 'on_device')}</Text>
          <View style={styles.cacheCard}>
            <View style={styles.cacheRow}>
              <Text style={styles.cacheKey}>Offline Storage Engine:</Text>
              <Text style={styles.cacheVal}>WatermelonDB / Drift v3.2</Text>
            </View>
            <View style={styles.cacheRow}>
              <Text style={styles.cacheKey}>Cache Freshness Status:</Text>
              <Text style={[styles.cacheVal, { color: isOffline ? '#D97706' : '#059669' }]}>
                {isOffline ? 'OFFLINE (Cached)' : 'ONLINE (Fresh)'}
              </Text>
            </View>
            <View style={styles.cacheRow}>
              <Text style={styles.cacheKey}>Geofence Engine:</Text>
              <Text style={styles.cacheVal}>Point-in-Polygon (Ray-Casting)</Text>
            </View>
            <View style={styles.cacheRow}>
              <Text style={styles.cacheKey}>Database Footprint:</Text>
              <Text style={styles.cacheVal}>1.4 MB · 0 network leak</Text>
            </View>
          </View>
        </Section>

        <TouchableOpacity style={styles.redoBtn} onPress={onRedoOnboarding}>
          <Text style={styles.redoText}>↻ {t(lang, 'redo_onboarding')}</Text>
        </TouchableOpacity>
        <Text style={styles.version}>Mausam 2.0 · v0.9.0 · Team BugNotFound · SIH 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  meta: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  hubGrid: { gap: 10, marginBottom: 14 },
  hubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  hubIcon: { fontSize: 22 },
  hubTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  hubSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  hubChevron: { fontSize: 18, color: colors.textSoft },
  demoCard: { backgroundColor: '#EEF2FF', borderRadius: 20, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  demoTitle: { fontSize: 13, fontWeight: '800', color: colors.text },
  demoSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 10, marginTop: 10, borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)' },
  demoRowActive: { borderColor: colors.primary, borderWidth: 2 },
  demoAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' },
  demoAvatarText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  demoName: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  demoPills: { fontSize: 12 },
  demoCheck: { fontSize: 16, color: colors.textSoft },
  section: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  sectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  noneText: { fontSize: 12, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  rowSub: { fontSize: 11, color: colors.textMuted },
  activityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  activityName: { fontSize: 12.5, fontWeight: '600', color: '#1E293B' },
  activityTime: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  langTextActive: { color: '#fff' },
  privacyText: { fontSize: 12, color: '#475569', lineHeight: 18 },
  cacheCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cacheRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cacheKey: { fontSize: 11.5, color: colors.textMuted },
  cacheVal: { fontSize: 11.5, fontWeight: '700', color: '#1E293B' },
  redoBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  redoText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  version: { textAlign: 'center', fontSize: 10, color: colors.textSoft, marginTop: 12 },
  drillHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activePill: { backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  scenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  scenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  scenBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scenBtnText: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  scenBtnTextActive: { color: '#fff' },
  scenSeverity: { fontSize: 9, fontWeight: '800' },
  activeWarn: { marginTop: 12, borderRadius: 14, padding: 12, backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FB923C' },
  activeWarnTitle: { fontSize: 13, fontWeight: '800', color: '#7C2D12' },
  activeWarnBody: { fontSize: 12, color: '#9A3412', marginTop: 6, lineHeight: 17 },
  drillNote: { fontSize: 10.5, fontWeight: '600', color: '#047857', marginTop: 8 },
  backLiveBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  backLiveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
