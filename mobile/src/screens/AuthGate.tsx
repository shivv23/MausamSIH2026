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
  requestOtp,
  resetPassword,
  setAuthToken,
  setSyncServer,
  verifyOtp,
  type AuthSession,
} from '../services/profileSync';

interface Props {
  lang: Lang;
  defaultAccountId?: string;
  /** Shown when an existing session was revoked/expired and re-login is needed. */
  notice?: string;
  /** restored = the pulled cloud profile (if the account has a backup), else null → go to onboarding */
  onAuthed: (restored: UserProfile | null, accountId: string) => void;
  /** Continue without a cloud account (offline demo mode) */
  onSkip: () => void;
}

type Screen = 'main' | 'verify' | 'recover';
type VerifyPurpose = 'verify_email' | 'verify_phone';

const ID_RE = /^[A-Za-z0-9_.-]{2,64}$/;
const CODE_RE = /^\d{6}$/;

export default function AuthGate({ lang, defaultAccountId = '', notice, onAuthed, onSkip }: Props) {
  const [screen, setScreen] = useState<Screen>('main');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [server, setServer] = useState('http://localhost:8000');
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pendingSession, setPendingSession] = useState<AuthSession | null>(null);

  // verify screen
  const [verifyPurpose, setVerifyPurpose] = useState<VerifyPurpose>('verify_email');
  const [otpCode, setOtpCode] = useState('');
  const [otpDevHint, setOtpDevHint] = useState<string | undefined>();
  const [otpSentTo, setOtpSentTo] = useState<string | undefined>();
  const [otpTtl, setOtpTtl] = useState<number>(10);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpErr, setOtpErr] = useState('');

  // recover screen
  const [recoverContact, setRecoverContact] = useState('');
  const [recoverCode, setRecoverCode] = useState('');
  const [recoverNewPassword, setRecoverNewPassword] = useState('');
  const [recoverCodeSent, setRecoverCodeSent] = useState(false);

  useEffect(() => {
    getSyncServer().then((s) => setServer(s ?? 'http://localhost:8000'));
  }, []);

  const finishAuth = async (session: AuthSession, id: string) => {
    await setAuthToken(id, session.token);
    let restored: UserProfile | null = null;
    const res = await pullProfile(id, server, session.token);
    if (res.status === 'profile') restored = res.profile;
    onAuthed(restored, id);
  };

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
      const session = mode === 'signup'
        ? await registerAccount(
            server,
            id,
            password,
            email.trim() || phone.trim() ? { email: email.trim() || undefined, phone: phone.trim() || undefined } : undefined,
          )
        : await loginAccount(server, id, password);
      setPendingSession(session);
      if (mode === 'signup' && session.contactVerificationRequired && (email.trim() || phone.trim())) {
        const purpose: VerifyPurpose = email.trim() ? 'verify_email' : 'verify_phone';
        setVerifyPurpose(purpose);
        setScreen('verify');
        await sendOtp(purpose, id);
        setBusy(false);
        return;
      }
      await finishAuth(session, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // duplicate registration → nudge toward sign-in with a clear message
      if (mode === 'signup' && /already registered/i.test(msg)) {
        setErr(t(lang, 'auth_dup'));
      } else if (/session revoked|revoked/i.test(msg)) {
        setErr(t(lang, 'auth_session_revoked'));
      } else {
        setErr(t(lang, 'auth_error') + ': ' + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (purpose: VerifyPurpose, id?: string) => {
    const uid = id ?? accountId.trim();
    const contact = purpose === 'verify_email' ? email.trim() : phone.trim();
    setOtpBusy(true);
    setOtpErr('');
    try {
      const res = await requestOtp(server, uid, purpose, contact || undefined);
      setOtpDevHint(res.devCode);
      setOtpSentTo(res.sentTo);
      setOtpTtl(res.ttlMinutes);
      setOtpCode('');
    } catch (e) {
      setOtpErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOtpBusy(false);
    }
  };

  const confirmOtp = async () => {
    const id = accountId.trim();
    if (!CODE_RE.test(otpCode)) {
      setOtpErr(t(lang, 'auth_otp_invalid'));
      return;
    }
    setOtpBusy(true);
    setOtpErr('');
    try {
      const session = await verifyOtp(server, id, verifyPurpose, otpCode);
      setPendingSession(session);
      await finishAuth(session, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/locked/i.test(msg)) setOtpErr(t(lang, 'auth_otp_locked'));
      else if (/expired/i.test(msg)) setOtpErr(t(lang, 'auth_otp_expired'));
      else setOtpErr(msg || t(lang, 'auth_otp_invalid'));
    } finally {
      setOtpBusy(false);
    }
  };

  const startRecover = () => {
    setScreen('recover');
    setRecoverCodeSent(false);
    setRecoverContact('');
    setRecoverCode('');
    setRecoverNewPassword('');
    setErr('');
  };

  const sendRecoverCode = async () => {
    const id = accountId.trim();
    if (!id) {
      setErr(t(lang, 'auth_id_invalid'));
      return;
    }
    if (!recoverContact.trim()) {
      setErr(t(lang, 'sec_contact_required'));
      return;
    }
    setOtpBusy(true);
    setOtpErr('');
    try {
      const res = await requestOtp(server, id, 'reset_password', recoverContact.trim());
      setOtpDevHint(res.devCode);
      setOtpTtl(res.ttlMinutes);
      setRecoverCodeSent(true);
      setRecoverCode('');
    } catch (e) {
      setOtpErr(e instanceof Error ? e.message : String(e));
    } finally {
      setOtpBusy(false);
    }
  };

  const doReset = async () => {
    const id = accountId.trim();
    if (!CODE_RE.test(recoverCode)) {
      setErr(t(lang, 'auth_otp_invalid'));
      return;
    }
    if (!recoverNewPassword || recoverNewPassword.length < 6) {
      setErr(t(lang, 'auth_password_short'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const session = await resetPassword(server, id, recoverCode, recoverNewPassword);
      await setAuthToken(id, session.token);
      const res = await pullProfile(id, server, session.token);
      onAuthed(res.status === 'profile' ? res.profile : null, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/locked/i.test(msg)) setErr(t(lang, 'auth_otp_locked'));
      else if (/expired/i.test(msg)) setErr(t(lang, 'auth_otp_expired'));
      else setErr(msg || t(lang, 'auth_error'));
    } finally {
      setBusy(false);
    }
  };

  if (screen === 'verify') {
    const contact = verifyPurpose === 'verify_email' ? email.trim() : phone.trim();
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.container}>
            <Text style={styles.logo}>🔐</Text>
            <Text style={styles.title}>{t(lang, 'auth_otp_title')}</Text>
            {otpSentTo ? (
              <Text style={styles.subtitle}>{t(lang, 'auth_otp_sent').replace('a 6-digit code was sent to', '')}{contact || otpSentTo}</Text>
            ) : null}
            {otpDevHint ? (
              <Text style={styles.devHint}>{t(lang, 'auth_otp_dev_hint')}{'\n'}{otpDevHint}</Text>
            ) : null}
            <Text style={styles.label}>{t(lang, 'auth_otp_code')}</Text>
            <TextInput
              style={styles.input}
              value={otpCode}
              onChangeText={(v) => {
                setOtpCode(v.replace(/\D/g, '').slice(0, 6));
                setOtpErr('');
              }}
              placeholder="123456"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              autoFocus
            />
            {otpErr ? <Text style={styles.err}>{otpErr}</Text> : null}
            <TouchableOpacity style={[styles.submitBtn, otpBusy && styles.btnDisabled]} disabled={otpBusy} onPress={confirmOtp}>
              <Text style={styles.submitText}>{otpBusy ? t(lang, 'auth_otp_verifying') : t(lang, 'auth_otp_verify')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipBtn} disabled={otpBusy} onPress={() => sendOtp(verifyPurpose)}>
              <Text style={styles.skipText}>{otpBusy ? '…' : t(lang, 'auth_otp_send')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={async () => {
                await setAuthToken(accountId.trim(), pendingSession?.token ?? null);
                onAuthed(null, accountId.trim());
              }}
            >
              <Text style={styles.skipText}>{t(lang, 'auth_otp_skip')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === 'recover') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.container}>
            <TouchableOpacity onPress={() => setScreen('main')}>
              <Text style={styles.skipText}>← {t(lang, 'auth_back')}</Text>
            </TouchableOpacity>
            <Text style={styles.logo}>🔑</Text>
            <Text style={styles.title}>{t(lang, 'auth_reset_title')}</Text>
            <Text style={styles.subtitle}>{t(lang, 'auth_reset_sub')}</Text>
            <Text style={styles.label}>{t(lang, 'auth_account_id')}</Text>
            <TextInput
              style={styles.input}
              value={accountId}
              onChangeText={setAccountId}
              placeholder="riya_mehta"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.label}>{t(lang, 'auth_email')} / {t(lang, 'auth_phone')}</Text>
            <TextInput
              style={styles.input}
              value={recoverContact}
              onChangeText={setRecoverContact}
              placeholder="riya@example.com / +917000000000"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            {recoverCodeSent ? (
              <>
                {otpDevHint ? (
                  <Text style={styles.devHint}>{t(lang, 'auth_otp_dev_hint')}{'\n'}{otpDevHint}</Text>
                ) : null}
                <Text style={styles.label}>{t(lang, 'auth_reset_code')}</Text>
                <TextInput
                  style={styles.input}
                  value={recoverCode}
                  onChangeText={(v) => setRecoverCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                />
                <Text style={styles.label}>{t(lang, 'auth_new_password')}</Text>
                <TextInput
                  style={styles.input}
                  value={recoverNewPassword}
                  onChangeText={setRecoverNewPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry
                />
              </>
            ) : null}
            {otpErr ? <Text style={styles.err}>{otpErr}</Text> : null}
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <TouchableOpacity
              style={[styles.submitBtn, otpBusy && styles.btnDisabled]}
              disabled={otpBusy || busy}
              onPress={recoverCodeSent ? doReset : sendRecoverCode}
            >
              <Text style={styles.submitText}>
                {otpBusy || busy ? t(lang, 'auth_working') : recoverCodeSent ? t(lang, 'auth_reset_btn') : t(lang, 'auth_otp_send')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

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

          {notice ? (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <View style={styles.modeRow}>
            {(['signin', 'signup'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                testID={m === 'signin' ? 'auth-mode-signin' : 'auth-mode-signup'}
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
            testID="auth-server"
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
            testID="auth-id"
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
                testID="auth-name"
                placeholder="Riya Mehta"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
              />
              <Text style={styles.label}>{t(lang, 'auth_email')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="riya@example.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              <Text style={styles.label}>{t(lang, 'auth_phone')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 70000 00000"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
              />
              <Text style={styles.note}>{t(lang, 'auth_recovery_note')}</Text>
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
            testID="auth-password"
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          {mode === 'signin' ? (
            <TouchableOpacity style={styles.forgotRow} onPress={startRecover}>
              <Text style={styles.forgotText}>{t(lang, 'auth_forgot')}</Text>
            </TouchableOpacity>
          ) : null}

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={submit}
            testID="auth-submit"
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
  note: { fontSize: 11, color: colors.textSoft, marginTop: 6, lineHeight: 15 },
  noticeBanner: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  noticeText: { fontSize: 12.5, color: '#92400E', fontWeight: '700', lineHeight: 17, textAlign: 'center' },
  devHint: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12, textAlign: 'center', fontWeight: '700' },
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
  forgotRow: { alignItems: 'flex-end', marginTop: 8 },
  forgotText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  err: { color: '#B91C1C', fontSize: 12, fontWeight: '600', marginTop: 10, lineHeight: 16 },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnDisabled: { opacity: 0.5 },
  skipBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  skipText: { fontSize: 12.5, fontWeight: '600', color: '#64748B' },
});