import { AccountPrivacy } from './privacy';

export type UserRole = 'visitor' | 'user' | 'creator' | 'moderator' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  privacySetting: AccountPrivacy;
  role: UserRole;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  pinnedPostId?: string | null;
  isFollowing?: boolean;
  isFollowPending?: boolean;
  isCloseFriend?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  privacySetting?: AccountPrivacy;
  pinnedPostId?: string | null;
}
