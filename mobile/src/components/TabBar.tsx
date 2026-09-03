import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';
import type { Tab } from '../../App';
import { t } from '../i18n';
import type { Lang } from '../engine';

const ICONS: Record<Tab, string> = { home: '🏠', map: '🗺️', myday: '📅', ask: '💬', alerts: '🔔', me: '👤' };

export default function TabBar({ current, onTab, lang }: { current: Tab; onTab: (t: Tab) => void; lang: Lang }) {
  const tabs: { key: Tab; label: string }[] = [
    { key: 'home', label: t(lang, 'nav_home') },
    { key: 'map', label: t(lang, 'nav_map') },
    { key: 'myday', label: t(lang, 'nav_myday') },
    { key: 'ask', label: t(lang, 'nav_ask') },
    { key: 'alerts', label: t(lang, 'nav_alerts') },
    { key: 'me', label: t(lang, 'nav_me') },
  ];
  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {tabs.map(({ key, label }) => {
          const active = current === key;
          return (
            <TouchableOpacity key={key} style={styles.tab} onPress={() => onTab(key)}>
              <Text style={[styles.icon, active && styles.iconActive]}>{ICONS[key]}</Text>
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.card },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,23,42,0.06)',
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  icon: { fontSize: 20, opacity: 0.55 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  labelActive: { color: colors.primary, fontWeight: '800' },
});