import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import type { Homepage, Lang } from '../engine';
import { L } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';

interface Props {
  hp: Homepage;
  lang: Lang;
  onClose: () => void;
}

const STATUS_KEY = { verified: 'status_verified', pending: 'status_pending', contested: 'status_contested' } as const;

interface Report {
  id: string;
  type: string;
  icon: string;
  place: string;
  time: string;
  votes: number;
  status: 'verified' | 'pending' | 'contested';
}

const PRESETS: Report[] = [
  { id: 'r1', type: 'flood', icon: '🌊', place: 'Wakad Bridge underpass', time: '18 min ago', votes: 7, status: 'verified' },
  { id: 'r2', type: 'power', icon: '💡', place: 'Aundh sector 15', time: '41 min ago', votes: 3, status: 'pending' },
  { id: 'r3', type: 'vis', icon: '🌫️', place: 'Baner road', time: '1 h ago', votes: 5, status: 'verified' },
  { id: 'r4', type: 'flood', icon: '🌊', place: 'Sinhagad Rd low point', time: '12 min ago', votes: 2, status: 'contested' },
];

export default function Social({ hp, lang, onClose }: Props) {
  const [reports, setReports] = useState<Report[]>(PRESETS);
  const [mode, setMode] = useState<'map' | 'submit'>('map');
  const [place, setPlace] = useState('');
  const [type, setType] = useState('flood');
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!place.trim()) return;
    const nr: Report = { id: 'new', type, icon: type === 'flood' ? '🌊' : '💡', place: place.trim(), time: 'just now', votes: 1, status: 'pending' };
    setReports([nr, ...reports]);
    setDone(true);
    setTimeout(() => { setDone(false); setMode('map'); setPlace(''); }, 2200);
  };

  const typeChip = (k: string, icon: string, label: string) => (
    <TouchableOpacity key={k} style={[styles.typeChip, type === k && styles.typeChipActive]} onPress={() => setType(k)}>
      <Text style={[styles.typeChipText, type === k && styles.typeChipTextActive]}>{icon} {label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.head}>
          <Text style={styles.title}>{t(lang, 'social_title')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
        </View>

        <View style={styles.seg}>
          <TouchableOpacity style={[styles.segBtn, mode === 'map' && styles.segActive]} onPress={() => setMode('map')}>
            <Text style={[styles.segText, mode === 'map' && styles.segTextActive]}>🗺️ {t(lang, 'social_map')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, mode === 'submit' && styles.segActive]} onPress={() => setMode('submit')}>
            <Text style={[styles.segText, mode === 'submit' && styles.segTextActive]}>📤 {t(lang, 'social_report')}</Text>
          </TouchableOpacity>
        </View>

        {mode === 'map' ? (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* mini map */}
            <View style={styles.map}>
              <Text style={styles.mapTitle}>@ Vancouver-like — {L(lang, hp.city.name, hp.city.nameHi)}</Text>
              <View style={styles.mapGrid}>
                {['A', 'B', 'C', 'D'].map((c) => (
                  <View key={c} style={styles.mapCell}><Text style={styles.mapCellText}>{c}</Text></View>
                ))}
              </View>
              {reports.filter((r) => r.status === 'verified').map((r) => (
                <View key={r.id} style={styles.mapPin}><Text style={styles.mapPinText}>{r.type === 'flood' ? '🌊' : '🌫️'}</Text></View>
              ))}
              <Text style={styles.mapLegend}>🟡 verified · pending · contested reports shown near you</Text>
            </View>

            <Text style={styles.listTitle}>{t(lang, 'social_nearby')} ({reports.length})</Text>
            {reports.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.cardIcon}>{r.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardPlace}>{r.place}</Text>
                    <View style={[styles.statusPill, { backgroundColor: r.status === 'verified' ? '#DCFCE7' : r.status === 'contested' ? '#FEE2E2' : '#FEF9C3' }]}>
                      <Text style={[styles.statusText, { color: r.status === 'verified' ? '#15803D' : r.status === 'contested' ? '#B91C1C' : '#A16207' }]}>{t(lang, STATUS_KEY[r.status])}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardMeta}>{r.time} · ✓ {r.votes} {t(lang, 'social_votes')}</Text>
                  <TouchableOpacity style={styles.upvote}><Text style={styles.upvoteText}>👍 ✓ {t(lang, 'social_confirm')}</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>{t(lang, 'social_report_sub')}</Text>
            <View style={styles.typeRow}>
              {typeChip('flood', '🌊', t(lang, 'social_flood'))}
              {typeChip('power', '💡', t(lang, 'social_power'))}
              {typeChip('vis', '🌫️', t(lang, 'social_visibility'))}
            </View>
            <TextInput style={styles.input} placeholder={t(lang, 'social_place')} placeholderTextColor={colors.textSoft} value={place} onChangeText={setPlace} />
            <TouchableOpacity style={styles.submitBtn} onPress={submit}><Text style={styles.submitText}>📸 {t(lang, 'social_submit')}</Text></TouchableOpacity>
            {done ? <Text style={styles.done}>✅ {t(lang, 'social_submitted')}</Text> : null}
            <Text style={styles.note}>{t(lang, 'social_note')}</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#F1F5F9', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, fontWeight: '800', color: '#334155' },
  seg: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  segBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontSize: 12.5, fontWeight: '700', color: '#475569' },
  segTextActive: { color: '#fff' },
  body: { padding: 20, paddingBottom: 40 },
  map: { backgroundColor: '#E8F0F7', borderRadius: 18, padding: 12, height: 200, position: 'relative', borderWidth: 1, borderColor: '#CBD5E1' },
  mapTitle: { fontSize: 11, fontWeight: '700', color: '#334155' },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  mapCell: { width: '47%', height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  mapCellText: { color: '#94A3B8', fontWeight: '700' },
  mapPin: { position: 'absolute', top: 70, left: 90 },
  mapPinText: { fontSize: 22 },
  mapLegend: { position: 'absolute', bottom: 10, left: 12, fontSize: 10, color: '#475569' },
  listTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748B', marginTop: 18, marginBottom: 10 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(15,23,42,0.06)' },
  cardIcon: { fontSize: 24 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPlace: { fontSize: 13, fontWeight: '800', color: '#1E293B', flex: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  statusText: { fontSize: 10, fontWeight: '800' },
  cardMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  upvote: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  upvoteText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 12, lineHeight: 18 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  typeChipTextActive: { color: '#fff' },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.text, marginBottom: 12 },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  done: { marginTop: 12, fontSize: 13, fontWeight: '700', color: '#047857', textAlign: 'center' },
  note: { marginTop: 16, fontSize: 11, color: colors.textSoft, lineHeight: 16 },
});