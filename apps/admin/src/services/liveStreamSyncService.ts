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

const TOPIC_ACTIVE_STREAMS = 'privity/v1/active-streams';
const TOPIC_QUERY = 'privity/v1/query-streams';
const TOPIC_STREAM_PREFIX = 'privity/v1/stream/';
const TOPIC_ROOM_PREFIX = 'privity/v1/room/';

export function getRoomIdFromHandle(raw: string): string {
  if (!raw) return 'live';
  let cleaned = raw.toLowerCase().trim();
  if (cleaned.startsWith('@')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('live-user-')) cleaned = cleaned.replace('live-user-', '');
  if (cleaned.startsWith('privity-live-')) cleaned = cleaned.replace('privity-live-', '');
  return cleaned.replace(/[^a-z0-9]/g, '') || 'live';
}

class LiveStreamSyncService {
  private mqttClient: MqttClient | null = null;
  private brokerIndex = 0;
  private activeStreams: Map<string, RemoteLiveStreamPayload> = new Map();
  private subscribers: Set<(streams: LiveMeStreamer[]) => void> = new Set();
  private roomSubscribers: Map<string, Set<(event: any) => void>> = new Map();
  private hostPeer: Peer | null = null;
  private hostPeerConnections: Map<string, RTCPeerConnection> = new Map();
  private hostMediaStream: MediaStream | null = null;
  private currentHostSession: RemoteLiveStreamPayload | null = null;
  private heartbeatInterval: any = null;
  private pruneInterval: any = null;
  private queryInterval: any = null;
  private broadcastBus: BroadcastChannel | null = null;
  private isConnecting = false;

