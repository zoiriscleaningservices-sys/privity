import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { PostPrivacy, PostType } from '@privity/types';
import { theme } from '../theme';

interface Props {
  onClose: () => void;
  onPostCreated?: (post: any) => void;
}

export const CreatePostModal: React.FC<Props> = ({ onClose, onPostCreated }) => {
  const [postType, setPostType] = useState<PostType>('text');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [privacy, setPrivacy] = useState<PostPrivacy>('followers');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = () => {
    if (!caption.trim()) {
      Alert.alert('Required', 'Please write a caption or message.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const parsedTags = tags
        .split(' ')
        .map((t) => t.replace('#', '').trim())
        .filter(Boolean);

      const newPost = {
        id: `post-${Date.now()}`,
        authorId: 'me',
        author: {
          id: 'me',
          username: 'luciano',
          displayName: 'Luciano',
          isVerified: true,
        },
        type: postType,
        caption,
        tags: parsedTags,
        privacy,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        savesCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onPostCreated?.(newPost);
      Alert.alert('Published', `Your ${privacy.replace('_', ' ')} post is live!`);
      onClose();
    }, 600);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          onPress={handlePublish}
          disabled={isSubmitting}
          style={[styles.publishBtn, isSubmitting && styles.publishBtnDisabled]}
        >
          <Text style={styles.publishText}>
            {isSubmitting ? 'Posting...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Post Type Selector */}
        <Text style={styles.sectionLabel}>CONTENT TYPE</Text>
        <View style={styles.typeSelectorRow}>
          {(['text', 'image', 'video'] as PostType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeBtn,
                postType === type && styles.typeBtnActive,
              ]}
              onPress={() => setPostType(type)}
            >
              <Text style={styles.typeIcon}>
                {type === 'text' ? '✍️ Text' : type === 'image' ? '📷 Photo' : '🎥 Video (≤60s)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Caption Input */}
        <Text style={styles.sectionLabel}>CAPTION / THOUGHTS</Text>
        <TextInput
          style={styles.captionInput}
          placeholder="What is on your mind? Share with intent..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          numberOfLines={5}
          value={caption}
          onChangeText={setCaption}
        />

        {/* Tags */}
        <Text style={styles.sectionLabel}>TAGS (SPACE SEPARATED)</Text>
        <TextInput
          style={styles.tagsInput}
          placeholder="#mindful #design #journal"
          placeholderTextColor={theme.colors.textMuted}
          value={tags}
          onChangeText={setTags}
        />

        {/* Privacy Selector (PRD Core Principle: Users should understand who can see what they share) */}
        <Text style={[styles.sectionLabel, { marginTop: theme.spacing.lg }]}>
          WHO CAN SEE THIS? (PRIVACY LEVEL)
        </Text>

        <TouchableOpacity
          style={[
            styles.privacyOption,
            privacy === 'close_friends' && styles.privacyOptionCloseFriends,
          ]}
          onPress={() => setPrivacy('close_friends')}
        >
          <View style={styles.privacyOptionHeader}>
            <Text style={[styles.privacyIcon, { color: theme.colors.privacyCloseFriends }]}>
              ★
            </Text>
            <Text style={[styles.privacyTitle, { color: theme.colors.privacyCloseFriends }]}>
              Close Friends Only
            </Text>
            {privacy === 'close_friends' && <Text style={styles.checkIcon}>✓</Text>}
          </View>
          <Text style={styles.privacySub}>
            Visible solely to members of your close friends list. Intimate & private.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.privacyOption,
            privacy === 'followers' && styles.privacyOptionFollowers,
          ]}
          onPress={() => setPrivacy('followers')}
        >
          <View style={styles.privacyOptionHeader}>
            <Text style={[styles.privacyIcon, { color: theme.colors.privacyFollowers }]}>
              👥
            </Text>
            <Text style={[styles.privacyTitle, { color: theme.colors.privacyFollowers }]}>
              Followers Only
            </Text>
            {privacy === 'followers' && <Text style={styles.checkIcon}>✓</Text>}
          </View>
          <Text style={styles.privacySub}>
            Only accounts who follow you (and whom you approved if private) can view this.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.privacyOption,
            privacy === 'public' && styles.privacyOptionPublic,
          ]}
          onPress={() => setPrivacy('public')}
        >
          <View style={styles.privacyOptionHeader}>
            <Text style={[styles.privacyIcon, { color: theme.colors.privacyPublic }]}>
              🌐
            </Text>
            <Text style={[styles.privacyTitle, { color: theme.colors.privacyPublic }]}>
              Public
            </Text>
            {privacy === 'public' && <Text style={styles.checkIcon}>✓</Text>}
          </View>
          <Text style={styles.privacySub}>
            Visible to anyone on Privity and in search/discovery according to account status.
          </Text>
        </TouchableOpacity>

        <View style={styles.captionEditNote}>
          <Text style={styles.noteText}>
            ⏱️ Note: Captions can be edited within 15 minutes of publication.
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  cancelBtn: {
    padding: theme.spacing.xs,
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.md,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.typography.sizes.md,
  },
  publishBtn: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: theme.typography.sizes.sm,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    borderColor: theme.colors.brand,
    backgroundColor: theme.colors.surfaceHover,
  },
  typeIcon: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  captionInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    textAlignVertical: 'top',
    minHeight: 110,
    marginBottom: theme.spacing.md,
  },
  tagsInput: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
  privacyOption: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  privacyOptionCloseFriends: {
    borderColor: theme.colors.privacyCloseFriends,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  privacyOptionFollowers: {
    borderColor: theme.colors.privacyFollowers,
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
  },
  privacyOptionPublic: {
    borderColor: theme.colors.privacyPublic,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  privacyOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  privacyTitle: {
    fontWeight: '700',
    fontSize: theme.typography.sizes.sm,
    flex: 1,
  },
  checkIcon: {
    color: theme.colors.textPrimary,
    fontWeight: 'bold',
  },
  privacySub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    paddingLeft: 24,
  },
  captionEditNote: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
  },
  noteText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
});
