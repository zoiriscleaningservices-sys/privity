import { useEffect, useState } from 'react';
import { Ban, Clock, Coins, Eye, MessageCircleOff, MessageCircle, Sparkles, Swords, Trash, UserX, Vibrate, Volume2, VolumeX } from 'lucide-react';
import type { BattleSnapshot, UserRef } from '../core/events';
import type { LiveComment } from '../client/commentStore';
import type { LiveCommands, WalletInfo } from '../client/LiveCommands';
import type { EffectPrefs } from '../show/effects';
import { ConfirmDialog, Sheet } from './primitives';
import { Avatar } from './Avatar';
import { Toggle } from './ViewerSheets';
import { formatDuration, useNow } from './hooks';

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
