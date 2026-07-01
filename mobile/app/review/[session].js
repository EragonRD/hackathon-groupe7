import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, SafeAreaView, FlatList, TextInput, Share, Alert, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
// API "legacy" : documentDirectory / read/writeAsStringAsync (l'API par défaut
// d'expo-file-system SDK 57 a changé de forme ; legacy reste stable et suffit ici).
import * as FileSystem from 'expo-file-system/legacy';
import {
  CaretLeft, Play, Pause, ChatText, Cursor, PencilSimple, ArrowUpRight, Rectangle,
  Circle, TextT, Eraser, Broadcast, DownloadSimple, UploadSimple, Trash, PaperPlaneRight,
} from 'phosphor-react-native';
import { useReview } from '../../src/lib/useReview';
import { useAuth } from '../../src/lib/auth-context';
import SecureVideo from '../../src/components/SecureVideo';
import DrawingLayer from '../../src/components/DrawingLayer';
import { theme, globalStyles } from '../../src/theme';
import { formatTime, initials } from '../../src/lib/format';

const TOOLS = [
  { id: 'cursor', Icon: Cursor },
  { id: 'pen', Icon: PencilSimple },
  { id: 'arrow', Icon: ArrowUpRight },
  { id: 'rect', Icon: Rectangle },
  { id: 'ellipse', Icon: Circle },
  { id: 'text', Icon: TextT },
  { id: 'eraser', Icon: Eraser },
];

const SHAPE_WINDOW = 2.5; // s : fenêtre d'affichage des dessins d'une note autour de son temps

