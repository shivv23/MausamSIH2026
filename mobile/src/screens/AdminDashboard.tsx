import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Homepage, Lang, Severity, Provider, Source } from '../engine';
import { CITIES, DEMO_USERS, L, SEVERITY_COLOR } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import type { DisasterAlertWithPolygon, GeoPolygon } from '../types';
import { dispatchAlertNotification, createFCMPayload } from '../services/notifications';
import { isPointInGeofence } from '../services/offlineCache';

interface Props {
  hp: Homepage;
  lang: Lang;
  onClose: () => void;
  onPublishAlert: (alert: DisasterAlertWithPolygon) => void;
  onClearAlert: () => void;
  onToggleOffline: (offline: boolean) => void;
  isOffline: boolean;
  providers: Provider[];
  onUpdateProviders: (providers: Provider[]) => void;
}

const EVENT_TYPES = [
  { key: 'heavy_rain', label: 'Heavy Rain', labelHi: 'भारी बारिश', icon: '🌧️', defaultSev: 'orange' as Severity },
  { key: 'cyclone', label: 'Cyclone', labelHi: 'चक्रवात', icon: '🌀', defaultSev: 'red' as Severity },
  { key: 'heatwave', label: 'Heatwave', labelHi: 'लू', icon: '🥵', defaultSev: 'orange' as Severity },
  { key: 'frost', label: 'Frost / Cold Wave', labelHi: 'पाला / शीतलहर', icon: '❄️', defaultSev: 'yellow' as Severity },
  { key: 'aqi_spike', label: 'AQI Spike (GRAP III)', labelHi: 'AQI उछाल (GRAP III)', icon: '😷', defaultSev: 'orange' as Severity },
  { key: 'thunderstorm', label: 'Severe Thunderstorm', labelHi: 'भीषण आंधी-तूफान', icon: '⚡', defaultSev: 'orange' as Severity },
];

