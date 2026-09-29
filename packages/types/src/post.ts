import { PostPrivacy } from './privacy';
import { UserProfile } from './user';

export type PostType = 'text' | 'image' | 'video';

export interface Post {
  id: string;
  authorId: string;
  author: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isVerified'>;
  type: PostType;
  contentUrl?: string | null;
  thumbnailUrl?: string | null;
  caption: string;
  tags: string[];
  privacy: PostPrivacy;
  visibilityId?: string | null;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isPinned?: boolean;
  canEditCaption?: boolean; // Within 15 minutes of publication per PRD 12.4
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostDto {
  type: PostType;
  contentUrl?: string;
  thumbnailUrl?: string;
  caption: string;
  tags?: string[];
  privacy: PostPrivacy;
  scheduledAt?: string;
}

export interface UpdatePostCaptionDto {
  caption: string;
}
