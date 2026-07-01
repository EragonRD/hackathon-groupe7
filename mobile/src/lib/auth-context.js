// Contexte d'authentification partagé : évite d'appeler me() sur chaque écran.
// Fournit { user, loading, reduceMotion, refresh, signOut }. Se réhydrate au
// démarrage via me() et écoute 'auth:expired' (émis par authFetch sur 401 non
// récupérable) pour revenir à l'écran de connexion.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AccessibilityInfo, DeviceEventEmitter } from 'react-native';
import { me, logout } from '../auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  const refresh = useCallback(async () => {
    const u = await me();
    setUser(u);
    setLoading(false);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    // Réhydratation initiale : le setState se fait APRÈS l'await de me() (asynchrone),
    // pas pendant le render. La règle ne distingue pas ce cas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const sub = DeviceEventEmitter.addListener('auth:expired', () => setUser(null));
    return () => sub.remove();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, reduceMotion, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
