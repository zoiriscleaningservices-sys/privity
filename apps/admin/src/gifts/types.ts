import { Gift, GiftCategory, GiftRarity, GiftEvent, GiftTransaction } from '@privity/types';

export type { Gift, GiftCategory, GiftRarity, GiftEvent, GiftTransaction };

export const GIFT_PRIORITY_MAP: Record<GiftRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  special: 4,
  legendary: 5,
};

export type QueueItemStatus = 'pending' | 'playing' | 'completed' | 'failed';

export interface ActiveGiftQueueItem {
  queueId: string;
  event: GiftEvent;
  gift: Gift;
  startTime: number;
  duration: number;
  status: QueueItemStatus;
  lane: number;
  isGroupedStreak?: boolean;
  streakCount?: number;
}
