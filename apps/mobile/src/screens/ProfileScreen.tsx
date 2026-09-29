import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { theme } from '../theme';

export const ProfileScreen: React.FC = () => {
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'close_friends'>('posts');

  const toggleAccountPrivacy = () => {
    const next = !isPrivateAccount;
    setIsPrivateAccount(next);
    Alert.alert(
      'Account Privacy Updated',
      next
        ? 'Your account is now Private. New followers require your explicit approval.'
        : 'Your account is now Public. Anyone can follow you and view public posts.',
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.topInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>L</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>12</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>148</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>86</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>
          </View>

          <Text style={styles.displayName}>Luciano</Text>
          <Text style={styles.username}>@luciano</Text>
          <Text style={styles.bio}>
            Building Privity: private-first sharing, real circles, no algorithmic games.
          </Text>

          {/* Account Privacy Control Card */}
          <View style={styles.privacyCard}>
            <View style={styles.privacyTextCol}>
              <Text style={styles.privacyCardTitle}>
                {isPrivateAccount ? 'Private Account 🔒' : 'Public Account 🌐'}
              </Text>
              <Text style={styles.privacyCardSub}>
                {isPrivateAccount
                  ? 'Only approved followers can see your profile & content.'
                  : 'Anyone can follow and view your public posts.'}
              </Text>
            </View>
            <Switch
              value={isPrivateAccount}
              onValueChange={toggleAccountPrivacy}
              trackColor={{ false: theme.colors.surface, true: theme.colors.brand }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Tab Navigator */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'posts' && styles.tabItemActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'posts' && styles.tabLabelActive,
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'saved' && styles.tabItemActive]}
            onPress={() => setActiveTab('saved')}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'saved' && styles.tabLabelActive,
              ]}
            >
              Saved
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === 'close_friends' && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab('close_friends')}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'close_friends' && styles.tabLabelActive,
              ]}
            >
              ★ Close Friends (14)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'posts' ? (
          <View style={styles.postGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridPinIcon}>📌 Pinned Post</Text>
              <Text style={styles.gridItemCaption}>
                "Privacy isn't secrecy. It's having choice and agency over your attention."
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridItemCaption}>
                Working on the core privacy model engine today.
              </Text>
            </View>
          </View>
        ) : activeTab === 'saved' ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>★</Text>
            <Text style={styles.emptyTitle}>Saved Posts</Text>
            <Text style={styles.emptySub}>
              Posts you save remain private to you.
            </Text>
          </View>
        ) : (
          <View style={styles.closeFriendsContainer}>
            <Text style={styles.cfIntro}>
              Only members of this list can view posts marked with ★ Close Friends.
            </Text>
            <View style={styles.cfUserRow}>
              <Text style={styles.cfName}>Elena Rodriguez (@elena_rodriguez)</Text>
              <Text style={styles.cfBadge}>Close Friend</Text>
            </View>
            <View style={styles.cfUserRow}>
              <Text style={styles.cfName}>Marcus Vance (@marcus_dev)</Text>
              <Text style={styles.cfBadge}>Close Friend</Text>
            </View>
          </View>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  settingsBtn: {
    padding: theme.spacing.xs,
  },
  settingsIcon: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  profileCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.lg,
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 26,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNum: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  displayName: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  username: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  bio: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  privacyTextCol: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  privacyCardTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  privacyCardSub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: theme.colors.brand,
  },
  tabLabel: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: theme.colors.textPrimary,
  },
  postGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  gridItem: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  gridPinIcon: {
    color: theme.colors.privacyPublic,
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 6,
  },
  gridItemCaption: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  closeFriendsContainer: {
    padding: theme.spacing.xs,
  },
  cfIntro: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: theme.spacing.md,
  },
  cfUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  cfName: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  cfBadge: {
    color: theme.colors.privacyCloseFriends,
    fontSize: 12,
    fontWeight: '700',
  },
});
