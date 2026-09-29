export type NotificationType =
  | 'new_follower'
  | 'follow_request'
  | 'follow_request_accepted'
  | 'like'
  | 'comment'
  | 'comment_reply'
  | 'mention'
  | 'moderation_action';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  actorId?: string;
  actorUsername?: string;
  actorAvatarUrl?: string;
  targetId?: string;
  payload: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
}
