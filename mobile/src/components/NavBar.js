// Barre de navigation basse (comme la topbar du web) : accès aux sections
// principales de l'app authentifiée. Les onglets admin n'apparaissent qu'aux admins.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { House, Gear, ShieldCheck, Question, SignOut } from 'phosphor-react-native';
import { useAuth } from '../lib/auth-context';
import { theme } from '../theme';

export default function NavBar({ active }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const logout = async () => {
    await signOut();
    router.replace('/');
  };

  const tabs = [
    { id: 'catalogue', label: 'Accueil', Icon: House, route: '/catalogue' },
    ...(isAdmin
      ? [
          { id: 'admin', label: 'Admin', Icon: Gear, route: '/admin' },
          { id: 'dashboard', label: 'Surveillance', Icon: ShieldCheck, route: '/dashboard' },
        ]
      : []),
    { id: 'docs', label: 'Aide', Icon: Question, route: '/docs' },
    { id: 'logout', label: 'Quitter', Icon: SignOut, action: logout },
  ];

  return (
    <View style={styles.bar}>
      {tabs.map(({ id, label, Icon, route, action }) => {
        const on = id === active;
        return (
          <Pressable
            key={id}
            style={styles.tab}
            onPress={() => (action ? action() : !on && router.replace(route))}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Icon size={22} color={on ? theme.accent : theme.textDim} weight={on ? 'fill' : 'regular'} />
            <Text style={[styles.label, on && styles.labelOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.line,
    backgroundColor: theme.bg1,
    paddingVertical: theme.space[2],
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { color: theme.textDim, fontSize: 11 },
  labelOn: { color: theme.accent, fontWeight: '600' },
});
