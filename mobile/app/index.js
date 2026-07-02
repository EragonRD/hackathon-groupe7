import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, User, Eye, EyeClosed } from 'phosphor-react-native';
import { login } from '../src/auth';
import { useAuth } from '../src/lib/auth-context';
import { theme, globalStyles } from '../src/theme';
import PoulpiumMark from '../src/components/PoulpiumMark';

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Déjà connecté : router vers l'écran adapté (change-password si requis).
  useEffect(() => {
    if (loading || !user) return;
    router.replace(user.mustChangePassword ? '/change-password' : '/catalogue');
  }, [loading, user, router]);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const u = await login(username, password);
      await refresh();
      router.replace(u.mustChangePassword ? '/change-password' : '/catalogue');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.hero}>
        <PoulpiumMark size={64} />
        <Text style={styles.logo}>Poulpium</Text>
        <Text style={styles.tagline}>revue vidéo collaborative</Text>
        <Text style={styles.featureItem}>dessine · commente · live</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Connexion</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <User size={20} color={theme.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="identifiant"
            placeholderTextColor={theme.textFaint}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Lock size={20} color={theme.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="mot de passe"
            placeholderTextColor={theme.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPassword((s) => !s)} style={styles.eyeIcon} hitSlop={8}>
            {showPassword ? <EyeClosed size={20} color={theme.textDim} /> : <Eye size={20} color={theme.textDim} />}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { transform: [{ scale: 0.98 }] },
            (!username || !password || submitting) && { opacity: 0.5 },
          ]}
          onPress={handleLogin}
          disabled={!username || !password || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.accentInk} />
          ) : (
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          )}
        </Pressable>

        <Text style={styles.demoHint}>alice / bob / carol · password</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, justifyContent: 'center', padding: theme.space[4] },
  centered: { alignItems: 'center' },
  hero: { alignItems: 'center', marginBottom: theme.space[6] },
  logo: { ...globalStyles.text, fontSize: 30, fontWeight: 'bold', marginTop: theme.space[3] },
  tagline: { ...globalStyles.text, color: theme.textDim, fontSize: 15, marginTop: theme.space[1] },
  featureItem: { ...globalStyles.text, color: theme.accent, fontSize: 13, fontWeight: '500', marginTop: theme.space[2] },
  card: { backgroundColor: theme.bg2, borderRadius: theme.radius.md, padding: theme.space[5], borderWidth: 1, borderColor: theme.line, ...theme.shadow.s2 },
  cardTitle: { ...globalStyles.text, fontSize: 20, fontWeight: '600', marginBottom: theme.space[4] },
  errorBox: { backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.danger, borderRadius: theme.radius.sm, padding: theme.space[3], marginBottom: theme.space[4] },
  errorText: { color: theme.danger, fontSize: 14 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg1, borderRadius: theme.radius.md, marginBottom: theme.space[4], borderWidth: 1, borderColor: theme.line },
  inputIcon: { marginLeft: theme.space[3] },
  eyeIcon: { padding: theme.space[3] },
  input: { flex: 1, color: theme.text, paddingVertical: theme.space[3], paddingHorizontal: theme.space[3], fontSize: 16 },
  primaryButton: { backgroundColor: theme.accent, padding: theme.space[4], borderRadius: theme.radius.md, alignItems: 'center', marginTop: theme.space[2] },
  primaryButtonText: { color: theme.accentInk, fontWeight: 'bold', fontSize: 16 },
  demoHint: { ...globalStyles.text, color: theme.textFaint, textAlign: 'center', marginTop: theme.space[4], fontSize: 12 },
});
