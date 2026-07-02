import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Image, SafeAreaView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PlayCircle, Shield, SignOut, UploadSimple, Warning } from 'phosphor-react-native';
import NavBar from '../src/components/NavBar';
import { listMyContents } from '../src/lib/contents';
import { useAuth } from '../src/lib/auth-context';
import { theme, globalStyles } from '../src/theme';

// Base des flux vidéo (même résolution que SecureVideo) : la vignette est servie
// par le Core sous /videos/:id/thumbnail.jpg (route publique, pas de JWT requis).
const MEDIA =
  process.env.EXPO_PUBLIC_HLS_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const POLL_MS = 4000;

export default function CatalogueScreen() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();

  const [contents, setContents] = useState([]);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async ({ silent } = {}) => {
    if (!silent) setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const list = await listMyContents();
      setContents(list);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  // Chargement initial dès qu'un utilisateur est authentifié.
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Re-poll silencieux tant qu'un contenu est en cours de chiffrement
  // ('processing') : reflète la progression et le passage à 'playable' sans
  // action de l'utilisateur.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (contents.some((c) => c.status === 'processing')) {
      timerRef.current = setTimeout(() => load({ silent: true }), POLL_MS);
    }
    return () => clearTimeout(timerRef.current);
  }, [contents, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  }, [load]);

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  const renderItem = ({ item }) => {
    const failed = item.status === 'failed';
    const pct = Math.max(0, Math.min(100, Math.round(item.progress ?? 0)));

    // Contenu lisible : carte cliquable -> ouverture de la revue (session = id).
    if (item.playable) {
      return (
        <Pressable
          style={({ pressed }) => [styles.sampleCard, pressed && { opacity: 0.92 }]}
          onPress={() => router.push(`/review/${item.id}?id=${item.id}`)}
        >
          <View style={styles.sampleThumb}>
            <Image
              source={{ uri: `${MEDIA}/videos/${item.id}/thumbnail.jpg` }}
              style={styles.thumbImg}
            />
            <View style={styles.thumbOverlay}>
              <PlayCircle size={48} color={theme.accentInk} weight="fill" />
            </View>
            <View style={styles.secureBadge}>
              <Shield size={13} color={theme.accentInk} weight="fill" />
              <Text style={styles.secureText}>chiffré</Text>
            </View>
          </View>
          <View style={styles.sampleInfo}>
            <Text style={styles.sampleTitle} numberOfLines={1}>{item.title}</Text>
            {item.guestUpload ? <Text style={styles.sampleCategory}>Depot invite</Text> : null}
          </View>
        </Pressable>
      );
    }

    // Non lisible : en cours de chiffrement (progression) ou en échec.
    return (
      <View style={[styles.metaCard, failed && styles.metaCardFailed]}>
        <View style={styles.metaThumb}>
          {failed ? <Warning size={22} color={theme.danger} /> : <ActivityIndicator color={theme.accent} />}
        </View>
        <View style={styles.metaInfo}>
          <Text style={styles.metaTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.metaStatus}>
            {failed ? 'Echec du traitement' : `Chiffrement en cours ${pct}%`}
          </Text>
        </View>
      </View>
    );
  };

  if (loading || !user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.logo}>Poulpium</Text>
        <Pressable onPress={handleLogout} style={styles.iconBtn} hitSlop={6}>
          <SignOut size={20} color={theme.textDim} />
        </Pressable>
      </View>

      {state === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={theme.accent} size="large" /></View>
      ) : state === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Catalogue indisponible</Text>
          <Text style={styles.emptyText}>Le service est injoignable.</Text>
          <Pressable style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Reessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={contents}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.sectionTitle}>Catalogue</Text>}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <UploadSimple size={40} color={theme.textFaint} />
              <Text style={styles.emptyTitle}>Aucune video</Text>
              <Text style={styles.emptyText}>
                Uploadez une video depuis l&apos;espace admin pour la retrouver ici.
              </Text>
            </View>
          }
        />
      )}
      <NavBar active="catalogue" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space[5], gap: theme.space[2] },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space[4], paddingVertical: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  logo: { ...globalStyles.text, fontSize: 20, fontWeight: 'bold' },
  iconBtn: { padding: theme.space[1] },
  listContent: { padding: theme.space[4], gap: theme.space[4], flexGrow: 1 },
  sectionTitle: { ...globalStyles.text, fontSize: 22, fontWeight: 'bold', marginBottom: theme.space[2], marginTop: theme.space[3] },
  sampleCard: { backgroundColor: theme.bg2, borderRadius: theme.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.line, ...theme.shadow.s2, marginBottom: theme.space[2] },
  sampleThumb: { height: 200, backgroundColor: theme.bg3, justifyContent: 'center', alignItems: 'center' },
  thumbImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(7,9,12,0.35)' },
  secureBadge: { position: 'absolute', top: theme.space[3], right: theme.space[3], flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingHorizontal: theme.space[2], paddingVertical: theme.space[1], borderRadius: theme.radius.pill, gap: theme.space[1] },
  secureText: { color: theme.accentInk, fontWeight: 'bold', fontSize: 12 },
  sampleInfo: { padding: theme.space[4] },
  sampleTitle: { ...globalStyles.text, fontSize: 18, fontWeight: 'bold', marginBottom: theme.space[1] },
  sampleCategory: { ...globalStyles.text, color: theme.textDim, fontSize: 14 },
  metaCard: { flexDirection: 'row', backgroundColor: theme.bg1, borderRadius: theme.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.line, alignItems: 'center' },
  metaCardFailed: { borderColor: theme.danger },
  metaThumb: { width: 96, height: 72, backgroundColor: theme.bg3, alignItems: 'center', justifyContent: 'center' },
  metaInfo: { flex: 1, padding: theme.space[3], justifyContent: 'center' },
  metaTitle: { ...globalStyles.text, fontSize: 16, fontWeight: '600', marginBottom: theme.space[1] },
  metaStatus: { color: theme.textDim, fontSize: 13 },
  emptyTitle: { ...globalStyles.text, fontSize: 18, fontWeight: 'bold' },
  emptyText: { color: theme.textDim, fontSize: 14, textAlign: 'center' },
  retryBtn: { marginTop: theme.space[2], backgroundColor: theme.accent, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], borderRadius: theme.radius.pill },
  retryText: { color: theme.accentInk, fontWeight: 'bold' },
});
