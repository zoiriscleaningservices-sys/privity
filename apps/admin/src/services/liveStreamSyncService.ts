import mqtt, { MqttClient } from 'mqtt';
import { Peer } from 'peerjs';
import { LiveMeStreamer } from '../components/liveme/types';

export interface RemoteLiveStreamPayload {
  id: string;
  creatorHandle: string;
  creatorName: string;
  creatorAvatar: string;
  isVerified?: boolean;
  category: string;
  title: string;
  description: string;
  viewersCount: number;
  likesCount: number;
  dailyRank?: string;
  previewUrl: string;
  videoStreamUrl?: string;
  posterUrl?: string;
  tags?: string[];
  peerId?: string;
  startedAt: number;
  isLive: boolean;
  lastHeartbeat: number;
}

const PRIMARY_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const FALLBACK_BROKER = 'wss://broker.hivemq.com:8884/mqtt';

const TOPIC_ACTIVE_STREAMS = 'privity/v1/active-streams';
const TOPIC_QUERY = 'privity/v1/query-streams';
const TOPIC_ROOM_PREFIX = 'privity/v1/room/';

class LiveStreamSyncService {
  private mqttClient: MqttClient | null = null;
  private currentBroker = PRIMARY_BROKER;
  private activeStreams: Map<string, RemoteLiveStreamPayload> = new Map();
  private subscribers: Set<(streams: LiveMeStreamer[]) => void> = new Set();
  private roomSubscribers: Map<string, Set<(event: any) => void>> = new Map();
  private hostPeer: Peer | null = null;
  private hostMediaStream: MediaStream | null = null;
  private currentHostSession: RemoteLiveStreamPayload | null = null;
  private heartbeatInterval: any = null;
  private pruneInterval: any = null;
  private broadcastBus: BroadcastChannel | null = null;
  private isConnecting = false;

  constructor() {
    this.initBroadcastBus();
    this.initMqtt();
    this.startPruneLoop();
    this.loadCachedStreams();
  }

