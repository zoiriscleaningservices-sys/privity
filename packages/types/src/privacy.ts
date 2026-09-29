/**
 * Privity Core Privacy Model
 * PRD Section 10: Privacy Model & Enforcement
 */

export type PostPrivacy = 'public' | 'followers' | 'close_friends';

export type AccountPrivacy = 'public' | 'private';

export interface PrivacyCheckContext {
  authorId: string;
  authorAccountPrivacy: AccountPrivacy;
  postPrivacy: PostPrivacy;
  viewerId: string | null;
  isAuthor: boolean;
  isFollower: boolean;
  isCloseFriend: boolean;
  isBlockedByAuthor: boolean;
  isViewerBlockingAuthor: boolean;
  isAuthorSuspendedOrBanned: boolean;
}

export interface PrivacyCheckResult {
  canView: boolean;
  reason?: string;
}
