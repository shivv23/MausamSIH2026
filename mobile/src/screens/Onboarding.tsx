import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { Activity, ActivityType, PersonaKey, UserProfile, Lang } from '../engine';
import { CITIES, CONDITIONS, PERSONAS } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import { saveConsent } from '../services/db';

interface Props {
  lang: Lang;
  onDone: (profile: UserProfile, cityKey: string) => void;
  /** When set (user created/signed into an account first), the profile is
   *  created under this account id instead of a name-derived one. */
  fixedId?: string;
}

type Consent = 'none' | 'profile' | 'notifications' | 'both';

// default activities per persona so the My Day timeline is populated
const DEFAULT_ACTIVITIES: Partial<Record<PersonaKey, { type: ActivityType; label: string; labelHi: string; time: string }[]>> = {
  fitness: [{ type: 'run', label: 'Morning run', labelHi: 'सुबह की दौड़', time: '06:30' }],
  commuter: [{ type: 'commute', label: 'Office commute', labelHi: 'ऑफ़िस सफ़र', time: '09:00' }],
  parent: [{ type: 'school_drop', label: 'School drop', labelHi: 'स्कूल छोड़ना', time: '07:45' }],
  agriculture: [{ type: 'farm_work', label: 'Field work', labelHi: 'खेत का काम', time: '06:00' }],
  events: [{ type: 'event', label: 'Outdoor event', labelHi: 'बाहरी आयोजन', time: '19:00' }],
  beach: [{ type: 'swim', label: 'Beach / swim', labelHi: 'समुद्र तट / तैराकी', time: '10:00' }],
};

