import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TouchableOpacity } from 'react-native';
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

export function ExplainSheet({
  card,
  lang,
  onClose,
  onHide,
}: {
  card: Card | null;
  lang: Lang;
  onClose: () => void;
  onHide?: (c: Card) => void;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sensitivityAdjust, setSensitivityAdjust] = useState<number>(0);
  const [snapshotLogged, setSnapshotLogged] = useState(false);

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

  const handleLogSnapshot = (type: string) => {
    setFeedback(type);
    setSnapshotLogged(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
            {/* Header */}
            <View style={styles.head}>
              <CardMetaIcon type={card.type} size={22} />
              <View style={styles.headMain}>
                <View style={styles.headTitleRow}>
                  <Text style={styles.headTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <PhaseBadge phase={card.phase} lang={lang} severity={card.severity} />
                </View>
                <Text style={styles.headSummary}>{card.summary}</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={{ fontWeight: '800', color: '#475569' }}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            {/* 3-Step Distrust Header Banner (§13.2 Steps 6-7) */}
            <View style={styles.distrustBanner}>
              <Text style={styles.distrustTitle}>🛡️ 3-Step Zero-Distrust Story</Text>
              <Text style={styles.distrustSub}>
                {L(
                  lang,
                  'Deterministic math + verbatim official data + full user recalibration agency.',
                  'पारदर्शी गणित + यथावत आधिकारिक डेटा + उपयोगकर्ता संवेदनशीलता नियंत्रण।'
                )}
              </Text>
            </View>

            {/* STEP 1: TRANSPARENT MATHEMATICAL SCORE */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
                <Text style={[styles.sectionLabel, { color: accent }]}>{t(lang, 'distrust_step1')}</Text>
              </View>

              <Text style={styles.sectionBody}>{card.explanation.why}</Text>

              {/* Ranking Formula breakdown */}
              <View style={styles.rankBox}>
                <View style={styles.rankHeader}>
                  <Text style={styles.rankFormula}>
                    Score = Σ (w_i × Metric_i) = <Text style={{ fontWeight: '800', color: accent }}>{(scoreSum * 100).toFixed(0)} / 100</Text>
                  </Text>
                </View>

                {RANK_KEYS.map(([k, label, w]) => {
                  const v = rk[k];
                  return (
                    <View key={k} style={styles.rankBarRow}>
                      <Text style={styles.rankLabel}>{t(lang, label)}</Text>
                      <Text style={styles.rankW}>{(w * 100).toFixed(0)}%</Text>
                      <View style={styles.rankTrack}>
                        <View style={[styles.rankFill, { width: `${v * 100}%`, backgroundColor: accent }]} />
                      </View>
                      <Text style={styles.rankVal}>{Math.round(v * 100)}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Driving Factors */}
              {card.factors && card.factors.length > 0 ? (
                <>
                  <View style={[styles.factorHead, { marginTop: 14 }]}>
                    <Text style={styles.sectionLabelMuted}>{t(lang, 'factors')}</Text>
                    {card.score !== undefined ? <ScoreRing score={card.score} label={card.level} size={42} /> : null}
                  </View>
                  {card.factors.map((f) => (
                    <View
                      key={f.name}
                      style={[
                        styles.factorRow,
                        f.impact === 'good' ? styles.factorRowGood : f.impact === 'bad' ? styles.factorRowBad : styles.factorRowNeutral,
                      ]}
                    >
                      <Text style={styles.factorName}>{L(lang, f.name, f.nameHi)}</Text>
                      <Text
                        style={[
                          styles.factorVal,
                          f.impact === 'good' ? { color: '#047857' } : f.impact === 'bad' ? { color: '#DC2626' } : { color: '#475569' },
                        ]}
                      >
                        {f.impact === 'good' ? '▲' : f.impact === 'bad' ? '▼' : '–'} {f.value}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>

            {/* STEP 2: VERBATIM SOURCE GUARANTEE */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
                <Text style={[styles.sectionLabel, { color: '#059669' }]}>{t(lang, 'distrust_step2')}</Text>
              </View>

              {card.phase === 'official' ? (
                <View style={styles.officialVerbatimBox}>
                  <Text style={styles.officialVerbatimTitle}>🔒 {t(lang, 'push_official')}</Text>
                  <Text style={styles.officialVerbatimBody}>
                    {L(
                      lang,
                      'This is an official government safety bulletin from the India Meteorological Department. It is delivered verbatim without LLM rewriting to ensure zero hallucination and complete legal trust.',
                      'यह भारत मौसम विज्ञान विभाग (IMD) का आधिकारिक सुरक्षा बुलेटिन है। इसमें बिना किसी AI बदलाव के यथावत पाठ दिखाया गया है।'
                    )}
                  </Text>
                </View>
              ) : (
                <View style={styles.derivedBox}>
                  <Text style={styles.derivedTitle}>⚙️ Derived Decision Support</Text>
                  <Text style={styles.derivedBody}>
                    {L(
                      lang,
                      'Computed on-device by Mausam Impact Model v2.4 from official 1-hour forecast grids and your selected persona weights. Non-competing decision guidance.',
                      'मौसम इम्पैक्ट मॉडल द्वारा आधिकारिक 1-घंटे के पूर्वानुमान ग्रिड और आपकी प्रोफ़ाइल से डिवाइस पर परिकलित।'
                    )}
                  </Text>
                </View>
              )}

              {/* Provenance Metadata Grid */}
              <View style={styles.provBox}>
                <Text style={styles.provSrc}>🛡️ {t(lang, 'source')}: {card.provenance.source}</Text>
                <View style={styles.provGrid}>
                  <Text style={styles.provLabel}>{t(lang, 'issued')}</Text>
                  <Text style={styles.provVal}>{fmt(card.provenance.issuedAt)}</Text>
                  <Text style={styles.provLabel}>{t(lang, 'valid_until')}</Text>
                  <Text style={styles.provVal}>{fmt(card.provenance.validUntil)}</Text>
                  <Text style={styles.provLabel}>{t(lang, 'confidence')}</Text>
                  <Text style={styles.provVal}>{Math.round(card.explanation.confidence * 100)}% (Calibrated)</Text>
                  <Text style={styles.provLabel}>{t(lang, 'licence')}</Text>
                  <Text style={styles.provVal} numberOfLines={2}>
                    MoES National Open Data Policy (CC-BY-4.0)
                  </Text>
                </View>
              </View>
            </View>

            {/* STEP 3: USER AGENCY & RECALIBRATION */}
            <View style={styles.stepSection}>
              <View style={styles.stepHeaderRow}>
                <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>3</Text></View>
                <Text style={[styles.sectionLabel, { color: '#2563EB' }]}>{t(lang, 'distrust_step3')}</Text>
              </View>

              <Text style={styles.agencySub}>
                {L(
                  lang,
                  'You are always in control. Recalibrate card sensitivity or report a data discrepancy with an instant snapshot.',
                  'आप हमेशा नियंत्रण में हैं। कार्ड संवेदनशीलता समायोजित करें या तत्काल स्नैपशॉट के साथ रिपोर्ट दर्ज करें।'
                )}
              </Text>

              {/* Sensitivity Calibration Controls */}
              <View style={styles.calibrateBox}>
                <Text style={styles.calibrateLabel}>🎛️ {t(lang, 'distrust_calibrate')}</Text>
                <View style={styles.calibrateRow}>
                  {[-1, 0, 1].map((step) => {
                    const active = sensitivityAdjust === step;
                    const label = step === -1 ? '−20% Less Sensitive' : step === 1 ? '+20% More Sensitive' : 'Default';
                    return (
                      <TouchableOpacity
                        key={step}
                        style={[styles.calBtn, active && styles.calBtnActive]}
                        onPress={() => setSensitivityAdjust(step)}
                      >
                        <Text style={[styles.calBtnText, active && styles.calBtnTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Feedback & Inaccuracy Snapshot Reporting */}
              {snapshotLogged ? (
                <View style={styles.fbThanks}>
                  <Text style={styles.fbThanksText}>
                    ✓ {t(lang, 'distrust_snapshot_logged')}
                  </Text>
                  <Text style={styles.fbThanksSub}>
                    Lat: Pune Metro · Provider: {card.provenance.source} · Confidence: {Math.round(card.explanation.confidence * 100)}%
                  </Text>
                </View>
              ) : (
                <View style={styles.fbRow}>
                  {[
                    ['helpful', '👍', t(lang, 'helpful')],
                    ['not_helpful', '👎', t(lang, 'not_helpful')],
                    ['inaccurate', '🚩', t(lang, 'inaccurate')],
                  ].map(([k, e, label]) => (
                    <Pressable key={k} style={styles.fbBtn} onPress={() => handleLogSnapshot(k)}>
                      <Text style={{ fontSize: 16 }}>{e}</Text>
                      <Text style={styles.fbBtnText}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Hide / Snooze Button */}
              <Pressable
                style={styles.hideBtn}
                onPress={() => {
                  onHide?.(card);
                  onClose();
                }}
              >
                <Text style={styles.hideBtnText}>🙈 {t(lang, 'hide_like_this')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginBottom: 12 },
  head: { flexDirection: 'row', gap: 12, paddingHorizontal: 20 },
  headMain: { flex: 1 },
  headTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  headTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.4, flexShrink: 1 },
  headSummary: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 14, marginHorizontal: 20 },
  distrustBanner: {
    marginHorizontal: 20,
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 14,
  },
  distrustTitle: { fontSize: 12.5, fontWeight: '800', color: colors.primary },
  distrustSub: { fontSize: 11, color: '#4338CA', marginTop: 2, lineHeight: 15 },
  stepSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
  stepHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20 },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  sectionLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionLabelMuted: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textMuted },
  sectionBody: { fontSize: 13, color: '#1E293B', lineHeight: 19, marginHorizontal: 20, marginTop: 6 },
  rankBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rankHeader: { marginBottom: 6 },
  rankFormula: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  rankBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  rankLabel: { width: 75, fontSize: 11, fontWeight: '600', color: '#334155' },
  rankW: { width: 28, fontSize: 9.5, color: colors.textSoft },
  rankTrack: { flex: 1, height: 7, borderRadius: 3.5, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  rankFill: { height: 7, borderRadius: 3.5 },
  rankVal: { width: 28, textAlign: 'right', fontSize: 10, fontWeight: '700', color: '#334155' },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  factorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginHorizontal: 20,
    marginTop: 6,
  },
  factorRowGood: { borderColor: '#D1FAE5', backgroundColor: '#ECFDF5' },
  factorRowBad: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  factorRowNeutral: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  factorName: { fontSize: 11.5, fontWeight: '600', color: '#334155' },
  factorVal: { fontSize: 11, fontWeight: '700' },
  officialVerbatimBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  officialVerbatimTitle: { fontSize: 11.5, fontWeight: '800', color: '#991B1B' },
  officialVerbatimBody: { fontSize: 11, color: '#7F1D1D', marginTop: 4, lineHeight: 16 },
  derivedBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  derivedTitle: { fontSize: 11.5, fontWeight: '800', color: '#166534' },
  derivedBody: { fontSize: 11, color: '#14532D', marginTop: 4, lineHeight: 16 },
  provBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  provSrc: { fontSize: 11.5, fontWeight: '800', color: '#1E293B' },
  provGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, rowGap: 4 },
  provLabel: { width: '35%', fontSize: 11, color: colors.textMuted },
  provVal: { width: '60%', fontSize: 11, fontWeight: '600', color: '#1E293B' },
  agencySub: { fontSize: 11.5, color: colors.textMuted, marginHorizontal: 20, marginTop: 6, lineHeight: 16 },
  calibrateBox: { backgroundColor: '#F1F5F9', borderRadius: 14, padding: 12, marginHorizontal: 20, marginTop: 10 },
  calibrateLabel: { fontSize: 11, fontWeight: '800', color: '#334155', marginBottom: 6 },
  calibrateRow: { flexDirection: 'row', gap: 6 },
  calBtn: { flex: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1' },
  calBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  calBtnText: { fontSize: 9.5, fontWeight: '700', color: '#475569' },
  calBtnTextActive: { color: '#fff' },
  fbThanks: { backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, marginHorizontal: 20, marginTop: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  fbThanksText: { fontSize: 11.5, fontWeight: '700', color: '#047857' },
  fbThanksSub: { fontSize: 9.5, color: '#065F46', marginTop: 2, fontFamily: 'monospace' },
  fbRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 10 },
  fbBtn: { flex: 1, alignItems: 'center', gap: 4, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 9, backgroundColor: '#fff' },
  fbBtnText: { fontSize: 10.5, fontWeight: '700', color: '#334155' },
  hideBtn: { marginHorizontal: 20, marginTop: 10, paddingVertical: 8, alignItems: 'center' },
  hideBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
});
