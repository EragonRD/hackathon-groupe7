import { forwardRef, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Video from 'react-native-video';
import { getToken } from '../auth';
import { theme } from '../theme';

// Base HLS. Par défaut = le Core (même service que l'auth). Le flux chiffré est
// exposé par le Core sous /stream/:id/index.m3u8 (cf. backend stream.controller).
// Surchargeable via EXPO_PUBLIC_HLS_URL si un nginx dédié sert les segments.
const HLS_URL =
  process.env.EXPO_PUBLIC_HLS_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Lecteur de flux HLS chiffré (Zero-Trust).
//
// ⚠️ POINT CRITIQUE (risque n°1) : la playlist contient
//   #EXT-X-KEY:METHOD=AES-128,URI="<core>/keys/:id"
// et la requête de CLÉ doit porter le JWT. `react-native-video` applique
// `source.headers` à toutes les requêtes de la source (playlist, segments ET
// clé) sur ExoPlayer/AVPlayer : c'est l'approche retenue. Si une plateforme
// n'attache pas le header à la requête de clé, prévoir un proxy de clé local.
// À VALIDER sur device réel avec le Core lancé.
const SecureVideo = forwardRef(function SecureVideo(
  { contentId, onProgress, onEnd, onLoad, paused },
  ref,
) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  if (!token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>Lecture impossible</Text>
        <Text style={styles.errHint}>{error}</Text>
      </View>
    );
  }

  const src = `${HLS_URL}/stream/${contentId}/index.m3u8`;

  return (
    <Video
      ref={ref}
      source={{ uri: src, headers: { Authorization: `Bearer ${token}` } }}
      style={StyleSheet.absoluteFill}
      paused={paused}
      onProgress={onProgress}
      onEnd={onEnd}
      onLoad={onLoad}
      onError={(e) => {
        const code = e?.error?.errorCode ?? e?.error?.code;
        // 401/403 sur la clé = accès refusé (token absent/expiré ou pas les droits).
        setError(String(code ?? 'source illisible'));
      }}
      resizeMode="contain"
      progressUpdateInterval={100}
      controls={false}
    />
  );
});

export default SecureVideo;

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errText: { color: theme.danger, fontWeight: 'bold', fontSize: 15 },
  errHint: { color: theme.textFaint, fontSize: 12, marginTop: 4 },
});
