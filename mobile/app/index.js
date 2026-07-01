import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, AccessibilityInfo } from 'react-native';
import { useRouter } from 'expo-router';
import { login, me } from '../src/auth';
import { theme, globalStyles } from '../src/theme';
import { CheckCircle, Lock, User, Eye, EyeClosed } from 'phosphor-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    
    // Check if already logged in
    me().then(user => {
      if (user) {
        if (user.mustChangePassword) {
          // TODO: handle mustChangePassword
          router.replace('/catalogue');
        } else {
          router.replace('/catalogue');
        }
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.mustChangePassword) {
        // Redirect to change password screen if we had one
        router.replace('/catalogue');
      } else {
        router.replace('/catalogue');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>🐙 Poulpium</Text>
        <Text style={styles.tagline}>revue vidéo collaborative</Text>
        <View style={styles.features}>
          <Text style={styles.featureItem}>· dessine · commente · live</Text>
        </View>
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
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            {showPassword ? (
              <EyeClosed size={20} color={theme.textDim} />
            ) : (
              <Eye size={20} color={theme.textDim} />
            )}
          </Pressable>
        </View>

        <Pressable 
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { transform: [{ scale: 0.98 }] },
            (!username || !password) && { opacity: 0.5 }
          ]}
          onPress={handleLogin}
          disabled={!username || !password || loading}
        >
          <Text style={styles.primaryButtonText}>Se connecter →</Text>
        </Pressable>
        
        <Text style={styles.demoHint}>
          alice / bob / carol · password
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: 'center',
    padding: theme.space[4],
  },
  hero: {
    alignItems: 'center',
    marginBottom: theme.space[6],
  },
  logo: {
    ...globalStyles.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: theme.space[2],
  },
  tagline: {
    ...globalStyles.text,
    color: theme.textDim,
    fontSize: 16,
    marginBottom: theme.space[3],
  },
  features: {
    flexDirection: 'row',
  },
  featureItem: {
    ...globalStyles.text,
    color: theme.accent,
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    backgroundColor: theme.bg2,
    borderRadius: theme.radius.md,
    padding: theme.space[5],
    ...theme.shadow.s2,
  },
  cardTitle: {
    ...globalStyles.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: theme.space[4],
  },
  errorBox: {
    backgroundColor: theme.danger + '20', // transparent danger
    borderWidth: 1,
    borderColor: theme.danger,
    borderRadius: theme.radius.sm,
    padding: theme.space[3],
    marginBottom: theme.space[4],
  },
  errorText: {
    color: theme.danger,
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg1,
    borderRadius: theme.radius.md,
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.line,
  },
  inputIcon: {
    marginLeft: theme.space[3],
  },
  eyeIcon: {
    padding: theme.space[3],
  },
  input: {
    flex: 1,
    color: theme.text,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[3],
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: theme.accent,
    padding: theme.space[4],
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: theme.space[2],
  },
  primaryButtonText: {
    color: theme.accentInk,
    fontWeight: 'bold',
    fontSize: 16,
  },
  demoHint: {
    ...globalStyles.text,
    color: theme.textFaint,
    textAlign: 'center',
    marginTop: theme.space[4],
    fontSize: 12,
  }
});
