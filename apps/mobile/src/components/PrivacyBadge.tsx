import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PostPrivacy } from '@privity/types';
import { theme } from '../theme';

interface Props {
  privacy: PostPrivacy;
  showDescription?: boolean;
}

export const PrivacyBadge: React.FC<Props> = ({ privacy, showDescription }) => {
  const getBadgeConfig = () => {
    switch (privacy) {
      case 'close_friends':
        return {
          label: 'Close Friends',
          bg: 'rgba(16, 185, 129, 0.15)',
          color: theme.colors.privacyCloseFriends,
          icon: '★',
          description: 'Visible only to your close friends list',
        };
      case 'followers':
        return {
          label: 'Followers Only',
          bg: 'rgba(129, 140, 248, 0.15)',
          color: theme.colors.privacyFollowers,
          icon: '👥',
          description: 'Visible only to accounts you have approved',
        };
      case 'public':
      default:
        return {
          label: 'Public',
          bg: 'rgba(56, 189, 248, 0.12)',
          color: theme.colors.privacyPublic,
          icon: '🌐',
          description: 'Anyone can see this post',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.color }]}>
        <Text style={[styles.icon, { color: config.color }]}>{config.icon}</Text>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      </View>
      {showDescription && (
        <Text style={styles.description}>{config.description}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  icon: {
    fontSize: 11,
    marginRight: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