  constructor() {
    this.initBroadcastBus();
    this.initMqtt();
    this.startPruneLoop();
    this.startQueryLoop();
    this.loadCachedStreams();
    this.setupLifecycleListeners();
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

  private setupLifecycleListeners() {
    if (typeof window === 'undefined') return;
    try {
      window.addEventListener('storage', (e) => {
        if (
          e.key === 'privity_remote_active_streams' ||
          e.key === 'privity_current_live_host' ||
          e.key === 'privity_is_host_broadcasting'
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
    } catch {}
  }

  private loadCachedStreams() {
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (isBroadcasting && savedHost) {
        try {
          const parsed = JSON.parse(savedHost);
          if (parsed && parsed.id) {
            const h: RemoteLiveStreamPayload = {
              id: parsed.id,
              creatorHandle: parsed.creatorHandle || parsed.handle || 'host',
              creatorName: parsed.creatorName || parsed.name || 'Host',
              creatorAvatar: parsed.creatorAvatar || parsed.avatar || '',
              category: parsed.category || 'Featured',
              title: parsed.title || 'Live Broadcast',
              description: parsed.description || 'Decentralized Live Broadcast',
              viewersCount: parsed.viewersCount || 1,
              likesCount: parsed.likesCount || 0,
              previewUrl: parsed.previewUrl || parsed.avatar || '',
              startedAt: parsed.startedAt || Date.now(),
              isLive: true,
              lastHeartbeat: Date.now(),
            };
            this.activeStreams.set(h.id, h);
          }
        } catch {}
      }

      const saved = localStorage.getItem('privity_remote_active_streams');
      if (saved) {
        const list: RemoteLiveStreamPayload[] = JSON.parse(saved);
        const now = Date.now();
        list.forEach((s) => {
          if (now - (s.lastHeartbeat || s.startedAt) < 30000) {
            const creatorHandle = s.creatorHandle || (s as any).handle || '';
            const creatorName = s.creatorName || (s as any).name || 'Host';
            const creatorAvatar = s.creatorAvatar || (s as any).avatar || '';
            s.creatorHandle = creatorHandle;
            s.creatorName = creatorName;
            s.creatorAvatar = creatorAvatar;
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
        // Subscribe to broadcasts, query topic, and retained stream prefix
        client.subscribe([TOPIC_ACTIVE_STREAMS, TOPIC_QUERY, `${TOPIC_STREAM_PREFIX}+`], { qos: 1 });

        // Query active streams immediately across the network
        this.queryNetworkStreams();

        // If this device is currently hosting, immediately announce to the newly connected broker
        if (this.currentHostSession) {
          this.announceStream(this.currentHostSession);
        }
      });

      client.on('message', (topic, payload) => {
        try {
          const text = payload.toString();
          if (!text || text.trim() === '') return;
          const data = JSON.parse(text);

          if (topic === TOPIC_ACTIVE_STREAMS) {
            if (data.type === 'STREAM_ACTIVE' || data.type === 'STREAM_HEARTBEAT') {
              this.handleIncomingStream(data.stream);
            } else if (data.type === 'STREAM_ENDED') {
              this.handleStreamEnded(data.streamId);
            }
          } else if (topic.startsWith(TOPIC_STREAM_PREFIX)) {
            const streamId = topic.replace(TOPIC_STREAM_PREFIX, '');
            if (data.type === 'STREAM_ACTIVE' || data.type === 'STREAM_HEARTBEAT') {
              this.handleIncomingStream(data.stream);
            } else if (data.type === 'STREAM_ENDED') {
              this.handleStreamEnded(data.streamId || streamId);
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
      this.handleStreamEnded(stream.id);
      return;
    }
    const creatorHandle = stream.creatorHandle || stream.handle || '';
    const creatorName = stream.creatorName || stream.name || 'Host';
    const creatorAvatar = stream.creatorAvatar || stream.avatar || '';
    stream.creatorHandle = creatorHandle;
    stream.creatorName = creatorName;
    stream.creatorAvatar = creatorAvatar;
    stream.isLive = true;

    const normHandle = creatorHandle.toLowerCase().replace('@', '').trim();
    // Remove any older session IDs for the same creator handle to prevent duplicates
    if (normHandle) {
      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if (id !== stream.id && (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim() === normHandle) {
          this.activeStreams.delete(id);
        }
      }
    }
    stream.lastHeartbeat = Date.now();
    this.activeStreams.set(stream.id, stream);
    this.saveCachedStreams();
    this.notifySubscribers();
  }

  private handleStreamEnded(streamId: string) {
    let deletedHandle = '';
    const target = this.activeStreams.get(streamId);
    if (target) {
      deletedHandle = (target.creatorHandle || '').toLowerCase().replace('@', '').trim();
      this.activeStreams.delete(streamId);
    }
    if (deletedHandle) {
      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if ((s.creatorHandle || '').toLowerCase().replace('@', '').trim() === deletedHandle) {
          this.activeStreams.delete(id);
        }
      }
    }
    this.saveCachedStreams();
    this.notifySubscribers();
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
    }, 2500);
  }

  private startQueryLoop() {
    if (this.queryInterval) clearInterval(this.queryInterval);
    this.queryInterval = setInterval(() => {
      // Periodically query to refresh active streams across all devices
      this.queryNetworkStreams();
    }, 2500);
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

    // 1. If this device has an active currentHostSession, ALWAYS include it
    if (this.currentHostSession && this.currentHostSession.isLive !== false) {
      const normHandle = (this.currentHostSession.creatorHandle || '').toLowerCase().replace('@', '').trim();
      if (normHandle) {
        handleMap.set(normHandle, this.currentHostSession);
      }
    }

    // 2. Check localStorage host broadcast session as well
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (isBroadcasting && savedHost) {
        const parsedHost = JSON.parse(savedHost);
        const normHandle = (parsedHost.creatorHandle || parsedHost.handle || '').toLowerCase().replace('@', '').trim();
        if (normHandle && !handleMap.has(normHandle)) {
          handleMap.set(normHandle, {
            id: parsedHost.id || `live-user-${normHandle}`,
            creatorHandle: parsedHost.creatorHandle || parsedHost.handle,
            creatorName: parsedHost.creatorName || parsedHost.name || 'Host',
            creatorAvatar: parsedHost.creatorAvatar || parsedHost.avatar || '',
            category: parsedHost.category || 'Featured',
            title: parsedHost.title || 'Live Broadcast',
            description: parsedHost.description || 'Live Stream',
            viewersCount: Math.max(1, parsedHost.viewersCount || 1),
            likesCount: parsedHost.likesCount || 0,
            previewUrl: parsedHost.previewUrl || parsedHost.avatar || '',
            startedAt: parsedHost.startedAt || Date.now(),
            isLive: true,
            lastHeartbeat: Date.now(),
          });
        }
      }
    } catch {}

    // 3. Active network streams
    for (const s of this.activeStreams.values()) {
      if (now - (s.lastHeartbeat || s.startedAt) > 12000 && (!this.currentHostSession || this.currentHostSession.id !== s.id)) {
        continue;
      }
      const normHandle = (s.creatorHandle || (s as any).handle || '').toLowerCase().replace('@', '').trim();
      if (!normHandle) continue;
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
    if (this.currentHostSession) {
      if (!streamId) return true;
      return this.currentHostSession.id === streamId;
    }
    try {
      const isBroadcasting = localStorage.getItem('privity_is_host_broadcasting') === 'true';
      if (!isBroadcasting) return false;
      if (!streamId) return true;
      const savedHost = localStorage.getItem('privity_current_live_host');
      if (savedHost) {
        const parsed = JSON.parse(savedHost);
        return parsed.id === streamId;
      }
    } catch {}
    return false;
  }

  public getHostSession(): RemoteLiveStreamPayload | null {
    return this.currentHostSession;
  }

  public updateHostMediaStream(stream: MediaStream | null) {
    this.hostMediaStream = stream;
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

    // Announce to MQTT immediately with retain flag
    this.announceStream(this.currentHostSession);

    // Start 2.5-second heartbeat loop
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (this.currentHostSession) {
        this.currentHostSession.lastHeartbeat = Date.now();
        this.announceStream(this.currentHostSession, 'STREAM_HEARTBEAT');
      }
    }, 2500);

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
        }
      }
    });
  }

  private announceStream(stream: RemoteLiveStreamPayload, type: 'STREAM_ACTIVE' | 'STREAM_HEARTBEAT' = 'STREAM_ACTIVE') {
    if (this.mqttClient && this.mqttClient.connected) {
      try {
        const payload = JSON.stringify({ type, stream });
        this.mqttClient.publish(TOPIC_ACTIVE_STREAMS, payload, { qos: 0 });
        const streamTopic = `${TOPIC_STREAM_PREFIX}${stream.id}`;
        this.mqttClient.publish(streamTopic, payload, { retain: true, qos: 1 });
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

    if (this.currentHostSession) {
      const streamId = this.currentHostSession.id;
      const handle = (this.currentHostSession.creatorHandle || '').toLowerCase().replace('@', '').trim();

      if (this.mqttClient && this.mqttClient.connected) {
        try {
          const endPayload = JSON.stringify({
            type: 'STREAM_ENDED',
            streamId,
            creatorHandle: this.currentHostSession.creatorHandle,
          });
          this.mqttClient.publish(TOPIC_ACTIVE_STREAMS, endPayload, { qos: 0 });
          const streamTopic = `${TOPIC_STREAM_PREFIX}${streamId}`;
          // Empty payload with retain: true deletes the retained topic permanently on MQTT brokers!
          this.mqttClient.publish(streamTopic, '', { retain: true, qos: 1 });
        } catch {}
      }

      try {
        this.broadcastBus?.postMessage({
          type: 'LIVE_HOST_ENDED',
          streamId,
          handle,
        });
      } catch {}

      for (const [id, s] of Array.from(this.activeStreams.entries())) {
        if (id === streamId || (s.creatorHandle || '').toLowerCase().replace('@', '').trim() === handle) {
          this.activeStreams.delete(id);
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
    peerIdOrHandle: string,
    onStream: (stream: MediaStream) => void,
    onStatusChange?: (status: 'connecting' | 'connected' | 'failed') => void
  ): () => void {
    let viewerPeer: Peer | null = null;
    let callInstance: any = null;
    let rtcPeerConnection: RTCPeerConnection | null = null;
    let isCleanedUp = false;
    let hasStreamConnected = false;

    if (onStatusChange) onStatusChange('connecting');

    const roomId = getRoomIdFromHandle(peerIdOrHandle);
    const targetPeerId = `privity-live-${roomId}`;
    const viewerId = `privity-v-${Math.random().toString(36).substring(2, 9)}`;

    const handleStreamSuccess = (remoteStream: MediaStream) => {
      if (isCleanedUp || hasStreamConnected) return;
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
        if (event.streams && event.streams[0]) {
          handleStreamSuccess(event.streams[0]);
        }
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
            }
          } catch {}
        } else if (evt.type === 'RTC_HOST_CANDIDATE' && evt.viewerId === viewerId && evt.candidate) {
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(evt.candidate));
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