export default function AdminDashboard({
  hp,
  lang,
  onClose,
  onPublishAlert,
  onClearAlert,
  onToggleOffline,
  isOffline,
  providers,
  onUpdateProviders,
}: Props) {
  const [eventType, setEventType] = useState('heavy_rain');
  const [severity, setSeverity] = useState<Severity>('orange');
  const [regionKey, setRegionKey] = useState('pune');
  const [radiusKm, setRadiusKm] = useState(40);
  const [headlineEn, setHeadlineEn] = useState('IMD Orange Alert: Heavy rain likely at isolated places in Pune Metro');
  const [headlineHi, setHeadlineHi] = useState('IMD ऑरेंज चेतावनी: पुणे मेट्रो में अलग-अलग स्थानों पर भारी बारिश की संभावना');
  const [bodyEn, setBodyEn] = useState('Intense spells (45 mm/h) expected between 8–11 AM. Waterlogging likely near underpasses; allow 30 min extra commute.');
  const [bodyHi, setBodyHi] = useState('सुबह 8–11 बजे 45 मिमी/घंटा बारिश का अनुमान। अंडरपास के पास जलभराव संभव; 30 मिनट अतिरिक्त समय रखें।');
  const [published, setPublished] = useState(false);

  const selectedCity = CITIES.find((c) => c.key === regionKey) || CITIES[0];
  const cityLat = selectedCity.sunrise === '06:48' ? 28.61 : selectedCity.coastal ? 19.07 : 18.52;
  const cityLon = selectedCity.sunrise === '06:48' ? 77.20 : selectedCity.coastal ? 72.87 : 73.85;

  // Generate synthetic geofence polygon around city center
  const dLat = radiusKm / 111.0;
  const dLon = radiusKm / (111.0 * Math.cos((cityLat * Math.PI) / 180));
  const activePolygon: GeoPolygon = {
    coordinates: [
      [cityLon - dLon, cityLat - dLat],
      [cityLon + dLon, cityLat - dLat],
      [cityLon + dLon, cityLat + dLat],
      [cityLon - dLon, cityLat + dLat],
      [cityLon - dLon, cityLat - dLat],
    ],
  };

  // Evaluate which demo users are inside the geofence
  const targetResolutions = DEMO_USERS.map((d) => {
    const userLat = d.cityKey === 'pune' ? 18.52 : d.cityKey === 'mumbai' ? 19.07 : 30.73;
    const userLon = d.cityKey === 'pune' ? 73.85 : d.cityKey === 'mumbai' ? 72.87 : 76.77;
    const inPolygon = isPointInGeofence(userLat, userLon, activePolygon) || d.cityKey === regionKey;
    return {
      user: d.user,
      city: d.cityKey,
      inPolygon,
      localizedBody: inPolygon
        ? (lang === 'hi' ? `${headlineHi} — आप प्रभावित क्षेत्र में हैं। कृपया सुरक्षा उपाय करें।` : `${headlineEn} — you are INSIDE affected zone. Please act.`)
        : (lang === 'hi' ? `${headlineHi} — आपके शहर के निकट।` : `${headlineEn} — nearby region.`),
    };
  });

  const handleSelectEventType = (evKey: string) => {
    setEventType(evKey);
    const ev = EVENT_TYPES.find((e) => e.key === evKey);
    if (ev) {
      setSeverity(ev.defaultSev);
      if (evKey === 'cyclone') {
        setHeadlineEn('IMD Red Alert: Severe Cyclonic Storm approaching coast');
        setHeadlineHi('IMD रेड चेतावनी: तट की ओर बढ़ता भीषण चक्रवाती तूफ़ान');
        setBodyEn('Sustained wind 95 km/h gusting 130 km/h. Coastal areas evacuate to designated shelters immediately.');
        setBodyHi('95 किमी/घंटा हवा, 130 किमी/घंटा झोंके। तटीय क्षेत्रों से तुरंत आश्रय स्थलों में जाएँ।');
      } else if (evKey === 'heatwave') {
        setHeadlineEn('IMD Orange Alert: Severe Heatwave Conditions (42 °C)');
        setHeadlineHi('IMD ऑरेंज चेतावनी: भीषण लू की स्थिति (42 °C)');
        setBodyEn('5 °C above normal. Avoid outdoor exposure 12–4 PM, hydrate frequently, keep ORS handy.');
        setBodyHi('सामान्य से 5 °C अधिक। दोपहर 12–4 बजे बाहर न निकलें, बार-बार पानी पिएँ।');
      } else if (evKey === 'frost') {
        setHeadlineEn('IMD Yellow Alert: Ground Frost warning for Open Fields');
        setHeadlineHi('IMD येलो चेतावनी: खुले खेतों में पाले की चेतावनी');
        setBodyEn('Night minimum 3–4 °C. Apply light irrigation at dusk to prevent crop cell damage.');
        setBodyHi('रात का तापमान 3–4 °C। पाले से बचाव के लिए शाम को हल्की सिंचाई करें।');
      } else {
        setHeadlineEn(`IMD ${ev.defaultSev.toUpperCase()} Alert: ${ev.label} in ${selectedCity.name}`);
        setHeadlineHi(`IMD ${ev.defaultSev.toUpperCase()} चेतावनी: ${selectedCity.nameHi} में ${ev.labelHi}`);
      }
    }
  };

  const handlePublish = async () => {
    const alertObj: DisasterAlertWithPolygon = {
      id: `w-${Date.now().toString(36)}`,
      severity,
      eventType,
      source: eventType === 'aqi_spike' ? 'CPCB' : 'IMD',
      headline: headlineEn,
      headlineHi,
      body: bodyEn,
      bodyHi,
      region: selectedCity.name,
      center: { lat: cityLat, lon: cityLon, name: selectedCity.name },
      radiusKm,
      polygon: activePolygon,
      issuedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
      actions: ['Avoid flood underpasses', 'Allow 30 min extra commute', 'Keep emergency phone charged'],
      actionsHi: ['जलभराव वाले अंडरपास से बचें', '30 मिनट अतिरिक्त समय रखें', 'फ़ोन चार्ज रखें'],
      affectedUsers: targetResolutions.map((tr) => ({
        userId: tr.user.id,
        city: tr.city,
        inPolygon: tr.inPolygon,
        headline: headlineEn,
        body: tr.localizedBody,
      })),
    };

    // 1. Dispatch real push notification via Alert Orchestrator
    await dispatchAlertNotification({
      title: lang === 'hi' ? `🚨 ${headlineHi}` : `🚨 ${headlineEn}`,
      body: lang === 'hi' ? bodyHi : bodyEn,
      severity,
      category: 'severeWarnings',
    });

    // 2. Publish to App State
    onPublishAlert(alertObj);
    setPublished(true);
    setTimeout(() => setPublished(false), 2500);
  };

  const toggleProvider = (name: Source) => {
    const updated: Provider[] = providers.map((p) => {
      if (p.name === name) {
        const nextStatus: 'ok' | 'degraded' | 'down' = p.status === 'ok' ? 'degraded' : p.status === 'degraded' ? 'down' : 'ok';
        return { ...p, status: nextStatus };
      }
      return p;
    });
    onUpdateProviders(updated);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>🛠️ {t(lang, 'admin_title')}</Text>
            <Text style={styles.sub}>{t(lang, 'admin_sub')}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Disaster Event Type Selection */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t(lang, 'admin_event_type')}</Text>
            <View style={styles.eventGrid}>
              {EVENT_TYPES.map((ev) => {
                const active = eventType === ev.key;
                return (
                  <TouchableOpacity
                    key={ev.key}
                    style={[styles.eventBtn, active && styles.eventBtnActive]}
                    onPress={() => handleSelectEventType(ev.key)}
                  >
                    <Text style={styles.eventIcon}>{ev.icon}</Text>
                    <Text style={[styles.eventText, active && styles.eventTextActive]}>
                      {L(lang, ev.label, ev.labelHi)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Severity & Region Selection */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.cardLabel}>{t(lang, 'admin_severity')}</Text>
                <View style={styles.sevRow}>
                  {(['yellow', 'orange', 'red'] as Severity[]).map((sev) => {
                    const active = severity === sev;
                    return (
                      <TouchableOpacity
                        key={sev}
                        style={[
                          styles.sevBtn,
                          active && { backgroundColor: SEVERITY_COLOR[sev], borderColor: SEVERITY_COLOR[sev] },
                        ]}
                        onPress={() => setSeverity(sev)}
                      >
                        <Text style={[styles.sevText, active && { color: '#fff' }]}>{sev.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.cardLabel}>{t(lang, 'admin_radius')}: {radiusKm} km</Text>
                <View style={styles.radiusRow}>
                  {[20, 40, 60, 100].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.radBtn, radiusKm === r && styles.radBtnActive]}
                      onPress={() => setRadiusKm(r)}
                    >
                      <Text style={[styles.radText, radiusKm === r && styles.radTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={[styles.cardLabel, { marginTop: 14 }]}>{t(lang, 'admin_region')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionRow}>
              {CITIES.map((c) => {
                const active = regionKey === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.regionBtn, active && styles.regionBtnActive]}
                    onPress={() => setRegionKey(c.key)}
                  >
                    <Text style={[styles.regionText, active && styles.regionTextActive]}>
                      {L(lang, c.name, c.nameHi)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Headline & Body Editor */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Official Bulletin Headline (English & Hindi)</Text>
            <TextInput
              style={styles.input}
              value={headlineEn}
              onChangeText={setHeadlineEn}
              placeholder="English headline"
            />
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              value={headlineHi}
              onChangeText={setHeadlineHi}
              placeholder="Hindi headline"
            />

            <Text style={[styles.cardLabel, { marginTop: 12 }]}>Safety Actionable Text</Text>
            <TextInput
              style={[styles.input, { minHeight: 54 }]}
              multiline
              value={bodyEn}
              onChangeText={setBodyEn}
            />
          </View>

          {/* Ray-Casting Target Resolution Table */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>🎯 {t(lang, 'admin_affected_users')} (Point-in-Polygon)</Text>
            <Text style={styles.targetSub}>
              {L(
                lang,
                'Matches registered user coordinates against the active geofence polygon in real time.',
                'सक्रिय जियोफ़ेंस पॉलीगॉन के विरुद्ध वास्तविक समय में उपयोगकर्ता निर्देशांक मिलान।'
              )}
            </Text>

            {targetResolutions.map((tr) => (
              <View key={tr.user.id} style={styles.targetRow}>
                <View style={[styles.userBadge, tr.inPolygon ? styles.userBadgeIn : styles.userBadgeOut]}>
                  <Text style={styles.userBadgeText}>{tr.user.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>
                    {tr.user.name} ({tr.city.toUpperCase()})
                  </Text>
                  <Text style={styles.userPayload} numberOfLines={1}>
                    FCM: {tr.localizedBody}
                  </Text>
                </View>
                <View style={[styles.statusTag, tr.inPolygon ? styles.statusTagIn : styles.statusTagOut]}>
                  <Text style={[styles.statusTagText, { color: tr.inPolygon ? '#DC2626' : '#16A34A' }]}>
                    {tr.inPolygon ? '🚨 IN ZONE' : '✓ SAFE'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Primary Action: Broadcast & Dispatch */}
          <TouchableOpacity style={styles.publishBtn} onPress={handlePublish}>
            <Text style={styles.publishBtnText}>
              {published ? '✓ ' + L(lang, 'BROADCAST DISPATCHED TO FCM & UI!', 'अलर्ट प्रसारित!') : '🚨 ' + t(lang, 'admin_dispatch_btn')}
            </Text>
          </TouchableOpacity>

          {/* Clear Alerts Button */}
          <TouchableOpacity style={styles.clearBtn} onPress={onClearAlert}>
            <Text style={styles.clearBtnText}>↺ {t(lang, 'admin_clear')}</Text>
          </TouchableOpacity>

          {/* Provider Chaos / Fallback Simulator */}
          <View style={[styles.card, { marginTop: 18 }]}>
            <Text style={styles.cardLabel}>⚡ {t(lang, 'admin_chaos')}</Text>
            <Text style={styles.targetSub}>
              {L(lang, 'Tap a provider to toggle OK → DEGRADED → DOWN to test fallback provenance.', 'फ़ॉलबैक जाँचने के लिए प्रदाता स्थिति बदलें।')}
            </Text>

            {providers.map((p) => (
              <TouchableOpacity key={p.name} style={styles.provRow} onPress={() => toggleProvider(p.name)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={[
                      styles.provDot,
                      { backgroundColor: p.status === 'ok' ? '#10B981' : p.status === 'degraded' ? '#F59E0B' : '#EF4444' },
                    ]}
                  />
                  <Text style={styles.provName}>{p.name}</Text>
                </View>
                <View
                  style={[
                    styles.provStatusBadge,
                    { backgroundColor: p.status === 'ok' ? '#ECFDF5' : p.status === 'degraded' ? '#FFFBEB' : '#FEF2F2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.provStatusText,
                      { color: p.status === 'ok' ? '#047857' : p.status === 'degraded' ? '#B45309' : '#B91C1C' },
                    ]}
                  >
                    {p.status.toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Airplane Mode Offline Simulator */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>✈️ {t(lang, 'admin_offline_toggle')}</Text>
                <Text style={styles.cardSub}>
                  {L(lang, 'Test WatermelonDB offline storage & staleness marker', 'वॉटरमेलन-डीबी ऑफ़लाइन स्टोरेज व स्टेलनेस मार्कर जाँचें')}
                </Text>
              </View>
              <Switch
                value={isOffline}
                onValueChange={onToggleOffline}
                trackColor={{ false: '#CBD5E1', true: '#F59E0B' }}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
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
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: '47%',
  },
  eventBtnActive: { backgroundColor: '#EEF2FF', borderColor: colors.primary },
  eventIcon: { fontSize: 16 },
  eventText: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  eventTextActive: { color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center' },
  sevRow: { flexDirection: 'row', gap: 4 },
  sevBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  sevText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  radiusRow: { flexDirection: 'row', gap: 4 },
  radBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  radBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  radTextActive: { color: '#fff' },
  regionRow: { gap: 6 },
  regionBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  regionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  regionText: { fontSize: 11.5, fontWeight: '600', color: '#475569' },
  regionTextActive: { color: '#fff', fontWeight: '700' },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    color: colors.text,
  },
  targetSub: { fontSize: 11, color: colors.textMuted, marginBottom: 10, lineHeight: 15 },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadgeIn: { backgroundColor: '#FEE2E2' },
  userBadgeOut: { backgroundColor: '#DCFCE7' },
  userBadgeText: { fontSize: 12, fontWeight: '800', color: colors.text },
  userName: { fontSize: 12, fontWeight: '700', color: colors.text },
  userPayload: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  statusTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusTagIn: { backgroundColor: '#FEF2F2' },
  statusTagOut: { backgroundColor: '#F0FDF4' },
  statusTagText: { fontSize: 9, fontWeight: '800' },
  publishBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  clearBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  clearBtnText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  provRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  provDot: { width: 8, height: 8, borderRadius: 4 },
  provName: { fontSize: 12, fontWeight: '600', color: colors.text },
  provStatusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  provStatusText: { fontSize: 9.5, fontWeight: '800' },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
