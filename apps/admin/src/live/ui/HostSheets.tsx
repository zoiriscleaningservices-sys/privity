import { useEffect, useState } from 'react';
import { Ban, Clock, Coins, Eye, MessageCircleOff, MessageCircle, Sparkles, Swords, Trash, UserX, Vibrate, Volume2, VolumeX, AlertCircle, CheckCircle2, Radio, RefreshCw, Zap } from 'lucide-react';
import type { BattleSnapshot, UserRef } from '../core/events';
import type { LiveComment } from '../client/commentStore';
import type { LiveCommands, WalletInfo } from '../client/LiveCommands';
import type { EffectPrefs } from '../show/effects';
import { ConfirmDialog, Sheet } from './primitives';
import { Avatar } from './Avatar';
import { Toggle } from './ViewerSheets';
import { formatDuration, useNow } from './hooks';
import { liveStreamSync } from '../../services/liveStreamSyncService';

/** Host moderation on a comment. Every action is a server RPC; the result is the server's. */
export function ModerationSheet({
  open,
  onClose,
  comment,
  busy,
  onDelete,
  onMute,
  onKick,
  onBlock,
}: {
  open: boolean;
  onClose: () => void;
  comment: LiveComment | null;
  busy: string | null;
  onDelete: () => void;
  onMute: (minutes: number) => void;
  onKick: () => void;
  onBlock: () => void;
}) {
  const [confirm, setConfirm] = useState<null | 'kick' | 'block'>(null);
  if (!comment) return null;
  const who = comment.author.display_name || `@${comment.author.handle}`;
  return (
    <>
      <Sheet open={open} onClose={onClose} title={who} subtitle={`@${comment.author.handle}`} size="compact" id="plv-moderation">
        <blockquote className="plv-quote">{comment.text}</blockquote>
        <div className="plv-menu">
          <button type="button" className="plv-menu-item" onClick={onDelete} disabled={!!busy} id="plv-mod-delete">
            <Trash size={18} aria-hidden="true" />
            <span>
              {busy === 'delete' ? 'Deleting…' : 'Delete comment'}
              <small>Removed for everyone.</small>
            </span>
          </button>
          <div className="plv-menu-item plv-menu-split">
            <VolumeX size={18} aria-hidden="true" />
            <span>
              Mute in this LIVE
              <small>They can watch but not comment.</small>
            </span>
            <div className="plv-chip-row">
              {[5, 30, 120].map((m) => (
                <button key={m} type="button" className="plv-chip-btn" onClick={() => onMute(m)} disabled={!!busy} id={`plv-mod-mute-${m}`}>
                  {m < 60 ? `${m} min` : `${m / 60} h`}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="plv-menu-item plv-menu-item--danger" onClick={() => setConfirm('kick')} disabled={!!busy}>
            <UserX size={18} aria-hidden="true" />
            <span>
              Remove from LIVE
              <small>They leave now and cannot rejoin this LIVE.</small>
            </span>
          </button>
          <button type="button" className="plv-menu-item plv-menu-item--danger" onClick={() => setConfirm('block')} disabled={!!busy}>
            <Ban size={18} aria-hidden="true" />
            <span>
              Block account
              <small>Blocks them across Privity.</small>
            </span>
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'kick' ? `Remove ${who} from this LIVE?` : `Block ${who}?`}
        body={confirm === 'kick' ? 'They will be disconnected and cannot come back during this LIVE.' : 'They will not be able to find you or interact with you.'}
        confirmLabel={confirm === 'kick' ? 'Remove' : 'Block'}
        busy={busy === 'kick' || busy === 'block'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm === 'kick') onKick();
          else onBlock();
          setConfirm(null);
        }}
      />
    </>
  );
}

