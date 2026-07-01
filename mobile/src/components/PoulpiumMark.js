// Marque Poulpium : un poulpe stylisé (plusieurs bras = plusieurs relecteurs).
// Version SVG statique, accent bleu unique. Pas d'animation (reste sobre, pro).
import Svg, { Circle, Path, G } from 'react-native-svg';
import { theme } from '../theme';

export default function PoulpiumMark({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <G>
        {/* Tête */}
        <Path
          d="M32 8c11 0 19 8 19 19v6c0 4-3 7-7 7H20c-4 0-7-3-7-7v-6C13 16 21 8 32 8z"
          fill={theme.accent}
        />
        {/* Bras (tentacules) */}
        <Path d="M16 38c-4 4-6 9-10 11" stroke={theme.accentStrong} strokeWidth={4} strokeLinecap="round" />
        <Path d="M24 41c-2 5-2 10-5 14" stroke={theme.accentStrong} strokeWidth={4} strokeLinecap="round" />
        <Path d="M32 42c0 6 1 11 0 16" stroke={theme.accentStrong} strokeWidth={4} strokeLinecap="round" />
        <Path d="M40 41c2 5 2 10 5 14" stroke={theme.accentStrong} strokeWidth={4} strokeLinecap="round" />
        <Path d="M48 38c4 4 6 9 10 11" stroke={theme.accentStrong} strokeWidth={4} strokeLinecap="round" />
        {/* Yeux */}
        <Circle cx="25" cy="26" r="4.5" fill={theme.accentInk} />
        <Circle cx="39" cy="26" r="4.5" fill={theme.accentInk} />
        <Circle cx="25" cy="27" r="2" fill={theme.bg} />
        <Circle cx="39" cy="27" r="2" fill={theme.bg} />
      </G>
    </Svg>
  );
}
