import { useMemo, useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useMetadata } from '../lib/useMetadata';
import { formatTime } from '../lib/format';
import { theme, globalStyles } from '../theme';

// Insights IA (Pôle 3) affichés sous le lecteur (Bloc B, P1<->P3).
// Résumé + chapitres + transcription cliquables (saut au timecode), mots-clés,
// traduction. Se met à jour tout seul quand l'analyse passe à "done".
export default function InsightsPanel({ contentId, onSeek, currentTime = 0 }) {
  const meta = useMetadata(contentId);
  const [query, setQuery] = useState('');
  const [openTrad, setOpenTrad] = useState(null);

  const data = meta.status === 'done' ? meta.data : null;
  const segments = useMemo(() => data?.segments ?? [], [data]);
  const chapters = data?.chapters ?? [];
  const keywords = data?.keywords ?? [];
  const translations = useMemo(
    () =>
      Array.isArray(data?.translations)
        ? data.translations
        : data?.translation
          ? [data.translation]
          : [],
    [data],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? segments.filter((s) => (s.text ?? '').toLowerCase().includes(q)) : segments;
  }, [segments, query]);

  if (meta.status !== 'done') {
    return (
      <View style={[styles.panel, styles.centered]}>
        {meta.status === 'loading' || meta.status === 'processing' ? (
          <ActivityIndicator color={theme.accent} />
        ) : null}
        <Text style={styles.muted}>
          {meta.status === 'loading' && 'Chargement des insights…'}
          {meta.status === 'processing' &&
            'Analyse IA en cours (transcription, résumé, chapitres)… mise à jour automatique.'}
          {meta.status === 'not_analyzed' && 'Aucune analyse IA pour ce contenu.'}
          {meta.status === 'error' && `Analyse indisponible : ${meta.error}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Méta */}
        <View style={styles.chips}>
          {data.language ? (
            <Text style={styles.chip}>Langue : {data.language}</Text>
          ) : null}
          {typeof data.duration_sec === 'number' ? (
            <Text style={styles.chip}>Durée : {formatTime(data.duration_sec)}</Text>
          ) : null}
        </View>

        {/* Résumé */}
        {data.summary ? (
          <View style={styles.block}>
            <Text style={styles.h}>Résumé</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </View>
        ) : null}

        {/* Mots-clés */}
        {keywords.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Mots-clés</Text>
            <View style={styles.kwWrap}>
              {keywords.map((k, i) => (
                <Text key={i} style={styles.kw}>
                  {k}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* Chapitres */}
        {chapters.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Chapitres</Text>
            {chapters.map((c, i) => (
              <Pressable key={i} style={styles.row} onPress={() => onSeek?.(c.start)}>
                <Text style={[globalStyles.textMono, styles.tc]}>{formatTime(c.start ?? 0)}</Text>
                <Text style={styles.chapterTitle}>{c.title}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Transcription + filtre */}
        {segments.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Transcription</Text>
            <TextInput
              style={styles.search}
              placeholder="Filtrer la transcription…"
              placeholderTextColor={theme.textFaint}
              value={query}
              onChangeText={setQuery}
            />
            {filtered.map((s, i) => {
              const active =
                currentTime >= (s.start ?? 0) && currentTime < (s.end ?? Infinity);
              return (
                <Pressable
                  key={i}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => onSeek?.(s.start)}
                >
                  <Text style={[globalStyles.textMono, styles.tc]}>{formatTime(s.start ?? 0)}</Text>
                  <Text style={styles.segText}>{s.text}</Text>
                </Pressable>
              );
            })}
            {filtered.length === 0 ? (
              <Text style={styles.muted}>Aucun segment ne correspond.</Text>
            ) : null}
          </View>
        ) : null}

        {/* Traductions */}
        {translations.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.h}>Traduction</Text>
            {translations.map((t, i) => (
              <View key={i}>
                <Pressable
                  style={styles.tradHead}
                  onPress={() => setOpenTrad(openTrad === i ? null : i)}
                >
                  <Text style={[globalStyles.textMono, styles.tradLang]}>
                    {(t.lang ?? '??').toUpperCase()}
                  </Text>
                  <Text style={styles.tradToggle}>{openTrad === i ? '−' : '+'}</Text>
                </Pressable>
                {openTrad === i ? <Text style={styles.summary}>{t.text}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { height: '38%', backgroundColor: theme.bg1, borderTopWidth: 1, borderTopColor: theme.line },
  centered: { alignItems: 'center', justifyContent: 'center', padding: theme.space[5] },
  scroll: { padding: theme.space[3] },
  muted: { color: theme.textDim, fontSize: 13, textAlign: 'center', marginTop: theme.space[2], lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.space[2] },
  chip: {
    color: theme.textDim, fontSize: 11, borderWidth: 1, borderColor: theme.line,
    borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 4,
  },
  block: { marginBottom: theme.space[4] },
  h: {
    color: theme.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: theme.space[2],
  },
  summary: { color: theme.text, fontSize: 14, lineHeight: 20 },
  kwWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  kw: {
    color: theme.accent, fontSize: 12, backgroundColor: theme.accentSoft,
    borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6,
  },
  row: { flexDirection: 'row', paddingVertical: 6, borderRadius: theme.radius.sm, paddingHorizontal: 4 },
  rowActive: { backgroundColor: theme.accentSoft },
  tc: { color: theme.accent, fontSize: 12, width: 48 },
  chapterTitle: { color: theme.text, fontSize: 14, fontWeight: '600', flex: 1 },
  segText: { color: theme.text, fontSize: 14, flex: 1, lineHeight: 19 },
  search: {
    backgroundColor: theme.bg2, color: theme.text, borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space[3], paddingVertical: theme.space[2], marginBottom: theme.space[2],
  },
  tradHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  tradLang: { color: theme.accent, fontSize: 13 },
  tradToggle: { color: theme.textDim, fontSize: 18 },
});
