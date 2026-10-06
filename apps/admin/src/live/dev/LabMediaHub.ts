/**
 * LabMediaHub — in-page loopback MediaTransport for the LIVE Lab (DEV ONLY).
 *
 * - Screens on this page publish their own processed media (host filter output, guest camera).
 * - Simulated remote people (Lab guests who have no screen open, the battle opponent) get a
 *   clearly labelled synthetic test signal so layouts can be verified with moving video.
 * - Link state per participant can be injected to exercise reconnect / disconnect UI.
 *
 * Stage 4 replaces this with a LiveKit-backed MediaTransport; screens do not change.
 */

import type { ParticipantMedia, ParticipantMediaStatus } from '../client/connection';
import type { MediaTransport, PublishedMedia } from '../client/mediaTransport';
import { TestPatternSource } from '../media/TestPatternSource';

interface SimEntry {
  pattern: TestPatternSource;
  status: ParticipantMediaStatus;
  cameraOn: boolean;
  micOn: boolean;
}

export class LabMediaHub implements MediaTransport {
  private published = new Map<string, PublishedMedia & { status: ParticipantMediaStatus }>();
  private simulated = new Map<string, SimEntry>();
  private snapshot: ReadonlyMap<string, ParticipantMedia> = new Map();
  private readonly listeners = new Set<() => void>();

  get(): ReadonlyMap<string, ParticipantMedia> {
    return this.snapshot;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  publish(id: string, media: PublishedMedia): void {
    const prev = this.published.get(id);
    this.published.set(id, { ...media, status: prev?.status ?? 'connected' });
    this.rebuild();
  }

  unpublish(id: string): void {
    if (this.published.delete(id)) this.rebuild();
  }

  /** Adds / removes synthetic remote participants to match who is on stage. */
  syncSimulated(ids: ReadonlyArray<{ id: string; label: string }>): void {
    const want = new Set(ids.map((x) => x.id));
    let changed = false;
    for (const [id, e] of this.simulated) {
      if (!want.has(id) || this.published.has(id)) {
        e.pattern.stop();
        this.simulated.delete(id);
        changed = true;
      }
    }
    for (const { id, label } of ids) {
      if (this.simulated.has(id) || this.published.has(id)) continue;
      const pattern = new TestPatternSource('guest', `SIMULATED · ${label}`, 270, 480);
      this.simulated.set(id, { pattern, status: 'connected', cameraOn: true, micOn: true });
      changed = true;
    }
    if (changed) this.rebuild();
  }

  /** QA: what a remote participant's own device is doing (their choice, not the host's). */
  setSimulatedState(id: string, patch: Partial<Pick<SimEntry, 'status' | 'cameraOn' | 'micOn'>>): void {
    const e = this.simulated.get(id);
    if (e) {
      Object.assign(e, patch);
      this.rebuild();
      return;
    }
    const p = this.published.get(id);
    if (p && patch.status) {
      p.status = patch.status;
      this.rebuild();
    }
  }

  simulatedIds(): string[] {
    return [...this.simulated.keys()];
  }

  dispose(): void {
    for (const e of this.simulated.values()) e.pattern.stop();
    this.simulated.clear();
    this.published.clear();
    this.listeners.clear();
  }

  private rebuild(): void {
    const next = new Map<string, ParticipantMedia>();
    for (const [id, p] of this.published) {
      next.set(id, { id, status: p.status, cameraOn: p.cameraOn, micOn: p.micOn, stream: p.stream });
    }
    for (const [id, e] of this.simulated) {
      let stream: MediaStream | null = null;
      try {
        stream = e.cameraOn ? e.pattern.start() : null;
      } catch {
        stream = null;
      }
      if (!e.cameraOn) e.pattern.stop();
      next.set(id, { id, status: e.status, cameraOn: e.cameraOn, micOn: e.micOn, stream });
    }
    this.snapshot = next;
    for (const fn of this.listeners) fn();
  }
}
