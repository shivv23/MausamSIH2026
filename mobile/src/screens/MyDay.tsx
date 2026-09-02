import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Activity, Homepage, Lang } from '../engine';
import { fmtTime, L } from '../engine';
import { t } from '../i18n';
import { colors, CONDITION_ICON, statusColor } from '../theme';
import { ScoreRing } from '../components/ui';

const POPULAR: Activity[] = [
  { type: 'walk', label: 'Evening walk', labelHi: 'शाम की सैर', time: '18:00' },
  { type: 'yoga', label: 'Morning yoga', labelHi: 'सुबह का योग', time: '06:30' },
  { type: 'run', label: 'Easy run', labelHi: 'आसान दौड़', time: '07:00' },
  { type: 'cycle', label: 'Cycle ride', labelHi: 'साइकिल की सवारी', time: '17:30' },
  { type: 'swim', label: 'Swim class', labelHi: 'तैराकी कक्षा', time: '16:00' },
  { type: 'event', label: 'Outdoor event', labelHi: 'मैदानी कार्यक्रम', time: '19:00' },
  { type: 'travel', label: 'Travel / trip', labelHi: 'यात्रा', time: '10:30' },
];

export default function MyDay({ hp, lang, onAddActivity }: { hp: Homepage; lang: Lang; onAddActivity: (a: Activity) => void }) {
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);
  const usedTypes = new Set(hp.user.activities.map((a) => a.type));
  const good = hp.myDay.filter((m) => m.status === 'go').length;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(lang, 'myday_title')}</Text>
        <Text style={styles.sub}>{t(lang, 'myday_sub')}</Text>

        <View style={styles.summaryRow}>
          {(['go', 'shift', 'avoid'] as const).map((s) => {
            const n = hp.myDay.filter((m) => m.status === s).length;
            return (
              <View key={s} style={styles.summaryCard}>
                <Text style={[styles.summaryNum, { color: statusColor(s) }]}>{n}</Text>
                <Text style={styles.summaryLabel}>{t(lang, s === 'go' ? 'status_go' : s === 'shift' ? 'status_shift' : 'status_avoid')}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.timeline}>
          {hp.myDay.map((m) => {
            const color = statusColor(m.status);
            const [time, tod] = (fmtTime(m.activity.time, lang) ?? ' ').split(' ');
            return (
              <View key={m.activity.time + m.activity.type} style={styles.row}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeMain}>{time}</Text>
                  <Text style={styles.timeTod}>{tod}</Text>
                </View>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={styles.itemCard}>
                  <View style={styles.itemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemLabel}>{L(lang, m.activity.label, m.activity.labelHi)}</Text>
                      <Text style={styles.itemNote}>{CONDITION_ICON[m.point.condition]} {m.note}</Text>
                    </View>
                    <ScoreRing score={m.score} size={44} />
                  </View>
                  <View style={styles.itemFoot}>
                    <View style={[styles.statusPill, { backgroundColor: `${color}1A` }]}>
                      <Text style={[styles.statusText, { color }]}>{t(lang, m.status === 'go' ? 'status_go' : m.status === 'shift' ? 'status_shift' : 'status_avoid')}</Text>
                    </View>
                    {m.suggestion ? <Text style={styles.suggestion}>✨ {m.suggestion}</Text> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setPicking((v) => !v)}>
          <Text style={styles.addText}>{picking ? '✕ ' : '＋ '}{t(lang, 'add_activity')}</Text>
        </TouchableOpacity>

        {picking ? (
          <View style={styles.picker}>
            {POPULAR.map((a) => {
              const used = usedTypes.has(a.type);
              return (
                <Pressable key={a.type} disabled={used} style={[styles.pickItem, used && styles.pickDisabled]} onPress={() => { onAddActivity(a); setAdded(true); setTimeout(() => setAdded(false), 1800); }}>
                  <Text style={styles.pickLabel}>{L(lang, a.label, a.labelHi)}</Text>
                  <Text style={[styles.pickTime, used && { color: colors.textSoft }]}>{used ? t(lang, 'myday_already') : fmtTime(a.time, lang)}</Text>
                </Pressable>
              );
            })}
            {added ? <Text style={styles.pickAdded}>✓ {t(lang, 'myday_added')}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.bottom}>{good}/{hp.myDay.length} {L(lang, 'plans on track · re-scored every 15 min', 'योजनाएँ ठीक · हर 15 मिनट पुनः स्कोर')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  summaryNum: { fontSize: 22, fontWeight: '800' },
  summaryLabel: { fontSize: 10.5, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
  timeline: { marginTop: 18 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  timeCol: { width: 46, alignItems: 'flex-end', paddingTop: 12 },
  timeMain: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  timeTod: { fontSize: 9.5, fontWeight: '600', color: colors.textSoft, textTransform: 'uppercase' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 14, borderWidth: 4, borderColor: colors.bg },
  itemCard: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemLabel: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  itemNote: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  itemFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  suggestion: { fontSize: 11, fontWeight: '700', color: colors.primary },
  addBtn: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#E2E8F0', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  addText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  picker: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)', gap: 6 },
  pickItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  pickDisabled: { opacity: 0.45 },
  pickLabel: { fontSize: 12.5, fontWeight: '700', color: '#1E293B' },
  pickTime: { fontSize: 11, fontWeight: '600', color: '#475569' },
  pickAdded: { textAlign: 'center', fontSize: 11.5, fontWeight: '700', color: '#047857', marginTop: 2 },
  bottom: { textAlign: 'center', fontSize: 10.5, color: colors.textSoft, marginTop: 12 },
});