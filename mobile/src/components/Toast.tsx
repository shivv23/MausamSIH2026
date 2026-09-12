import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; kind: ToastKind; }

type ToastListener = (t: { message: string; kind: ToastKind }) => void;
const listeners = new Set<ToastListener>();

/** Fire a global toast (auto-dismisses). Works anywhere, no context needed. */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  for (const l of listeners) l({ message, kind });
}

/** Mount once (e.g. inside the root SafeAreaProvider) to render toasts. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const pushesRef = useRef(0);

  useEffect(() => {
    const l: ToastListener = (t) => {
      const id = ++idRef.current;
      pushesRef.current += 1;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
        pushesRef.current -= 1;
      }, 3400);
    };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

// Small fade-up entrance animation for each toast.
export function ToastItem({ toast }: { toast: ToastItem }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);
  return (
    <Animated.View
      style={[styles.toast, toast.kind === 'error' ? styles.err : toast.kind === 'success' ? styles.ok : styles.info, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={styles.text} numberOfLines={3}>
        {toast.kind === 'success' ? '✓ ' : toast.kind === 'error' ? '✕ ' : ''}{toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 52,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    borderRadius: 14,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    alignSelf: 'center',
    maxWidth: 420,
    width: '100%',
  },
  ok: { backgroundColor: '#065F46' },
  err: { backgroundColor: '#991B1B' },
  info: { backgroundColor: '#0F172A' },
  text: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 },
});