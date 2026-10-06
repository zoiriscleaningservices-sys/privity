/**
 * Server-authoritative clock.
 *
 * Local time is taken from a MONOTONIC source (performance.now()), never Date.now(), so a user
 * changing their device clock cannot move battle timers. The offset to server time is
 * estimated from RPC round trips (midpoint method, preferring low-RTT samples) and
 * lower-bounded by event timestamps (an event can never be from the future).
 */

export type MonotonicNow = () => number;

const defaultMonotonic: MonotonicNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export class ServerClock {
  private offset: number | null = null;
  private bestRtt = Number.POSITIVE_INFINITY;
  private lastReturned = Number.NEGATIVE_INFINITY;

  constructor(private readonly monotonicNow: MonotonicNow = defaultMonotonic) {}

  /** Local monotonic timestamp, for measuring round trips. */
  localNow(): number {
    return this.monotonicNow();
  }

  get isSynced(): boolean {
    return this.offset !== null;
  }

  /**
   * @param t0 localNow() before the request
   * @param t1 localNow() after the response
   * @param serverMs server timestamp contained in the response (epoch ms)
   */
  syncFromRoundTrip(t0: number, t1: number, serverMs: number): void {
    const rtt = Math.max(0, t1 - t0);
    const estimate = serverMs + rtt / 2 - t1;
    if (this.offset === null) {
      this.offset = estimate;
      this.bestRtt = rtt;
      return;
    }
    // Low-RTT samples are more accurate; weight them more heavily.
    const alpha = rtt <= this.bestRtt * 1.5 ? 0.5 : 0.1;
    this.bestRtt = Math.min(this.bestRtt, rtt);
    this.offset = this.offset + alpha * (estimate - this.offset);
  }

  /** Events are emitted before they are received, so server_ts is a lower bound on "now". */
  observeServerTimestamp(serverMs: number): void {
    const local = this.monotonicNow();
    const lowerBound = serverMs - local;
    if (this.offset === null || lowerBound > this.offset) {
      this.offset = lowerBound;
    }
  }

  /** Estimated current server time (epoch ms). Never moves backwards. */
  now(): number {
    const local = this.monotonicNow();
    const raw = local + (this.offset ?? Date.now() - local);
    if (raw < this.lastReturned) return this.lastReturned;
    this.lastReturned = raw;
    return raw;
  }
}
