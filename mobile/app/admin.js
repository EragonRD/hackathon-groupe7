import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, SectionList, ActivityIndicator } from 'react-native';
import { authFetch } from '../src/auth';
import { theme, globalStyles } from '../src/theme';
import ScreenHeader from '../src/components/ScreenHeader';
import NavBar from '../src/components/NavBar';

// Administration multi-tenant (lecture seule mobile). Le CRUD complet reste sur
// le web ; ici on affiche utilisateurs et contenus autorisés par le Core.
export default function AdminScreen() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [uRes, cRes] = await Promise.all([authFetch('/admin/users'), authFetch('/admin/contents')]);
        const users = uRes.ok ? await uRes.json() : [];
        const contents = cRes.ok ? await cRes.json() : [];
        setSections([
          { title: `Utilisateurs (${users.length})`, data: users.map((u) => ({ key: u.username ?? u.id, label: u.username ?? u.id, meta: u.role ?? '' })) },
          { title: `Contenus (${contents.length})`, data: contents.map((c) => ({ key: c.id, label: c.title ?? c.id, meta: c.id })) },
        ]);
      } catch (e) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Administration" />
      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: theme.space[6] }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.key)}
          contentContainerStyle={{ padding: theme.space[3] }}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={[globalStyles.textMono, styles.rowMeta]}>{item.meta}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.error}>Aucune donnée.</Text>}
        />
      )}
      <NavBar active="admin" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  section: { color: theme.textDim, fontSize: 13, fontWeight: 'bold', marginTop: theme.space[4], marginBottom: theme.space[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.bg1, borderRadius: theme.radius.sm, padding: theme.space[3], marginBottom: theme.space[2] },
  rowLabel: { color: theme.text, fontSize: 15 },
  rowMeta: { color: theme.textFaint, fontSize: 12 },
  error: { color: theme.textFaint, textAlign: 'center', padding: theme.space[5] },
});