export default function Onboarding({ lang, onDone, fixedId }: Props) {
  const [selected, setSelected] = useState<PersonaKey[]>([]);
  const [name, setName] = useState('');
  const [city, setCity] = useState('pune');
  const [conditions, setConditions] = useState<string[]>([]);
  const [consent, setConsent] = useState<Consent>('both');
  const [detecting, setDetecting] = useState(false);

  /** One-shot, consent-first city detection. Falls back to manual entry on
   * any denial/error; never tracks location afterwards. */
  const detectCity = async () => {
    try {
      setDetecting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t(lang, 'ob_detect_city'), t(lang, 'ob_detect_denied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        Alert.alert(t(lang, 'ob_detect_city'), t(lang, 'ob_detect_fail'));
        return;
      }
      let nearest = CITIES[0];
      let best = Number.POSITIVE_INFINITY;
      for (const c of CITIES) {
        const d = haversineKm(latitude, longitude, c.lat, c.lon);
        if (d < best) { best = d; nearest = c; }
      }
      if (best > 350) {
        // outside India's coverage → keep manual, tell the user clearly
        Alert.alert(t(lang, 'ob_detect_city'), t(lang, 'ob_detect_fail'));
        return;
      }
      setCity(nearest.name);
      Alert.alert(t(lang, 'ob_detect_city'), t(lang, 'ob_detect_nearby').replace('{city}', L(lang, nearest.name, nearest.nameHi)));
    } catch {
      Alert.alert(t(lang, 'ob_detect_city'), t(lang, 'ob_detect_fail'));
    } finally {
      setDetecting(false);
    }
  };

  const toggleConsent = (c: Exclude<Consent, 'none'>): void => {
    const next = consent === c ? 'none' : consent === 'both' ? (c === 'profile' ? 'notifications' : 'profile') : c === 'profile' ? 'both' : 'both';
    setConsent(next);
  };

  const toggle = (key: PersonaKey) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((p) => p !== key);
      if (prev.length >= 3) { Alert.alert(t(lang, 'ob_persona_sub'), t(lang, 'ob_persona_sub')); return prev; }
      return [...prev, key];
    });
  };

  const toggleCondition = (c: string) => {
    setConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const finish = () => {
    if (selected.length === 0) {
      Alert.alert(t(lang, 'ob_persona_title'), t(lang, 'ob_persona_sub'));
      return;
    }
    const cityObj = CITIES.find((c) => c.name.toLowerCase() === city.trim().toLowerCase() || c.key === city.trim().toLowerCase());
    const cityKey = cityObj?.key ?? 'pune';
    const isHi = lang === 'hi';
    const userName = name.trim() || (isHi ? 'उपयोकर्ता' : 'User');
    const userNameHi = isHi ? userName : userName;
    const activities: Activity[] = [];
    selected.forEach((p, idx) => {
      const defs = DEFAULT_ACTIVITIES[p];
      if (defs) activities.push(...defs.slice(0, 1).map((d) => ({ ...d, label: isHi ? d.labelHi : d.label, labelHi: d.labelHi })));
      if (idx === 0 && selected.includes('fitness') && !activities.some((a) => a.type === 'commute')) {
        activities.push({ type: 'commute', label: isHi ? 'ऑफ़िस सफ़र' : 'Office commute', labelHi: 'ऑफ़िस सफ़र', time: '09:00' });
      }
    });
    const profile: UserProfile = {
      id: fixedId || (name.trim() || userName).toLowerCase().replace(/\s+/g, '_') || 'user',
      name: userName, nameHi: userNameHi, personas: selected,
      conditions, activities, locations: [{ type: 'home', label: 'Home' }],
      city: cityKey, language: lang, behaviorBias: {},
    };
    if (consent === 'none') {
      Alert.alert(t(lang, 'privacy_consent_title'), t(lang, 'privacy_consent_sub'));
      return;
    }
    const consents = consent === 'both' ? ['profile', 'notifications'] : consent === 'profile' ? ['profile'] : ['notifications'];
    saveConsent({
      userId: profile.id,
      policyVersion: 'v1',
      acceptedAt: new Date().toISOString(),
      consents,
    }).catch(() => undefined);
    onDone(profile, cityKey);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t(lang, 'ob_welcome_title')}</Text>
        <Text style={styles.subtitle}>{t(lang, 'ob_welcome_sub')}</Text>

        <Text style={styles.sectionTitle}>{t(lang, 'ob_persona_title')}</Text>
        <Text style={styles.sectionSub}>{t(lang, 'ob_persona_sub')}</Text>

        <View style={styles.grid}>
          {(Object.keys(PERSONAS) as PersonaKey[]).map((key) => {
            const m = PERSONAS[key];
            const active = selected.includes(key);
            return (
              <TouchableOpacity key={key} style={[styles.persona, active && { borderColor: m.color, backgroundColor: m.soft }]} onPress={() => toggle(key)}>
                <Text style={styles.personaIcon}>{m.icon}</Text>
                <Text style={[styles.personaLabel, active && { color: m.color }]}>{L(lang, m.label, m.labelHi)}</Text>
                <Text style={styles.personaDesc}>{L(lang, m.desc, m.descHi)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>{t(lang, 'ob_name')}</Text>
        <TextInput style={styles.input} placeholder={t(lang, 'ob_name_ph')} placeholderTextColor={colors.textSoft} value={name} onChangeText={setName} />

        <Text style={styles.fieldLabel}>{t(lang, 'ob_city')}</Text>
        <View style={styles.cityRow}>
          <TextInput style={[styles.input, styles.cityInput]} placeholder={t(lang, 'ob_city_ph')} placeholderTextColor={colors.textSoft} value={city} onChangeText={setCity} autoCapitalize="none" />
          <TouchableOpacity style={[styles.detectBtn, detecting && styles.detectBtnDisabled]} disabled={detecting} onPress={detectCity}>
            <Text style={styles.detectText}>{detecting ? t(lang, 'ob_detect_busy') : t(lang, 'ob_detect_city')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>{t(lang, 'ob_conditions')}</Text>
        <View style={styles.chipWrap}>
          {(Object.keys(CONDITIONS) as string[]).map((c) => {
            const active = conditions.includes(c);
            return (
              <TouchableOpacity key={c} style={[styles.condChip, active && { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]} onPress={() => toggleCondition(c)}>
                <Text style={[styles.condText, active && { color: '#B91C1C' }]}>{L(lang, CONDITIONS[c].label, CONDITIONS[c].labelHi)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.consentCard}>
          <Text style={styles.consentTitle}>{t(lang, 'privacy_consent_title')}</Text>
          <Text style={styles.consentSub}>{t(lang, 'privacy_consent_sub')}</Text>
          {(['profile', 'notifications'] as const).map((c) => {
            const active = consent === 'both' || consent === c;
            return (
              <View key={c} style={styles.consentRow}>
                <TouchableOpacity hitSlop={10} onPress={() => toggleConsent(c)}>
                  <View style={[styles.checkbox, active && styles.checkboxOn]}>
                    {active ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.consentName}>{t(lang, c === 'profile' ? 'privacy_consent_profile' : 'privacy_consent_notifications')}</Text>
                  <Text style={styles.consentDesc}>{t(lang, c === 'profile' ? 'privacy_consent_conditions_desc' : 'privacy_consent_notif_desc')}</Text>
                </View>
              </View>
            );
          })}
          <TouchableOpacity onPress={() => Alert.alert(t(lang, 'privacy_policy'), t(lang, 'privacy_consent_sub') + '\n\n• ' + t(lang, 'privacy_stored_locally') + '\n• ' + t(lang, 'privacy_retention') + '\n• ' + t(lang, 'privacy_permissions'))}>
            <Text style={styles.consentLink}>{t(lang, 'privacy_policy')} →</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.cta, consent === 'none' && styles.ctaMuted]} onPress={finish}>
          <Text style={styles.ctaText}>{t(lang, 'privacy_accept')} →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const L = (lang: Lang, en: string, hi: string) => (lang === 'hi' ? hi : en);

/** Great-circle distance in km (Haversine) for nearest-city matching. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 21 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginTop: 24 },
  sectionSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  persona: { width: '31%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', padding: 12, marginBottom: 10, alignItems: 'center' },
  personaIcon: { fontSize: 28 },
  personaLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6, textAlign: 'center' },
  personaDesc: { fontSize: 10, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 18, marginBottom: 6 },
  cityRow: { flexDirection: 'row', gap: 8 },
  cityInput: { flex: 1 },
  detectBtn: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  detectBtnDisabled: { opacity: 0.5 },
  detectText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, backgroundColor: '#fff' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  condChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  condText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  consentCard: { marginTop: 24, backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  consentTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  consentSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: '#C7D2FE', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  consentName: { fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  consentDesc: { fontSize: 11, color: colors.textMuted, marginTop: 1, lineHeight: 15 },
  consentLink: { fontSize: 11.5, fontWeight: '700', color: colors.primary, marginTop: 12 },
  cta: { marginTop: 18, backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  ctaMuted: { backgroundColor: '#94A3B8' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});