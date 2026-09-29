import { UserProfile } from './user';

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  author: Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'isVerified'>;
  text: string;
  parentCommentId?: string | null;
  replies?: Comment[];
  repliesCount?: number;
  createdAt: string;
  editedAt?: string | null;
}

export interface CreateCommentDto {
  text: string;
  parentCommentId?: string; // Optional: only root comments can be replied to (1-level nesting)
}

export interface UpdateCommentDto {
  text: string;
}
