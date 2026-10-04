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

const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];

const TOPIC_ACTIVE_STREAMS = 'privity/v2/active-streams';
const TOPIC_QUERY = 'privity/v2/query-streams';
const TOPIC_STREAM_PREFIX = 'privity/v2/stream/';
const TOPIC_ROOM_PREFIX = 'privity/v2/room/';

export interface EndedStreamEntry {
  endedAt: number;
  creatorHandle: string;
}

export function getRoomIdFromHandle(raw: string): string {
  if (!raw) return 'live';
  let cleaned = raw.toLowerCase().trim();
  if (cleaned.startsWith('@')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('live-user-')) {
    const after = cleaned.replace('live-user-', '');
    cleaned = after.split('-')[0] || after;
  }
  if (cleaned.startsWith('privity-live-')) {
    const after = cleaned.replace('privity-live-', '');
    cleaned = after.split('-')[0] || after;
  }
  if (cleaned.startsWith('stream-')) {
    const after = cleaned.replace('stream-', '');
    cleaned = after.split('-')[0] || after;
  }
  return cleaned.replace(/[^a-z0-9]/g, '') || 'live';
}

class LiveStreamSyncService {
  private mqttClient: MqttClient | null = null;
  private brokerIndex = 0;
  private activeStreams: Map<string, RemoteLiveStreamPayload> = new Map();
  private endedStreams: Map<string, EndedStreamEntry> = new Map();
  private subscribers: Set<(streams: LiveMeStreamer[]) => void> = new Set();
  private roomSubscribers: Map<string, Set<(event: any) => void>> = new Map();
  private hostPeer: Peer | null = null;
  private hostPeerConnections: Map<string, RTCPeerConnection> = new Map();
  private hostMediaStream: MediaStream | null = null;
  private currentHostSession: RemoteLiveStreamPayload | null = null;
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private guestStreamSubscribers: Set<(guestHandle: string, stream: MediaStream) => void> = new Set();
  private heartbeatInterval: any = null;
  private pruneInterval: any = null;
  private queryInterval: any = null;
  private broadcastBus: BroadcastChannel | null = null;
  private isConnecting = false;

  constructor() {
    this.loadEndedStreams();
    this.initBroadcastBus();
    this.initMqtt();
    this.startPruneLoop();
    this.startQueryLoop();
    this.loadCachedStreams();
    this.setupLifecycleListeners();
  }

  private loadEndedStreams() {
    try {
      const raw = localStorage.getItem('privity_ended_streams_v2');
      if (raw) {
        const data = JSON.parse(raw);
        const now = Date.now();
        // Keep ended records from the last 6 hours
        for (const [key, val] of Object.entries(data as Record<string, EndedStreamEntry>)) {
          if (now - val.endedAt < 6 * 60 * 60 * 1000) {
            this.endedStreams.set(key.toLowerCase(), val);
          }
        }
      }
    } catch {}
  }

  private saveEndedStreams() {
    try {
      const obj: Record<string, EndedStreamEntry> = {};
      for (const [k, v] of this.endedStreams.entries()) {
        obj[k] = v;
      }
      localStorage.setItem('privity_ended_streams_v2', JSON.stringify(obj));
    } catch {}
  }

  public markStreamEnded(streamId: string, rawHandle?: string) {
    const now = Date.now();
    const normId = (streamId || '').toLowerCase().trim();
    const normHandle = (rawHandle || '').toLowerCase().replace('@', '').trim();
    if (normId) {
      this.endedStreams.set(normId, { endedAt: now, creatorHandle: normHandle });
    }
    this.saveEndedStreams();
  }

  public isStreamEnded(streamId?: string, _rawHandle?: string, startedAt?: number): boolean {
    const normId = (streamId || '').toLowerCase().trim();
    if (normId && this.endedStreams.has(normId)) {
      const record = this.endedStreams.get(normId);
      if (record && startedAt && startedAt > record.endedAt) {
        return false;
      }
      return true;
    }
    return false;
  }

  public clearStreamEnded(streamId?: string, rawHandle?: string) {
    const normId = (streamId || '').toLowerCase().trim();
    const normHandle = (rawHandle || '').toLowerCase().replace('@', '').trim();
    if (normId) this.endedStreams.delete(normId);
    if (normHandle) this.endedStreams.delete(normHandle);
    for (const [id, rec] of Array.from(this.endedStreams.entries())) {
      if (rec.creatorHandle === normHandle || id === normId) {
        this.endedStreams.delete(id);
      }
    }
    this.saveEndedStreams();
  }

