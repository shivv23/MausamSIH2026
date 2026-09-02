import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Homepage, Lang } from '../engine';
import { answerQuestion, SUGGESTED_QUESTIONS } from '../engine';
import { t } from '../i18n';
import { colors } from '../theme';

interface Msg { role: 'user' | 'bot'; text: string; source?: string; chips?: string[]; }

export default function Ask({ hp, lang }: { hp: Homepage; lang: Lang }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'bot', text: t(lang, 'ask_intro') }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<ScrollView>(null);

  const scrollBottom = () => endRef.current?.scrollToEnd({ animated: true });

  useEffect(() => { scrollBottom(); }, [msgs, typing]);

  const send = (q: string) => {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const a = answerQuestion(q, hp, lang);
      setMsgs((m) => [...m, { role: 'bot', text: a.text, source: a.source, chips: a.chips?.filter(Boolean) }]);
      setTyping(false);
    }, 550);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(lang, 'ask_title')}</Text>
          <Text style={styles.sub}>{t(lang, 'ask_sub')}</Text>
        </View>

        <ScrollView ref={endRef} style={styles.msgs} contentContainerStyle={styles.msgsContent}>
          {msgs.map((m, i) => (
            <View key={i} style={[styles.bubbleWrap, m.role === 'user' ? styles.right : styles.left]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={m.role === 'user' ? styles.textUser : styles.textBot}>{m.text}</Text>
                {m.chips?.length ? (
                  <View style={styles.chipRowWrap}>
                    {m.chips.map((c) => <View key={c} style={styles.chip}><Text style={styles.chipText}>🟢 {c}</Text></View>)}
                  </View>
                ) : null}
                {m.source ? <Text style={styles.source}>🛡 {m.source}</Text> : null}
              </View>
            </View>
          ))}
          {typing ? (
            <View style={[styles.bubbleWrap, styles.left]}>
              <View style={[styles.bubble, styles.bubbleBot, { flexDirection: 'row', gap: 4 }]}>
                {[0, 1, 2].map((i) => <View key={i} style={styles.typingDot} />)}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputArea}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggRow}>
            {SUGGESTED_QUESTIONS[lang].map((q) => (
              <TouchableOpacity key={q} style={styles.suggPill} onPress={() => send(q)}>
                <Text style={styles.suggText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t(lang, 'ask_placeholder')}
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => send(input)}>
              <Text style={styles.sendText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  sub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },
  msgs: { flex: 1 },
  msgsContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  bubbleWrap: { maxWidth: '85%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleBot: { backgroundColor: '#fff', borderTopLeftRadius: 6, borderWidth: 1, borderColor: 'rgba(15,23,42,0.05)' },
  bubbleUser: { backgroundColor: colors.primary, borderTopRightRadius: 6 },
  textBot: { color: '#1E293B', fontSize: 13, lineHeight: 19 },
  textUser: { color: '#fff', fontSize: 13, lineHeight: 19 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#ECFDF5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#047857', fontSize: 11, fontWeight: '600' },
  source: { marginTop: 8, fontSize: 10, fontWeight: '600', color: colors.textSoft },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' },
  inputArea: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 6 },
  suggRow: { gap: 8, paddingBottom: 8 },
  suggPill: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DBEAFE' },
  suggText: { fontSize: 11.5, fontWeight: '600', color: colors.primary },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  input: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 6 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 15 },
});