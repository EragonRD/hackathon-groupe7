import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, FlatList, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReview } from '../../src/lib/useReview';
import { me } from '../../src/auth';
import SecureVideo from '../../src/components/SecureVideo';
import DrawingLayer from '../../src/components/DrawingLayer';
import { theme, globalStyles } from '../../src/theme';
import { CaretLeft, Play, Pause, Circle, ArrowUUpLeft, ChatText } from 'phosphor-react-native';
import { formatTime, initials } from '../../src/lib/format';

export default function ReviewScreen() {
  const { session, id } = useLocalSearchParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(theme.ink.red);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const {
    notes,
    peers,
    addNote,
    sendPlayback,
    subscribePlayback
  } = useReview({ session, user, mode: 'socket' });

  useEffect(() => {
    me().then(u => {
      if (u) setUser(u);
      else router.replace('/');
    });
  }, []);

  useEffect(() => {
    const unsub = subscribePlayback((evt) => {
      if (evt.kind === 'playback' || evt.kind === 'state') {
        if (evt.paused !== undefined) setPaused(evt.paused);
        if (evt.position !== undefined && videoRef.current) {
          videoRef.current.seek(evt.position);
        }
      }
    });
    return unsub;
  }, [subscribePlayback]);

  const handleProgress = (data) => {
    setCurrentTime(data.currentTime);
    if (duration === 0 && data.seekableDuration) {
      setDuration(data.seekableDuration);
    }
  };

  const togglePlay = () => {
    const nextPaused = !paused;
    setPaused(nextPaused);
    sendPlayback({ action: nextPaused ? 'pause' : 'play', position: currentTime });
  };

  const handleSeek = (time) => {
    if (videoRef.current) {
      videoRef.current.seek(time);
      sendPlayback({ action: 'seek', position: time });
    }
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    addNote({
      time: currentTime,
      text: commentText,
      shapes: [], // for simplicity, attaching current drawn shapes could be done here
      color: color
    });
    setCommentText('');
  };

  if (!user) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <CaretLeft size={24} color={theme.text} />
          <Text style={styles.backText}>Retour</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{id || session}</Text>
        <View style={styles.presence}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{peers.length + 1}</Text>
          </View>
          {peers.slice(0, 3).map((p, i) => (
            <View key={p.id} style={[styles.avatar, { backgroundColor: p.color, marginLeft: -8, zIndex: 3-i }]}>
              <Text style={styles.avatarText}>{initials(p.name)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.playerContainer}>
        <SecureVideo
          contentId={id || 'poc'}
          paused={paused}
          onProgress={handleProgress}
          seekTo={videoRef}
        />
        
        <DrawingLayer
          shapes={[]}
          currentTool={tool}
          currentColor={color}
          onAddShape={(shape) => {}}
          onClear={() => {}}
        />

        {/* Watermark simulé */}
        <Text style={styles.watermark}>{user.username} - Poulpium Demo</Text>
      </View>

      {/* Timeline */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineBar}>
          <View style={[styles.timelineProgress, { width: duration ? `${(currentTime / duration) * 100}%` : '0%' }]} />
          {notes.map(n => (
            <Pressable
              key={n.id}
              style={[styles.marker, { left: `${(n.time / (duration||1)) * 100}%`, backgroundColor: n.color }]}
              onPress={() => handleSeek(n.time)}
            />
          ))}
        </View>
        <Text style={[globalStyles.textMono, styles.timecode]}>{formatTime(currentTime)}</Text>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={togglePlay} style={styles.toolBtn}>
          {paused ? <Play size={24} color={theme.text} weight="fill" /> : <Pause size={24} color={theme.text} weight="fill" />}
        </Pressable>
        <View style={styles.divider} />
        
        {Object.entries(theme.ink).map(([name, hex]) => (
          <Pressable key={name} onPress={() => setColor(hex)} style={[styles.colorBtn, { backgroundColor: hex, borderWidth: color === hex ? 2 : 0, borderColor: theme.text }]} />
        ))}
        
        <View style={styles.divider} />
        <Pressable onPress={() => setShowComments(!showComments)} style={[styles.toolBtn, showComments && styles.toolBtnActive]}>
          <ChatText size={24} color={showComments ? theme.accent : theme.text} />
        </Pressable>
      </View>

      {/* Comments Panel (bottom sheet behavior) */}
      {showComments && (
        <View style={styles.commentsPanel}>
          <FlatList
            data={notes}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleSeek(item.time)} style={styles.commentItem}>
                <View style={[styles.commentAvatar, { backgroundColor: item.author.color }]}>
                  <Text style={styles.avatarText}>{initials(item.author.name)}</Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{item.author.name}</Text>
                    <Text style={[globalStyles.textMono, styles.commentTime]}>{formatTime(item.time)}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.text}</Text>
                </View>
              </Pressable>
            )}
          />
          <View style={styles.composer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter un commentaire..."
              placeholderTextColor={theme.textFaint}
              value={commentText}
              onChangeText={setCommentText}
              onSubmitEditing={submitComment}
            />
            <Pressable onPress={submitComment} style={styles.sendBtn}>
              <Text style={styles.sendBtnText}>Envoyer</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', padding: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: theme.text, marginLeft: theme.space[1], fontSize: 16 },
  title: { flex: 1, color: theme.text, textAlign: 'center', fontWeight: 'bold', fontSize: 16, marginHorizontal: theme.space[3] },
  presence: { flexDirection: 'row', alignItems: 'center' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginRight: theme.space[2] },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.live, marginRight: 4 },
  liveText: { color: theme.textDim, fontSize: 12, fontWeight: 'bold' },
  avatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.bg },
  avatarText: { color: theme.bg, fontWeight: 'bold', fontSize: 10 },
  playerContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  watermark: { position: 'absolute', top: 20, right: 20, color: 'rgba(255,255,255,0.3)', fontSize: 14, pointerEvents: 'none' },
  timelineContainer: { flexDirection: 'row', alignItems: 'center', padding: theme.space[3], backgroundColor: theme.bgInset },
  timelineBar: { flex: 1, height: 8, backgroundColor: theme.bg2, borderRadius: 4, position: 'relative' },
  timelineProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: theme.accent, borderRadius: 4 },
  marker: { position: 'absolute', top: -2, width: 8, height: 12, transform: [{translateX: -4}] },
  timecode: { color: theme.text, marginLeft: theme.space[3], width: 45, textAlign: 'right' },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: theme.space[3], borderTopWidth: 1, borderTopColor: theme.line },
  toolBtn: { padding: theme.space[2] },
  toolBtnActive: { backgroundColor: theme.accentSoft, borderRadius: theme.radius.sm },
  divider: { width: 1, height: 24, backgroundColor: theme.lineStrong, marginHorizontal: theme.space[3] },
  colorBtn: { width: 24, height: 24, borderRadius: 12, marginHorizontal: theme.space[1] },
  commentsPanel: { height: '40%', backgroundColor: theme.bg1, borderTopWidth: 1, borderTopColor: theme.line },
  commentItem: { flexDirection: 'row', padding: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: theme.space[3] },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  commentAuthor: { color: theme.text, fontWeight: 'bold', fontSize: 14 },
  commentTime: { color: theme.accent, fontSize: 12 },
  commentText: { color: theme.textDim, fontSize: 14 },
  composer: { flexDirection: 'row', padding: theme.space[3], backgroundColor: theme.bg2, alignItems: 'center' },
  commentInput: { flex: 1, backgroundColor: theme.bg1, color: theme.text, borderRadius: theme.radius.sm, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], marginRight: theme.space[2] },
  sendBtn: { backgroundColor: theme.accent, paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], borderRadius: theme.radius.sm },
  sendBtnText: { color: theme.accentInk, fontWeight: 'bold' }
});
