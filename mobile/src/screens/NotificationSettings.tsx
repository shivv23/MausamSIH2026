import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Lang } from '../engine';
import { L } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import type { NotificationSettings } from '../types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';
import {
  loadNotificationSettings,
  saveNotificationSettings,
  dispatchAlertNotification,
} from '../services/notifications';

interface Props {
  lang: Lang;
  onClose: () => void;
}

export default function NotificationSettingsModal({ lang, onClose }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
  }, []);

  const update = (partial: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const updateCategory = (key: keyof NotificationSettings['categories'], val: boolean) => {
    const updated: NotificationSettings = {
      ...settings,
      categories: { ...settings.categories, [key]: val },
    };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const triggerTestNotification = async () => {
    setTestSent(true);
    await dispatchAlertNotification({
      title: lang === 'hi' ? '🚨 IMD ऑरेंज चेतावनी: भारी बारिश' : '🚨 IMD Orange Alert: Heavy Rain Approaching',
      body: lang === 'hi'
        ? 'पुणे में अगले 2 घंटों में 45 मिमी/घंटा बारिश का अनुमान। निचले इलाकों से बचें।'
        : 'Intense rain bands (45 mm/h) moving across Pune. Allow 30m extra for travel.',
      severity: 'orange',
      category: 'severeWarnings',
      settings,
    });
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t(lang, 'notif_settings_title')}</Text>
            <Text style={styles.sub}>{L(lang, 'Alert Orchestrator · Real-time push rules', 'अलर्ट आर्केस्ट्रेटर · रियल-टाइम पुश नियम')}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Master Push Toggle */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{t(lang, 'notif_master')}</Text>
                <Text style={styles.cardSub}>
                  {L(lang, 'Receive instant weather hazard alerts & daily briefings', 'मौसम चेतावनियाँ व दैनिक सारांश प्राप्त करें')}
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(val) => update({ enabled: val })}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>
          </View>

          {/* Quiet Hours Section */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>🌙 {t(lang, 'notif_quiet_hours')}</Text>
                <Text style={styles.cardSub}>{t(lang, 'notif_quiet_desc')}</Text>
              </View>
              <Switch
                value={settings.quietHoursEnabled}
                onValueChange={(val) => update({ quietHoursEnabled: val })}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>

            {settings.quietHoursEnabled ? (
              <>
                <View style={styles.quietTimeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>{L(lang, 'Start', 'शुरुआत')}</Text>
                    <Text style={styles.timeValue}>{settings.quietHoursStart}</Text>
                  </View>
                  <Text style={styles.timeArrow}>→</Text>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>{L(lang, 'End', 'समाप्ति')}</Text>
                    <Text style={styles.timeValue}>{settings.quietHoursEnd}</Text>
                  </View>
                </View>

                <View style={styles.bypassBadge}>
                  <Text style={styles.bypassIcon}>🛡️</Text>
                  <Text style={styles.bypassText}>
                    {t(lang, 'notif_red_bypass')}
                    {L(
                      lang,
                      ' (Life-safety guarantee: official cyclone/flood red warnings override quiet hours).',
                      ' (सुरक्षा गारंटी: चक्रवात/बाढ़ की रेड चेतावनी शांत समय को बायपास करेगी)।'
                    )}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* Category Toggles */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>{L(lang, 'ALERT CATEGORIES', 'अलर्ट श्रेणियाँ')}</Text>

            <CategoryRow
              icon="🚨"
              title={t(lang, 'notif_cat_severe')}
              sub={L(lang, 'IMD Red / Orange color-coded bulletins', 'IMD रेड / ऑरेंज रंग-कोडेड बुलेटिन')}
              value={settings.categories.severeWarnings}
              onChange={(v) => updateCategory('severeWarnings', v)}
              locked
            />

            <CategoryRow
              icon="🫁"
              title={t(lang, 'notif_cat_aqi')}
              sub={L(lang, `Spikes above AQI ${settings.aqiThreshold} (CPCB & NCAP)`, `AQI ${settings.aqiThreshold} से ऊपर उछाल`)}
              value={settings.categories.aqiHealth}
              onChange={(v) => updateCategory('aqiHealth', v)}
            />

            <CategoryRow
              icon="🚗"
              title={t(lang, 'notif_cat_rain')}
              sub={L(lang, `Rain probability > ${settings.rainProbabilityThreshold}% before commute`, `सफ़र से पहले बारिश की संभावना > ${settings.rainProbabilityThreshold}%`)}
              value={settings.categories.rainCommute}
              onChange={(v) => updateCategory('rainCommute', v)}
            />

            <CategoryRow
              icon="🌾"
              title={t(lang, 'notif_cat_farm')}
              sub={L(lang, 'Ground frost & irrigation windows (Agromet)', 'पाला व सिंचाई समय (एग्रोमेट)')}
              value={settings.categories.farmingFrost}
              onChange={(v) => updateCategory('farmingFrost', v)}
            />

            <CategoryRow
              icon="🏖️"
              title={t(lang, 'notif_cat_marine')}
              sub={L(lang, 'High tides & rough wave warnings (INCOIS)', 'ऊँची लहरें व समुद्र चेतावनी (INCOIS)')}
              value={settings.categories.marineTides}
              onChange={(v) => updateCategory('marineTides', v)}
            />

            <CategoryRow
              icon="📅"
              title={t(lang, 'notif_cat_myday')}
              sub={L(lang, 'Morning 6 AM briefing & activity shifts', 'सुबह 6 बजे का सारांश व गतिविधि सुझाव')}
              value={settings.categories.myDayReminders}
              onChange={(v) => updateCategory('myDayReminders', v)}
            />
          </View>

          {/* Threshold Sliders */}
          <View style={styles.card}>
            <Text style={styles.sectionHeader}>{L(lang, 'SENSITIVITY THRESHOLDS', 'संवेदनशीलता सीमाएँ')}</Text>

            <View style={styles.thresholdBlock}>
              <View style={styles.thresholdHead}>
                <Text style={styles.thresholdTitle}>🫁 {L(lang, 'AQI Alert Threshold', 'AQI अलर्ट सीमा')}</Text>
                <Text style={[styles.thresholdVal, { color: settings.aqiThreshold >= 200 ? '#DC2626' : '#D97706' }]}>
                  {settings.aqiThreshold} ({settings.aqiThreshold >= 300 ? 'Very Poor' : settings.aqiThreshold >= 200 ? 'Poor' : 'Moderate'})
                </Text>
              </View>
              <View style={styles.thresholdOptions}>
                {[100, 150, 200, 300].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.threshBtn, settings.aqiThreshold === val && styles.threshBtnActive]}
                    onPress={() => update({ aqiThreshold: val })}
                  >
                    <Text style={[styles.threshText, settings.aqiThreshold === val && styles.threshTextActive]}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.thresholdBlock, { marginTop: 16 }]}>
              <View style={styles.thresholdHead}>
                <Text style={styles.thresholdTitle}>🌧️ {L(lang, 'Rain Probability Threshold', 'बारिश संभावना सीमा')}</Text>
                <Text style={styles.thresholdVal}>{settings.rainProbabilityThreshold}%</Text>
              </View>
              <View style={styles.thresholdOptions}>
                {[40, 60, 80].map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={[styles.threshBtn, settings.rainProbabilityThreshold === val && styles.threshBtnActive]}
                    onPress={() => update({ rainProbabilityThreshold: val })}
                  >
                    <Text style={[styles.threshText, settings.rainProbabilityThreshold === val && styles.threshTextActive]}>
                      {val}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Test Notification Dispatch Button */}
          <TouchableOpacity style={styles.testBtn} onPress={triggerTestNotification}>
            <Text style={styles.testBtnText}>
              {testSent ? '✓ ' + L(lang, 'Dispatched to OS Notification Tray!', 'सूचना भेजी गई!') : '🔔 ' + t(lang, 'notif_test_btn')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.engineMeta}>
            Alert Orchestrator v2.4 · Powered by FCM + expo-notifications · {L(lang, 'Zero spam guaranteed', 'शून्य स्पैम गारंटी')}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function CategoryRow({
  icon,
  title,
  sub,
  value,
  onChange,
  locked = false,
}: {
  icon: string;
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <View style={styles.catRow}>
      <Text style={styles.catIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.catTitle}>{title}</Text>
          {locked ? (
            <View style={styles.lockBadge}><Text style={styles.lockText}>LOCKED</Text></View>
          ) : null}
        </View>
        <Text style={styles.catSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={locked}
        trackColor={{ false: '#CBD5E1', true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.06)',
    backgroundColor: '#fff',
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 16, fontWeight: '800', color: '#475569' },
  container: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.textSoft,
    marginBottom: 12,
  },
  quietTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
  },
  timeBox: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  timeValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2, fontFamily: 'monospace' },
  timeArrow: { fontSize: 16, color: colors.textSoft, marginHorizontal: 8 },
  bypassBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  bypassIcon: { fontSize: 14 },
  bypassText: { flex: 1, fontSize: 11, color: '#991B1B', lineHeight: 15, fontWeight: '600' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  catIcon: { fontSize: 20 },
  catTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  catSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, lineHeight: 15 },
  lockBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  lockText: { fontSize: 8.5, fontWeight: '800', color: '#475569' },
  thresholdBlock: { marginTop: 4 },
  thresholdHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  thresholdTitle: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  thresholdVal: { fontSize: 12, fontWeight: '800' },
  thresholdOptions: { flexDirection: 'row', gap: 8 },
  threshBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  threshBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  threshText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  threshTextActive: { color: '#fff' },
  testBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  testBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  engineMeta: {
    textAlign: 'center',
    fontSize: 10.5,
    color: colors.textSoft,
    marginTop: 14,
  },
});
