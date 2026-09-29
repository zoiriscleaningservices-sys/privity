import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  StatusBar,
  Alert,
} from 'react-native';
import { FeedScreen } from './src/screens/FeedScreen';
import { DiscoverScreen } from './src/screens/DiscoverScreen';
import { CreatePostModal } from './src/screens/CreatePostModal';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { theme } from './src/theme';
import { Post, ReportReason } from '@privity/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'discover' | 'notifications' | 'profile'>('home');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reportingPost, setReportingPost] = useState<Post | null>(null);

  const handleOpenReport = (post: Post) => {
    setReportingPost(post);
  };

  const submitReport = (reason: ReportReason) => {
    Alert.alert(
      'Report Submitted',
      `Thank you. This post has been sent to our moderation queue for review (${reason}).`,
    );
    setReportingPost(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.background} />

      {/* Screen Views */}
      <View style={styles.mainContent}>
        {activeTab === 'home' && <FeedScreen onOpenReport={handleOpenReport} />}
        {activeTab === 'discover' && <DiscoverScreen />}
        {activeTab === 'notifications' && <NotificationsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Primary Tab Navigation Bar (PRD Section 45) */}
      <View style={styles.bottomNav}>
        {/* Home */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('home')}
        >
          <Text
            style={[
              styles.navIcon,
              activeTab === 'home' && styles.navIconActive,
            ]}
          >
            🏠
          </Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'home' && styles.navLabelActive,
            ]}
          >
            Feed
          </Text>
        </TouchableOpacity>

        {/* Discover */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('discover')}
        >
          <Text
            style={[
              styles.navIcon,
              activeTab === 'discover' && styles.navIconActive,
            ]}
          >
            🔍
          </Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'discover' && styles.navLabelActive,
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>

        {/* Central Prominent Create Action (PRD Section 45) */}
        <TouchableOpacity
          style={styles.createActionBtn}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.8}
        >
          <View style={styles.createButtonInner}>
            <Text style={styles.createPlus}>+</Text>
          </View>
        </TouchableOpacity>

        {/* Notifications */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('notifications')}
        >
          <Text
            style={[
              styles.navIcon,
              activeTab === 'notifications' && styles.navIconActive,
            ]}
          >
            🔔
          </Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'notifications' && styles.navLabelActive,
            ]}
          >
            Activity
          </Text>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity
          style={styles.navTab}
          onPress={() => setActiveTab('profile')}
        >
          <Text
            style={[
              styles.navIcon,
              activeTab === 'profile' && styles.navIconActive,
            ]}
          >
            👤
          </Text>
          <Text
            style={[
              styles.navLabel,
              activeTab === 'profile' && styles.navLabelActive,
            ]}
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Post Creation Modal */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <CreatePostModal onClose={() => setIsCreateModalOpen(false)} />
      </Modal>

      {/* Moderation / Report Modal (PRD Section 19.1) */}
      <Modal
        visible={!!reportingPost}
        transparent
        animationType="fade"
        onRequestClose={() => setReportingPost(null)}
      >
        <View style={styles.reportOverlay}>
          <View style={styles.reportModalCard}>
            <Text style={styles.reportTitle}>Report Content</Text>
            <Text style={styles.reportSub}>
              Select the reason for reporting this post by @{reportingPost?.author.username}:
            </Text>

            {(
              [
                ['spam', 'Spam / Misleading'],
                ['harassment', 'Harassment or Bullying'],
                ['hate_abuse', 'Hate Speech or Abuse'],
                ['sexual_content', 'Sensitive or Inappropriate Content'],
                ['violence', 'Violence or Dangerous Acts'],
                ['fraud_scam', 'Scam or Fraud'],
              ] as [ReportReason, string][]
            ).map(([reason, label]) => (
              <TouchableOpacity
                key={reason}
                style={styles.reportOptionBtn}
                onPress={() => submitReport(reason)}
              >
                <Text style={styles.reportOptionText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.reportCancelBtn}
              onPress={() => setReportingPost(null)}
            >
              <Text style={styles.reportCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  mainContent: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navTab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    color: theme.colors.textMuted,
  },
  navIconActive: {
    color: theme.colors.brand,
  },
  navLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    color: theme.colors.brand,
  },
  createActionBtn: {
    top: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  createPlus: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
    marginTop: -2,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  reportModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reportTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 6,
  },
  reportSub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginBottom: theme.spacing.md,
  },
  reportOptionBtn: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  reportOptionText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  reportCancelBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportCancelText: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
