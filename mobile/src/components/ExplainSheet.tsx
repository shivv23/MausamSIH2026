import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import type { Card, Lang } from '../engine';
import { L, SEVERITY_COLOR } from '../engine';
import { t, type LangKey } from '../i18n';
import { colors, CARD_META } from '../theme';
import { CardMetaIcon, PhaseBadge, ScoreRing } from './ui';

type RankKey = 'interest' | 'context' | 'urgency' | 'time' | 'location' | 'behavior';
const RANK_KEYS: [RankKey, LangKey, number][] = [
  ['interest', 'r_interest', 0.3],
  ['context', 'r_context', 0.2],
  ['urgency', 'r_urgency', 0.25],
  ['time', 'r_time', 0.1],
  ['location', 'r_location', 0.1],
  ['behavior', 'r_behavior', 0.05],
];

export function ExplainSheet({ card, lang, onClose, onHide }: { card: Card | null; lang: Lang; onClose: () => void; onHide?: (c: Card) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!card) return null;
  const meta = CARD_META[card.type] ?? CARD_META.mausam_brief;
  const accent = card.type === 'severe_warning' ? SEVERITY_COLOR[card.severity ?? 'red'] : meta.accent;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const rk = card.explanation.ranking;
  const scoreSum = RANK_KEYS.reduce((acc, [k, , w]) => acc + rk[k] * w, 0);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={styles.head}>
              <CardMetaIcon type={card.type} size={22} />
              <View style={styles.headMain}>
                <View style={styles.headTitleRow}>
                  <Text style={styles.headTitle} numberOfLines={1}>{card.title}</Text>
                  <PhaseBadge phase={card.phase} lang={lang} severity={card.severity} />
                </View>
                <Text style={styles.headSummary}>{card.summary}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}><Text>✕</Text></Pressable>
            </View>
            <View style={styles.divider} />

            {/* why */}
            <Text style={[styles.sectionLabel, { color: accent }]}>{t(lang, 'why_seeing')}</Text>
            <Text style={styles.sectionBody}>{card.explanation.why}</Text>

            {/* ranking */}
            <Text style={styles.sectionLabelMuted}>{t(lang, 'ranking_breakdown')}</Text>
            <View style={styles.rankRow} key="head">
              <Text style={[styles.footnote, { alignSelf: 'flex-end', marginBottom: 4 }]}>Σ = {(scoreSum * 100).toFixed(0)}</Text>
            </View>
            {RANK_KEYS.map(([k, label, w]) => {
              const v = rk[k];
              return (
                <View key={k} style={styles.rankBarRow}>
                  <Text style={styles.rankLabel}>{t(lang, label)}</Text>
                  <Text style={styles.rankW}>w{w}</Text>
                  <View style={styles.rankTrack}>
                    <View style={[styles.rankFill, { width: `${v * 100}%`, backgroundColor: accent }]} />
                  </View>
                  <Text style={styles.rankVal}>{Math.round(v * 100)}</Text>
                </View>
              );
            })}
            <Text style={styles.footnote}>Score = w1·Interest + w2·Context + w3·Urgency + w4·Time + w5·Location + w6·Behavior{card.phase === 'official' ? ' · pinned' : ''}</Text>

            {/* factors */}
            {card.factors && card.factors.length > 0 ? (
              <>
                <View style={[styles.factorHead, { marginTop: 16 }]}>
                  <Text style={styles.sectionLabelMuted}>{t(lang, 'factors')}</Text>
                  {card.score !== undefined ? <ScoreRing score={card.score} label={card.level} size={46} /> : null}
                </View>
                {card.factors.map((f) => (
                  <View key={f.name} style={[styles.factorRow,
                    f.impact === 'good' ? styles.factorRowGood : f.impact === 'bad' ? styles.factorRowBad : styles.factorRowNeutral]}>
                    <Text style={styles.factorName}>{L(lang, f.name, f.nameHi)}</Text>
                    <Text style={[styles.factorVal,
                      f.impact === 'good' ? { color: '#047857' } : f.impact === 'bad' ? { color: '#DC2626' } : { color: '#475569' }]}>
                      {(f.impact === 'good' ? '▲' : f.impact === 'bad' ? '▼' : '–')} {f.value}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {/* provenance */}
            <View style={styles.provBox}>
              <Text style={styles.provSrc}>🛡 {t(lang, 'source')}: {card.provenance.source}</Text>
              <View style={styles.provGrid}>
                <Text style={styles.provLabel}>{t(lang, 'issued')}</Text>
                <Text style={styles.provVal}>{fmt(card.provenance.issuedAt)}</Text>
                <Text style={styles.provLabel}>{t(lang, 'valid_until')}</Text>
                <Text style={styles.provVal}>{fmt(card.provenance.validUntil)}</Text>
                <Text style={styles.provLabel}>{t(lang, 'confidence')}</Text>
                <Text style={styles.provVal}>{Math.round(card.explanation.confidence * 100)}%</Text>
                <Text style={styles.provLabel}>{t(lang, 'licence')}</Text>
                <Text style={styles.provVal} numberOfLines={2}>{card.provenance.licence}</Text>
              </View>
            </View>

            {/* feedback */}
            {feedback ? (
              <View style={styles.fbThanks}><Text style={styles.fbThanksText}>{t(lang, 'thanks_feedback')}</Text></View>
            ) : (
              <View style={styles.fbRow}>
                {[['helpful', '👍', t(lang, 'helpful')], ['not_helpful', '👎', t(lang, 'not_helpful')], ['inaccurate', '🚩', t(lang, 'inaccurate')]].map(([k, e, label]) => (
                  <Pressable key={k} style={styles.fbBtn} onPress={() => setFeedback(k)}>
                    <Text style={{ fontSize: 16 }}>{e}</Text>
                    <Text style={styles.fbBtnText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable style={styles.hideBtn} onPress={() => { onHide?.(card); onClose(); }}>
              <Text style={styles.hideBtnText}>🙈 {t(lang, 'hide_like_this')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  head: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  headMain: { flex: 1 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  headTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.4, flexShrink: 1 },
  headSummary: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16, marginHorizontal: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 20, marginTop: 4 },
  sectionLabelMuted: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted, marginHorizontal: 20, marginTop: 18 },
  sectionBody: { fontSize: 13.5, color: '#1E293B', lineHeight: 20, marginHorizontal: 20, marginTop: 6 },
  rankRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginTop: 4 },
  rankBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 3 },
  rankLabel: { width: 78, fontSize: 11.5, fontWeight: '600', color: '#334155' },
  rankW: { width: 30, fontSize: 10, color: colors.textSoft },
  rankTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  rankFill: { height: 8, borderRadius: 4 },
  rankVal: { width: 32, textAlign: 'right', fontSize: 10.5, fontWeight: '700', color: '#334155' },
  footnote: { fontSize: 9.5, color: colors.textSoft, marginHorizontal: 20, marginTop: 6 },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, marginHorizontal: 20, marginTop: 6 },
  factorRowGood: { borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  factorRowBad: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  factorRowNeutral: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  factorName: { fontSize: 11.5, fontWeight: '600', color: '#334155' },
  factorVal: { fontSize: 11, fontWeight: '700' },
  provBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 18 },
  provSrc: { fontSize: 12, fontWeight: '800', color: '#1E293B' },
  provGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 6 },
  provLabel: { width: '35%', fontSize: 11.5, color: colors.textMuted },
  provVal: { width: '60%', fontSize: 11.5, fontWeight: '600', color: '#1E293B' },
  fbThanks: { backgroundColor: '#ECFDF5', borderRadius: 16, padding: 12, marginHorizontal: 20, marginTop: 18 },
  fbThanksText: { fontSize: 12, fontWeight: '600', color: '#047857' },
  fbRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 18 },
  fbBtn: { flex: 1, alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 10 },
  fbBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  hideBtn: { marginHorizontal: 20, marginTop: 10, paddingVertical: 10, borderRadius: 16, alignItems: 'center' },
  hideBtnText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
});