  private initBroadcastBus() {
    try {
      this.broadcastBus = new BroadcastChannel('privity_sync_bus');
      this.broadcastBus.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.type === 'LIVE_HOST_STARTED' && e.data.host) {
          const normHandle = (e.data.host.creatorHandle || '').toLowerCase().replace('@', '').trim();
          this.clearStreamEnded(e.data.host.id, normHandle);
          this.handleIncomingStream(e.data.host);
        } else if (e.data.type === 'LIVE_HOST_ENDED') {
          this.handleStreamEnded(e.data.streamId || '', e.data.handle);
        } else if (e.data.type === 'LIVE_ROOM_EVENT' && e.data.streamId) {
          this.dispatchRoomEvent(e.data.streamId, e.data.event);
        }
      };
    } catch {}
  }

  private setupLifecycleListeners() {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('storage', (e) => {
        if (
          e.key === 'privity_remote_active_streams' ||
          e.key === 'privity_current_live_host' ||
          e.key === 'privity_is_host_broadcasting' ||
          e.key === 'privity_ended_streams_v2'
        ) {
          this.loadCachedStreams();
          this.notifySubscribers();
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.ensureConnected();
          this.queryNetworkStreams();
          this.loadCachedStreams();
          this.notifySubscribers();
        }
      });
      window.addEventListener('focus', () => {
        this.ensureConnected();
        this.queryNetworkStreams();
        this.loadCachedStreams();
        this.notifySubscribers();
      });
      window.addEventListener('online', () => {
        this.ensureConnected();
        this.queryNetworkStreams();
      });
      window.addEventListener('beforeunload', () => {
        if (this.currentHostSession) {
          this.stopHostBroadcast();
        }
      });
      window.addEventListener('pagehide', () => {
        if (this.currentHostSession) {
          this.stopHostBroadcast();
        }
      });
    } catch {}
  }

  private loadCachedStreams() {
    try {
      this.loadEndedStreams();
      const now = Date.now();
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (isBroadcasting && savedHost) {
        try {
          const parsed = JSON.parse(savedHost);
          if (parsed && parsed.id) {
            const normHandle = (parsed.creatorHandle || parsed.handle || '').toLowerCase().replace('@', '').trim();
            // If the host session was marked ended or heartbeat is older than 12s:
            if (
              this.isStreamEnded(parsed.id, normHandle, parsed.startedAt) ||
              (parsed.lastHeartbeat && now - parsed.lastHeartbeat > 12000)
            ) {
              localStorage.removeItem('privity_current_live_host');
              localStorage.removeItem('privity_is_host_broadcasting');
              localStorage.removeItem('privity_active_live_session');
            } else if (this.currentHostSession) {
              this.activeStreams.set(this.currentHostSession.id, this.currentHostSession);
            }
          }
        } catch {
          localStorage.removeItem('privity_current_live_host');
          localStorage.removeItem('privity_is_host_broadcasting');
        }
      }

      const saved = localStorage.getItem('privity_remote_active_streams');
      if (saved) {
        const list: RemoteLiveStreamPayload[] = JSON.parse(saved);
        list.forEach((s) => {
          const normHandle = (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim();
          if (this.isStreamEnded(s.id, normHandle, s.startedAt)) return;
          if (now - (s.lastHeartbeat || s.startedAt) < 12000) {
            s.creatorHandle = normHandle;
            s.creatorName = s.creatorName || (s as any).name || 'Host';
            s.creatorAvatar = s.creatorAvatar || (s as any).avatar || '';
            this.activeStreams.set(s.id, s);
          }
        });
      }
    } catch {}
  }

  private saveCachedStreams() {
    try {
      const now = Date.now();
      const list = Array.from(this.activeStreams.values()).filter((s) => {
        const normHandle = (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim();
        if (this.isStreamEnded(s.id, normHandle, s.startedAt)) return false;
        if (now - (s.lastHeartbeat || s.startedAt) > 12000) return false;
        return true;
      });
      localStorage.setItem('privity_remote_active_streams', JSON.stringify(list));
    } catch {}
  }

  private initMqtt() {
    if (this.mqttClient || this.isConnecting) return;
    this.isConnecting = true;

    try {
      const currentBroker = BROKERS[this.brokerIndex % BROKERS.length];
      const clientId = `privity_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
      const client = mqtt.connect(currentBroker, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
        keepalive: 15,
      });

      this.mqttClient = client;

      client.on('connect', () => {
        this.isConnecting = false;
        // Subscribe to live broadcasts and query topic without retain
        client.subscribe([TOPIC_ACTIVE_STREAMS, TOPIC_QUERY, `${TOPIC_STREAM_PREFIX}+`], { qos: 0 });

        // Query active streams immediately across the network
        this.queryNetworkStreams();

        // Also clean up any legacy retained topics on the old v1 prefix
        client.subscribe('privity/v1/stream/+', { qos: 1 });

        // If this device is currently hosting, immediately announce to the newly connected broker
        if (this.currentHostSession) {
          this.announceStream(this.currentHostSession);
        }
      });

      client.on('message', (topic, payload) => {
        try {
          // If receiving on legacy v1 topic, immediately clear the retained message on the broker
          if (topic.startsWith('privity/v1/stream/')) {
            if (payload && payload.length > 0) {
              client.publish(topic, '', { retain: true, qos: 1 });
            }
            return;
          }

          const text = payload.toString();
          if (!text || text.trim() === '') return;
          const data = JSON.parse(text);

          if (topic === TOPIC_ACTIVE_STREAMS) {
            if (data.type === 'STREAM_ACTIVE' || data.type === 'STREAM_HEARTBEAT') {
              this.handleIncomingStream(data.stream);
            } else if (data.type === 'STREAM_ENDED') {
              this.handleStreamEnded(data.streamId, data.creatorHandle);
            }
          } else if (topic.startsWith(TOPIC_STREAM_PREFIX)) {
            const streamId = topic.replace(TOPIC_STREAM_PREFIX, '');
            if (data.type === 'STREAM_ACTIVE' || data.type === 'STREAM_HEARTBEAT') {
              this.handleIncomingStream(data.stream);
            } else if (data.type === 'STREAM_ENDED') {
              this.handleStreamEnded(data.streamId || streamId, data.creatorHandle);
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
        this.handleBrokerFailover();
      });

      client.on('close', () => {
        this.isConnecting = false;
      });
    } catch {
      this.isConnecting = false;
    }
  }

  private handleBrokerFailover() {
    this.brokerIndex++;
    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }
    this.isConnecting = false;
    setTimeout(() => this.initMqtt(), 1500);
  }

  public ensureConnected() {
    if (!this.mqttClient || !this.mqttClient.connected) {
      if (!this.isConnecting) {
        this.initMqtt();
      }
    }
  }

  public queryNetworkStreams() {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(TOPIC_QUERY, JSON.stringify({ type: 'QUERY_ACTIVE_STREAMS' }));
      } catch {}
    }
  }

  private handleIncomingStream(stream: any) {
    if (!stream || !stream.id) return;
    if (stream.isLive === false) {
      this.handleStreamEnded(stream.id, stream.creatorHandle || stream.handle);
      return;
    }

    const creatorHandle = stream.creatorHandle || stream.handle || '';
    const normHandle = creatorHandle.toLowerCase().replace('@', '').trim();
    const streamId = (stream.id || '').toLowerCase().trim();
    const now = Date.now();

    // 1. Immediately clear any past ended marker for this creator handle when an active stream arrives
    this.clearStreamEnded(streamId, normHandle);

    // 2. Blacklist check: only drop if this specific stream ID was marked ended after stream started
    if (this.isStreamEnded(streamId, normHandle, stream.startedAt)) {
      return;
    }

    // 3. Strict timestamp staleness check:
    // If the message has a timestamp older than 8 seconds, it is stale / delayed / retained!
    const msgTimestamp = stream.lastHeartbeat || stream.startedAt;
    if (msgTimestamp && (now - msgTimestamp > 8000)) {
      return;
    }

    const creatorName = stream.creatorName || stream.name || 'Host';
    const creatorAvatar = stream.creatorAvatar || stream.avatar || '';
    stream.creatorHandle = creatorHandle;
    stream.creatorName = creatorName;
    stream.creatorAvatar = creatorAvatar;
    stream.isLive = true;

    // Deduplicate: remove any older session IDs for the same creator handle
    if (normHandle) {
      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if (id !== stream.id && (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim() === normHandle) {
          this.activeStreams.delete(id);
        }
      }
    }

    stream.lastHeartbeat = msgTimestamp || now;
    this.activeStreams.set(stream.id, stream);
    this.saveCachedStreams();
    this.notifySubscribers();
  }

  private handleStreamEnded(streamId: string, rawHandle?: string) {
    let deletedHandle = (rawHandle || '').toLowerCase().replace('@', '').trim();
    const target = this.activeStreams.get(streamId);
    if (target) {
      deletedHandle = deletedHandle || (target.creatorHandle || '').toLowerCase().replace('@', '').trim();
      this.activeStreams.delete(streamId);
    }
    if (deletedHandle) {
      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if ((s.creatorHandle || '').toLowerCase().replace('@', '').trim() === deletedHandle) {
          this.activeStreams.delete(id);
        }
      }
    }
    this.markStreamEnded(streamId, deletedHandle);
    this.saveCachedStreams();
    this.notifySubscribers();
  }

  public notifyStreamStarted(stream: any) {
    if (!stream) return;
    const normHandle = (stream.creatorHandle || stream.handle || '').toLowerCase().replace('@', '').trim();
    const streamId = (stream.id || '').toLowerCase().trim();
    if (streamId) this.clearStreamEnded(streamId, normHandle);
    this.handleIncomingStream(stream);
  }

  public notifyStreamEnded(streamId: string, rawHandle?: string) {
    this.handleStreamEnded(streamId, rawHandle);
  }

  private startPruneLoop() {
    if (this.pruneInterval) clearInterval(this.pruneInterval);
    this.pruneInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, stream] of Array.from(this.activeStreams.entries())) {
        // If this is our own host session, keep it alive as long as currentHostSession is set
        if (this.currentHostSession && this.currentHostSession.id === id) {
          continue;
        }
        const normHandle = (stream.creatorHandle || (stream as any).handle || '').toLowerCase().replace('@', '').trim();
        // If this specific stream is marked ended, prune immediately
        if (this.isStreamEnded(id, normHandle, stream.startedAt)) {
          this.activeStreams.delete(id);
          changed = true;
          continue;
        }
        // Remote streams without a heartbeat for 8 seconds are considered ended
        const lastHb = stream.lastHeartbeat || stream.startedAt || now;
        if (now - lastHb > 8000) {
          this.markStreamEnded(id, normHandle);
          this.activeStreams.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.saveCachedStreams();
        this.notifySubscribers();
      }
    }, 1500);
  }

  private startQueryLoop() {
    if (this.queryInterval) clearInterval(this.queryInterval);
    this.queryInterval = setInterval(() => {
      // Periodically query to refresh active streams across all devices
      this.queryNetworkStreams();
    }, 2000);
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
    const handleMap = new Map<string, RemoteLiveStreamPayload>();
    const now = Date.now();

    // 1. If this device has an active currentHostSession, include it
    if (this.currentHostSession && this.currentHostSession.isLive !== false) {
      const normHandle = (this.currentHostSession.creatorHandle || '').toLowerCase().replace('@', '').trim();
      if (normHandle && !this.isStreamEnded(this.currentHostSession.id, normHandle, this.currentHostSession.startedAt)) {
        handleMap.set(normHandle, this.currentHostSession);
      }
    }

    // 2. Active network streams (strictly filtered against ended streams and stale heartbeats)
    for (const s of this.activeStreams.values()) {
      const normHandle = (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim();
      if (!normHandle) continue;

      if (this.isStreamEnded(s.id, normHandle, s.startedAt)) {
        continue;
      }
      if (now - (s.lastHeartbeat || s.startedAt) > 12000 && (!this.currentHostSession || this.currentHostSession.id !== s.id)) {
        continue;
      }

      const existing = handleMap.get(normHandle);
      if (!existing || (s.lastHeartbeat || s.startedAt) > (existing.lastHeartbeat || existing.startedAt)) {
        handleMap.set(normHandle, s);
      }
    }

    const list: LiveMeStreamer[] = [];
    for (const s of handleMap.values()) {
      const handle = s.creatorHandle || (s as any).handle || 'host';
      const rawName = s.creatorName || (s as any).name || 'Host';
      const cleanName = rawName.replace(' (LIVE NOW 🔴)', '');
      const avatar = s.creatorAvatar || (s as any).avatar || '';
      const isHost = this.currentHostSession?.id === s.id || this.isLocalHost(s.id);

      list.push({
        id: s.id,
        handle: handle,
        name: `${cleanName} (LIVE NOW 🔴)`,
        avatar: avatar,
        isVerified: !!s.isVerified,
        category: s.category || 'Featured',
        title: s.title || 'Live Broadcast · Sovereign Stream',
        description: s.description || 'Live streaming sovereign node',
        viewersCount: Math.max(1, s.viewersCount ?? 1),
        totalViews: `${Math.max(1, s.viewersCount ?? 1)}`,
        popularity: `${s.likesCount ?? 0}`,
        diamonds: (s as any).diamonds ?? 0,
        likesCount: s.likesCount ?? 0,
        videoStreamUrl: s.videoStreamUrl,
        posterUrl: s.posterUrl || s.previewUrl || avatar,
        tags: s.tags && s.tags.length > 0 ? s.tags : ['LiveNow', 'Host', 'Privity'],
        tagBadge: 'LIVE NOW',
        isHost: isHost,
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

  public isLocalHost(streamId?: string): boolean {
    if (this.currentHostSession && this.currentHostSession.isLive !== false) {
      if (!streamId) return true;
      return this.currentHostSession.id === streamId;
    }
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      if (!isBroadcasting) return false;
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (savedHost) {
        const parsed = JSON.parse(savedHost);
        const normHandle = (parsed.creatorHandle || parsed.handle || '').toLowerCase().replace('@', '').trim();
        if (this.isStreamEnded(parsed.id, normHandle, parsed.startedAt)) return false;
        if (parsed.lastHeartbeat && Date.now() - parsed.lastHeartbeat > 4500) return false;
        if (!streamId) return true;
        return parsed.id === streamId;
      }
    } catch {}
    return false;
  }

  public getHostSession(): RemoteLiveStreamPayload | null {
    if (this.currentHostSession && this.currentHostSession.isLive !== false) {
      const normHandle = (this.currentHostSession.creatorHandle || '').toLowerCase().replace('@', '').trim();
      if (!this.isStreamEnded(this.currentHostSession.id, normHandle, this.currentHostSession.startedAt)) {
        return this.currentHostSession;
      }
    }
    return null;
  }

  public updateHostMediaStream(stream: MediaStream | null) {
    this.hostMediaStream = stream;
    if (stream) {
      this.hostPeerConnections.forEach((pc) => {
        try {
          const senders = pc.getSenders();
          stream.getTracks().forEach((track) => {
            const sender = senders.find((s) => s.track?.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track).catch(() => {});
            } else {
              pc.addTrack(track, stream);
            }
          });
        } catch (e) {
          console.warn('Privity live error replacing tracks on pc:', e);
        }
      });
    }
  }

  public updateHostStats(stats: { viewersCount?: number; likesCount?: number; diamonds?: number }) {
    if (this.currentHostSession) {
      if (typeof stats.viewersCount === 'number') this.currentHostSession.viewersCount = Math.max(0, stats.viewersCount);
      if (typeof stats.likesCount === 'number') this.currentHostSession.likesCount = Math.max(0, stats.likesCount);
      if (typeof stats.diamonds === 'number') (this.currentHostSession as any).diamonds = Math.max(0, stats.diamonds);
      this.currentHostSession.lastHeartbeat = Date.now();
      this.saveCachedStreams();
      this.notifySubscribers();
      this.announceStream(this.currentHostSession, 'STREAM_HEARTBEAT');
    }
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
      peerId?: string;
    },
    cameraStream: MediaStream | null
  ): Promise<string> {
    this.hostMediaStream = cameraStream;

    // Clean alphanumeric canonical peer ID matching viewer expectations
    const roomId = getRoomIdFromHandle(session.creatorHandle || session.id);
    const peerId = session.peerId || `privity-live-${roomId}`;
    const cleanHandle = (session.creatorHandle || session.id).toLowerCase().replace('@', '').trim();

    // Clear ended blacklist for this creator handle and ID so the new broadcast is instantly unblocked!
    this.clearStreamEnded(session.id, cleanHandle);

    this.currentHostSession = {
      id: session.id,
      creatorHandle: session.creatorHandle,
      creatorName: session.creatorName,
      creatorAvatar: session.creatorAvatar,
      isVerified: session.isVerified,
      category: session.category || 'Featured',
      title: session.title || 'Live Broadcast',
      description: session.description || 'Decentralized Live Broadcast',
      viewersCount: session.viewersCount ?? 0,
      likesCount: session.likesCount ?? 0,
      previewUrl: session.previewUrl || session.creatorAvatar,
      posterUrl: session.previewUrl || session.creatorAvatar,
      tags: session.tags || ['LiveNow', 'Host'],
      peerId,
      startedAt: Date.now(),
      isLive: true,
      lastHeartbeat: Date.now(),
    };

    // Add to local state and notify immediately
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

    // Initialize direct WebRTC room signaling over MQTT
    this.setupHostWebRTCSignaling(roomId);

    // Announce to MQTT immediately without retain
    this.announceStream(this.currentHostSession);

    // Start 1.5-second heartbeat loop
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.currentHostSession) {
        this.currentHostSession.lastHeartbeat = Date.now();
        this.announceStream(this.currentHostSession, 'STREAM_HEARTBEAT');
      }
    }, 1500);

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
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.hostPeer = peer;

      peer.on('open', (assignedId) => {
        if (this.currentHostSession) {
          this.currentHostSession.peerId = assignedId;
          this.announceStream(this.currentHostSession);
        }
      });

      peer.on('error', (err) => {
        console.warn('Privity Host Peer notice:', err.type);
        if (err.type === 'unavailable-id') {
          setTimeout(() => {
            if (this.currentHostSession && !this.hostPeer) {
              this.setupHostPeer(peerId);
            }
          }, 1000);
        }
      });

      peer.on('call', (call) => {
        if (this.hostMediaStream) {
          call.answer(this.hostMediaStream);
        } else {
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
    } catch (err) {
      console.warn('Privity host peer init notice:', err);
    }
  }

  private setupHostWebRTCSignaling(roomId: string) {
    this.subscribeToRoomEvents(roomId, async (evt) => {
      if (!this.currentHostSession || !evt) return;

      // 1. Viewer WebRTC Offer handling
      if (evt.type === 'RTC_OFFER' && evt.offer && evt.viewerId) {
        try {
          let pc = this.hostPeerConnections.get(evt.viewerId);
          if (pc) {
            try { pc.close(); } catch {}
          }
          pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun.cloudflare.com:3478' },
            ],
          });
          this.hostPeerConnections.set(evt.viewerId, pc);

          if (this.hostMediaStream) {
            this.hostMediaStream.getTracks().forEach((track) => {
              if (this.hostMediaStream) pc!.addTrack(track, this.hostMediaStream);
            });
          }

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              this.sendRoomEvent(roomId, {
                type: 'RTC_HOST_CANDIDATE',
                viewerId: evt.viewerId,
                candidate: event.candidate,
              });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(evt.offer));

          // Flush any queued candidates for this viewer
          const queued = this.pendingIceCandidates.get(evt.viewerId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          this.pendingIceCandidates.delete(evt.viewerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.sendRoomEvent(roomId, {
            type: 'RTC_ANSWER',
            viewerId: evt.viewerId,
            answer,
          });
        } catch (err) {
          console.warn('WebRTC host offer error:', err);
        }
      } else if (evt.type === 'RTC_VIEWER_CANDIDATE' && evt.candidate && evt.viewerId) {
        const pc = this.hostPeerConnections.get(evt.viewerId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(evt.candidate));
          } catch {}
        } else {
          const q = this.pendingIceCandidates.get(evt.viewerId) || [];
          q.push(evt.candidate);
          this.pendingIceCandidates.set(evt.viewerId, q);
        }
      }
      // 2. Guest 2-Way Stage WebRTC Offer handling (Host <-> Guest talk & see)
      else if (evt.type === 'GUEST_RTC_OFFER' && evt.offer && evt.guestHandle) {
        try {
          const cleanGuestH = evt.guestHandle.replace(/^@/, '').toLowerCase().trim();
          const connKey = `guest-${cleanGuestH}`;
          let pc = this.hostPeerConnections.get(connKey);
          if (pc) {
            try { pc.close(); } catch {}
          }
          pc = new RTCPeerConnection({
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun.cloudflare.com:3478' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          });
          this.hostPeerConnections.set(connKey, pc);

          // Add host tracks so guest receives host audio and video in ultra-HD
          if (this.hostMediaStream) {
            this.hostMediaStream.getTracks().forEach((track) => {
              if (this.hostMediaStream) pc!.addTrack(track, this.hostMediaStream);
            });
            try {
              pc.getSenders().forEach((sender) => {
                if (sender.track?.kind === 'video') {
                  const params = sender.getParameters();
                  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                  params.encodings[0].maxBitrate = 8000000;
                  params.encodings[0].networkPriority = 'high';
                  sender.setParameters(params).catch(() => {});
                }
              });
            } catch {}
          }

          // Receive guest tracks so host receives guest audio and video
          const incomingGuestStream = new MediaStream();
          pc.ontrack = (event) => {
            if (event.track) {
              if (!incomingGuestStream.getTracks().some((t) => t.id === event.track.id)) {
                incomingGuestStream.addTrack(event.track);
              }
            }
            if (event.streams && event.streams[0]) {
              event.streams[0].getTracks().forEach((t) => {
                if (!incomingGuestStream.getTracks().some((it) => it.id === t.id)) {
                  incomingGuestStream.addTrack(t);
                }
              });
            }
            this.dispatchGuestStream(cleanGuestH, incomingGuestStream);
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              this.sendRoomEvent(roomId, {
                type: 'GUEST_RTC_HOST_CANDIDATE',
                guestHandle: cleanGuestH,
                candidate: event.candidate,
              });
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(evt.offer));

          // Flush queued candidates
          const queued = this.pendingIceCandidates.get(connKey) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          this.pendingIceCandidates.delete(connKey);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          this.sendRoomEvent(roomId, {
            type: 'GUEST_RTC_ANSWER',
            guestHandle: cleanGuestH,
            answer,
          });
        } catch (err) {
          console.warn('WebRTC guest offer error on host:', err);
        }
      } else if (evt.type === 'GUEST_RTC_CANDIDATE' && evt.candidate && evt.guestHandle) {
        const cleanGuestH = evt.guestHandle.replace(/^@/, '').toLowerCase().trim();
        const connKey = `guest-${cleanGuestH}`;
        const pc = this.hostPeerConnections.get(connKey);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(evt.candidate));
          } catch {}
        } else {
          const q = this.pendingIceCandidates.get(connKey) || [];
          q.push(evt.candidate);
          this.pendingIceCandidates.set(connKey, q);
        }
      } else if (evt.type === 'GUEST_DISCONNECTED' && evt.handle) {
        const cleanGuestH = evt.handle.replace(/^@/, '').toLowerCase().trim();
        const connKey = `guest-${cleanGuestH}`;
        const pc = this.hostPeerConnections.get(connKey);
        if (pc) {
          try { pc.close(); } catch {}
          this.hostPeerConnections.delete(connKey);
        }
      }
    });
  }

  private announceStream(stream: RemoteLiveStreamPayload, type: 'STREAM_ACTIVE' | 'STREAM_HEARTBEAT' = 'STREAM_ACTIVE') {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        const payload = JSON.stringify({ type, stream });
        this.mqttClient.publish(TOPIC_ACTIVE_STREAMS, payload, { qos: 0, retain: false });
        const streamTopic = `${TOPIC_STREAM_PREFIX}${stream.id}`;
        this.mqttClient.publish(streamTopic, payload, { qos: 0, retain: false });
      } catch {}
    }
  }

  public stopHostBroadcast() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.hostPeerConnections.forEach((pc) => {
      try { pc.close(); } catch {}
    });
    this.hostPeerConnections.clear();

    const session = this.currentHostSession;
    let streamId = session?.id || '';
    let handle = session?.creatorHandle || '';

    // Check localStorage fallback if currentHostSession was already cleared
    if (!streamId || !handle) {
      try {
        const saved = localStorage.getItem('privity_current_live_host');
        if (saved) {
          const parsed = JSON.parse(saved);
          streamId = streamId || parsed.id;
          handle = handle || parsed.creatorHandle || parsed.handle || '';
        }
      } catch {}
    }

    if (streamId || handle) {
      const normHandle = handle.toLowerCase().replace('@', '').trim();
      this.markStreamEnded(streamId, normHandle);

      if (this.mqttClient && this.mqttClient.connected) {
        try {
          const endPayload = JSON.stringify({
            type: 'STREAM_ENDED',
            streamId,
            creatorHandle: handle,
          });
          this.mqttClient.publish(TOPIC_ACTIVE_STREAMS, endPayload, { qos: 0 });
          if (streamId) {
            this.mqttClient.publish(`${TOPIC_STREAM_PREFIX}${streamId}`, endPayload, { retain: false, qos: 0 });
            // Clean up any legacy retained topics
            this.mqttClient.publish(`privity/v1/stream/${streamId}`, '', { retain: true, qos: 1 });
            this.mqttClient.publish(`${TOPIC_STREAM_PREFIX}${streamId}`, '', { retain: true, qos: 1 });
          }
        } catch {}
      }

      // Room event to notify viewers (graceful countdown)
      try {
        const roomId = getRoomIdFromHandle(handle || streamId);
        this.sendRoomEvent(roomId, {
          type: 'LIVE_ENDED',
          streamId,
          hostHandle: handle,
        });
      } catch {}

      try {
        this.broadcastBus?.postMessage({
          type: 'LIVE_HOST_ENDED',
          streamId,
          handle: normHandle,
        });
      } catch {}

      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if (id === streamId || (s.creatorHandle || '').toLowerCase().replace('@', '').trim() === normHandle) {
          this.activeStreams.delete(id);
        }
      }
    }

    this.currentHostSession = null;
    try {
      localStorage.removeItem('privity_current_live_host');
      localStorage.removeItem('privity_is_host_broadcasting');
      localStorage.removeItem('privity_active_live_session');
      localStorage.removeItem('privity_remote_active_streams');
    } catch {}
    this.saveCachedStreams();
    this.notifySubscribers();

    if (this.hostPeer) {
      try {
        this.hostPeer.destroy();
      } catch {}
      this.hostPeer = null;
    }

    if (this.hostMediaStream) {
      try {
        this.hostMediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.hostMediaStream = null;
    }
  }

  // =========================================================================
  // VIEWER P2P VIDEO CONNECTION
  // =========================================================================

  public connectToRemoteStream(
    peerIdOrHandle: string,
    onStream: (stream: MediaStream) => void,
    onStatusChange?: (status: 'connecting' | 'connected' | 'failed') => void
  ): () => void {
    let viewerPeer: Peer | null = null;
    let callInstance: any = null;
    let rtcPeerConnection: RTCPeerConnection | null = null;
    let isCleanedUp = false;
    let hasStreamConnected = false;
    const pendingHostCandidates: RTCIceCandidateInit[] = [];

    if (onStatusChange) onStatusChange('connecting');

    const roomId = getRoomIdFromHandle(peerIdOrHandle);
    const targetPeerId = `privity-live-${roomId}`;
    const viewerId = `privity-v-${Math.random().toString(36).substring(2, 9)}`;

    const incomingMediaStream = new MediaStream();

    const handleStreamSuccess = (remoteStream: MediaStream) => {
      if (isCleanedUp) return;
      hasStreamConnected = true;
      if (onStatusChange) onStatusChange('connected');
      onStream(remoteStream);
    };

    // 1. Direct WebRTC Signaling over MQTT Room
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      });
      rtcPeerConnection = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (event.track) {
          if (!incomingMediaStream.getTracks().some((t) => t.id === event.track.id)) {
            incomingMediaStream.addTrack(event.track);
          }
        }
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!incomingMediaStream.getTracks().some((it) => it.id === t.id)) {
              incomingMediaStream.addTrack(t);
            }
          });
        }
        handleStreamSuccess(incomingMediaStream);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && !isCleanedUp) {
          this.sendRoomEvent(roomId, {
            type: 'RTC_VIEWER_CANDIDATE',
            viewerId,
            candidate: event.candidate,
          });
        }
      };

      this.subscribeToRoomEvents(roomId, async (evt) => {
        if (isCleanedUp || !evt) return;
        if (evt.type === 'RTC_ANSWER' && evt.viewerId === viewerId && evt.answer) {
          try {
            if (pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(evt.answer));
              // Flush any queued candidates that arrived before remote description was set
              for (const cand of pendingHostCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
              pendingHostCandidates.length = 0;
            }
          } catch {}
        } else if (evt.type === 'RTC_HOST_CANDIDATE' && evt.viewerId === viewerId && evt.candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(evt.candidate));
            } else {
              pendingHostCandidates.push(evt.candidate);
            }
          } catch {}
        }
      });

      pc.createOffer().then(async (offer) => {
        if (isCleanedUp) return;
        await pc.setLocalDescription(offer);
        this.sendRoomEvent(roomId, {
          type: 'RTC_OFFER',
          viewerId,
          offer,
        });
      }).catch(() => {});
    } catch {}

    // 2. PeerJS in parallel as secondary P2P transport
    try {
      viewerPeer = new Peer(viewerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      viewerPeer.on('open', () => {
        if (isCleanedUp || !viewerPeer || hasStreamConnected) return;

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const dummyStream = canvas.captureStream(1);

        try {
          const call = viewerPeer.call(targetPeerId, dummyStream);
          callInstance = call;

          call.on('stream', (remoteStream: MediaStream) => {
            handleStreamSuccess(remoteStream);
          });
        } catch {}
      });
    } catch {}

    return () => {
      isCleanedUp = true;
      try {
        if (rtcPeerConnection) rtcPeerConnection.close();
      } catch {}
      try {
        if (callInstance) callInstance.close();
      } catch {}
      try {
        if (viewerPeer) viewerPeer.destroy();
      } catch {}
    };
  }

  // =========================================================================
  // GUEST 2-WAY STAGE WEBRTC & REAL-TIME AUDIO/VIDEO
  // =========================================================================

  public subscribeToGuestStreams(callback: (guestHandle: string, stream: MediaStream) => void): () => void {
    this.guestStreamSubscribers.add(callback);
    return () => {
      this.guestStreamSubscribers.delete(callback);
    };
  }

  private dispatchGuestStream(guestHandle: string, stream: MediaStream) {
    const cleanGuestH = guestHandle.replace(/^@/, '').toLowerCase().trim();
    this.guestStreamSubscribers.forEach((cb) => {
      try {
        cb(cleanGuestH, stream);
      } catch (e) {
        console.warn('Guest stream subscriber dispatch error:', e);
      }
    });
  }

  public connectGuestStage(
    roomIdOrHandle: string,
    guestHandle: string,
    localStream: MediaStream,
    onHostStream?: (stream: MediaStream) => void
  ): () => void {
    const roomId = getRoomIdFromHandle(roomIdOrHandle);
    const cleanGuestH = guestHandle.replace(/^@/, '').toLowerCase().trim();
    let isCleanedUp = false;
    let pc: RTCPeerConnection | null = null;
    const pendingHostCandidates: RTCIceCandidateInit[] = [];
    const incomingHostStream = new MediaStream();

    try {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      });

      // 1. Add all guest media tracks (camera & microphone) with ultra-HD bitrate
      localStream.getTracks().forEach((track) => {
        pc!.addTrack(track, localStream);
      });
      try {
        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === 'video') {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 8000000;
            params.encodings[0].networkPriority = 'high';
            sender.setParameters(params).catch(() => {});
          }
        });
      } catch {}

      // 2. Receive host media stream (host camera & microphone)
      pc.ontrack = (event) => {
        if (event.track) {
          if (!incomingHostStream.getTracks().some((t) => t.id === event.track.id)) {
            incomingHostStream.addTrack(event.track);
          }
        }
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!incomingHostStream.getTracks().some((it) => it.id === t.id)) {
              incomingHostStream.addTrack(t);
            }
          });
        }
        if (onHostStream) {
          onHostStream(incomingHostStream);
        }
      };

      // 3. Send guest ICE candidates to host
      pc.onicecandidate = (event) => {
        if (event.candidate && !isCleanedUp) {
          this.sendRoomEvent(roomId, {
            type: 'GUEST_RTC_CANDIDATE',
            guestHandle: cleanGuestH,
            candidate: event.candidate,
          });
        }
      };

      // 4. Subscribe to host answer and candidates
      const unsub = this.subscribeToRoomEvents(roomId, async (evt) => {
        if (isCleanedUp || !evt || !pc) return;

        if (evt.type === 'GUEST_RTC_ANSWER' && evt.guestHandle === cleanGuestH && evt.answer) {
          try {
            if (pc.signalingState !== 'stable') {
              await pc.setRemoteDescription(new RTCSessionDescription(evt.answer));
              for (const cand of pendingHostCandidates) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
              pendingHostCandidates.length = 0;
            }
          } catch (e) {
            console.warn('Guest WebRTC setRemoteDescription error:', e);
          }
        } else if (evt.type === 'GUEST_RTC_HOST_CANDIDATE' && evt.guestHandle === cleanGuestH && evt.candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(evt.candidate));
            } else {
              pendingHostCandidates.push(evt.candidate);
            }
          } catch (e) {
            console.warn('Guest WebRTC candidate error:', e);
          }
        }
      });

      // 5. Send initial offer
      pc.createOffer().then(async (offer) => {
        if (isCleanedUp || !pc) return;
        await pc.setLocalDescription(offer);
        this.sendRoomEvent(roomId, {
          type: 'GUEST_RTC_OFFER',
          guestHandle: cleanGuestH,
          offer,
        });
      }).catch((e) => {
        console.warn('Guest WebRTC createOffer error:', e);
      });

      return () => {
        isCleanedUp = true;
        unsub();
        try {
          if (pc) pc.close();
        } catch {}
      };
    } catch (err) {
      console.warn('Guest stage WebRTC initialization error:', err);
      return () => {
        isCleanedUp = true;
      };
    }
  }

  // =========================================================================
  // ROOM REAL-TIME EVENTS (LIKES, HEARTS, CHAT)
  // =========================================================================

  public sendRoomEvent(streamIdOrHandle: string, event: any) {
    const roomId = getRoomIdFromHandle(streamIdOrHandle);
    const topic = `${TOPIC_ROOM_PREFIX}${roomId}`;
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.publish(topic, JSON.stringify(event));
      } catch {}
    }

    try {
      this.broadcastBus?.postMessage({
        type: 'LIVE_ROOM_EVENT',
        streamId: roomId,
        event,
      });
    } catch {}

    this.dispatchRoomEvent(roomId, event);
  }

  public sendVideoFrame(streamIdOrHandle: string, frameData: string) {
    const roomId = getRoomIdFromHandle(streamIdOrHandle);
    this.sendRoomEvent(roomId, {
      type: 'LIVE_FRAME',
      streamerId: roomId,
      frame: frameData,
    });
  }

  public subscribeToRoom(streamIdOrHandle: string, onEvent: (event: any) => void): () => void {
    return this.subscribeToRoomEvents(streamIdOrHandle, onEvent);
  }

  public subscribeToRoomEvents(streamIdOrHandle: string, onEvent: (event: any) => void): () => void {
    const roomId = getRoomIdFromHandle(streamIdOrHandle);
    if (!this.roomSubscribers.has(roomId)) {
      this.roomSubscribers.set(roomId, new Set());
    }
    this.roomSubscribers.get(roomId)!.add(onEvent);

    const topic = `${TOPIC_ROOM_PREFIX}${roomId}`;
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        this.mqttClient.subscribe(topic);
      } catch {}
    }

    return () => {
      const set = this.roomSubscribers.get(roomId);
      if (set) {
        set.delete(onEvent);
        if (set.size === 0) {
          this.roomSubscribers.delete(roomId);
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
    if (this.queryInterval) clearInterval(this.queryInterval);
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
