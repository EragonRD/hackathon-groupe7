import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { SAMPLE, CATALOGUE_META } from '../src/data/videos';
import { formatTime } from '../src/lib/format';
import { theme, globalStyles } from '../src/theme';
import { PlayCircle, Shield, SignOut } from 'phosphor-react-native';
import { logout, me, isAdmin } from '../src/auth';

export default function CatalogueScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    me().then(u => {
      if (!u) {
        router.replace('/');
      } else {
        setUser(u);
        isAdmin().then(setAdmin);
      }
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const renderItem = ({ item }) => {
    if (item.playable) {
      return (
        <Pressable 
          style={({pressed}) => [styles.sampleCard, pressed && { opacity: 0.9 }]}
          onPress={() => router.push(`/review/${item.session}?id=${item.id}`)}
        >
          <View style={styles.sampleThumb}>
            <PlayCircle size={48} color={theme.accentInk} weight="fill" />
            <View style={styles.secureBadge}>
              <Shield size={14} color={theme.bg} weight="fill" />
              <Text style={styles.secureText}>chiffré</Text>
            </View>
          </View>
          <View style={styles.sampleInfo}>
            <Text style={styles.sampleTitle}>{item.title}</Text>
            <Text style={styles.sampleCategory}>{item.category}</Text>
          </View>
        </Pressable>
      );
    }

    return (
      <View style={styles.metaCard}>
        <Image source={{ uri: item.thumb }} style={styles.metaThumb} />
        <View style={styles.metaInfo}>
          <Text style={styles.metaTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaCategory}>{item.category}</Text>
            <Text style={[globalStyles.textMono, styles.metaDuration]}>
              {formatTime(item.duration_sec)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topbar}>
        <Text style={styles.logo}>Poulpium</Text>
        <View style={styles.topbarActions}>
          {admin && (
            <View style={styles.adminBadges}>
              <Text style={styles.badgeText}>Admin</Text>
              <Text style={styles.badgeText}>Surv</Text>
            </View>
          )}
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <SignOut size={24} color={theme.textDim} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={[SAMPLE, ...CATALOGUE_META]}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={() => (
          <Text style={styles.sectionTitle}>Catalogue</Text>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  logo: {
    ...globalStyles.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
  },
  adminBadges: {
    flexDirection: 'row',
    gap: theme.space[2],
  },
  badgeText: {
    color: theme.accentStrong,
    backgroundColor: theme.accentSoft,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radius.sm,
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutBtn: {
    padding: theme.space[1],
  },
  listContent: {
    padding: theme.space[4],
    gap: theme.space[4],
  },
  sectionTitle: {
    ...globalStyles.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: theme.space[2],
    marginTop: theme.space[4],
  },
  sampleCard: {
    backgroundColor: theme.bg2,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadow.s2,
    marginBottom: theme.space[2],
  },
  sampleThumb: {
    height: 200,
    backgroundColor: theme.bg3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secureBadge: {
    position: 'absolute',
    top: theme.space[3],
    right: theme.space[3],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.warn,
    paddingHorizontal: theme.space[2],
    paddingVertical: theme.space[1],
    borderRadius: theme.radius.pill,
    gap: theme.space[1],
  },
  secureText: {
    color: theme.bg,
    fontWeight: 'bold',
    fontSize: 12,
  },
  sampleInfo: {
    padding: theme.space[4],
  },
  sampleTitle: {
    ...globalStyles.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: theme.space[1],
  },
  sampleCategory: {
    ...globalStyles.text,
    color: theme.textDim,
    fontSize: 14,
  },
  metaCard: {
    flexDirection: 'row',
    backgroundColor: theme.bg1,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    opacity: 0.6, // Désactivé visuellement
  },
  metaThumb: {
    width: 120,
    height: 80,
    backgroundColor: theme.bg3,
  },
  metaInfo: {
    flex: 1,
    padding: theme.space[3],
    justifyContent: 'center',
  },
  metaTitle: {
    ...globalStyles.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: theme.space[2],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaCategory: {
    color: theme.textDim,
    fontSize: 14,
  },
  metaDuration: {
    color: theme.textFaint,
    fontSize: 14,
  }
});
