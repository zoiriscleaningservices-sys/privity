/**
 * Connection + media-presence models.
 *
 * `link` is the realtime event channel (real in production: Supabase channel status).
 * `quality` is MEDIA quality and only exists when real telemetry exists (Stage 4: WebRTC
 * getStats / LiveKit ConnectionQuality). Until then it is 'unknown' and the UI says so —
 * no invented bars or numbers. The LIVE Lab may inject values; they are labelled 'simulated'.
 */

export type LinkStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type MediaQuality = 'unknown' | 'excellent' | 'good' | 'weak';
export type TelemetrySource = 'none' | 'simulated' | 'webrtc';

export interface ConnectionState {
  link: LinkStatus;
  quality: MediaQuality;
  source: TelemetrySource;
  rttMs: number | null;
  packetLossPct: number | null;
}

export const INITIAL_CONNECTION: ConnectionState = {
  link: 'connecting',
  quality: 'unknown',
  source: 'none',
  rttMs: null,
  packetLossPct: null,
};

/** Stage 4 feeds real WebRTC stats through this. Thresholds follow common VoIP guidance. */
export function qualityFromStats(s: { rttMs: number; packetLossPct: number; jitterMs?: number }): Exclude<MediaQuality, 'unknown'> {
  const jitter = s.jitterMs ?? 0;
  if (s.packetLossPct >= 5 || s.rttMs >= 400 || jitter >= 60) return 'weak';
  if (s.packetLossPct >= 1.5 || s.rttMs >= 180 || jitter >= 30) return 'good';
  return 'excellent';
}

/** Per-participant media presence (Stage 4: LiveKit participant/track events). */
export type ParticipantMediaStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface ParticipantMedia {
  id: string;
  status: ParticipantMediaStatus;
  /** The participant is publishing camera / microphone (their own choice, on their device). */
  cameraOn: boolean;
  micOn: boolean;
  /** Video to render, if any. Stage 4 supplies remote LiveKit tracks; the Lab supplies test patterns. */
  stream: MediaStream | null;
}
