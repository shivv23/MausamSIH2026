import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import type { Homepage, Lang } from '../engine';
import { L, SCENARIOS, aqiBand, uvBand } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';

interface Props {
  hp: Homepage;
  lang: Lang;
  onClose: () => void;
}

const CLOUD_FACTS: Record<string, { en: string; hi: string }> = {
  sunny: { en: 'Cirrus layer up high — fair weather streak', hi: 'ऊपर सिरस बादल — मौसम साफ़ रहेगा' },
  partly: { en: 'Cumulus — building through the day, dry', hi: 'क्यूमुलस — दिन भर बढ़ेगा, सूखा' },
  rain: { en: 'Nimbostratus overhead — continuous rain band', hi: 'ऊपर निंबोस्ट्रेटस — लगातार बारिश वाला बादल' },
  storm: { en: 'Cumulonimbus — severe convection, lightning risk', hi: 'क्यूमुलोनिंबस — गंभीर संवहन, बिजली का खतरा' },
  haze: { en: 'Haze layer — air quality degraded (AQI elevated)', hi: 'धुंध की परत — वायु गुणवत्ता खराब (AQI अधिक)' },
  cold: { en: 'Clear night sky — radiative frost risk', hi: 'साफ़ रात — पाले का खतरा' },
  hot: { en: 'Hazy, dry air — strong solar heating', hi: 'धुंधली, शुष्क हवा — तेज़ धूप' },
};

export default function AR({ hp, lang, onClose }: Props) {
  const p = hp.params;
  const sc = hp.scenario;
  const cf = CLOUD_FACTS[sc.condition] ?? CLOUD_FACTS.sunny;
  const band = aqiBand(p.aqi);
  const uv = uvBand(p.uv);
  const isStorm = sc.condition === 'storm' || sc.condition === 'rain';

  const stars = Math.max(0, (100 - p.aqi) / 2 + (p.uv > 6 ? -20 : 8));
  const starLabel = stars >= 80 ? 'Excellent' : stars >= 55 ? 'Good' : stars >= 30 ? 'Fair' : 'Poor';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* camera viewport */}
        <View style={styles.viewport}>
          <View style={styles.gradient} />
          {isStorm && <View style={styles.flash} />}

          {/* sky tags */}
          <View style={styles.tagTop}>
            <Text style={styles.appTitle}>🔭 AR / Mausam</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
          </View>

          <View style={styles.aimRing}>
            <Text style={styles.aimEmoji}>{sc.condition === 'rain' ? '🌧️' : sc.condition === 'storm' ? '⚡' : sc.condition === 'haze' ? '😶‍🌫️' : sc.condition === 'cold' ? '🌌' : sc.condition === 'hot' ? '☀️' : '☀️'}</Text>
          </View>

          <View style={styles.aimLabel}>
            <Text style={styles.aimTitle}>{L(lang, cf.en, cf.hi)}</Text>
            <Text style={styles.aimSub}>@{L(lang, hp.city.name, hp.city.nameHi)}, {hp.city.state}</Text>
          </View>

          {/* overlay rows */}
          <View style={styles.rowStrip}>
            <View style={styles.overlayChip}><Text style={styles.chipValue}>{p.temp}°C</Text><Text style={styles.chipKey}>Temp</Text></View>
            <View style={styles.overlayChip}><Text style={styles.chipValue}>{p.uv}</Text><Text style={styles.chipKey}>UV {L(lang, uv.label, uv.labelHi)}</Text></View>
            <View style={styles.overlayChip}><Text style={styles.chipValue}>{p.rainProb}%</Text><Text style={styles.chipKey}>Rain</Text></View>
          </View>
        </View>

        {/* bottom detail panel */}
        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.panelTitle}>{t(lang, 'ar_sky_science')}</Text>

          <Row label={t(lang, 'ar_cloud_type')} value={L(lang, cf.en, cf.hi)} icon="☁️" />
          <Row label={t(lang, 'ar_uv_intensity')} value={`UV ${p.uv} — ${L(lang, uv.label, uv.labelHi)}`} icon="☀️" />
          <Row label={t(lang, 'ar_rain_approach')} value={`${p.rainProb}% in next 3 h`} icon="🌧️" />
          <Row label={t(lang, 'ar_air_quality')} value={`AQI ${p.aqi} · ${L(lang, band.label, band.labelHi)}`} icon="😷" />
          <Row label={t(lang, 'ar_star_gazing')} value={`${starLabel} (${Math.round(stars)}/100)`} icon="⭐" />

          <Text style={styles.note}>{t(lang, 'ar_note')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0B1220' },
  viewport: { flex: 1.1, position: 'relative' },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1E3A8A' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.06)' },
  tagTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 40 },
  appTitle: { color: '#fff', fontSize: 13, fontWeight: '800', opacity: 0.9 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  aimRing: { alignSelf: 'center', marginTop: 20, width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  aimEmoji: { fontSize: 44 },
  aimLabel: { alignItems: 'center', marginTop: 12, paddingHorizontal: 16 },
  aimTitle: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  aimSub: { color: '#fff', fontSize: 11, opacity: 0.8, marginTop: 2 },
  rowStrip: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16, paddingHorizontal: 16 },
  overlayChip: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', flex: 1, maxWidth: 110 },
  chipValue: { color: '#fff', fontSize: 17, fontWeight: '800' },
  chipKey: { color: '#fff', fontSize: 9.5, opacity: 0.85, marginTop: 1 },
  panel: { flex: 1, backgroundColor: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -18 },
  panelContent: { padding: 20, paddingBottom: 40 },
  panelTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: '#94A3B8', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowIcon: { fontSize: 20 },
  rowLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  rowValue: { fontSize: 13.5, color: '#F1F5F9', fontWeight: '700', marginTop: 2 },
  note: { marginTop: 16, fontSize: 11, color: '#64748B', lineHeight: 16 },
});