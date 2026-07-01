import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { authFetch } from '../src/auth';
import { theme, globalStyles } from '../src/theme';
import ScreenHeader from '../src/components/ScreenHeader';

// Surveillance sécurité (lecture seule). Affiche les métriques renvoyées par
// /security/dashboard sous forme de cartes clé/valeur.
export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/security/dashboard');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const entries = data ? flatten(data) : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Surveillance" />
      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: theme.space[6] }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: theme.space[3] }}>
          {entries.map(([k, v]) => (
            <View key={k} style={styles.metric}>
              <Text style={styles.metricKey}>{k}</Text>
              <Text style={[globalStyles.textMono, styles.metricVal]}>{v}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Aplati un objet en paires clé/valeur lisibles (1 niveau).
function flatten(obj) {
  return Object.entries(obj).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  metric: { backgroundColor: theme.bg1, borderRadius: theme.radius.sm, padding: theme.space[3], marginBottom: theme.space[2] },
  metricKey: { color: theme.textDim, fontSize: 13 },
  metricVal: { color: theme.text, fontSize: 18, marginTop: 2 },
  error: { color: theme.textFaint, textAlign: 'center', padding: theme.space[5] },
});
