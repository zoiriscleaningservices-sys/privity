import { Gift, GiftEvent, ActiveGiftQueueItem, GIFT_PRIORITY_MAP } from './types';

export class GiftQueueManager {
  private queue: ActiveGiftQueueItem[] = [];
  private activeItems: ActiveGiftQueueItem[] = [];
  private listeners: Set<(items: ActiveGiftQueueItem[]) => void> = new Set();
  private maxConcurrentMinor: number = 4;
  private nextLane: number = 0;

  public subscribe(listener: (items: ActiveGiftQueueItem[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.activeItems]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const copy = [...this.activeItems];
    this.listeners.forEach((fn) => fn(copy));
  }

  public enqueue(event: GiftEvent, gift: Gift): void {
    const priority = gift.priority || GIFT_PRIORITY_MAP[gift.rarity] || 1;
    const isMajor = priority >= 5;

    // Check if we should group repeated small gifts into a streak
    if (!isMajor) {
      const existingStreak = this.activeItems.find(
        (item) =>
          item.event.giftId === gift.id &&
          item.event.senderId === event.senderId &&
          item.status === 'playing'
      );

      if (existingStreak) {
        existingStreak.streakCount = (existingStreak.streakCount || 1) + (event.quantity || 1);
        existingStreak.startTime = Date.now(); // reset timer for streak burst
        this.notify();
        return;
      }
    }

    const queueItem: ActiveGiftQueueItem = {
      queueId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      event,
      gift,
      startTime: 0,
      duration: gift.animationDuration || 4000,
      status: 'pending',
      lane: (this.nextLane++ % 4),
      streakCount: event.quantity || 1,
    };

    if (isMajor) {
      // Legendary gifts go to the front of pending queue
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    this.processQueue();
  }

  public removeItem(queueId: string): void {
    this.activeItems = this.activeItems.filter((item) => item.queueId !== queueId);
    this.processQueue();
    this.notify();
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const hasActiveMajor = this.activeItems.some(
      (item) => (item.gift.priority || GIFT_PRIORITY_MAP[item.gift.rarity] || 1) >= 5
    );

    // If a major gift is currently commanding the stage, wait for it to finish
    if (hasActiveMajor) return;

    // Next item to consider
    const nextItem = this.queue[0];
    const nextPriority = nextItem.gift.priority || GIFT_PRIORITY_MAP[nextItem.gift.rarity] || 1;

    if (nextPriority >= 5) {
      // Legendary gift: commands the main overlay!
      // Promote from queue to active
      this.queue.shift();
      nextItem.status = 'playing';
      nextItem.startTime = Date.now();
      this.activeItems.push(nextItem);
      this.notify();
    } else {
      // Minor gift: allow up to maxConcurrentMinor
      const activeMinorCount = this.activeItems.filter(
        (item) => (item.gift.priority || GIFT_PRIORITY_MAP[item.gift.rarity] || 1) < 5
      ).length;

      if (activeMinorCount < this.maxConcurrentMinor) {
        this.queue.shift();
        nextItem.status = 'playing';
        nextItem.startTime = Date.now();
        this.activeItems.push(nextItem);
        this.notify();

        // Recursively check if another minor gift can be processed
        if (this.queue.length > 0 && (this.queue[0].gift.priority || 1) < 5) {
          this.processQueue();
        }
      }
    }
  }

  public clear(): void {
    this.queue = [];
    this.activeItems = [];
    this.notify();
  }
}

// Global Singleton for the livestream session
export const globalGiftQueue = new GiftQueueManager();
