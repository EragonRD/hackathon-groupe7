import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, SectionList, ActivityIndicator, Pressable, Alert, Share,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { UploadSimple, Trash } from 'phosphor-react-native';
import { theme, globalStyles } from '../src/theme';
import ScreenHeader from '../src/components/ScreenHeader';
import NavBar from '../src/components/NavBar';
import {
  listUsers, listContents, revokeContent, restoreContent, deleteContent, inviteGuest, uploadVideo,
} from '../src/lib/admin';

// Administration multi-tenant. Upload d'une vidéo, actions sur les contenus
// (révoquer/restaurer la clé, supprimer), génération d'un lien d'invité.
export default function AdminScreen() {
  const [users, setUsers] = useState([]);
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploadPct, setUploadPct] = useState(null);
  const [busy, setBusy] = useState(null); // id du contenu en cours d'action

  const load = useCallback(async () => {
    try {
      setError(null);
      const [u, c] = await Promise.all([listUsers(), listContents()]);
      setUsers(u);
      setContents(c);
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickAndUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      const asset = res?.assets?.[0] ?? (res?.type === 'success' ? res : null);
      if (!asset?.uri) return;
      setUploadPct(0);
      await uploadVideo({ uri: asset.uri, name: asset.name, title: asset.name, onProgress: setUploadPct });
      setUploadPct(null);
      Alert.alert('Upload', 'Vidéo envoyée — chiffrement en cours côté serveur.');
      load();
    } catch (e) {
      setUploadPct(null);
      Alert.alert('Upload', String(e?.message ?? e));
    }
  };

  const withBusy = async (id, fn, okMsg) => {
    setBusy(id);
    try {
      await fn();
      if (okMsg) Alert.alert('Admin', okMsg);
      load();
    } catch (e) {
      Alert.alert('Admin', String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const onRevoke = (c) =>
    c.revoked
      ? withBusy(c.id, () => restoreContent(c.id), 'Clé restaurée — lecture rétablie.')
      : withBusy(c.id, () => revokeContent(c.id), 'Clé révoquée — lecture bloquée (403).');

  const onDelete = (c) =>
    Alert.alert('Supprimer', `Supprimer « ${c.title ?? c.id} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => withBusy(c.id, () => deleteContent(c.id), 'Contenu supprimé.'),
      },
    ]);

  const onInvite = async (c) => {
    try {
      const { shareUrl } = await inviteGuest(c.id, '24h');
      await Share.share({ message: shareUrl, title: `Invitation ${c.title ?? c.id}` });
    } catch (e) {
      Alert.alert('Invitation', String(e?.message ?? e));
    }
  };

  const sections = [
    { title: `Contenus (${contents.length})`, type: 'content', data: contents },
    { title: `Utilisateurs (${users.length})`, type: 'user', data: users },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Administration" />

      <Pressable style={[styles.uploadBtn, uploadPct !== null && styles.uploadBtnBusy]} onPress={pickAndUpload} disabled={uploadPct !== null}>
        <UploadSimple size={18} color={theme.accentInk} weight="fill" />
        <Text style={styles.uploadText}>{uploadPct !== null ? `Envoi… ${uploadPct}%` : 'Importer une vidéo'}</Text>
      </Pressable>
      {uploadPct !== null ? (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${uploadPct}%` }]} />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={theme.accent} style={{ marginTop: theme.space[6] }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => String(item.id ?? item.username ?? i)}
          contentContainerStyle={{ padding: theme.space[3], paddingBottom: 90 }}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item, section }) =>
            section.type === 'content' ? (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.rowLabel} numberOfLines={1}>{item.title ?? item.id}</Text>
                  <Text style={[styles.statusTag, item.revoked ? styles.tagDanger : styles.tagOk]}>
                    {item.revoked ? 'révoqué' : (item.status ?? 'prêt')}
                  </Text>
                </View>
                <Text style={[globalStyles.textMono, styles.rowMeta]}>{item.id}</Text>
                <View style={styles.cardActions}>
                  <Pressable style={styles.cardBtn} onPress={() => onInvite(item)}>
                    <Text style={styles.cardBtnText}>Inviter</Text>
                  </Pressable>
                  <Pressable style={styles.cardBtn} onPress={() => onRevoke(item)} disabled={busy === item.id}>
                    <Text style={[styles.cardBtnText, { color: item.revoked ? theme.ok : theme.warn }]}>
                      {item.revoked ? 'Restaurer' : 'Révoquer'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.cardBtn} onPress={() => onDelete(item)} disabled={busy === item.id}>
                    <Trash size={15} color={theme.danger} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{item.username ?? item.id}</Text>
                <Text style={[globalStyles.textMono, styles.rowMeta]}>{item.role ?? ''}</Text>
              </View>
            )
          }
          ListEmptyComponent={<Text style={styles.error}>Aucune donnée.</Text>}
        />
      )}
      <NavBar active="admin" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.accent, marginHorizontal: theme.space[3], marginTop: theme.space[2],
    paddingVertical: theme.space[3], borderRadius: theme.radius.md,
  },
  uploadBtnBusy: { opacity: 0.7 },
  uploadText: { color: theme.accentInk, fontWeight: 'bold', fontSize: 15 },
  progressBar: { height: 4, backgroundColor: theme.bg2, marginHorizontal: theme.space[3], marginTop: 6, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.accent },
  section: { color: theme.textDim, fontSize: 13, fontWeight: 'bold', marginTop: theme.space[4], marginBottom: theme.space[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.bg1, borderRadius: theme.radius.sm, padding: theme.space[3], marginBottom: theme.space[2] },
  card: { backgroundColor: theme.bg1, borderRadius: theme.radius.md, padding: theme.space[3], marginBottom: theme.space[2] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTag: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.pill, overflow: 'hidden' },
  tagOk: { color: theme.ok, borderWidth: 1, borderColor: theme.ok },
  tagDanger: { color: theme.danger, borderWidth: 1, borderColor: theme.danger },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: theme.space[4], marginTop: theme.space[3] },
  cardBtn: { paddingVertical: 4 },
  cardBtnText: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  rowLabel: { color: theme.text, fontSize: 15, flex: 1, marginRight: theme.space[2] },
  rowMeta: { color: theme.textFaint, fontSize: 12, marginTop: 2 },
  error: { color: theme.textFaint, textAlign: 'center', padding: theme.space[5] },
});
