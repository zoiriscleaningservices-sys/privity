import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Notification } from '@privity/types';
import { theme } from '../theme';

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 'n-1',
    userId: 'me',
    type: 'follow_request',
    payload: {
      requesterUsername: 'sam_arch',
      requesterDisplayName: 'Sam Archer',
    },
    isRead: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-2',
    userId: 'me',
    type: 'like',
    payload: {
      actorUsername: 'elena_rodriguez',
      actorDisplayName: 'Elena Rodriguez',
      postSnippet: 'Sunlit afternoon in the studio...',
    },
    isRead: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'n-3',
    userId: 'me',
    type: 'comment',
    payload: {
      actorUsername: 'marcus_dev',
      actorDisplayName: 'Marcus Vance',
      commentText: 'Completely agree, private-first feeds change how we connect.',
    },
    isRead: true,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n-4',
    userId: 'me',
    type: 'new_follower',
    payload: {
      actorUsername: 'chloe_visuals',
      actorDisplayName: 'Chloe Kim',
    },
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
];

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);

  const handleAcceptRequest = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, type: 'follow_request_accepted' as any, isRead: true } : n,
      ),
    );
  };

  const handleRejectRequest = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity
          onPress={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
          }
        >
          <Text style={styles.markReadText}>Mark all as read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notifications.map((item) => (
          <View
            key={item.id}
            style={[
              styles.itemCard,
              !item.isRead && styles.unreadItemCard,
            ]}
          >
            <View style={styles.iconCol}>
              <Text style={styles.typeIcon}>
                {item.type === 'follow_request'
                  ? '🔒'
                  : item.type === 'like'
                  ? '♥'
                  : item.type === 'comment'
                  ? '💬'
                  : '👤'}
              </Text>
            </View>

            <View style={styles.textCol}>
              {item.type === 'follow_request' ? (
                <View>
                  <Text style={styles.messageText}>
                    <Text style={styles.boldText}>{item.payload.requesterDisplayName}</Text> requested to follow your private account.
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.acceptBtn}
                      onPress={() => handleAcceptRequest(item.id)}
                    >
                      <Text style={styles.acceptText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectRequest(item.id)}
                    >
                      <Text style={styles.rejectText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : item.type === 'follow_request_accepted' ? (
                <Text style={styles.messageText}>
                  Follow request accepted.
                </Text>
              ) : item.type === 'like' ? (
                <Text style={styles.messageText}>
                  <Text style={styles.boldText}>{item.payload.actorDisplayName}</Text> liked your post: "{item.payload.postSnippet}"
                </Text>
              ) : item.type === 'comment' ? (
                <Text style={styles.messageText}>
                  <Text style={styles.boldText}>{item.payload.actorDisplayName}</Text> commented: "{item.payload.commentText}"
                </Text>
              ) : (
                <Text style={styles.messageText}>
                  <Text style={styles.boldText}>{item.payload.actorDisplayName}</Text> started following you.
                </Text>
              )}
            </View>
          </View>
        ))}
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
  markReadText: {
    color: theme.colors.privacyFollowers,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unreadItemCard: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: theme.colors.surfaceHover,
  },
  iconCol: {
    marginRight: theme.spacing.sm,
    paddingTop: 2,
  },
  typeIcon: {
    fontSize: 18,
  },
  textCol: {
    flex: 1,
  },
  messageText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: theme.colors.privacyCloseFriends,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginRight: 8,
  },
  acceptText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  rejectText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
