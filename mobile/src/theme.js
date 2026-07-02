// Transcription of frontend/src/styles/tokens.css to React Native styles
import { StyleSheet, Platform } from 'react-native';

export const theme = {
  // Surfaces (off-black, jamais #000)
  bg: '#0a0c0f',
  bg1: '#101319',
  bg2: '#161a21',
  bg3: '#1d222b',
  bgInset: '#07090c',

  // Traits / séparateurs
  line: 'rgba(255, 255, 255, 0.07)',
  lineStrong: 'rgba(255, 255, 255, 0.13)',

  // Texte
  text: '#e9ebef',
  textDim: '#9aa2ae',
  textFaint: '#5d646f',

  // Accent unique (bleu électrique)
  accent: '#3d6dfd',
  accentStrong: '#5b85ff',
  accentSoft: 'rgba(61, 109, 253, 0.15)',
  accentLine: 'rgba(61, 109, 253, 0.45)',
  accentInk: '#ffffff',

  // États sémantiques
  ok: '#2ec27e',
  warn: '#f5a623',
  danger: '#ff5b5b',
  live: '#2ec27e',

  // Rayons
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  },

  // Espacement
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 24,
    6: 32,
    7: 48,
  },

  // Ombres
  shadow: {
    s1: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
    s2: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.55, shadowRadius: 34 },
      android: { elevation: 10 },
    }),
    pop: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.6, shadowRadius: 50 },
      android: { elevation: 16 },
    }),
  },

  // Animation (pour reanimated)
  ease: [0.16, 1, 0.3, 1], // fallback values for cubic bezier
  dur: 180,

  // Palette d'annotation
  ink: {
    amber: '#f5a623',
    red: '#ff5b5b',
    green: '#2ec27e',
    cyan: '#29c5e6',
    violet: '#b07bff',
    white: '#f4f6fa',
  },
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  text: {
    color: theme.text,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto', default: 'sans-serif' }),
  },
  textMono: {
    fontFamily: 'JetBrainsMono-Regular', // To be loaded via expo-font
    fontVariant: ['tabular-nums'],
  },
});
