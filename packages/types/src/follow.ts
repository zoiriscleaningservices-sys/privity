import { UserProfile } from './user';

export type FollowStatus = 'pending' | 'accepted';

export interface FollowRelationship {
  id: string;
  followerId: string;
  followeeId: string;
  status: FollowStatus;
  createdAt: string;
  user?: UserProfile;
}
