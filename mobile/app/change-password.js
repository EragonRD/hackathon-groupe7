import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword } from '../src/auth';
import { useAuth } from '../src/lib/auth-context';
import { theme, globalStyles } from '../src/theme';

// Écran imposé au premier accès d'un admin invité (mot de passe temporaire).
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { refresh, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (next !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      await refresh();
      router.replace('/catalogue');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Changer le mot de passe</Text>
        <Text style={styles.sub}>Votre mot de passe est temporaire. Choisissez-en un nouveau pour continuer.</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput style={styles.input} placeholder="mot de passe actuel" placeholderTextColor={theme.textFaint} secureTextEntry value={current} onChangeText={setCurrent} />
        <TextInput style={styles.input} placeholder="nouveau mot de passe" placeholderTextColor={theme.textFaint} secureTextEntry value={next} onChangeText={setNext} />
        <TextInput style={styles.input} placeholder="confirmer" placeholderTextColor={theme.textFaint} secureTextEntry value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />

        <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }, busy && { opacity: 0.5 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={theme.accentInk} /> : <Text style={styles.primaryText}>Valider</Text>}
        </Pressable>
        <Pressable onPress={cancel} style={styles.cancel}>
          <Text style={styles.cancelText}>Se déconnecter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: theme.space[4] },
  card: { backgroundColor: theme.bg2, borderRadius: theme.radius.md, padding: theme.space[5], borderWidth: 1, borderColor: theme.line },
  title: { ...globalStyles.text, fontSize: 20, fontWeight: 'bold' },
  sub: { color: theme.textDim, fontSize: 14, marginTop: theme.space[2], marginBottom: theme.space[4] },
  error: { color: theme.danger, marginBottom: theme.space[3] },
  input: { backgroundColor: theme.bg1, color: theme.text, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.line, paddingHorizontal: theme.space[3], paddingVertical: theme.space[3], fontSize: 16, marginBottom: theme.space[3] },
  primary: { backgroundColor: theme.accent, padding: theme.space[4], borderRadius: theme.radius.md, alignItems: 'center', marginTop: theme.space[2] },
  primaryText: { color: theme.accentInk, fontWeight: 'bold', fontSize: 16 },
  cancel: { alignItems: 'center', marginTop: theme.space[4] },
  cancelText: { color: theme.textDim, fontSize: 13 },
});