/** LIVE info + settings. Earnings come from the server wallet, never computed here. */
export function HostSettingsSheet({
  open,
  onClose,
  commands,
  title,
  startedAt,
  viewers,
  peakViewers,
  commentsEnabled,
  onToggleComments,
  togglingComments,
  prefs,
  onPrefs,
  battle,
}: {
  open: boolean;
  onClose: () => void;
  commands: LiveCommands;
  title: string;
  startedAt: number | null;
  viewers: number;
  peakViewers: number;
  commentsEnabled: boolean;
  onToggleComments: (enabled: boolean) => void;
  togglingComments: boolean;
  prefs: EffectPrefs;
  onPrefs: (p: Partial<EffectPrefs>) => void;
  /** Present only while a battle can still be forfeited (server decides the outcome). */
  battle?: { busy: boolean; onForfeit: () => void } | null;
}) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [walletError, setWalletError] = useState(false);
  const now = useNow(1000, open);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void commands.getWallet().then((w) => {
      if (!alive) return;
      if (w.ok) setWallet(w.data);
      else setWalletError(true);
    });
    return () => {
      alive = false;
    };
  }, [open, commands]);

  return (
    <Sheet open={open} onClose={onClose} title="LIVE settings" subtitle={title} size="tall" id="plv-host-settings">
      <div className="plv-stats-grid">
        <div className="plv-stat">
          <Clock size={16} aria-hidden="true" />
          <span className="plv-stat-value plv-num">{startedAt ? formatDuration(now - startedAt) : '—'}</span>
          <span className="plv-stat-label">Live for</span>
        </div>
        <div className="plv-stat">
          <Eye size={16} aria-hidden="true" />
          <span className="plv-stat-value plv-num">{viewers.toLocaleString()}</span>
          <span className="plv-stat-label">Watching · peak {peakViewers.toLocaleString()}</span>
        </div>
        <div className="plv-stat">
          <Coins size={16} aria-hidden="true" />
          <span className="plv-stat-value plv-num">{wallet ? wallet.earnings.toLocaleString() : walletError ? 'Unavailable' : '…'}</span>
          <span className="plv-stat-label">Total earnings (wallet)</span>
        </div>
      </div>
      <h3 className="plv-sheet-section">Chat</h3>
      <div className="plv-menu">
        <Toggle
          id="plv-toggle-comments"
          icon={commentsEnabled ? <MessageCircle size={18} /> : <MessageCircleOff size={18} />}
          label="Allow comments"
          hint={togglingComments ? 'Updating…' : commentsEnabled ? 'Viewers can comment.' : 'Only you can see the chat history.'}
          checked={commentsEnabled}
          onChange={(v) => !togglingComments && onToggleComments(v)}
        />
      </div>
      <h3 className="plv-sheet-section">Effects on this device</h3>
      <div className="plv-menu">
        <Toggle icon={<Volume2 size={18} />} label="Sounds" checked={prefs.sound} onChange={(v) => onPrefs({ sound: v })} />
        <Toggle icon={<Vibrate size={18} />} label="Vibration" checked={prefs.haptics} onChange={(v) => onPrefs({ haptics: v })} />
        <Toggle icon={<Sparkles size={18} />} label="Reduce motion" checked={prefs.reducedMotion} onChange={(v) => onPrefs({ reducedMotion: v })} />
      </div>
      {battle && (
        <>
          <h3 className="plv-sheet-section">Battle</h3>
          <div className="plv-menu">
            <button
              type="button"
              className="plv-menu-item plv-menu-item--danger"
              onClick={() => setConfirmForfeit(true)}
              disabled={battle.busy}
              id="plv-battle-forfeit"
            >
              <Swords size={18} aria-hidden="true" />
              <span>
                {battle.busy ? 'Forfeiting…' : 'Forfeit battle'}
                <small>Ends the battle now. The server records the result.</small>
              </span>
            </button>
          </div>
          <ConfirmDialog
            open={confirmForfeit}
            title="Forfeit this battle?"
            body="The server ends the battle now and your opponent is declared the winner."
            confirmLabel="Forfeit"
            busy={battle.busy}
            onCancel={() => setConfirmForfeit(false)}
            onConfirm={() => {
              battle.onForfeit();
              setConfirmForfeit(false);
            }}
          />
        </>
      )}
    </Sheet>
  );
}

