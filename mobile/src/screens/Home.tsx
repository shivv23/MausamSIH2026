import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchHomepage,
  loadCachedHomepage,
  clearProfile,
  type FetchResult,
} from '../api/client';
import type { HomepageCard, HomepageResponse, UserProfile } from '../types';
import { colors, scoreColor, phaseColor } from '../theme';

interface Props {
  profile: UserProfile;
  goHome: () => void;
}

export default function Home({ profile, goHome }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [res, setRes] = useState<HomepageResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [explaining, setExplaining] = useState<HomepageCard | null>(null);

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      const result: FetchResult = await fetchHomepage(profile);
      if (result.ok && result.data) {
        setRes(result.data);
        setOffline(result.offline);
        setMessage(result.message);
        setError(undefined);
      } else {
        setError(result.message || 'Unable to load homepage.');
      }
      if (showSpinner) setLoading(false);
    },
    [profile],
  );

  useEffect(() => {
    // optimistic: render cache immediately, then fresh data
    loadCachedHomepage().then((c) => {
      if (c && !res) {
        setRes(c.res);
        setOffline(true);
        setMessage(`Offline (cached ${new Date(c.ts).toLocaleTimeString()})`);
      }
    });
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.user_id, profile.city]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  const reset = () => {
    Alert.alert('Log out', 'Clear this profile and go back to onboarding?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await clearProfile(); goHome(); } },
    ]);
  };

  if (loading && !res) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Personalizing your homepage…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !res) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn’t reach Mausam 👋</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset}>
            <Text style={styles.resetLink}>Back to onboarding</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!res) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {greet(res)}</Text>
            <Text style={styles.location}>📍 {res.city || profile.city || 'India'}</Text>
          </View>
          <TouchableOpacity onPress={reset} accessibilityRole="button" accessibilityLabel="Reset profile">
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(profile.user_id)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.personaRow}>
          {res.personas.map((p) => (
            <View key={p} style={styles.personaChip}>
              <Text style={styles.personaChipText}>{p}</Text>
            </View>
          ))}
        </View>

        {(offline || message) && (
          <View style={[styles.banner, offline ? styles.bannerOffline : styles.bannerInfo]}>
            <Text style={styles.bannerText}>{message || (offline ? 'Offline — showing cached data' : '')}</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>For you today</Text>

        {res.cards.map((card) => (
          <Card key={card.id} card={card} onWhy={() => setExplaining(card)} />
        ))}

        <Text style={styles.metadata}>
          Updated {res.metadata?.dataFreshness || 'recently'} · data & all cards carry source + confidence
        </Text>
      </ScrollView>

      <ExplanationSheet card={explaining} onClose={() => setExplaining(null)} />
    </SafeAreaView>
  );
}

function greet(res: HomepageResponse): string {
  const h = new Date(res.generated_at).getHours() || new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function initials(id: string): string {
  return (id || 'u').slice(0, 2).toUpperCase();
}

function Card({ card, onWhy }: { card: HomepageCard; onWhy: () => void }) {
  const score = typeof card.data.score === 'number' ? card.data.score : undefined;
  const isOfficial = card.phase === 'official' || card.type === 'severe_warning';
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isOfficial && styles.cardOfficial,
      ]}
      onPress={onWhy}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.summary}`}
    >
      <View style={styles.cardRow}>
        <View style={styles.cardMain}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, isOfficial && styles.cardTitleOfficial]}>{card.title}</Text>
            {card.phase && <PhaseBadge phase={card.phase} />}
          </View>
          <Text style={styles.cardSummary}>{card.summary}</Text>
        </View>
        {score !== undefined && <ScoreRing score={score} />}
      </View>
      <Text style={styles.cardWhy}>Why? {card.explanation.why_shown}</Text>
    </TouchableOpacity>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  return (
    <View style={[styles.phaseBadge, { backgroundColor: `${phaseColor(phase)}22` }]}>
      <Text style={[styles.phaseText, { color: phaseColor(phase) }]}>{phase.toUpperCase()}</Text>
    </View>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <View style={styles.ring}>
      <Text style={[styles.ringScore, { color }]}>{score}</Text>
      <Text style={styles.ringLabel}>{labelFor(score)}</Text>
    </View>
  );
}

function labelFor(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Poor';
  return 'Avoid';
}

function ExplanationSheet({ card, onClose }: { card: HomepageCard | null; onClose: () => void }) {
  return (
    <Modal visible={card !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{card?.title}</Text>
          <Text style={styles.modalSummary}>{card?.summary}</Text>
          <View style={styles.divider} />
          <Text style={styles.modalLabel}>Why am I seeing this?</Text>
          <Text style={styles.modalBody}>{card?.explanation.why_shown}</Text>
          <Text style={styles.modalLabel}>Source</Text>
          <Text style={styles.modalBody}>
            {card?.provenance.source} · issued {prettyDate(card?.provenance.issued_at)} · valid until{' '}
            {prettyDate(card?.provenance.valid_until)}
          </Text>
          <Text style={styles.modalLabel}>Confidence</Text>
          <Text style={styles.modalBody}>{Math.round((card?.explanation.confidence ?? 0) * 100)}%</Text>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function prettyDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: colors.textMuted },
  errorTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  errorBody: { marginTop: 8, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retry: { marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '700' },
  resetLink: { marginTop: 16, color: colors.primary, textDecorationLine: 'underline' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
  location: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  personaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  personaChip: { backgroundColor: colors.primaryLight, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  personaChipText: { color: '#0A2540', fontSize: 12, fontWeight: '600' },
  banner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  bannerOffline: { backgroundColor: '#FFF8E1' },
  bannerInfo: { backgroundColor: '#E3F2FD' },
  bannerText: { color: colors.text, fontSize: 13 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  cardOfficial: { borderColor: colors.warningRed, borderWidth: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1, paddingRight: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardTitleOfficial: { color: colors.warningRed },
  cardSummary: { fontSize: 14, color: colors.textMuted, marginTop: 6, lineHeight: 20 },
  cardWhy: { fontSize: 12, color: colors.textMuted, marginTop: 10, fontStyle: 'italic' },
  phaseBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  phaseText: { fontSize: 10, fontWeight: '800' },
  ring: { width: 68, height: 68, borderRadius: 34, borderWidth: 4, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 24, fontWeight: '800' },
  ringLabel: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  metadata: { marginTop: 8, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalSummary: { fontSize: 14, color: colors.textMuted, marginTop: 6 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 14 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 10 },
  modalBody: { fontSize: 14, color: colors.text, marginTop: 4, lineHeight: 20 },
  modalClose: { marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '700' },
});