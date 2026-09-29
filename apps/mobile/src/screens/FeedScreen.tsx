import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Post, PostPrivacy } from '@privity/types';
import { theme } from '../theme';
import { PostCard } from '../components/PostCard';

const SAMPLE_POSTS: Post[] = [
  {
    id: 'post-1',
    authorId: 'user-1',
    author: {
      id: 'user-1',
      username: 'elena_rodriguez',
      displayName: 'Elena Rodriguez',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isVerified: true,
    },
    type: 'image',
    contentUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800',
    caption: 'Sunlit afternoon in the studio. Creating without the pressure of an algorithm.',
    tags: ['photography', 'mindful', 'art'],
    privacy: 'close_friends',
    likesCount: 14,
    commentsCount: 3,
    sharesCount: 0,
    savesCount: 5,
    isLiked: true,
    isSaved: true,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'post-2',
    authorId: 'user-2',
    author: {
      id: 'user-2',
      username: 'marcus_dev',
      displayName: 'Marcus Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      isVerified: false,
    },
    type: 'text',
    caption:
      'Reflecting on social networks: The moment you make follower count the primary metric, content degenerates into outrage and clickbait. Privity feels like the antidote.',
    tags: ['social', 'privacy', 'thoughts'],
    privacy: 'followers',
    likesCount: 38,
    commentsCount: 11,
    sharesCount: 4,
    savesCount: 12,
    isLiked: false,
    isSaved: false,
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
  },
  {
    id: 'post-3',
    authorId: 'user-3',
    author: {
      id: 'user-3',
      username: 'chloe_visuals',
      displayName: 'Chloe Kim',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      isVerified: true,
    },
    type: 'video',
    thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800',
    caption: 'Tokyo rainy evening walk — captured in 4K 60fps 🌧️✨',
    tags: ['tokyo', 'cinematic', 'video'],
    privacy: 'public',
    likesCount: 124,
    commentsCount: 19,
    sharesCount: 15,
    savesCount: 42,
    isLiked: false,
    isSaved: false,
    createdAt: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 340 * 60 * 1000).toISOString(),
  },
];

interface Props {
  onOpenReport?: (post: Post) => void;
  onOpenComment?: (post: Post) => void;
}

export const FeedScreen: React.FC<Props> = ({ onOpenReport, onOpenComment }) => {
  const [filter, setFilter] = useState<'all' | PostPrivacy>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    return p.privacy === filter;
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top App Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>privity</Text>
          <View style={styles.dot} />
        </View>
        <Text style={styles.tagline}>Private-first social feed</Text>
      </View>

      {/* Privacy Audience Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'all' && styles.filterChipTextActive,
            ]}
          >
            All Followed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === 'close_friends' && styles.filterChipCloseFriends,
          ]}
          onPress={() => setFilter('close_friends')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'close_friends' && styles.filterChipTextCloseFriends,
            ]}
          >
            ★ Close Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            filter === 'followers' && styles.filterChipFollowers,
          ]}
          onPress={() => setFilter('followers')}
        >
          <Text
            style={[
              styles.filterChipText,
              filter === 'followers' && styles.filterChipTextFollowers,
            ]}
          >
            👥 Followers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feed List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand}
          />
        }
      >
        {filteredPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onReportPress={onOpenReport}
            onCommentPress={onOpenComment}
          />
        ))}

        <View style={styles.feedEnd}>
          <Text style={styles.feedEndText}>You are all caught up</Text>
          <Text style={styles.feedEndSub}>
            Content is chronological & relationship-driven
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
  topBar: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.privacyCloseFriends,
    marginLeft: 3,
    marginTop: 4,
  },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: theme.colors.surfaceHover,
    borderColor: theme.colors.border,
  },
  filterChipCloseFriends: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: theme.colors.privacyCloseFriends,
  },
  filterChipFollowers: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: theme.colors.privacyFollowers,
  },
  filterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.colors.textPrimary,
  },
  filterChipTextCloseFriends: {
    color: theme.colors.privacyCloseFriends,
  },
  filterChipTextFollowers: {
    color: theme.colors.privacyFollowers,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  feedEnd: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  feedEndText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  feedEndSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
