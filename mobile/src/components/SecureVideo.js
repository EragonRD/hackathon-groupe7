import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getToken } from '../auth';
import { theme } from '../theme';

// Base HLS. Par défaut = le Core (même service que l'auth). Le flux chiffré est
// exposé par le Core sous /videos/:id/index.m3u8 (cf. backend StreamController,
// @Controller('videos')). IMPORTANT : le Core réécrit l'URI de la clé EXT-X-KEY
// en RELATIF (/keys/:id) ; la playlist doit donc être servie par le Core pour que
// la clé se résolve sur la même origine (ne PAS pointer HLS_URL vers le nginx
// :8080, qui sert la playlist brute avec une URI de clé en dur).
const HLS_URL =
  process.env.EXPO_PUBLIC_HLS_URL ?? process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Lecteur de flux HLS chiffré (Zero-Trust) via `expo-video` (inclus dans Expo Go,
// contrairement à react-native-video qui exige un build natif).
//
// ⚠️ POINT CRITIQUE (risque n°1) : la playlist contient
//   #EXT-X-KEY:METHOD=AES-128,URI="<core>/keys/:id"
// et la requête de CLÉ doit porter le JWT. On passe `headers` sur la source :
// expo-video (ExoPlayer/AVPlayer) applique ces en-têtes aux requêtes du flux,
// clé comprise. À VALIDER sur device réel avec le Core lancé ; si une plateforme
// n'attache pas le header à la requête de clé, prévoir un proxy de clé local.
const SecureVideo = forwardRef(function SecureVideo(
  { contentId, onProgress, onEnd, onLoad, paused },
  ref,
) {
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const src = `${HLS_URL}/videos/${contentId}/index.m3u8`;

  // Callbacks stockés en ref : évite de re-souscrire les listeners à chaque render
  // (les handlers sont passés en inline par l'écran de revue).
  const cbRef = useRef({ onProgress, onEnd, onLoad });
  useEffect(() => {
    cbRef.current = { onProgress, onEnd, onLoad };
  });

  // Le player est créé une seule fois (source chargée plus tard via replace()).
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 0.25;
    p.loop = false;
  });

  useImperativeHandle(
    ref,
    () => ({
      seek: (t) => {
        try {
          player.currentTime = t;
        } catch {
          // player pas prêt : le seek suivant (progress) recalera
        }
      },
    }),
    [player],
  );

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  // Charge la source dès que le token est disponible (avec l'en-tête JWT).
  useEffect(() => {
    if (!token) return;
    try {
      player.replace({ uri: src, headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
      setError(String(e?.message ?? e));
    }
  }, [token, src, player]);

  // Play/pause piloté par la prop (Watch Together).
  useEffect(() => {
    if (!token) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, token, player]);

  // Événements du player -> callbacks de l'écran de revue.
  useEffect(() => {
    const subs = [
      player.addListener('timeUpdate', (e) =>
        cbRef.current.onProgress?.({ currentTime: e.currentTime }),
      ),
      player.addListener('statusChange', (e) => {
        if (e.status === 'readyToPlay') cbRef.current.onLoad?.({ duration: player.duration });
        else if (e.status === 'error') setError(String(e.error?.message ?? 'source illisible'));
      }),
      player.addListener('playToEnd', () => cbRef.current.onEnd?.()),
    ];
    return () => subs.forEach((s) => s?.remove?.());
  }, [player]);

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

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
});

export default SecureVideo;

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  errText: { color: theme.danger, fontWeight: 'bold', fontSize: 15 },
  errHint: { color: theme.textFaint, fontSize: 12, marginTop: 4 },
});
