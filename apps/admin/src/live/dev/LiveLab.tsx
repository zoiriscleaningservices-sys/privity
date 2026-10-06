/**
 * Privity LIVE Lab — DEV-ONLY QA harness (never bundled in production: App.tsx lazy-loads it
 * behind `import.meta.env.DEV`).
 *
 * It mounts the REAL Stage 3 screens (HostStudio, ViewerLiveScreen) against
 * SimulatedLiveBackend, which plays the server's role with the S2 event contract, and
 * LabMediaHub, an in-page loopback media transport. The control panel only does things that
 * OTHER people or the server would do (bots commenting / gifting / asking to join, an opponent
 * host, the battle clock, network failures). The screens never know they are in the Lab.
 *
 * Nothing here talks to Supabase. Everything simulated is labelled as such.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import type { LiveSnapshot, UserRef } from '../core/events';
import type { LiveCommands } from '../client/LiveCommands';
import { newIdempotencyKey } from '../client/LiveCommands';
import type { LiveFeed } from '../client/LiveRoomController';
import type { MediaQuality } from '../client/connection';
import { EffectsController } from '../show/effects';
import { DeviceFilterPresetStore } from '../media/presetStore';
import type { MediaSourceKind } from '../media/LocalMediaController';
import type { FilterPipeline } from '../media/FilterPipeline';
import { HostStudio } from '../ui/HostStudio';
import { ViewerLiveScreen } from '../ui/ViewerLiveScreen';
import { SimulatedLiveBackend } from './SimulatedLiveBackend';
import { LabMediaHub } from './LabMediaHub';
import { SIM_GIFTS } from './simCatalog';
import creatorA from './assets/creator-a.jpg';
import creatorB from './assets/creator-b.jpg';
import guestPhoto from './assets/guest.jpg';
import './lab.css';

// ---- Cast ------------------------------------------------------------------------------

const HOST: UserRef = { id: 'lab-host', handle: 'aria.lumen', display_name: 'Aria Lumen', avatar_url: creatorA };
const VIEWER: UserRef = { id: 'lab-viewer', handle: 'noah.k', display_name: 'Noah Kim', avatar_url: null };
const GUEST: UserRef = { id: 'lab-guest', handle: 'maya.rivera', display_name: 'Maya Rivera', avatar_url: guestPhoto };
const OPPONENT: UserRef = { id: 'lab-opponent', handle: 'kai.vortex', display_name: 'Kai Vortex', avatar_url: creatorB };
const OPP_FAN: UserRef = { id: 'lab-opp-fan', handle: 'vortex.fan', display_name: 'Rin (Kai fan)', avatar_url: null };

const BOT_NAMES = [
  ['Leo Park', 'leo.park'],
  ['Sofia Mendes', 'sofi.m'],
  ['Jonah Reyes', 'jonah.r'],
  ['Amara Osei', 'amara.o'],
  ['Theo Laurent', 'theo.l'],
  ['Priya Nair', 'priya.n'],
  ['Mateo Cruz', 'mateo.c'],
  ['Hana Sato', 'hana.s'],
  ['Elif Kaya', 'elif.k'],
  ['Omar Haddad', 'omar.h'],
  ['Zoe Martin', 'zoe.m'],
  ['Ivan Petrov', 'ivan.p'],
] as const;

const BOTS: UserRef[] = BOT_NAMES.map(([name, handle], i) => ({ id: `lab-bot-${i + 1}`, handle, display_name: name, avatar_url: null }));
const ON_PAGE = new Set([HOST.id, VIEWER.id, GUEST.id]);

const BOT_LINES = [
  'This look is so clean',
  'Hi from Lisbon!',
  'The lighting today is perfect',
  'How long are you live for?',
  'First time catching you live',
  'Battle later?',
  'That filter suits you',
  'Saying hi before class',
  'Can you shout out my sister Mia?',
  'Love the energy',
  'Audio is crystal clear',
  'Back again tonight',
];

// ---- Viewports -------------------------------------------------------------------------

type Viewport = 'iphone' | 'android' | 'desktop';
const VIEWPORTS: Record<Viewport, { w: number; h: number; label: string }> = {
  iphone: { w: 393, h: 852, label: 'iPhone 15 · 393×852' },
  android: { w: 360, h: 780, label: 'Android · 360×780' },
  desktop: { w: 1180, h: 720, label: 'Desktop · 1180×720' },
};

type ScreenId = 'host' | 'viewer' | 'guest';

// ---- Session ---------------------------------------------------------------------------

interface LabSession {
  backend: SimulatedLiveBackend;
  hub: LabMediaHub;
  effects: Record<ScreenId, EffectsController>;
  feeds: Record<ScreenId, LiveFeed>;
  commands: Record<ScreenId, LiveCommands>;
  dispose(): void;
}

function createSession(guestSlots: number): LabSession {
  const backend = new SimulatedLiveBackend({ host: HOST, title: 'Golden hour studio session', config: { guestSlots } });
  backend.ensureUser(VIEWER, 25000);
  backend.ensureUser(GUEST, 3000);
  backend.ensureUser(OPPONENT, 0);
  backend.ensureUser(OPP_FAN, 0);
  BOTS.forEach((b) => backend.ensureUser(b, 250000));
  backend.dev.setViewers(184);
  const hub = new LabMediaHub();
  const fx = () => new EffectsController({ persist: false, vibrate: null });
  return {
    backend,
    hub,
    effects: { host: fx(), viewer: fx(), guest: fx() },
    feeds: { host: backend.feedFor(HOST.id), viewer: backend.feedFor(VIEWER.id), guest: backend.feedFor(GUEST.id) },
    commands: { host: backend.commandsFor(HOST.id), viewer: backend.commandsFor(VIEWER.id), guest: backend.commandsFor(GUEST.id) },
    dispose() {
      hub.dispose();
      backend.dispose();
    },
  };
}

/** StrictMode-safe: the session is created in an effect and disposed on cleanup. */
function useLabSession(key: number, guestSlots: number): LabSession | null {
  const [session, setSession] = useState<LabSession | null>(null);
  useEffect(() => {
    const s = createSession(guestSlots);
    setSession(s);
    return () => {
      s.dispose();
      setSession(null);
    };
  }, [key, guestSlots]);
  return session;
}

