/**
 * Privity LIVE — Production MediaTransport.
 *
 * Bridges the real WebRTC media layer (liveStreamSyncService, PeerJS mesh, navigator.mediaDevices)
 * to the Stage 3 MediaTransport interface required by HostStudio, ViewerLiveScreen, VideoStage, and GuestDock.
 */

import type { MediaTransport, PublishedMedia } from '../client/mediaTransport';
import type { ParticipantMedia, ParticipantMediaStatus } from '../client/connection';
import { liveStreamSync, getRoomIdFromHandle } from '../../services/liveStreamSyncService';

export interface ProductionMediaTransportOptions {
  streamerId: string;
  streamerHandle: string;
  myId: string;
  myHandle: string;
  isHost: boolean;
  initialStream?: MediaStream | null;
}

export class ProductionMediaTransport implements MediaTransport {
  private published = new Map<string, PublishedMedia & { status: ParticipantMediaStatus }>();
  private remote = new Map<string, ParticipantMedia>();
  private snapshot: ReadonlyMap<string, ParticipantMedia> = new Map();
  private listeners = new Set<() => void>();
  private cleanupViewerStream: (() => void) | null = null;
  private cleanupGuestStreams: (() => void) | null = null;
  private cleanupGuestStage: (() => void) | null = null;
  private disposed = false;

  constructor(private readonly opts: ProductionMediaTransportOptions) {
    if (opts.isHost && opts.initialStream) {
      this.published.set(opts.myId, {
        stream: opts.initialStream,
        cameraOn: true,
        micOn: true,
        status: 'connected',
      });
      liveStreamSync.updateHostMediaStream(opts.initialStream);
    }
    if (!opts.isHost) {
      this.initViewerConnection();
    }
    this.initGuestStreamsListener();
    this.rebuild();
  }

  public updateInitialStream(stream: MediaStream | null): void {
    if (this.disposed || !this.opts.isHost) return;
    const prev = this.published.get(this.opts.myId);
    this.published.set(this.opts.myId, {
      stream,
      cameraOn: !!stream && stream.getVideoTracks().some((t) => t.readyState === 'live'),
      micOn: prev?.micOn ?? true,
      status: 'connected',
    });
    if (stream) {
      liveStreamSync.updateHostMediaStream(stream);
    }
    this.rebuild();
  }

  private initViewerConnection(): void {
    const target = this.opts.streamerHandle || this.opts.streamerId;
    this.cleanupViewerStream = liveStreamSync.connectToRemoteStream(
      target,
      (remoteStream) => {
        if (this.disposed) return;
        this.remote.set(this.opts.streamerId, {
          id: this.opts.streamerId,
          status: 'connected',
          cameraOn: true,
          micOn: true,
          stream: remoteStream,
        });
        const cleanHandle = (this.opts.streamerHandle || this.opts.streamerId || '').replace(/^@/, '').toLowerCase().trim();
        const roomId = cleanHandle.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanHandle && cleanHandle !== this.opts.streamerId) {
          this.remote.set(cleanHandle, {
            id: cleanHandle,
            status: 'connected',
            cameraOn: true,
            micOn: true,
            stream: remoteStream,
          });
        }
        if (roomId && roomId !== cleanHandle && roomId !== this.opts.streamerId) {
          this.remote.set(roomId, {
            id: roomId,
            status: 'connected',
            cameraOn: true,
            micOn: true,
            stream: remoteStream,
          });
        }
        this.rebuild();
      },
      (status) => {
        if (this.disposed) return;
        const current = this.remote.get(this.opts.streamerId);
        if (current) {
          current.status = status === 'connecting' ? 'reconnecting' : status === 'failed' ? 'disconnected' : 'connected';
          this.rebuild();
        }
      }
    );
  }

  private initGuestStreamsListener(): void {
    this.cleanupGuestStreams = liveStreamSync.subscribeToGuestStreams((guestHandle, stream) => {
      if (this.disposed) return;
      const cleanHandle = guestHandle.replace(/^@/, '').toLowerCase().trim();
      this.remote.set(cleanHandle, {
        id: cleanHandle,
        status: 'connected',
        cameraOn: true,
        micOn: true,
        stream,
      });
      this.rebuild();
    });
  }

  get(): ReadonlyMap<string, ParticipantMedia> {
    return this.snapshot;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(participantId: string, media: PublishedMedia): void {
    if (this.disposed) return;
    const prev = this.published.get(participantId);
    this.published.set(participantId, { ...media, status: prev?.status ?? 'connected' });

    if (this.opts.isHost && participantId === this.opts.myId) {
      liveStreamSync.updateHostMediaStream(media.stream);
    } else if (!this.opts.isHost && participantId === this.opts.myId && media.stream) {
      // Viewer accepted on stage as guest -> publish guest media to host WebRTC
      const hostHandle = this.opts.streamerHandle || this.opts.streamerId;
      this.cleanupGuestStage?.();
      this.cleanupGuestStage = liveStreamSync.connectGuestStage(
        hostHandle,
        this.opts.myHandle,
        media.stream,
        (hostStream) => {
          if (!this.disposed) {
            this.remote.set(this.opts.streamerId, {
              id: this.opts.streamerId,
              status: 'connected',
              cameraOn: true,
              micOn: true,
              stream: hostStream,
            });
            this.rebuild();
          }
        }
      );
    }

    this.rebuild();
  }

  unpublish(participantId: string): void {
    if (this.disposed) return;
    if (participantId === this.opts.myId && !this.opts.isHost) {
      this.cleanupGuestStage?.();
      this.cleanupGuestStage = null;
      const cleanMyH = this.opts.myHandle.replace(/^@/, '').toLowerCase().trim();
      const roomId = getRoomIdFromHandle(this.opts.streamerHandle || this.opts.streamerId);
      liveStreamSync.sendRoomEvent(roomId, {
        type: 'GUEST_DISCONNECTED',
        handle: cleanMyH,
      });
    }

    if (this.published.delete(participantId)) {
      this.rebuild();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cleanupViewerStream?.();
    this.cleanupGuestStreams?.();
    this.cleanupGuestStage?.();
    this.published.clear();
    this.remote.clear();
    this.listeners.clear();
  }

  private rebuild(): void {
    const next = new Map<string, ParticipantMedia>();
    for (const [id, r] of this.remote) {
      next.set(id, r);
    }
    for (const [id, p] of this.published) {
      next.set(id, {
        id,
        status: p.status,
        cameraOn: p.cameraOn,
        micOn: p.micOn,
        stream: p.stream,
      });
    }
    this.snapshot = next;
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (err) {
        console.warn('ProductionMediaTransport listener error:', err);
      }
    }
  }
}