  private initBroadcastBus() {
    try {
      this.broadcastBus = new BroadcastChannel('privity_sync_bus');
      this.broadcastBus.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.type === 'LIVE_HOST_STARTED' && e.data.host) {
          this.handleIncomingStream(e.data.host);
        } else if (e.data.type === 'LIVE_HOST_ENDED' && e.data.streamId) {
          this.handleStreamEnded(e.data.streamId);
        } else if (e.data.type === 'LIVE_ROOM_EVENT' && e.data.streamId) {
          this.dispatchRoomEvent(e.data.streamId, e.data.event);
        }
      };
    } catch {}
  }

  private loadCachedStreams() {
    try {
      const saved = localStorage.getItem('privity_remote_active_streams');
      if (saved) {
        const list: RemoteLiveStreamPayload[] = JSON.parse(saved);
        const now = Date.now();
        list.forEach((s) => {
          if (now - (s.lastHeartbeat || s.startedAt) < 25000) {
            this.activeStreams.set(s.id, s);
          }
        });
      }
    } catch {}
  }

  private saveCachedStreams() {
    try {
      const list = Array.from(this.activeStreams.values());
      localStorage.setItem('privity_remote_active_streams', JSON.stringify(list));
    } catch {}
  }

  private initMqtt() {
    if (this.mqttClient || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const clientId = `privity_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const client = mqtt.connect(this.currentBroker, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 4000,
      });

      this.mqttClient = client;

      client.on('connect', () => {
        this.isConnecting = false;
        client.subscribe([TOPIC_ACTIVE_STREAMS, TOPIC_QUERY], { qos: 0 });

        // Query active streams across the network
        this.queryNetworkStreams();

        // If this device is currently hosting, immediately announce to the newly connected broker
        if (this.currentHostSession) {
          this.announceStream(this.currentHostSession);
        }
      });

      client.on('message', (topic, payload) => {
        try {
          const text = payload.toString();
          const data = JSON.parse(text);

          if (topic === TOPIC_ACTIVE_STREAMS) {
            if (data.type === 'STREAM_ACTIVE' || data.type === 'STREAM_HEARTBEAT') {
              this.handleIncomingStream(data.stream);
            } else if (data.type === 'STREAM_ENDED') {
              this.handleStreamEnded(data.streamId);
            }
          } else if (topic === TOPIC_QUERY) {
            if (data.type === 'QUERY_ACTIVE_STREAMS' && this.currentHostSession) {
              this.announceStream(this.currentHostSession);
            }
          } else if (topic.startsWith(TOPIC_ROOM_PREFIX)) {
            const streamId = topic.replace(TOPIC_ROOM_PREFIX, '');
            this.dispatchRoomEvent(streamId, data);
          }
        } catch {}
      });

      client.on('error', () => {
        // Fallback to alternate broker if primary fails
        if (this.currentBroker === PRIMARY_BROKER) {
          this.currentBroker = FALLBACK_BROKER;
          try {
            client.end(true);
          } catch {}
          this.mqttClient = null;
          this.isConnecting = false;
          setTimeout(() => this.initMqtt(), 1500);
        }
      });

      client.on('close', () => {
        this.isConnecting = false;
      });
    } catch {
      this.isConnecting = false;
    }
  }

  public queryNetworkStreams() {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(TOPIC_QUERY, JSON.stringify({ type: 'QUERY_ACTIVE_STREAMS' }));
      } catch {}
    }
  }

  private handleIncomingStream(stream: RemoteLiveStreamPayload) {
    if (!stream || !stream.id) return;
    stream.lastHeartbeat = Date.now();
    this.activeStreams.set(stream.id, stream);
    this.saveCachedStreams();
    this.notifySubscribers();
  }

  private handleStreamEnded(streamId: string) {
    if (this.activeStreams.has(streamId)) {
      this.activeStreams.delete(streamId);
      this.saveCachedStreams();
      this.notifySubscribers();
    }
  }

  private startPruneLoop() {
    this.pruneInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, stream] of this.activeStreams.entries()) {
        // If this is our own host session, keep it alive as long as currentHostSession is set
        if (this.currentHostSession && this.currentHostSession.id === id) {
          continue;
        }
        // Remote streams without a heartbeat for 12 seconds are considered ended
        if (now - (stream.lastHeartbeat || stream.startedAt) > 12000) {
          this.activeStreams.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.saveCachedStreams();
        this.notifySubscribers();
      }
    }, 4000);
  }

  private notifySubscribers() {
    const list = this.getStreamersList();
    this.subscribers.forEach((cb) => {
      try {
        cb(list);
      } catch {}
    });
  }

  public getStreamersList(): LiveMeStreamer[] {
    const list: LiveMeStreamer[] = [];
    const now = Date.now();

    for (const s of this.activeStreams.values()) {
      if (now - (s.lastHeartbeat || s.startedAt) > 15000 && (!this.currentHostSession || this.currentHostSession.id !== s.id)) {
        continue;
      }
      list.push({
        id: s.id,
        handle: s.creatorHandle,
        name: `${s.creatorName} (LIVE NOW 🔴)`,
        avatar: s.creatorAvatar,
        isVerified: !!s.isVerified,
        category: s.category || 'Featured',
        title: s.title || 'Live Broadcast · Privity Exclusive',
        description: s.description || 'Live streaming sovereign node',
        viewersCount: Math.max(1, s.viewersCount || 1),
        totalViews: `${Math.max(1, s.viewersCount || 1)}`,
        popularity: '999+',
        diamonds: Math.max(100, s.likesCount * 10),
        likesCount: Math.max(1, s.likesCount || 1),
        videoStreamUrl: s.videoStreamUrl,
        posterUrl: s.posterUrl || s.previewUrl || s.creatorAvatar,
        tags: s.tags && s.tags.length > 0 ? s.tags : ['LiveNow', 'Host', 'Privity'],
        tagBadge: 'LIVE NOW',
        isHost: this.currentHostSession?.id === s.id,
        isCameraStream: true,
        peerId: s.peerId,
        topContributors: [],
      });
    }

    return list;
  }

  public subscribeToActiveStreams(callback: (streams: LiveMeStreamer[]) => void): () => void {
    this.subscribers.add(callback);
    // Initial emit
    callback(this.getStreamersList());
    // Also trigger network query to refresh
    this.queryNetworkStreams();

    return () => {
      this.subscribers.delete(callback);
    };
  }

  // =========================================================================
  // HOST BROADCASTING METHODS
  // =========================================================================

  public async startHostBroadcast(
    session: {
      id: string;
      creatorHandle: string;
      creatorName: string;
      creatorAvatar: string;
      isVerified?: boolean;
      title: string;
      category: string;
      description?: string;
      viewersCount?: number;
      likesCount?: number;
      previewUrl?: string;
      tags?: string[];
    },
    cameraStream: MediaStream | null
  ): Promise<string> {
    this.hostMediaStream = cameraStream;

    // Clean alphanumeric peer ID for reliable WebRTC signaling
    const sanitizedHandle = session.creatorHandle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const peerId = `privity-live-${sanitizedHandle}`;

    this.currentHostSession = {
      id: session.id,
      creatorHandle: session.creatorHandle,
      creatorName: session.creatorName,
      creatorAvatar: session.creatorAvatar,
      isVerified: session.isVerified,
      category: session.category || 'Featured',
      title: session.title || 'Live Broadcast',
      description: session.description || 'Decentralized Live Broadcast',
      viewersCount: session.viewersCount || 1,
      likesCount: session.likesCount || 1,
      previewUrl: session.previewUrl || session.creatorAvatar,
      posterUrl: session.previewUrl || session.creatorAvatar,
      tags: session.tags || ['LiveNow', 'Host'],
      peerId,
      startedAt: Date.now(),
      isLive: true,
      lastHeartbeat: Date.now(),
    };

    // Add to local state and notify
    this.activeStreams.set(session.id, this.currentHostSession);
    this.saveCachedStreams();
    this.notifySubscribers();

    // Broadcast on local bus
    try {
      this.broadcastBus?.postMessage({
        type: 'LIVE_HOST_STARTED',
        host: this.currentHostSession,
      });
    } catch {}

    // Initialize PeerJS Host Peer
    this.setupHostPeer(peerId);

    // Announce to MQTT
    this.announceStream(this.currentHostSession);

    // Start 3-second heartbeat loop
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.currentHostSession) {
        this.currentHostSession.lastHeartbeat = Date.now();
        this.announceStream(this.currentHostSession, 'STREAM_HEARTBEAT');
      }
    }, 3000);

    return peerId;
  }

  private setupHostPeer(peerId: string) {
    try {
      if (this.hostPeer) {
        this.hostPeer.destroy();
        this.hostPeer = null;
      }

      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.hostPeer = peer;

      peer.on('open', () => {
        // Host peer registered
      });

      peer.on('call', (call) => {
        // When a remote viewer calls this host, answer with the host's actual camera stream
        if (this.hostMediaStream) {
          call.answer(this.hostMediaStream);
        } else {
          // If no media stream, create a blank placeholder canvas stream so WebRTC connects
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, 320, 240);
          }
          const fallbackStream = canvas.captureStream(5);
          call.answer(fallbackStream);
        }
      });

      peer.on('error', (err) => {
        // Peer error handled gracefully
        console.warn('Privity Host Peer notice:', err.type);
      });
    } catch (err) {
      console.warn('Privity host peer init notice:', err);
    }
  }

  private announceStream(stream: RemoteLiveStreamPayload, type: 'STREAM_ACTIVE' | 'STREAM_HEARTBEAT' = 'STREAM_ACTIVE') {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(
          TOPIC_ACTIVE_STREAMS,
          JSON.stringify({
            type,
            stream,
          })
        );
      } catch {}
    }
  }

  public stopHostBroadcast() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.currentHostSession) {
      const streamId = this.currentHostSession.id;

      // Announce stream ended
      if (this.mqttClient && this.mqttClient.connected) {
        try {
          this.mqttClient.publish(
            TOPIC_ACTIVE_STREAMS,
            JSON.stringify({
              type: 'STREAM_ENDED',
              streamId,
              creatorHandle: this.currentHostSession.creatorHandle,
            })
          );
        } catch {}
      }

      // Broadcast on local bus
      try {
        this.broadcastBus?.postMessage({
          type: 'LIVE_HOST_ENDED',
          streamId,
        });
      } catch {}

      this.activeStreams.delete(streamId);
      this.currentHostSession = null;
      this.saveCachedStreams();
      this.notifySubscribers();
    }

    if (this.hostPeer) {
      try {
        this.hostPeer.destroy();
      } catch {}
      this.hostPeer = null;
    }

    this.hostMediaStream = null;
  }

  // =========================================================================
  // VIEWER P2P VIDEO CONNECTION
  // =========================================================================

  public connectToRemoteStream(
    peerId: string,
    onStream: (stream: MediaStream) => void,
    onStatusChange?: (status: 'connecting' | 'connected' | 'failed') => void
  ): () => void {
    let viewerPeer: Peer | null = null;
    let callInstance: any = null;
    let isCleanedUp = false;

    if (onStatusChange) onStatusChange('connecting');

    try {
      const randomViewerId = `privity-viewer-${Math.random().toString(36).substring(2, 8)}`;
      viewerPeer = new Peer(randomViewerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      viewerPeer.on('open', () => {
        if (isCleanedUp || !viewerPeer) return;

        // Create a minimal 1x1 dummy canvas stream for answering WebRTC call requirements
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const dummyStream = canvas.captureStream(1);

        try {
          const call = viewerPeer.call(peerId, dummyStream);
          callInstance = call;

          call.on('stream', (remoteStream: MediaStream) => {
            if (isCleanedUp) return;
            if (onStatusChange) onStatusChange('connected');
            onStream(remoteStream);
          });

          call.on('error', () => {
            if (onStatusChange) onStatusChange('failed');
          });

          call.on('close', () => {
            if (onStatusChange) onStatusChange('failed');
          });
        } catch {
          if (onStatusChange) onStatusChange('failed');
        }
      });

      viewerPeer.on('error', () => {
        if (onStatusChange) onStatusChange('failed');
      });
    } catch {
      if (onStatusChange) onStatusChange('failed');
    }

    return () => {
      isCleanedUp = true;
      try {
        if (callInstance) callInstance.close();
      } catch {}
      try {
        if (viewerPeer) viewerPeer.destroy();
      } catch {}
    };
  }

  // =========================================================================
  // ROOM REAL-TIME EVENTS (LIKES, HEARTS, CHAT)
  // =========================================================================

  public sendRoomEvent(streamId: string, event: any) {
    const topic = `${TOPIC_ROOM_PREFIX}${streamId}`;
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(topic, JSON.stringify(event));
      } catch {}
    }

    // Local bus
    try {
      this.broadcastBus?.postMessage({
        type: 'LIVE_ROOM_EVENT',
        streamId,
        event,
      });
    } catch {}

    // Dispatch locally too
    this.dispatchRoomEvent(streamId, event);
  }

  public subscribeToRoomEvents(streamId: string, onEvent: (event: any) => void): () => void {
    if (!this.roomSubscribers.has(streamId)) {
      this.roomSubscribers.set(streamId, new Set());
    }
    this.roomSubscribers.get(streamId)!.add(onEvent);

    const topic = `${TOPIC_ROOM_PREFIX}${streamId}`;
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.subscribe(topic);
      } catch {}
    }

    return () => {
      const set = this.roomSubscribers.get(streamId);
      if (set) {
        set.delete(onEvent);
        if (set.size === 0) {
          this.roomSubscribers.delete(streamId);
          if (this.mqttClient && this.mqttClient.connected) {
            try {
              this.mqttClient.unsubscribe(topic);
            } catch {}
          }
        }
      }
    };
  }

  private dispatchRoomEvent(streamId: string, event: any) {
    const set = this.roomSubscribers.get(streamId);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(event);
        } catch {}
      });
    }
  }

  public destroy() {
    this.stopHostBroadcast();
    if (this.pruneInterval) clearInterval(this.pruneInterval);
    if (this.broadcastBus) this.broadcastBus.close();
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }
  }
}

export const liveStreamSync = new LiveStreamSyncService();