/** Incoming battle invitation for the host (BATTLE_INVITED). Expiry is the server's. */
export function BattleInviteCard({
  battle,
  from,
  busy,
  error,
  onRespond,
}: {
  battle: BattleSnapshot;
  from: UserRef;
  busy: boolean;
  error: string | null;
  onRespond: (accept: boolean) => void;
}) {
  const now = useNow(500);
  const expires = battle.invite_expires_at ? Date.parse(battle.invite_expires_at) : null;
  const left = expires ? Math.max(0, Math.ceil((expires - now) / 1000)) : null;
  return (
    <section className="plv-invite" role="alertdialog" aria-labelledby="plv-invite-title" aria-describedby="plv-invite-body">
      <div className="plv-invite-head">
        <Swords size={18} aria-hidden="true" />
        <h2 id="plv-invite-title">Battle invite</h2>
        {left !== null && <span className="plv-invite-timer plv-num" aria-label={`${left} seconds to answer`}>{left}s</span>}
      </div>
      <div className="plv-invite-body" id="plv-invite-body">
        <Avatar user={from} size={48} ring="b" decorative />
        <p>
          <strong>{from.display_name || `@${from.handle}`}</strong> wants to battle you.
        </p>
      </div>
      {error && <p className="plv-help plv-help--warn">{error}</p>}
      <div className="plv-sheet-actions">
        <button type="button" className="plv-btn plv-btn--ghost" onClick={() => onRespond(false)} disabled={busy} id="plv-battle-decline">
          Decline
        </button>
        <button type="button" className="plv-btn plv-btn--iris" onClick={() => onRespond(true)} disabled={busy || left === 0} id="plv-battle-accept">
          {busy ? 'Answering…' : 'Accept battle'}
        </button>
      </div>
    </section>
  );
}

/** Outgoing battle invitation sent by the host (waiting for opponent to respond). */
export function BattleOutgoingCard({
  battle,
  target,
  busy,
  onCancel,
}: {
  battle: BattleSnapshot;
  target: UserRef;
  busy: boolean;
  onCancel: () => void;
}) {
  const now = useNow(500);
  const expires = battle.invite_expires_at ? Date.parse(battle.invite_expires_at) : null;
  const left = expires ? Math.max(0, Math.ceil((expires - now) / 1000)) : null;
  return (
    <section className="plv-invite plv-invite--outgoing" role="status" aria-labelledby="plv-outgoing-title" aria-describedby="plv-outgoing-body">
      <div className="plv-invite-head">
        <Swords size={18} className="plv-spin" aria-hidden="true" />
        <h2 id="plv-outgoing-title">Battle invitation sent</h2>
        {left !== null && <span className="plv-invite-timer plv-num" aria-label={`${left} seconds remaining`}>{left}s</span>}
      </div>
      <div className="plv-invite-body" id="plv-outgoing-body">
        <Avatar user={target} size={48} ring="b" decorative />
        <p>
          Waiting for <strong>{target.display_name || `@${target.handle}`}</strong> to accept…
        </p>
      </div>
      <div className="plv-sheet-actions">
        <button type="button" className="plv-btn plv-btn--ghost" onClick={onCancel} disabled={busy} id="plv-battle-cancel-invite">
          {busy ? 'Cancelling…' : 'Cancel invitation'}
        </button>
      </div>
    </section>
  );
}

/**
 * Authoritative PK Battle Matchmaker Sheet.
 * Manages explicit matching states: IDLE, SEARCHING, MATCH_FOUND, CONNECTING, CONNECTED, FAILED, CANCELLED, ENDED.
 * Strictly verifies real eligible broadcasters — NEVER creates fabricated or phantom participants!
 */
