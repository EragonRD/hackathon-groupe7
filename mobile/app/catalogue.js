import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { PlayCircle, Shield, SignOut, Gear, ShieldCheck, Question } from 'phosphor-react-native';
import { SAMPLE, CATALOGUE_META } from '../src/data/videos';
import { formatTime } from '../src/lib/format';
import { useAuth } from '../src/lib/auth-context';
import { theme, globalStyles } from '../src/theme';

export default function CatalogueScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const admin = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  const renderItem = ({ item }) => {
    if (item.playable) {
      return (
        <Pressable
          style={({ pressed }) => [styles.sampleCard, pressed && { opacity: 0.92 }]}
          onPress={() => router.push(`/review/${item.session}?id=${item.id}`)}
        >
          <View style={styles.sampleThumb}>
            <PlayCircle size={48} color={theme.accentInk} weight="fill" />
            <View style={styles.secureBadge}>
              <Shield size={13} color={theme.accentInk} weight="fill" />
              <Text style={styles.secureText}>chiffré</Text>
            </View>
          </View>
          <View style={styles.sampleInfo}>
            <Text style={styles.sampleTitle}>{item.title}</Text>
            <Text style={styles.sampleCategory}>{item.category}</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <View style={styles.metaCard}>
        <Image source={{ uri: item.thumb }} style={styles.metaThumb} />
        <View style={styles.metaInfo}>
          <Text style={styles.metaTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaCategory}>{item.category}</Text>
            <Text style={[globalStyles.textMono, styles.metaDuration]}>{formatTime(item.duration_sec)}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading || !user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.logo}>Poulpium</Text>
        <View style={styles.topbarActions}>
          {admin && (
            <>
              <Pressable onPress={() => router.push('/admin')} style={styles.iconBtn} hitSlop={6}>
                <Gear size={20} color={theme.textDim} />
              </Pressable>
              <Pressable onPress={() => router.push('/dashboard')} style={styles.iconBtn} hitSlop={6}>
                <ShieldCheck size={20} color={theme.textDim} />
              </Pressable>
            </>
          )}
          <Pressable onPress={() => router.push('/docs')} style={styles.iconBtn} hitSlop={6}>
            <Question size={20} color={theme.textDim} />
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.iconBtn} hitSlop={6}>
            <SignOut size={20} color={theme.textDim} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={[SAMPLE, ...CATALOGUE_META]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<Text style={styles.sectionTitle}>Catalogue</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  logo: { ...globalStyles.text, fontSize: 20, fontWeight: 'bold' },
  topbarActions: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  iconBtn: { padding: theme.space[1] },
  listContent: { padding: theme.space[4], gap: theme.space[4] },
  sectionTitle: { ...globalStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: theme.space[2], marginTop: theme.space[3] },
  sampleCard: { backgroundColor: theme.bg2, borderRadius: theme.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line, ...theme.shadow.s2, marginBottom: theme.space[2] },
  sampleThumb: { height: 200, backgroundColor: theme.bg3, justifyContent: 'center', alignItems: 'center' },
  secureBadge: { position: 'absolute', top: theme.space[3], right: theme.space[3], flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.radius.pill, gap: theme.space[1] },
  secureText: { color: theme.accentInk, fontWeight: 'bold', fontSize: 12 },
  sampleInfo: { padding: theme.space[4] },
  sampleTitle: { ...globalStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: theme.space[1] },
  sampleCategory: { ...globalStyles.text, color: theme.textDim, fontSize: 14 },
  metaCard: { flexDirection: 'row', backgroundColor: theme.bg1, borderRadius: theme.radius.md, overflow: 'hidden', opacity: 0.55 },
  metaThumb: { width: 120, height: 80, backgroundColor: theme.bg3 },
  metaInfo: { flex: 1, padding: theme.space[3], justifyContent: 'center' },
  metaTitle: { ...globalStyles.text, fontSize: 16, fontWeight: '600', marginBottom: theme.space[2] },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaCategory: { color: theme.textDim, fontSize: 14 },
  metaDuration: { color: theme.textFaint, fontSize: 14 },
});
