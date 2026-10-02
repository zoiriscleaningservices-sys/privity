import { Gift, GiftEvent, ActiveGiftQueueItem, GIFT_PRIORITY_MAP } from './types';

export class GiftQueueManager {
  private queue: ActiveGiftQueueItem[] = [];
  private activeItems: ActiveGiftQueueItem[] = [];
  private listeners: Set<(items: ActiveGiftQueueItem[]) => void> = new Set();
  private processedEventIds: Set<string> = new Set();
  private autoRemoveTimers: Map<string, any> = new Map();

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
    // 1. Strict Deduplication: Prevent gift from being played more than once
    if (event.id) {
      if (this.processedEventIds.has(event.id)) {
        return; // Already processed
      }
      this.processedEventIds.add(event.id);
      if (this.processedEventIds.size > 500) {
        const firstKey = this.processedEventIds.values().next().value;
        if (firstKey) this.processedEventIds.delete(firstKey);
      }
    }

    const priority = gift.priority || GIFT_PRIORITY_MAP[gift.rarity] || 1;
    const isMajor = priority >= 5;

    // Check if we should group repeated small gifts from the SAME sender into a combo streak
    const existingStreak = this.activeItems.find(
      (item) =>
        item.event.giftId === gift.id &&
        item.event.senderId === event.senderId &&
        item.status === 'playing'
    );

    if (existingStreak) {
      existingStreak.streakCount = (existingStreak.streakCount || 1) + (event.quantity || 1);
      existingStreak.startTime = Date.now();
      // Reset auto-remove timer
      if (this.autoRemoveTimers.has(existingStreak.queueId)) {
        clearTimeout(this.autoRemoveTimers.get(existingStreak.queueId));
      }
      const t = setTimeout(() => {
        this.removeItem(existingStreak.queueId);
      }, existingStreak.duration || 3200);
      this.autoRemoveTimers.set(existingStreak.queueId, t);

      this.notify();
      return;
    }

    const duration = isMajor ? Math.min(gift.animationDuration || 4500, 5000) : 3000;

    const queueItem: ActiveGiftQueueItem = {
      queueId: `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      event,
      gift,
      startTime: 0,
      duration,
      status: 'pending',
      lane: 0,
      streakCount: event.quantity || 1,
    };

    if (isMajor) {
      // High-tier gifts get priority in queue
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    this.processQueue();
  }

  public removeItem(queueId: string): void {
    if (this.autoRemoveTimers.has(queueId)) {
      clearTimeout(this.autoRemoveTimers.get(queueId));
      this.autoRemoveTimers.delete(queueId);
    }
    this.activeItems = this.activeItems.filter((item) => item.queueId !== queueId);
    this.processQueue();
    this.notify();
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    // Strict sequential rule: Only 1 gift active at a time!
    // "show one of the gift 1st and then the 2nd gift And one after you know one after another one"
    if (this.activeItems.length > 0) {
      return; // A gift is currently commanding the stage, wait for it to complete
    }

    const nextItem = this.queue.shift();
    if (!nextItem) return;

    nextItem.status = 'playing';
    nextItem.startTime = Date.now();
    this.activeItems.push(nextItem);
    this.notify();

    // Auto-advance after duration to ensure queue never gets stuck
    const t = setTimeout(() => {
      this.removeItem(nextItem.queueId);
    }, nextItem.duration);
    this.autoRemoveTimers.set(nextItem.queueId, t);
  }

  public clear(): void {
    this.autoRemoveTimers.forEach((timer) => clearTimeout(timer));
    this.autoRemoveTimers.clear();
    this.queue = [];
    this.activeItems = [];
    this.notify();
  }
}

// Global Singleton for the livestream session
export const globalGiftQueue = new GiftQueueManager();
