import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { theme } from '../theme';

export default function ScreenHeader({ title }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <CaretLeft size={22} color={theme.text} />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[3], paddingVertical: theme.space[3], borderBottomWidth: 1, borderBottomColor: theme.line },
  back: { flexDirection: 'row', alignItems: 'center', width: 90 },
  backText: { color: theme.text, marginLeft: 2, fontSize: 15 },
  title: { flex: 1, color: theme.text, textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  spacer: { width: 90 },
});