export default function ReviewScreen() {
  const { session, id } = useLocalSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);
  const currentTimeRef = useRef(0);

  const [tool, setTool] = useState('cursor');
  const [color, setColor] = useState(theme.ink.red);
  const [draftShapes, setDraftShapes] = useState([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [pendingText, setPendingText] = useState(null); // { x, y } en attente de saisie
  const [textValue, setTextValue] = useState('');
  const [barW, setBarW] = useState(1);

  const {
    notes, peers, addNote, removeNote, replaceNotes, sendCursor,
    presenterId, isPresenter, claimPresenter, releasePresenter,
    sendPlayback, sendHeartbeat, subscribePlayback,
  } = useReview({ session, user, mode: 'socket' });

  const locked = Boolean(presenterId) && !isPresenter; // invité : contrôles verrouillés

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [loading, user, router]);

  // Réception des commandes de lecture du présentateur.
  useEffect(() => {
    const unsub = subscribePlayback((evt) => {
      if (evt.paused !== undefined) setPaused(evt.paused);
      if (evt.position !== undefined && videoRef.current) {
        if (evt.kind === 'heartbeat') {
          // Recalage de dérive seulement si l'écart dépasse le seuil.
          if (Math.abs(currentTimeRef.current - evt.position) > 0.4) {
            videoRef.current.seek(evt.position);
          }
        } else {
          videoRef.current.seek(evt.position);
        }
      }
    });
    return unsub;
  }, [subscribePlayback]);

  // Battement régulier du présentateur (anti-dérive).
  useEffect(() => {
    if (!isPresenter) return;
    const iv = setInterval(() => {
      sendHeartbeat({ position: currentTimeRef.current, paused });
    }, 2000);
    return () => clearInterval(iv);
  }, [isPresenter, paused, sendHeartbeat]);

  const handleProgress = (data) => {
    currentTimeRef.current = data.currentTime;
    setCurrentTime(data.currentTime);
  };

  const togglePlay = () => {
    if (locked) return;
    const next = !paused;
    setPaused(next);
    if (isPresenter) sendPlayback({ action: next ? 'pause' : 'play', position: currentTimeRef.current });
  };

  const seekTo = useCallback(
    (t) => {
      if (locked) return;
      videoRef.current?.seek(t);
      if (isPresenter) sendPlayback({ action: 'seek', position: t });
    },
    [locked, isPresenter, sendPlayback],
  );

  // Dessin : composition dans un brouillon, attaché à la note à l'envoi.
  const commitShape = (s) => setDraftShapes((prev) => [...prev, s]);
  const clearDraft = () => setDraftShapes([]);
  const eraseAt = (x, y) =>
    setDraftShapes((prev) => {
      let best = -1;
      let bestD = 0.06; // seuil de proximité (normalisé)
      prev.forEach((s, i) => {
        const c = shapeCenter(s);
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      return best >= 0 ? prev.filter((_, i) => i !== best) : prev;
    });

  const confirmText = () => {
    if (pendingText && textValue.trim()) {
      commitShape({ tool: 'text', color, at: pendingText, value: textValue.trim() });
    }
    setPendingText(null);
    setTextValue('');
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text && draftShapes.length === 0) return;
    addNote({ time: currentTimeRef.current, text, shapes: draftShapes, color });
    setCommentText('');
    clearDraft();
  };

  // Formes des notes proches de l'instant courant (lecture seule sur l'image).
  const committedShapes = notes
    .filter((n) => Math.abs(n.time - currentTime) <= SHAPE_WINDOW)
    .flatMap((n) => n.shapes || []);

  const exportNotes = async () => {
    try {
      const payload = JSON.stringify(
        { version: 1, session, exportedAt: new Date().toISOString(), notes },
        null,
        2,
      );
      const uri = `${FileSystem.documentDirectory ?? ''}poulpium-${session}.json`;
      if (FileSystem.writeAsStringAsync) {
        await FileSystem.writeAsStringAsync(uri, payload);
        await Share.share({ url: uri, message: payload, title: `Notes ${session}` });
      } else {
        await Share.share({ message: payload, title: `Notes ${session}` });
      }
    } catch (e) {
      Alert.alert('Export', String(e?.message ?? e));
    }
  };

  const importNotes = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      const asset = res?.assets?.[0] ?? (res?.type === 'success' ? res : null);
      if (!asset?.uri) return;
      const raw = await FileSystem.readAsStringAsync(asset.uri);
      const data = JSON.parse(raw);
      if (Array.isArray(data?.notes)) {
        replaceNotes(data.notes);
        Alert.alert('Import', `${data.notes.length} note(s) importée(s).`);
      } else {
        Alert.alert('Import', 'Fichier invalide (champ "notes" absent).');
      }
    } catch (e) {
      Alert.alert('Import', String(e?.message ?? e));
    }
  };

  if (loading || !user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Topbar */}
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <CaretLeft size={22} color={theme.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{id || session}</Text>
        <View style={styles.presence}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={[globalStyles.textMono, styles.liveText]}>{peers.length + 1}</Text>
          </View>
          {peers.slice(0, 3).map((p, i) => (
            <View key={p.id} style={[styles.avatar, { backgroundColor: p.color, marginLeft: -8, zIndex: 3 - i }]}>
              <Text style={styles.avatarText}>{initials(p.name)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Lecteur + calque + curseurs distants */}
      <View style={styles.playerContainer}>
        <SecureVideo
          ref={videoRef}
          contentId={id || 'poc'}
          paused={paused}
          onProgress={handleProgress}
          onLoad={(d) => setDuration(d?.duration ?? 0)}
        />
        <DrawingLayer
          draftShapes={draftShapes}
          committedShapes={committedShapes}
          tool={tool}
          color={color}
          onCommitShape={commitShape}
          onEraseAt={eraseAt}
          onRequestText={(x, y) => setPendingText({ x, y })}
          onCursor={sendCursor}
        />
        {peers.filter((p) => p.cursor).map((p) => (
          <View key={p.id} pointerEvents="none" style={[styles.cursor, { left: `${p.cursor.x * 100}%`, top: `${p.cursor.y * 100}%` }]}>
            <View style={[styles.cursorDot, { backgroundColor: p.color }]} />
            <Text style={[styles.cursorLabel, { backgroundColor: p.color }]}>{p.name}</Text>
          </View>
        ))}
        <Text style={styles.watermark} pointerEvents="none">{user.username} · Poulpium</Text>
        {locked && (
          <View style={styles.lockBanner} pointerEvents="none">
            <Broadcast size={14} color={theme.accentInk} weight="fill" />
            <Text style={styles.lockText}>Lecture pilotée par le présentateur</Text>
          </View>
        )}
      </View>

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <Pressable
          style={styles.timelineBar}
          onLayout={(e) => setBarW(e.nativeEvent.layout.width || 1)}
          onPress={(e) => {
            if (!duration) return;
            const frac = Math.max(0, Math.min(1, e.nativeEvent.locationX / barW));
            seekTo(frac * duration);
          }}
        >
          <View style={[styles.timelineProgress, { width: duration ? `${(currentTime / duration) * 100}%` : '0%' }]} />
          {notes.map((n) => (
            <Pressable
              key={n.id}
              hitSlop={8}
              style={[styles.marker, { left: `${(n.time / (duration || 1)) * 100}%`, backgroundColor: n.color || theme.accent }]}
              onPress={() => seekTo(n.time)}
            />
          ))}
        </Pressable>
        <Text style={[globalStyles.textMono, styles.timecode]}>{formatTime(currentTime)}</Text>
      </View>

      {/* Barre d'outils */}
      <View style={styles.toolbar}>
        <Pressable onPress={togglePlay} style={[styles.toolBtn, locked && styles.toolBtnDisabled]}>
          {paused ? <Play size={22} color={theme.text} weight="fill" /> : <Pause size={22} color={theme.text} weight="fill" />}
        </Pressable>
        <View style={styles.divider} />
        {TOOLS.map(({ id: tid, Icon }) => (
          <Pressable key={tid} onPress={() => setTool(tid)} style={[styles.toolBtn, tool === tid && styles.toolBtnActive]}>
            <Icon size={20} color={tool === tid ? theme.accent : theme.text} weight={tool === tid ? 'fill' : 'regular'} />
          </Pressable>
        ))}
        <View style={styles.divider} />
        {Object.entries(theme.ink).map(([name, hex]) => (
          <Pressable
            key={name}
            onPress={() => setColor(hex)}
            style={[styles.colorBtn, { backgroundColor: hex, borderWidth: color === hex ? 2 : 0, borderColor: theme.text }]}
          />
        ))}
      </View>

      {/* Actions secondaires */}
      <View style={styles.actionsRow}>
        <Pressable onPress={isPresenter ? releasePresenter : claimPresenter} style={styles.actionBtn}>
          <Broadcast size={16} color={isPresenter ? theme.accent : theme.textDim} weight={isPresenter ? 'fill' : 'regular'} />
          <Text style={[styles.actionText, isPresenter && { color: theme.accent }]}>{isPresenter ? 'Rendre la main' : 'Présenter'}</Text>
        </Pressable>
        <Pressable onPress={clearDraft} style={styles.actionBtn} disabled={draftShapes.length === 0}>
          <Trash size={16} color={draftShapes.length ? theme.textDim : theme.textFaint} />
          <Text style={[styles.actionText, !draftShapes.length && { color: theme.textFaint }]}>Effacer ({draftShapes.length})</Text>
        </Pressable>
        <Pressable onPress={exportNotes} style={styles.actionBtn}>
          <DownloadSimple size={16} color={theme.textDim} />
          <Text style={styles.actionText}>Export</Text>
        </Pressable>
        <Pressable onPress={importNotes} style={styles.actionBtn}>
          <UploadSimple size={16} color={theme.textDim} />
          <Text style={styles.actionText}>Import</Text>
        </Pressable>
        <Pressable onPress={() => setShowComments((s) => !s)} style={[styles.actionBtn, showComments && styles.toolBtnActive]}>
          <ChatText size={16} color={showComments ? theme.accent : theme.textDim} />
          <Text style={[styles.actionText, showComments && { color: theme.accent }]}>{notes.length}</Text>
        </Pressable>
      </View>

      {/* Panneau commentaires */}
      {showComments && (
        <View style={styles.commentsPanel}>
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.empty}>Aucun commentaire pour l’instant.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => seekTo(item.time)} onLongPress={() => removeNote(item.id)} style={styles.commentItem}>
                <View style={[styles.commentAvatar, { backgroundColor: item.author.color }]}>
                  <Text style={styles.avatarText}>{initials(item.author.name)}</Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{item.author.name}</Text>
                    <Text style={[globalStyles.textMono, styles.commentTime]}>{formatTime(item.time)}</Text>
                  </View>
                  {item.text ? <Text style={styles.commentText}>{item.text}</Text> : null}
                  {item.shapes?.length ? <Text style={styles.commentMeta}>{item.shapes.length} annotation(s)</Text> : null}
                </View>
              </Pressable>
            )}
          />
          <View style={styles.composer}>
            <TextInput
              style={styles.commentInput}
              placeholder={draftShapes.length ? `Commentaire (+${draftShapes.length} dessin)` : 'Ajouter un commentaire...'}
              placeholderTextColor={theme.textFaint}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={submitComment}
            />
            <Pressable onPress={submitComment} style={styles.sendBtn}>
              <PaperPlaneRight size={18} color={theme.accentInk} weight="fill" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Saisie de texte (outil "texte") */}
      <Modal visible={Boolean(pendingText)} transparent animationType="fade" onRequestClose={() => setPendingText(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Texte sur l’image</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Votre texte"
              placeholderTextColor={theme.textFaint}
              value={textValue}
              onChangeText={setTextValue}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => { setPendingText(null); setTextValue(''); }}>
                <Text style={styles.modalCancel}>Annuler</Text>
              </Pressable>
              <Pressable onPress={confirmText} style={styles.modalOk}>
                <Text style={styles.modalOkText}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function shapeCenter(s) {
  if (s.at) return s.at;
  if (s.from && s.to) return { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 };
  if (s.points?.length) {
    const m = s.points[Math.floor(s.points.length / 2)];
    return { x: m.x, y: m.y };
  }
  return { x: 0.5, y: 0.5 };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', padding: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: theme.text, marginLeft: 2, fontSize: 15 },
  title: { flex: 1, color: theme.text, textAlign: 'center', fontWeight: 'bold', fontSize: 15, marginHorizontal: theme.space[3] },
  presence: { flexDirection: 'row', alignItems: 'center' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginRight: theme.space[2] },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.live, marginRight: 4 },
  liveText: { color: theme.textDim, fontSize: 12 },
  avatar: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.bg },
  avatarText: { color: theme.bg, fontWeight: 'bold', fontSize: 10 },
  playerContainer: { flex: 1, backgroundColor: theme.bgInset, position: 'relative' },
  cursor: { position: 'absolute' },
  cursorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: '#fff' },
  cursorLabel: { color: '#fff', fontSize: 10, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  watermark: { position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.28)', fontSize: 13 },
  lockBanner: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill },
  lockText: { color: theme.accentInk, fontSize: 12, marginLeft: 6, fontWeight: '600' },
  timelineContainer: { flexDirection: 'row', alignItems: 'center', padding: theme.space[3], backgroundColor: theme.bgInset },
  timelineBar: { flex: 1, height: 10, backgroundColor: theme.bg2, borderRadius: 5, position: 'relative', justifyContent: 'center' },
  timelineProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.accent, borderRadius: 5 },
  marker: { position: 'absolute', top: -3, width: 8, height: 16, borderRadius: 2, transform: [{ translateX: -4 }] },
  timecode: { color: theme.text, marginLeft: theme.space[3], width: 55, textAlign: 'right' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[2], paddingVertical: theme.space[2], borderTopWidth: 1, borderTopColor: theme.line, flexWrap: 'wrap' },
  toolBtn: { padding: theme.space[2], borderRadius: theme.radius.sm },
  toolBtnActive: { backgroundColor: theme.accentSoft },
  toolBtnDisabled: { opacity: 0.4 },
  divider: { width: 1, height: 22, backgroundColor: theme.lineStrong, marginHorizontal: theme.space[2] },
  colorBtn: { width: 22, height: 22, borderRadius: 11, marginHorizontal: 3 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], borderTopWidth: 1, borderTopColor: theme.line },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  actionText: { color: theme.textDim, fontSize: 12, marginLeft: 4 },
  commentsPanel: { height: '38%', backgroundColor: theme.bg1, borderTopWidth: 1, borderTopColor: theme.line },
  empty: { color: theme.textFaint, textAlign: 'center', padding: theme.space[5] },
  commentItem: { flexDirection: 'row', padding: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: theme.space[3] },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  commentAuthor: { color: theme.text, fontWeight: 'bold', fontSize: 14 },
  commentTime: { color: theme.accent, fontSize: 12 },
  commentText: { color: theme.text, fontSize: 14 },
  commentMeta: { color: theme.textFaint, fontSize: 12, marginTop: 2 },
  composer: { flexDirection: 'row', padding: theme.space[3], backgroundColor: theme.bg2, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: theme.bg1, color: theme.text, borderRadius: theme.radius.sm, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], marginRight: theme.space[2] },
  sendBtn: { backgroundColor: theme.accent, width: 40, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: theme.space[5] },
  modalCard: { width: '100%', backgroundColor: theme.bg2, borderRadius: theme.radius.md, padding: theme.space[4], borderWidth: 1, borderColor: theme.line },
  modalTitle: { color: theme.text, fontWeight: 'bold', fontSize: 15, marginBottom: theme.space[3] },
  modalInput: { backgroundColor: theme.bg1, color: theme.text, borderRadius: theme.radius.sm, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2] },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: theme.space[4] },
  modalCancel: { color: theme.textDim, marginRight: theme.space[4] },
  modalOk: { backgroundColor: theme.accent, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], borderRadius: theme.radius.sm },
  modalOkText: { color: theme.accentInk, fontWeight: 'bold' },
});
