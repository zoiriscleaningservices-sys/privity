import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { theme } from '../theme';

interface SuggestedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  isFollowing?: boolean;
}

const SUGGESTED_ACCOUNTS: SuggestedUser[] = [
  {
    id: 'user-s1',
    username: 'sara_architecture',
    displayName: 'Sara Lin',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    bio: 'Minimalist architecture & quiet urban spaces.',
  },
  {
    id: 'user-s2',
    username: 'acoustic_echoes',
    displayName: 'Acoustic Echoes',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    bio: 'Field recordings & ambient music production.',
  },
  {
    id: 'user-s3',
    username: 'oliver_woodcraft',
    displayName: 'Oliver Craft',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    bio: 'Handmade woodworking without industrial machinery.',
  },
];

const TRENDING_TAGS = [
  { tag: 'mindful', count: '1.2k' },
  { tag: 'slowlife', count: '890' },
  { tag: 'streetphoto', count: '740' },
  { tag: 'indiecraft', count: '512' },
  { tag: 'filmcamera', count: '430' },
];

export const DiscoverScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggleFollow = (userId: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, topics, or tags..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Suggested Creators */}
        <Text style={styles.sectionTitle}>SUGGESTED CREATORS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {SUGGESTED_ACCOUNTS.map((account) => {
            const isFollowing = !!followingMap[account.id];
            return (
              <View key={account.id} style={styles.userCard}>
                <Image source={{ uri: account.avatarUrl }} style={styles.userAvatar} />
                <Text style={styles.userName} numberOfLines={1}>{account.displayName}</Text>
                <Text style={styles.userHandle} numberOfLines={1}>@{account.username}</Text>
                <Text style={styles.userBio} numberOfLines={2}>{account.bio}</Text>
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    isFollowing && styles.followingBtn,
                  ]}
                  onPress={() => toggleFollow(account.id)}
                >
                  <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>

        {/* Popular Tags */}
        <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
          EXPLORE TAGS
        </Text>
        <View style={styles.tagGrid}>
          {TRENDING_TAGS.map((t) => (
            <TouchableOpacity key={t.tag} style={styles.tagChip}>
              <Text style={styles.tagHash}>#</Text>
              <Text style={styles.tagName}>{t.tag}</Text>
              <Text style={styles.tagCount}>{t.count}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Community & Safety Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoTitle}>🔒 Privacy by Design</Text>
          <Text style={styles.infoBody}>
            Privity only recommends public accounts and discoverable posts. Your followers-only and close friends content is never exposed to recommendation engines.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
  },
  userCard: {
    width: 150,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: theme.spacing.xs,
  },
  userName: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  userHandle: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
  },
  userBio: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: 10,
    height: 28,
  },
  followBtn: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    width: '100%',
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  followBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
  followingBtnText: {
    color: theme.colors.textSecondary,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  tagHash: {
    color: theme.colors.privacyFollowers,
    fontWeight: 'bold',
    marginRight: 4,
  },
  tagName: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
  },
  tagCount: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  infoBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    padding: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  infoTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  infoBody: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