/** Authoritative view for the panel: the simulated server's own snapshot, re-read on change. */
function useServerSnapshot(session: LabSession | null): { snap: LiveSnapshot | null; inspect: ReturnType<SimulatedLiveBackend['inspect']> | null } {
  const [snap, setSnap] = useState<LiveSnapshot | null>(null);
  const [inspect, setInspect] = useState<ReturnType<SimulatedLiveBackend['inspect']> | null>(null);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const observer = session.backend.commandsFor(HOST.id);
    const read = () => {
      setInspect(session.backend.inspect());
      void observer.getSnapshot(session.backend.liveId).then((r) => {
        if (alive && r.ok) setSnap(r.data);
      });
    };
    read();
    const unsub = session.backend.subscribe(read);
    const t = setInterval(read, 1000);
    return () => {
      alive = false;
      unsub();
      clearInterval(t);
    };
  }, [session]);
  return { snap, inspect };
}

interface LogEntry {
  id: number;
  text: string;
  ok: boolean | null;
}

// ---- Component -------------------------------------------------------------------------

export function LiveLab() {
  const [sessionKey, setSessionKey] = useState(0);
  const [guestSlots, setGuestSlots] = useState(8);
  const [viewport, setViewport] = useState<Viewport>('iphone');
  const [desktopScreen, setDesktopScreen] = useState<ScreenId>('viewer');
  const [hostSource, setHostSource] = useState<MediaSourceKind>('test-pattern');
  const [guestSource, setGuestSource] = useState<MediaSourceKind>('test-pattern');
  const [showGuestPhone, setShowGuestPhone] = useState(true);
  const [left, setLeft] = useState<Record<ScreenId, boolean>>({ host: false, viewer: false, guest: false });
  const [mountKeys, setMountKeys] = useState<Record<ScreenId, number>>({ host: 0, viewer: 0, guest: 0 });
  const [format, setFormat] = useState<'classic_double' | 'three_pulls'>('classic_double');
  const [autoChat, setAutoChat] = useState(false);
  const [autoGifts, setAutoGifts] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pixels, setPixels] = useState<PixelReport | null>(null);
  const [scale, setScale] = useState(1);

  const session = useLabSession(sessionKey, guestSlots);
  const { snap, inspect } = useServerSnapshot(session);
  const filterStore = useMemo(() => new DeviceFilterPresetStore(HOST.id), []);
  const logSeq = useRef(0);
  const botCursor = useRef(0);

  const addLog = useCallback((text: string, ok: boolean | null = null) => {
    const id = ++logSeq.current;
    setLog((l) => [{ id, text, ok }, ...l].slice(0, 12));
  }, []);

  const nextBot = useCallback(() => {
    const b = BOTS[botCursor.current % BOTS.length];
    botCursor.current += 1;
    return b;
  }, []);

  // Fit the phones to the window height.
  useEffect(() => {
    const fit = () => {
      const vp = VIEWPORTS[viewport];
      const avail = window.innerHeight - 52 - 32 - 30 - (window.innerWidth <= 1100 ? window.innerHeight * 0.42 : 0);
      setScale(Math.max(0.45, Math.min(1, avail / vp.h)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [viewport]);

  // Remote participants without a screen on this page get a labelled synthetic signal.
  const liveId = session?.backend.liveId ?? '';
  const battleOnStage = !!snap?.battle && ['accepted', 'live', 'locked', 'finalized'].includes(snap.battle.status);
  useEffect(() => {
    if (!session || !snap) return;
    const ids = snap.guests.filter((g) => !ON_PAGE.has(g.id)).map((g) => ({ id: g.id, label: g.display_name || g.handle }));
    if (battleOnStage) ids.push({ id: OPPONENT.id, label: `${OPPONENT.display_name} (opponent)` });
    session.hub.syncSimulated(ids);
  }, [session, snap, battleOnStage]);

  // Background audience activity.
  useEffect(() => {
    if (!session || !autoChat) return;
    const t = setInterval(() => {
      const bot = nextBot();
      void session.backend.commandsFor(bot.id).comment(liveId, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)]);
    }, 1700);
    return () => clearInterval(t);
  }, [session, autoChat, liveId, nextBot]);

  const sendBotGift = useCallback(
    async (giftId: string, quantity = 1, bot?: UserRef) => {
      if (!session) return;
      const sender = bot ?? nextBot();
      const res = await session.backend.commandsFor(sender.id).sendGift({
        liveId,
        giftId,
        quantity,
        idempotencyKey: newIdempotencyKey(),
        battleMode: 'auto',
        expectedBattleId: snap?.battle?.battle_id ?? null,
      });
      const name = SIM_GIFTS.find((g) => g.id === giftId)?.name ?? giftId;
      addLog(`${sender.display_name} → ${quantity}× ${name}: ${res.ok ? `ok (${res.data.battle_outcome})` : res.code}`, res.ok);
    },
    [session, liveId, snap?.battle?.battle_id, nextBot, addLog],
  );

  useEffect(() => {
    if (!session || !autoGifts) return;
    const t = setInterval(() => {
      const r = Math.random();
      void sendBotGift(r < 0.75 ? 'rose' : 'tropical-mosquito', r < 0.5 ? 1 : 3);
    }, 3800);
    return () => clearInterval(t);
  }, [session, autoGifts, sendBotGift]);

  const resetSession = () => {
    setAutoChat(false);
    setAutoGifts(false);
    setLeft({ host: false, viewer: false, guest: false });
    setPixels(null);
    setLog([]);
    setSessionKey((k) => k + 1);
  };

  const rejoin = (id: ScreenId) => {
    setLeft((l) => ({ ...l, [id]: false }));
    setMountKeys((k) => ({ ...k, [id]: k[id] + 1 }));
  };

  if (!session) {
    return (
      <div className="lab-root">
        <div className="lab-left">Starting simulated LIVE…</div>
      </div>
    );
  }

  const { backend, hub } = session;
  const shareUrl = `${window.location.origin}/#/live/${liveId}`;
  const vp = VIEWPORTS[viewport];
  const pendingBots = snap ? snap.guests.length : 0;
  const battle = snap?.battle ?? null;
  const simGuests = (snap?.guests ?? []).filter((g) => !ON_PAGE.has(g.id));

  const screens: Array<{ id: ScreenId; caption: JSX.Element; node: JSX.Element }> = [
    {
      id: 'host',
      caption: (
        <>
          <b>Host</b> · Aria · Studio
        </>
      ),
      node: (
        <HostStudio
          key={`host-${sessionKey}-${mountKeys.host}-${hostSource}`}
          feed={session.feeds.host}
          commands={session.commands.host}
          me={HOST}
          effects={session.effects.host}
          media={hub}
          filterStore={filterStore}
          mediaSource={hostSource}
          onExit={() => setLeft((l) => ({ ...l, host: true }))}
        />
      ),
    },
    {
      id: 'viewer',
      caption: (
        <>
          <b>Viewer</b> · Noah · 25k test coins
        </>
      ),
      node: (
        <ViewerLiveScreen
          key={`viewer-${sessionKey}-${mountKeys.viewer}`}
          feed={session.feeds.viewer}
          commands={session.commands.viewer}
          me={VIEWER}
          effects={session.effects.viewer}
          media={hub}
          shareUrl={shareUrl}
          onLeave={() => setLeft((l) => ({ ...l, viewer: true }))}
        />
      ),
    },
  ];
  if (showGuestPhone) {
    screens.push({
      id: 'guest',
      caption: (
        <>
          <b>Viewer → guest</b> · Maya
        </>
      ),
      node: (
        <ViewerLiveScreen
          key={`guest-${sessionKey}-${mountKeys.guest}-${guestSource}`}
          feed={session.feeds.guest}
          commands={session.commands.guest}
          me={GUEST}
          effects={session.effects.guest}
          media={hub}
          guestMediaSource={guestSource}
          shareUrl={shareUrl}
          onLeave={() => setLeft((l) => ({ ...l, guest: true }))}
        />
      ),
    });
  }
  const visible = viewport === 'desktop' ? screens.filter((s) => s.id === desktopScreen) : screens;

  const fmtJumps =
    format === 'classic_double'
      ? [
          ['Fight start', 1000],
          ['Double warning', 92000],
          ['Double ×2 live', 125000],
          ['Final 30s', 272000],
          ['Last 3s', 297000],
        ]
      : [
          ['Round 1', 1000],
          ['Break', 61000],
          ['Round 2', 67000],
          ['Round 3 ×2', 132000],
          ['Final 15s', 177000],
        ];

  return (
    <div className="lab-root" data-testid="live-lab">
      <header className="lab-top">
        <button
          type="button"
          className="lab-btn"
          onClick={() => {
            window.location.hash = '';
          }}
          id="lab-back"
        >
          <ArrowLeft size={14} /> App
        </button>
        <h1 className="lab-title">
          <span className="lab-mark" aria-hidden="true">
            <FlaskConical size={16} />
          </span>
          Privity LIVE Lab
          <span className="lab-tag">Dev · simulated server</span>
        </h1>
        <span className="lab-top-note">
          Real Stage 3 screens · events from the in-browser S2 simulator · media via in-page loopback · nothing reaches Supabase
        </span>
      </header>

      <div className="lab-body">
        <section className="lab-stage" aria-label="Devices">
          {visible.map((s) => (
            <div key={s.id} className="lab-device">
              <div className="lab-device-caption">{s.caption}</div>
              <div className="lab-device-slot" style={{ width: vp.w * scale, height: vp.h * scale }}>
                <div className={`lab-frame lab-frame--${viewport}`} style={{ width: vp.w, height: vp.h, transform: `scale(${scale})` }} data-screen={s.id}>
                  {left[s.id] ? (
                    <div className="lab-left">
                      <p>{s.id === 'host' ? 'Studio closed.' : 'Left the LIVE.'}</p>
                      <button type="button" className="lab-btn lab-btn--primary" onClick={() => rejoin(s.id)}>
                        Open again
                      </button>
                    </div>
                  ) : (
                    s.node
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        <aside className="lab-panel" aria-label="Lab controls">
          <details className="lab-section" open>
            <summary>Session</summary>
            <dl className="lab-kv">
              <dt>Server state</dt>
              <dd>
                {inspect?.status ?? '…'} · seq {inspect?.lastSeq ?? 0} · link {inspect?.link}
              </dd>
              <dt>Audience</dt>
              <dd>
                {inspect?.viewers ?? 0} watching · {inspect?.guests ?? 0}/{guestSlots} guests · {inspect?.requests ?? 0} waiting
              </dd>
              <dt>Battle</dt>
              <dd>{inspect?.battle ? `${inspect.battle.status} · A ${inspect.battle.a} – B ${inspect.battle.b}` : 'none'}</dd>
              <dt>Host earnings</dt>
              <dd>{(inspect?.hostEarnings ?? 0).toLocaleString()} (simulated wallet)</dd>
            </dl>
            <div className="lab-row">
              <span className="lab-row-label">Viewport</span>
              {(Object.keys(VIEWPORTS) as Viewport[]).map((v) => (
                <button key={v} type="button" className={`lab-btn ${viewport === v ? 'is-on' : ''}`} onClick={() => setViewport(v)} id={`lab-vp-${v}`}>
                  {VIEWPORTS[v].label}
                </button>
              ))}
            </div>
            {viewport === 'desktop' && (
              <div className="lab-row">
                <span className="lab-row-label">Screen</span>
                {screens.map((s) => (
                  <button key={s.id} type="button" className={`lab-btn ${desktopScreen === s.id ? 'is-on' : ''}`} onClick={() => setDesktopScreen(s.id)}>
                    {s.id}
                  </button>
                ))}
              </div>
            )}
            <div className="lab-row">
              <span className="lab-row-label">Server guest slots (server default 3, hard max 8)</span>
              {[3, 8].map((n) => (
                <button key={n} type="button" className={`lab-btn ${guestSlots === n ? 'is-on' : ''}`} onClick={() => setGuestSlots(n)}>
                  {n} slots
                </button>
              ))}
            </div>
            <div className="lab-row">
              <span className="lab-row-label">Host video source</span>
              <button type="button" className={`lab-btn ${hostSource === 'test-pattern' ? 'is-on' : ''}`} onClick={() => setHostSource('test-pattern')} id="lab-host-pattern">
                Test signal
              </button>
              <button type="button" className={`lab-btn ${hostSource === 'camera' ? 'is-on' : ''}`} onClick={() => setHostSource('camera')} id="lab-host-camera">
                Real camera
              </button>
            </div>
            <div className="lab-row">
              <span className="lab-row-label">Maya&rsquo;s video source when on stage</span>
              <button type="button" className={`lab-btn ${guestSource === 'test-pattern' ? 'is-on' : ''}`} onClick={() => setGuestSource('test-pattern')}>
                Test signal
              </button>
              <button type="button" className={`lab-btn ${guestSource === 'camera' ? 'is-on' : ''}`} onClick={() => setGuestSource('camera')}>
                Real camera
              </button>
              <button type="button" className={`lab-btn ${showGuestPhone ? 'is-on' : ''}`} onClick={() => setShowGuestPhone((v) => !v)}>
                {showGuestPhone ? 'Hide' : 'Show'} Maya&rsquo;s phone
              </button>
            </div>
            <div className="lab-row">
              <button type="button" className="lab-btn lab-btn--danger" onClick={resetSession} id="lab-reset">
                Reset session
              </button>
            </div>
          </details>

          <details className="lab-section" open>
            <summary>Audience</summary>
            <div className="lab-row">
              <button type="button" className="lab-btn" onClick={() => backend.dev.setViewers((inspect?.viewers ?? 0) + 25, BOTS.slice(0, 3))}>
                +25 viewers
              </button>
              <button type="button" className="lab-btn" onClick={() => backend.dev.setViewers((inspect?.viewers ?? 0) + 1000, BOTS.slice(3, 6))} id="lab-viewers-1000">
                +1,000
              </button>
              <button type="button" className="lab-btn" onClick={() => backend.dev.setViewers(Math.max(0, (inspect?.viewers ?? 0) - 100))}>
                −100
              </button>
            </div>
            <div className="lab-row">
              <button
                type="button"
                className="lab-btn"
                id="lab-bot-comment"
                onClick={() => {
                  const bot = nextBot();
                  void session.backend
                    .commandsFor(bot.id)
                    .comment(liveId, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)])
                    .then((r) => !r.ok && addLog(`${bot.display_name} comment: ${r.code}`, false));
                }}
              >
                Bot comment
              </button>
              <button type="button" className={`lab-btn ${autoChat ? 'is-on' : ''}`} onClick={() => setAutoChat((v) => !v)} id="lab-auto-chat">
                Auto chat {autoChat ? 'on' : 'off'}
              </button>
              <button
                type="button"
                className="lab-btn"
                onClick={() => {
                  const bot = nextBot();
                  void backend
                    .commandsFor(bot.id)
                    .follow(HOST.id)
                    .then((r) => addLog(`${bot.display_name} follows host: ${r.ok ? 'ok' : r.code}`, r.ok));
                }}
              >
                Bot follows host
              </button>
            </div>
          </details>

          <details className="lab-section" open>
            <summary>Gifts (from other viewers)</summary>
            <div className="lab-row">
              {SIM_GIFTS.map((g) => (
                <button key={g.id} type="button" className="lab-btn" onClick={() => void sendBotGift(g.id)} id={`lab-gift-${g.id}`}>
                  <img src={g.icon_url} alt="" /> {g.name} · {g.coin_cost.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="lab-row">
              <button
                type="button"
                className="lab-btn"
                onClick={() => {
                  const bot = nextBot();
                  for (let i = 0; i < 6; i += 1) setTimeout(() => void sendBotGift('rose', 1, bot), i * 260);
                }}
              >
                Rose streak ×6 (same sender)
              </button>
              <button type="button" className="lab-btn" onClick={() => BOTS.slice(0, 6).forEach((b, i) => setTimeout(() => void sendBotGift('rose', 1, b), i * 90))}>
                Rose burst (6 senders)
              </button>
              <button type="button" className={`lab-btn ${autoGifts ? 'is-on' : ''}`} onClick={() => setAutoGifts((v) => !v)}>
                Auto gifts {autoGifts ? 'on' : 'off'}
              </button>
            </div>
            <div className="lab-row">
              <button type="button" className="lab-btn" onClick={() => backend.dev.grantTestCredits(VIEWER.id, 10000)}>
                +10,000 test coins to Noah
              </button>
              <span className="lab-note">Noah: {(backend.getUser(VIEWER.id)?.testCoins ?? 0).toLocaleString()} test coins</span>
            </div>
          </details>

          <details className="lab-section" open>
            <summary>Stage &amp; guests</summary>
            <div className="lab-row">
              <button
                type="button"
                className="lab-btn"
                id="lab-bot-request"
                onClick={() => {
                  const bot = nextBot();
                  void backend
                    .commandsFor(bot.id)
                    .requestGuest(liveId)
                    .then((r) => addLog(`${bot.display_name} asks to join: ${r.ok ? r.data.status : r.code}`, r.ok));
                }}
              >
                Bot asks to join
              </button>
              <button
                type="button"
                className="lab-btn"
                id="lab-bot-request-5"
                onClick={() => {
                  for (let i = 0; i < 5; i += 1) {
                    const bot = nextBot();
                    void backend
                      .commandsFor(bot.id)
                      .requestGuest(liveId)
                      .then((r) => !r.ok && addLog(`${bot.display_name} asks to join: ${r.code}`, false));
                  }
                }}
              >
                5 bots ask
              </button>
            </div>
            <p className="lab-note">
              On stage now: {pendingBots}/{guestSlots}. Guests without a phone on this page show a labelled SIMULATED test signal. Real multi-party
              video arrives with Stage 4 (LiveKit). The stage UI is designed for host + 12; the server caps guests at {guestSlots}.
            </p>
            {simGuests.map((g) => {
              const m = hub.get().get(g.id);
              return (
                <div key={g.id} className="lab-guest">
                  <span className="lab-guest-name">{g.display_name}</span>
                  <button type="button" className={`lab-btn ${m?.cameraOn ? 'is-on' : ''}`} onClick={() => hub.setSimulatedState(g.id, { cameraOn: !m?.cameraOn })}>
                    Cam {m?.cameraOn ? 'on' : 'off'}
                  </button>
                  <button type="button" className={`lab-btn ${m?.micOn ? 'is-on' : ''}`} onClick={() => hub.setSimulatedState(g.id, { micOn: !m?.micOn })}>
                    Mic {m?.micOn ? 'on' : 'off'}
                  </button>
                  {(['connected', 'reconnecting', 'disconnected'] as const).map((st) => (
                    <button key={st} type="button" className={`lab-btn ${m?.status === st ? 'is-on' : ''}`} onClick={() => hub.setSimulatedState(g.id, { status: st })}>
                      {st}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="lab-btn lab-btn--danger"
                    onClick={() => void backend.commandsFor(g.id).leaveGuest(liveId).then((r) => addLog(`${g.display_name} leaves: ${r.ok ? 'ok' : r.code}`, r.ok))}
                  >
                    Leaves
                  </button>
                </div>
              );
            })}
          </details>

          <details className="lab-section" open>
            <summary>Battle (opponent: Kai Vortex)</summary>
            <div className="lab-row">
              <span className="lab-row-label">Format</span>
              <button type="button" className={`lab-btn ${format === 'classic_double' ? 'is-on' : ''}`} onClick={() => setFormat('classic_double')}>
                Classic + Double
              </button>
              <button type="button" className={`lab-btn ${format === 'three_pulls' ? 'is-on' : ''}`} onClick={() => setFormat('three_pulls')}>
                Three rounds
              </button>
            </div>
            <div className="lab-row">
              <button
                type="button"
                className="lab-btn lab-btn--primary"
                id="lab-battle-invite"
                disabled={!!battle && battle.status !== 'finalized'}
                onClick={() => backend.dev.inviteBattle(OPPONENT, format, 30000)}
              >
                Kai invites Aria
              </button>
              <button type="button" className="lab-btn" id="lab-battle-start" onClick={() => backend.dev.startBattle(OPPONENT, format)}>
                Start with intro
              </button>
            </div>
            <div className="lab-row">
              <span className="lab-row-label">Jump the server clock (restarts the battle at)</span>
              {fmtJumps.map(([label, ms]) => (
                <button key={label} type="button" className="lab-btn" onClick={() => backend.dev.startBattle(OPPONENT, format, ms as number)} id={`lab-jump-${String(label).replace(/\W+/g, '-').toLowerCase()}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="lab-row">
              <span className="lab-row-label">Gifts in Kai&rsquo;s room (score side B)</span>
              {SIM_GIFTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="lab-btn"
                  disabled={!battle}
                  onClick={() => {
                    const err = backend.dev.opponentGift(OPP_FAN, g.id, 1);
                    addLog(`Kai's room ← ${g.name}: ${err ?? 'scored'}`, err === null);
                  }}
                >
                  <img src={g.icon_url} alt="" /> {g.name}
                </button>
              ))}
            </div>
          </details>

          <details className="lab-section" open>
            <summary>Network (simulated)</summary>
            <div className="lab-row">
              <span className="lab-row-label">Realtime link for every screen</span>
              {(['connected', 'reconnecting', 'disconnected'] as const).map((l) => (
                <button key={l} type="button" className={`lab-btn ${inspect?.link === l ? 'is-on' : ''}`} onClick={() => backend.dev.setLink(l)} id={`lab-link-${l}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="lab-row">
              <span className="lab-row-label">Media quality (shown with a &ldquo;Sim&rdquo; tag)</span>
              {(['unknown', 'excellent', 'good', 'weak'] as MediaQuality[]).map((q) => (
                <button key={q} type="button" className={`lab-btn ${inspect?.quality === q ? 'is-on' : ''}`} onClick={() => backend.dev.setQuality(q)}>
                  {q}
                </button>
              ))}
            </div>
          </details>

          <details className="lab-section">
            <summary>Failure injection (next call from anyone)</summary>
            {FAILURES.map(([cmd, code, label]) => (
              <button
                key={`${cmd}:${code}`}
                type="button"
                className="lab-btn"
                style={{ margin: '3px 4px 3px 0' }}
                onClick={() => {
                  backend.dev.failNext(cmd, code);
                  addLog(`armed: next ${cmd} → ${code}`);
                }}
              >
                {label}
              </button>
            ))}
            <p className="lab-note">Turn auto chat / auto gifts off first, or a bot may consume the armed failure.</p>
          </details>

          <details className="lab-section" open>
            <summary>Filter pixel check (host pipeline)</summary>
            <div className="lab-row">
              <button type="button" className="lab-btn lab-btn--primary" onClick={() => setPixels(samplePipeline())} id="lab-sample-pixels">
                Sample pixels
              </button>
              <button
                type="button"
                className="lab-btn"
                onClick={() => {
                  localStorage.removeItem(`privity.live.filters.v1:${HOST.id}`);
                  setMountKeys((k) => ({ ...k, host: k.host + 1 }));
                  addLog('cleared saved looks for Aria (this device)');
                }}
              >
                Clear saved looks
              </button>
            </div>
            {pixels && <PixelTable report={pixels} />}
          </details>

          <details className="lab-section" open>
            <summary>Session end</summary>
            <div className="lab-row">
              <button type="button" className="lab-btn" onClick={() => backend.dev.systemNotice('Scheduled maintenance in 30 minutes. Your LIVE will not be interrupted.', 'info')}>
                System notice
              </button>
              <button type="button" className="lab-btn lab-btn--danger" onClick={() => backend.dev.endLive('host_ended')} id="lab-end-live">
                Server ends LIVE
              </button>
            </div>
          </details>

          <details className="lab-section" open>
            <summary>Log</summary>
            <ul className="lab-log" aria-live="polite">
              {log.length === 0 && <li>Actions from the panel appear here.</li>}
              {log.map((e) => (
                <li key={e.id} className={e.ok === null ? '' : e.ok ? 'is-ok' : 'is-fail'}>
                  {e.text}
                </li>
              ))}
            </ul>
          </details>
        </aside>
      </div>
    </div>
  );
}

const FAILURES: Array<[string, string, string]> = [
  ['sendGift', 'INSUFFICIENT_FUNDS', 'Gift: not enough coins'],
  ['sendGift', 'RATE_LIMITED', 'Gift: rate limited'],
  ['sendGift', 'GIFT_UNAVAILABLE', 'Gift: unavailable'],
  ['sendGift', 'BATTLE_LOCKED', 'Gift: battle locked (D6)'],
  ['sendGift', 'SERVER_ERROR', 'Gift: server error'],
  ['sendGift', 'NETWORK_ERROR', 'Gift: network error'],
  ['comment', 'RATE_LIMITED', 'Comment: rate limited'],
  ['comment', 'COMMENTS_DISABLED', 'Comment: disabled'],
  ['requestGuest', 'GUEST_QUEUE_FULL', 'Join request: queue full'],
  ['respondGuest', 'GUEST_SLOTS_FULL', 'Accept guest: slots full'],
  ['follow', 'NETWORK_ERROR', 'Follow: network error'],
  ['battleRespond', 'SERVER_ERROR', 'Battle answer: server error'],
  ['endLive', 'SERVER_ERROR', 'End LIVE: server error'],
];

// ---- Pixel QA --------------------------------------------------------------------------

/** Fixed regions of the test signal (normalised source coordinates). */
const PIXEL_POINTS: Array<{ label: string; at: [number, number] }> = [
  { label: 'Skin', at: [0.5, 0.4] },
  { label: 'Grey 57%', at: [0.04, 0.5625] },
  { label: 'Blue swatch', at: [0.4375, 0.89] },
  { label: 'White swatch', at: [0.6875, 0.89] },
];

interface PixelReport {
  at: string;
  status: string;
  frames: number;
  avgMs: number;
  size: string;
  rows: Array<{ label: string; original: number[]; filtered: number[]; delta: number }>;
  error?: string;
}

function samplePipeline(): PixelReport {
  const qa = (window as unknown as { __privityLiveQA?: { pipeline?: FilterPipeline | null } }).__privityLiveQA;
  const p = qa?.pipeline ?? null;
  const at = new Date().toLocaleTimeString();
  if (!p) return { at, status: 'no pipeline', frames: 0, avgMs: 0, size: '—', rows: [], error: 'Open the host studio with the camera on.' };
  const st = p.getState();
  const wasBypass = st.bypass;
  const pts = PIXEL_POINTS.map((x) => x.at);
  p.setBypass(true);
  const original = p.samplePixels(pts);
  p.setBypass(false);
  const filtered = p.samplePixels(pts);
  p.setBypass(wasBypass);
  const rows = PIXEL_POINTS.map((x, i) => {
    const o = original[i] ?? [0, 0, 0, 0];
    const f = filtered[i] ?? [0, 0, 0, 0];
    return { label: x.label, original: o.slice(0, 3), filtered: f.slice(0, 3), delta: Math.abs(o[0] - f[0]) + Math.abs(o[1] - f[1]) + Math.abs(o[2] - f[2]) };
  });
  return {
    at,
    status: st.status,
    frames: st.stats.framesRendered,
    avgMs: st.stats.avgRenderMs,
    size: `${st.stats.width}×${st.stats.height}`,
    rows,
    error: original.length === 0 ? 'No frame available yet.' : undefined,
  };
}

function PixelTable({ report }: { report: PixelReport }) {
  const rgb = (c: number[]) => `rgb(${c.join(',')})`;
  return (
    <div data-testid="lab-pixel-report">
      <dl className="lab-kv">
        <dt>Sampled</dt>
        <dd>{report.at}</dd>
        <dt>Pipeline</dt>
        <dd>
          {report.status} · {report.size} · {report.frames} frames · {report.avgMs.toFixed(2)} ms/frame
        </dd>
      </dl>
      {report.error ? (
        <p className="lab-note">{report.error}</p>
      ) : (
        <table className="lab-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Original</th>
              <th>Filtered</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.label} data-delta={r.delta}>
                <td>{r.label}</td>
                <td>
                  <span className="lab-swatch" style={{ background: rgb(r.original) }} />
                  {r.original.join(',')}
                </td>
                <td>
                  <span className="lab-swatch" style={{ background: rgb(r.filtered) }} />
                  {r.filtered.join(',')}
                </td>
                <td>{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="lab-note">Original = same frame with the shader bypassed. Δ is the summed RGB difference; 0 means the look leaves pixels untouched.</p>
    </div>
  );
}
