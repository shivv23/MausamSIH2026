import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Lang, UserProfile } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';
import {
  getSyncServer,
  loginAccount,
  pullProfile,
  registerAccount,
  setAuthToken,
  setSyncServer,
} from '../services/profileSync';

interface Props {
  lang: Lang;
  defaultAccountId?: string;
  /** restored = the pulled cloud profile (if the account has a backup), else null → go to onboarding */
  onAuthed: (restored: UserProfile | null, accountId: string) => void;
  /** Continue without a cloud account (offline demo mode) */
  onSkip: () => void;
}

const ID_RE = /^[A-Za-z0-9_.-]{2,64}$/;

export default function AuthGate({ lang, defaultAccountId = '', onAuthed, onSkip }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [server, setServer] = useState('http://localhost:8000');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getSyncServer().then((s) => setServer(s ?? 'http://localhost:8000'));
  }, []);

  const submit = async () => {
    const id = accountId.trim();
    if (!ID_RE.test(id)) {
      setErr(t(lang, 'auth_id_invalid'));
      return;
    }
    if (!password || password.length < 6) {
      setErr(t(lang, 'auth_password_short'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await setSyncServer(server);
      const token = mode === 'signup'
        ? await registerAccount(server, id, password)
        : await loginAccount(server, id, password);
      await setAuthToken(id, token);

      let restored: UserProfile | null = null;
      if (mode === 'signin') {
        const res = await pullProfile(id, server, token);
        if (res.status === 'profile') restored = res.profile;
      }
      onAuthed(restored, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // duplicate registration → nudge toward sign-in with a clear message
      if (mode === 'signup' && /already registered/i.test(msg)) {
        setErr(t(lang, 'auth_dup'));
      } else {
        setErr(t(lang, 'auth_error') + ': ' + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.logo}>⛅</Text>
          <Text style={styles.title}>{t(lang, 'auth_title')}</Text>
          <Text style={styles.subtitle}>{t(lang, 'auth_sub')}</Text>

          <View style={styles.modeRow}>
            {(['signin', 'signup'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => {
                  setMode(m);
                  setErr('');
                }}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                  {m === 'signin' ? t(lang, 'auth_signin') : t(lang, 'auth_create')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>{t(lang, 'auth_server')}</Text>
          <TextInput
            style={styles.input}
            value={server}
            onChangeText={setServer}
            placeholder="https://mausam.example.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.label}>{t(lang, 'auth_account_id')}</Text>
          <TextInput
            style={styles.input}
            value={accountId}
            onChangeText={(v) => {
              setAccountId(v);
              setErr('');
            }}
            placeholder="riya_mehta"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {mode === 'signup' ? (
            <>
              <Text style={styles.label}>{t(lang, 'auth_display_name')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Riya Mehta"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
            </>
          ) : null}

          <Text style={styles.label}>{t(lang, 'auth_password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErr('');
            }}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={submit}
          >
            <Text style={styles.submitText}>
              {busy ? t(lang, 'auth_working') : mode === 'signin' ? t(lang, 'auth_signin_btn') : t(lang, 'auth_create_btn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onSkip} disabled={busy}>
            <Text style={styles.skipText}>{t(lang, 'auth_skip')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 56, paddingBottom: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { fontSize: 44, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 22, marginBottom: 6 },
  modeBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modeTextActive: { color: '#fff' },
  label: { fontSize: 11, fontWeight: '800', color: colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
  },
  err: { color: '#B91C1C', fontSize: 12, fontWeight: '600', marginTop: 10, lineHeight: 16 },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  skipBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  skipText: { fontSize: 12.5, fontWeight: '600', color: '#64748B' },
});