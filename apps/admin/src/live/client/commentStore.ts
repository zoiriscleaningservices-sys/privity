/**
 * Comments projection: snapshot `recent_comments` + COMMENT_CREATED / COMMENT_DELETED events.
 * Bounded (oldest dropped) so rapid chat never grows the DOM or memory without limit.
 * Comments appear when the server confirms them — never optimistically invented.
 */

import { AnyLiveEvent, SnapshotComment, UserRef, toMs } from '../core/events';

export interface LiveComment {
  id: string;
  author: UserRef;
  text: string;
  createdAt: number;
}

export class CommentStore {
  private items: LiveComment[] = [];
  private readonly listeners = new Set<() => void>();

  constructor(private readonly limit = 120) {}

  get(): ReadonlyArray<LiveComment> {
    return this.items;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  reset(recent: ReadonlyArray<SnapshotComment>): void {
    const seen = new Set<string>();
    const next: LiveComment[] = [];
    for (const c of recent) {
      if (seen.has(c.comment_id)) continue;
      seen.add(c.comment_id);
      next.push({ id: c.comment_id, author: c.author, text: c.text, createdAt: toMs(c.created_at) ?? 0 });
    }
    this.items = next.slice(-this.limit);
    this.emit();
  }

  apply(e: AnyLiveEvent): void {
    if (e.event_type === 'COMMENT_CREATED') {
      if (this.items.some((c) => c.id === e.payload.comment_id)) return;
      const next = this.items.length >= this.limit ? this.items.slice(this.items.length - this.limit + 1) : this.items.slice();
      next.push({ id: e.payload.comment_id, author: e.payload.author, text: e.payload.text, createdAt: toMs(e.server_ts) ?? 0 });
      this.items = next;
      this.emit();
    } else if (e.event_type === 'COMMENT_DELETED') {
      const next = this.items.filter((c) => c.id !== e.payload.comment_id);
      if (next.length !== this.items.length) {
        this.items = next;
        this.emit();
      }
    }
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
