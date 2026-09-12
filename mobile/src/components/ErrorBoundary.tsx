import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary so a render crash anywhere in the tree shows a
 * recoverable screen instead of a silent white splash. Reports the crash to
 * Sentry (when a DSN is configured), stripping personal data before sending.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error?.message, info?.componentStack);
    // Never send raw strings from the screen tree (they can embed user data).
    Sentry.withScope((scope) => {
      scope.setLevel('fatal');
      scope.setTag('crash.surface', 'render');
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    });
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title} accessibilityRole="header">Something went wrong</Text>
          <Text style={styles.subtitle}>Mausam stayed up, but this screen hit an unexpected error.</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>{String(this.state.error?.message ?? this.state.error)}</Text>
          </ScrollView>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={styles.button}
            onPress={this.reset}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFE' },
  title: { fontSize: 20, fontWeight: '700', color: '#0B2A4A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#4B6A8C', textAlign: 'center', marginBottom: 16 },
  errorBox: { maxHeight: 160, width: '100%', backgroundColor: '#FFF1F0', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText: { color: '#B3261E', fontSize: 13 },
  button: { backgroundColor: '#2563EB', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  buttonLabel: { color: '#FFFFFF', fontWeight: '600' },
});