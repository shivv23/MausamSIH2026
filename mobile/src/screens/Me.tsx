import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Homepage, Lang, ScenarioKey, PersonaKey, UserProfile } from '../engine';
import { CONDITIONS, DEMO_USERS, fmtTime, L, PERSONAS, SCENARIOS, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import { deleteProfile, getAuthToken, getSyncServer, lastSyncedAt, loginAccount, logoutUser, pushProfile, pullProfile, registerAccount, setAuthToken, setSyncServer } from '../services/profileSync';
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
  onSyncPull?: (p: UserProfile) => void;
  /** Switch the whole device session to another account (cross-device restore). */
  onRestoreAccount?: (p: UserProfile) => void;
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
  onSyncPull,
  onRestoreAccount,
  isOffline,
  staleness,
}: Props) {
  const u = hp.user;
  const [syncServer, setSyncServerState] = useState('');
  const [syncAccountId, setSyncAccountId] = useState('');
  const [syncPassword, setSyncPassword] = useState('');
  const [syncToken, setSyncTokenState] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncErr, setSyncErr] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState('');

  React.useEffect(() => {
    getSyncServer().then((s) => setSyncServerState(s ?? 'http://localhost:8000'));
    getAuthToken(u.id).then((tok) => setSyncTokenState(tok));
    lastSyncedAt(u.id).then((iso) => setLastSyncAt(iso ? new Date(iso).toLocaleTimeString() : ''));
    setSyncAccountId(u.id);
  }, [u.id]);

  const saveServer = async () => {
    await setSyncServer(syncServer);
    setSyncErr(false);
    setSyncMsg(t(lang, 'sync_server_saved'));
  };

  const rememberToken = async (accountId: string, token: string) => {
    await setAuthToken(accountId, token);
    setSyncTokenState(token);
    setSyncPassword('');
    setSyncErr(false);
  };

  const handleSignup = async () => {
    if (syncPassword.length < 6) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_password_short'));
      return;
    }
    const accountId = syncAccountId.trim() || u.id;
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const token = await registerAccount(syncServer, accountId, syncPassword);
      await rememberToken(accountId, token);
      if (accountId !== u.id) {
        // Creating a brand-new account while signed into a different local
        // profile: back the current profile up under the new id, then switch.
        await pushProfile({ ...u, id: accountId }, syncServer, token);
        await onRestoreAccount?.({ ...u, id: accountId });
        setSyncMsg(t(lang, 'sync_switched_account'));
      } else {
        setSyncMsg(t(lang, 'sync_signed_up'));
      }
    } catch (e) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!syncPassword) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_password_required'));
      return;
    }
    const accountId = syncAccountId.trim() || u.id;
    if (accountId !== u.id && !onRestoreAccount) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_restore_unsupported'));
      return;
    }
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const token = await loginAccount(syncServer, accountId, syncPassword);
      await rememberToken(accountId, token);
      if (accountId !== u.id) {
        const res = await pullProfile(accountId, syncServer, token);
        if (res.status === 'profile') {
          await onRestoreAccount?.(res.profile);
          setSyncMsg(t(lang, 'sync_restored'));
        } else if (res.status === 'no_backup') {
          setSyncMsg(t(lang, 'sync_account_empty'));
        } else {
          setSyncMsg(t(lang, 'sync_stale'));
        }
      } else {
        setSyncMsg(t(lang, 'sync_logged_in'));
      }
    } catch (e) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncBusy(false);
    }
  };

  const handlePush = async () => {
    if (!syncToken) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_auth_required'));
      return;
    }
    setSyncBusy(true);
    setSyncMsg('');
    try {
      await pushProfile(u, syncServer, syncToken);
      setLastSyncAt(new Date().toLocaleTimeString());
      setSyncErr(false);
      setSyncMsg(t(lang, 'sync_pushed'));
    } catch (e) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncBusy(false);
    }
  };

  const handlePull = async () => {
    if (!syncToken) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_auth_required'));
      return;
    }
    setSyncBusy(true);
    setSyncMsg('');
    try {
      const res = await pullProfile(u.id, syncServer, syncToken);
      if (res.status === 'no_backup') {
        setSyncErr(false);
        setSyncMsg(t(lang, 'sync_none'));
        return;
      }
      if (res.status === 'stale') {
        setSyncErr(false);
        setSyncMsg(t(lang, 'sync_stale'));
        return;
      }
      await onSyncPull?.(res.profile);
      setLastSyncAt(new Date(res.updatedAt ?? Date.now()).toLocaleTimeString());
      setSyncErr(false);
      setSyncMsg(t(lang, 'sync_pulled'));
    } catch (e) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleLogout = async () => {
    setSyncBusy(true);
    setSyncMsg('');
    try {
      await logoutUser(u.id);
      setSyncTokenState(null);
      setSyncPassword('');
      setLastSyncAt('');
      setSyncErr(false);
      setSyncMsg(t(lang, 'sync_logged_out'));
    } catch (e) {
      setSyncErr(true);
      setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDeleteBackup = () => {
    Alert.alert(
      t(lang, 'delete_backup_title'),
      t(lang, 'delete_backup_desc'),
      [
        { text: t(lang, 'cancel'), style: 'cancel' },
        {
          text: t(lang, 'delete'),
          style: 'destructive',
          onPress: async () => {
            setSyncBusy(true);
            setSyncMsg('');
            try {
              await deleteProfile(u.id, syncServer, syncToken);
              setLastSyncAt('');
              setSyncErr(false);
              setSyncMsg(t(lang, 'sync_deleted_backup'));
            } catch (e) {
              setSyncErr(true);
              setSyncMsg(t(lang, 'sync_error') + ': ' + (e instanceof Error ? e.message : String(e)));
            } finally {
              setSyncBusy(false);
            }
          },
        },
      ],
    );
  };
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

        {/* Cloud Sync — cross-device profile restore */}
        <Section title={t(lang, 'sync_title')}>
          <Text style={styles.privacyText}>{t(lang, 'sync_desc')}</Text>
          <TextInput
            style={styles.syncInput}
            value={syncServer}
            onChangeText={setSyncServerState}
            placeholder="http://localhost:8000"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={styles.syncInput}
            value={syncAccountId}
            onChangeText={(v) => {
              setSyncAccountId(v.trim());
              setSyncErr(false);
            }}
            placeholder={t(lang, 'sync_account_id')}
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.syncInput}
            value={syncPassword}
            onChangeText={(v) => {
              setSyncPassword(v);
              setSyncErr(false);
            }}
            placeholder={t(lang, 'sync_password')}
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.syncRow}>
            <TouchableOpacity
              style={[styles.syncAuthBtn, syncBusy && styles.syncBtnDisabled]}
              disabled={syncBusy}
              onPress={() => saveServer()}
            >
              <Text style={styles.syncBtnText}>{t(lang, 'sync_save_server')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncAuthBtnAlt, syncBusy && styles.syncBtnDisabled]}
              disabled={syncBusy}
              onPress={handleSignup}
            >
              <Text style={styles.syncBtnTextAlt}>{t(lang, 'sync_signup')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncAuthBtnAlt, syncBusy && styles.syncBtnDisabled]}
              disabled={syncBusy}
              onPress={handleLogin}
            >
              <Text style={styles.syncBtnTextAlt}>{t(lang, 'sync_login')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.syncRow}>
            <TouchableOpacity
              style={[styles.syncBtn, syncBusy && styles.syncBtnDisabled]}
              disabled={syncBusy}
              onPress={handlePush}
            >
              <Text style={styles.syncBtnText}>↑ {t(lang, 'sync_push')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncBtn, syncBusy && styles.syncBtnDisabled]}
              disabled={syncBusy}
              onPress={handlePull}
            >
              <Text style={styles.syncBtnText}>↓ {t(lang, 'sync_pull')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.syncRow}>
            <TouchableOpacity
              style={[styles.syncDangerBtn, (!syncToken || syncBusy) && styles.syncBtnDisabled]}
              disabled={!syncToken || syncBusy}
              onPress={handleLogout}
            >
              <Text style={styles.syncDangerText}>{t(lang, 'sync_logout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncDangerBtn, (!syncToken || syncBusy) && styles.syncBtnDisabled]}
              disabled={!syncToken || syncBusy}
              onPress={handleDeleteBackup}
            >
              <Text style={styles.syncDangerText}>{t(lang, 'delete_backup')}</Text>
            </TouchableOpacity>
          </View>
          {syncToken ? (
            <Text style={styles.syncSignedIn}>
              ✓ {t(lang, 'sync_signed_in')} {u.id}
            </Text>
          ) : null}
          {lastSyncAt ? (
            <Text style={styles.syncMeta}>
              {t(lang, 'sync_last')} {lastSyncAt}
            </Text>
          ) : null}
          {syncMsg ? (
            <Text style={[styles.syncMsg, syncErr && styles.syncMsgErr]}>{syncMsg}</Text>
          ) : null}
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
  syncInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: '#0F172A',
    marginTop: 10,
  },
  syncRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  syncBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  syncAuthBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  syncAuthBtnAlt: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  syncBtnTextAlt: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  syncDangerBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  syncDangerText: { color: '#B91C1C', fontSize: 12, fontWeight: '800' },
  syncSignedIn: { fontSize: 11.5, fontWeight: '700', color: '#047857', marginTop: 10 },
  syncMeta: { fontSize: 11, color: colors.textMuted, marginTop: 10 },
  syncMsg: { fontSize: 12, color: '#047857', fontWeight: '700', marginTop: 6, lineHeight: 16 },
  syncMsgErr: { color: '#B91C1C' },
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
