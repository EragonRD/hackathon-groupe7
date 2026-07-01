import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { theme, globalStyles } from '../src/theme';
import ScreenHeader from '../src/components/ScreenHeader';

const SECTIONS = [
  { t: 'Se connecter', d: 'Comptes de démo : alice (admin), bob, carol. Mot de passe : password.' },
  { t: 'Revue vidéo', d: 'Ouvrez la séquence chiffrée. La clé de déchiffrement n’est délivrée qu’à un utilisateur authentifié et autorisé (Zero-Trust).' },
  { t: 'Annoter', d: '7 outils : curseur, crayon, flèche, cadre, ellipse, texte, gomme. Le dessin se rattache à l’instant courant puis à un commentaire.' },
  { t: 'Temps réel', d: 'Présence, curseurs distants et diffusion des notes via socket. « Présenter » synchronise la lecture chez les invités.' },
  { t: 'Export / Import', d: 'Exportez les notes en JSON ({version, session, notes}) et réimportez-les à l’identique.' },
];

export default function DocsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Aide" />
      <ScrollView contentContainerStyle={{ padding: theme.space[4] }}>
        <Text style={styles.lead}>Poulpium : revue vidéo collaborative, dessin et commentaire au timecode, en direct.</Text>
        {SECTIONS.map((s) => (
          <View key={s.t} style={styles.block}>
            <Text style={styles.h}>{s.t}</Text>
            <Text style={styles.p}>{s.d}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  lead: { ...globalStyles.text, fontSize: 16, marginBottom: theme.space[4] },
  block: { marginBottom: theme.space[4] },
  h: { color: theme.accentStrong, fontSize: 15, fontWeight: 'bold', marginBottom: theme.space[1] },
  p: { color: theme.textDim, fontSize: 14, lineHeight: 20 },
});
