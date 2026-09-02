import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PERSONAS, type UserProfile, type PersonaOption } from '../types';
import { colors } from '../theme';

interface Props {
  onDone: (profile: UserProfile) => void;
}

export default function Onboarding({ onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [city, setCity] = useState('pune');

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const finish = () => {
    const personas = Array.from(selected);
    if (personas.length === 0) {
      Alert.alert('Choose what matters', 'Pick at least one interest to personalize your homepage.');
      return;
    }
    const userId = (name.trim() || 'user').toLowerCase().replace(/\s+/g, '_') || 'user';
    onDone({ user_id: userId, personas, language: 'en', city: city.trim() || 'pune' });
  };

  const renderPersona = (p: PersonaOption) => {
    const active = selected.has(p.key);
    return (
      <TouchableOpacity
        key={p.key}
        style={[styles.persona, active && { borderColor: p.color, backgroundColor: `${p.color}10` }]}
        onPress={() => toggle(p.key)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={p.label}
      >
        <Text style={styles.personaIcon}>{p.icon}</Text>
        <Text style={[styles.personaLabel, active && { color: p.color }]}>{p.label}</Text>
        <Text style={styles.personaDesc}>{p.description}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Your Mausam is ready to be built 🎯</Text>
        <Text style={styles.subtitle}>
          What matters to you? Select all that apply — we rank your homepage around this.
        </Text>

        <View style={styles.grid}>{PERSONAS.map(renderPersona)}</View>

        <Text style={styles.fieldLabel}>Your name (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Ananya"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>Your city</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. pune, delhi, mumbai, chennai, punjab"
          placeholderTextColor={colors.textMuted}
          value={city}
          onChangeText={setCity}
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.cta} onPress={finish} accessibilityRole="button">
          <Text style={styles.ctaText}>Personalize my homepage →</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Tip: you belong to the 8 personas (Health, Fitness, Beach, Travel, Parent, Farming, Commuter, Events).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 20, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 4 },
  persona: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 12,
  },
  personaIcon: { fontSize: 30 },
  personaLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 },
  personaDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
  cta: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { marginTop: 18, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});