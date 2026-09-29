import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Post } from '@privity/types';
import { theme } from '../theme';
import { PrivacyBadge } from './PrivacyBadge';

interface Props {
  post: Post;
  onLikeToggle?: (postId: string, willLike: boolean) => void;
  onCommentPress?: (post: Post) => void;
  onSaveToggle?: (postId: string, willSave: boolean) => void;
  onReportPress?: (post: Post) => void;
}

export const PostCard: React.FC<Props> = ({
  post,
  onLikeToggle,
  onCommentPress,
  onSaveToggle,
  onReportPress,
}) => {
  const [isLiked, setIsLiked] = useState(post.isLiked ?? false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isSaved, setIsSaved] = useState(post.isSaved ?? false);

  const handleLike = () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    onLikeToggle?.(post.id, nextState);
  };

  const handleSave = () => {
    const nextState = !isSaved;
    setIsSaved(nextState);
    onSaveToggle?.(post.id, nextState);
  };

  const handleShare = () => {
    const shareUrl = `https://privity.app/p/${post.id}`;
    Alert.alert('Share Link Copied', `Link: ${shareUrl}`);
  };

  return (
    <View style={styles.card}>
      {/* Header: Author & Privacy Indicator */}
      <View style={styles.header}>
        <View style={styles.authorRow}>
          <View style={styles.avatarContainer}>
            {post.author.avatarUrl ? (
              <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarLetter}>
                  {post.author.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.authorInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{post.author.displayName}</Text>
              {post.author.isVerified && <Text style={styles.verifiedIcon}>✓</Text>}
            </View>
            <Text style={styles.username}>@{post.author.username}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <PrivacyBadge privacy={post.privacy} />
          <TouchableOpacity
            style={styles.moreButton}
            onPress={() => onReportPress?.(post)}
          >
            <Text style={styles.moreIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Media / Content */}
      {post.type === 'image' && post.contentUrl ? (
        <View style={styles.mediaContainer}>
          <Image source={{ uri: post.contentUrl }} style={styles.mediaImage} />
        </View>
      ) : post.type === 'video' ? (
        <View style={styles.videoContainer}>
          {post.thumbnailUrl ? (
            <Image source={{ uri: post.thumbnailUrl }} style={styles.mediaImage} />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.playIcon}>▶</Text>
              <Text style={styles.videoLabel}>Short Video (≤60s)</Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Caption & Tags */}
      <View style={styles.contentBody}>
        {post.caption ? (
          <Text style={styles.captionText}>{post.caption}</Text>
        ) : null}

        {post.tags && post.tags.length > 0 && (
          <View style={styles.tagList}>
            {post.tags.map((tag, idx) => (
              <Text key={idx} style={styles.tagPill}>
                #{tag}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Footer: Interactions */}
      <View style={styles.footer}>
        <View style={styles.interactionGroup}>
          {/* Like */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionIcon, isLiked && styles.likedIcon]}>
              {isLiked ? '♥' : '♡'}
            </Text>
            <Text style={[styles.actionCount, isLiked && styles.likedText]}>
              {likesCount}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onCommentPress?.(post)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={styles.actionCount}>{post.commentsCount}</Text>
          </TouchableOpacity>

          {/* Share external link */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Text style={styles.actionIcon}>↗</Text>
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          <Text style={[styles.actionIcon, isSaved && styles.savedIcon]}>
            {isSaved ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  authorInfo: {
    flexDirection: 'column',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.typography.sizes.sm,
  },
  verifiedIcon: {
    color: theme.colors.privacyPublic,
    marginLeft: 4,
    fontSize: 12,
  },
  username: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreButton: {
    paddingLeft: theme.spacing.sm,
    paddingVertical: 4,
  },
  moreIcon: {
    color: theme.colors.textMuted,
    fontSize: 18,
    fontWeight: 'bold',
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#05070c',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#05070c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 36,
    color: '#fff',
    marginBottom: 6,
  },
  videoLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  contentBody: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  captionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 20,
  },
  tagList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.xs,
  },
  tagPill: {
    color: theme.colors.privacyFollowers,
    fontSize: 12,
    marginRight: 8,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  interactionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    paddingVertical: 4,
  },
  actionIcon: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  actionCount: {
    marginLeft: 6,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
  },
  likedIcon: {
    color: theme.colors.danger,
  },
  likedText: {
    color: theme.colors.danger,
  },
  savedIcon: {
    color: theme.colors.privacyCloseFriends,
  },
});