export function BattleMatchmakerSheet({
  open,
  onClose,
  commands,
  currentHost,
  onStartBattle,
}: {
  open: boolean;
  onClose: () => void;
  commands: LiveCommands;
  currentHost: UserRef;
  onStartBattle?: (opponent: UserRef) => void;
}) {
  const [matchState, setMatchState] = useState<'IDLE' | 'SEARCHING' | 'MATCH_FOUND' | 'CONNECTING' | 'CONNECTED' | 'FAILED' | 'CANCELLED' | 'ENDED'>('IDLE');
  const [candidate, setCandidate] = useState<UserRef | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeStreamers, setActiveStreamers] = useState(() =>
    liveStreamSync.getStreamersList().filter((s) => {
      const h = (s.creatorHandle || s.handle || '').toLowerCase().replace('@', '').trim();
      const meH = (currentHost.handle || '').toLowerCase().replace('@', '').trim();
      return !s.isHost && s.isLive !== false && h !== meH && !liveStreamSync.isStreamEnded(s.id, s.handle, s.startedAt);
    })
  );

  useEffect(() => {
    if (!open) {
      setMatchState('IDLE');
      setCandidate(null);
      setErrorMessage(null);
      return;
    }
    liveStreamSync.queryNetworkStreams();
    const unsub = liveStreamSync.subscribeToActiveStreams((streams) => {
      const eligible = streams.filter((s) => {
        const h = (s.creatorHandle || s.handle || '').toLowerCase().replace('@', '').trim();
        const meH = (currentHost.handle || '').toLowerCase().replace('@', '').trim();
        return !s.isHost && s.isLive !== false && h !== meH && !liveStreamSync.isStreamEnded(s.id, s.handle, s.startedAt);
      });
      setActiveStreamers(eligible);
    });
    return unsub;
  }, [open, currentHost.handle]);

  const startSearching = () => {
    setMatchState('SEARCHING');
    setCandidate(null);
    setErrorMessage(null);
    liveStreamSync.queryNetworkStreams();

    setTimeout(() => {
      const eligible = liveStreamSync.getStreamersList().filter((s) => {
        const h = (s.creatorHandle || s.handle || '').toLowerCase().replace('@', '').trim();
        const meH = (currentHost.handle || '').toLowerCase().replace('@', '').trim();
        return !s.isHost && s.isLive !== false && h !== meH && !liveStreamSync.isStreamEnded(s.id, s.handle, s.startedAt);
      });
      if (eligible.length > 0) {
        const selected = eligible[Math.floor(Math.random() * eligible.length)];
        const opp: UserRef = {
          id: selected.id,
          handle: (selected.creatorHandle || selected.handle || '').replace('@', '').trim(),
          display_name: selected.name?.replace(' (LIVE NOW 🔴)', '') || selected.handle,
          avatar_url: selected.avatar || null,
        };
        setCandidate(opp);
        setMatchState('MATCH_FOUND');
      } else {
        setMatchState('FAILED');
        setErrorMessage('No other creators are currently live for matchmaking. Other creators must be actively broadcasting to match.');
      }
    }, 1500);
  };

  const handleSelectCreator = (s: any) => {
    const opp: UserRef = {
      id: s.id,
      handle: (s.creatorHandle || s.handle || '').replace('@', '').trim(),
      display_name: s.name?.replace(' (LIVE NOW 🔴)', '') || s.handle,
      avatar_url: s.avatar || null,
    };
    setCandidate(opp);
    setMatchState('MATCH_FOUND');
  };

  const handleSendInvite = async () => {
    if (!candidate) return;
    setMatchState('CONNECTING');
    setErrorMessage(null);

    try {
      if (commands.battleInvite) {
        await commands.battleInvite(candidate);
      } else if (commands.startBattle) {
        await commands.startBattle('classic_double', candidate);
      }
      if (onStartBattle) onStartBattle(candidate);

      const timeoutTimer = setTimeout(() => {
        setMatchState('FAILED');
        setErrorMessage('Connection timed out. Broadcast media was not established.');
      }, 15000);

      const unsub = liveStreamSync.subscribeToRoom(candidate.handle, (evt) => {
        if (evt.type === 'BATTLE_CANCELLED') {
          clearTimeout(timeoutTimer);
          setMatchState('FAILED');
          setErrorMessage('The opponent declined the battle invitation or disconnected.');
        } else if (evt.type === 'BATTLE_ACCEPTED' || evt.type === 'PK_BATTLE_START') {
          clearTimeout(timeoutTimer);
          setMatchState('CONNECTED');
          setTimeout(() => onClose(), 800);
        }
      });

      return () => {
        clearTimeout(timeoutTimer);
        unsub();
      };
    } catch (e: any) {
      setMatchState('FAILED');
      setErrorMessage(e?.message || 'Failed to initiate matchmaking.');
    }
  };

  const handleCancel = () => {
    setMatchState('CANCELLED');
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={handleCancel}
      title="PK Battle Matchmaking"
      subtitle={
        matchState === 'SEARCHING'
          ? 'Scanning live network for available creators…'
          : matchState === 'CONNECTING'
          ? 'Establishing peer connection…'
          : 'Real-time creator versus duels'
      }
      size="auto"
      id="plv-matchmaker"
    >
      {/* 1. IDLE STATE */}
      {matchState === 'IDLE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            <Zap size={24} style={{ color: '#818cf8', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff' }}>Quick Match Radar</div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>Instantly match with an active live creator</div>
            </div>
            <button type="button" className="plv-btn plv-btn--iris" onClick={startSearching} id="plv-quick-match" style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px' }}>
              ⚡ Match Now
            </button>
          </div>

          <div>
            <h3 className="plv-sheet-section" style={{ margin: '0 0 10px 0' }}>
              Available Live Creators ({activeStreamers.length})
            </h3>
            {activeStreamers.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <Radio size={28} style={{ color: 'rgba(255, 255, 255, 0.4)', margin: '0 auto 8px auto', display: 'block' }} />
                <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>No other creators live right now</p>
                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Start broadcasting on a second device or tap Match Now to refresh active broadcasts.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeStreamers.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectCreator(s)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    <Avatar user={{ id: s.id, handle: s.creatorHandle || s.handle, display_name: s.name, avatar_url: s.avatar || null }} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name?.replace(' (LIVE NOW 🔴)', '')}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                        @{s.creatorHandle || s.handle} · {s.viewersCount || 1} watching
                      </div>
                    </div>
                    <button type="button" className="plv-btn plv-btn--ghost" style={{ minHeight: '32px', padding: '0 12px', fontSize: '12px' }}>
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SEARCHING STATE */}
      {matchState === 'SEARCHING' && (
        <div style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', border: '2px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 1.5s linear infinite' }}>
            <Swords size={28} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>Searching for eligible creators…</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>Scanning active live nodes on the network</p>
          </div>
          <button type="button" className="plv-btn plv-btn--ghost" onClick={() => setMatchState('IDLE')}>
            Cancel Search
          </button>
        </div>
      )}

      {/* 3. MATCH_FOUND STATE */}
      {matchState === 'MATCH_FOUND' && candidate && (
        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '18px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
            <Avatar user={candidate} size={54} ring="b" decorative />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <CheckCircle2 size={13} /> Opponent Confirmed
              </div>
              <div style={{ fontWeight: 800, fontSize: '17px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {candidate.display_name}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                @{candidate.handle}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button type="button" className="plv-btn plv-btn--iris" onClick={handleSendInvite} id="plv-confirm-battle">
              <Swords size={18} /> Send Battle Challenge
            </button>
            <button type="button" className="plv-btn plv-btn--ghost" onClick={() => setMatchState('IDLE')}>
              Choose Different Creator
            </button>
          </div>
        </div>
      )}

      {/* 4. CONNECTING STATE */}
      {matchState === 'CONNECTING' && candidate && (
        <div style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid rgba(255, 255, 255, 0.15)', borderTopColor: '#818cf8', animation: 'spin 0.8s linear infinite' }} />
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
              Connecting to broadcast…
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
              Waiting for @{candidate.handle} to accept and establish WebRTC media
            </p>
          </div>
          <button type="button" className="plv-btn plv-btn--ghost" onClick={handleCancel}>
            Cancel Invitation
          </button>
        </div>
      )}

      {/* 5. CONNECTED STATE */}
      {matchState === 'CONNECTED' && (
        <div style={{ padding: '36px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <CheckCircle2 size={42} style={{ color: '#34d399' }} />
          <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>Battle Connected!</h4>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>Dual camera stage starting now…</p>
        </div>
      )}

      {/* 6. FAILED STATE */}
      {matchState === 'FAILED' && (
        <div style={{ padding: '24px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AlertCircle size={38} style={{ color: '#f87171' }} />
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#fff' }}>Matchmaking Unavailable</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
              {errorMessage || 'Unable to connect to a live opponent at this time.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
            <button type="button" className="plv-btn plv-btn--iris" onClick={startSearching}>
              <RefreshCw size={15} /> Try Again
            </button>
            <button type="button" className="plv-btn plv-btn--ghost" onClick={handleCancel}>
              Close
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
