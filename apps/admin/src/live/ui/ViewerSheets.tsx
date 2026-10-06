import { ReactNode, useState } from 'react';
import { Ban, Check, Copy, Crown, EyeOff, Hand, Share2, Sparkles, Vibrate, Volume2, X } from 'lucide-react';
import type { SupporterEntry, UserRef } from '../core/events';
import type { EffectPrefs } from '../show/effects';
import { Sheet } from './primitives';
import { Avatar } from './Avatar';

/** Share: the platform share sheet when available, otherwise copy the link. */
export function ShareSheet({ open, onClose, url, title }: { open: boolean; onClose: () => void; url: string; title: string }) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Share this LIVE" size="compact" id="plv-share-sheet">
      <div className="plv-share-link">
        <span className="plv-share-url" title={url}>
          {url}
        </span>
      </div>
      <div className="plv-sheet-actions">
        {canNativeShare && (
          <button
            type="button"
            className="plv-btn plv-btn--iris"
            onClick={() => {
              void navigator.share({ title, url }).then(onClose, () => undefined);
            }}
          >
            <Share2 size={16} aria-hidden="true" /> Share…
          </button>
        )}
        <button type="button" className="plv-btn plv-btn--ghost" onClick={() => void copy()} id="plv-share-copy">
          {copied === 'ok' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied === 'ok' ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      {copied === 'failed' && <p className="plv-help">Copying is blocked in this browser. Select the link above and copy it manually.</p>}
    </Sheet>
  );
}

export function SupportersSheet({ open, onClose, supporters }: { open: boolean; onClose: () => void; supporters: ReadonlyArray<SupporterEntry> }) {
  return (
    <Sheet open={open} onClose={onClose} title="Top supporters" subtitle="This LIVE" size="compact" id="plv-supporters-sheet">
      {supporters.length === 0 ? (
        <p className="plv-help">No gifts yet. Supporters appear here when gifts arrive.</p>
      ) : (
        <ol className="plv-supporter-list">
          {supporters.map((s, i) => (
            <li key={s.user.id} className="plv-supporter-row">
              <span className={`plv-rank plv-rank--${i + 1}`}>{i === 0 ? <Crown size={14} aria-label="Top supporter" /> : i + 1}</span>
              <Avatar user={s.user} size={36} decorative />
              <span className="plv-supporter-name">
                {s.user.display_name || s.user.handle}
                <span className="plv-supporter-handle">@{s.user.handle}</span>
              </span>
              <span className="plv-num plv-supporter-total">{s.total.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

export type GuestRequestUi = 'none' | 'requested' | 'accepted' | 'busy';

export function ViewerMoreSheet({
  open,
  onClose,
  guestState,
  onRequestJoin,
  onCancelRequest,
  prefs,
  onPrefs,
  canRequest,
  requestHint,
}: {
  open: boolean;
  onClose: () => void;
  guestState: GuestRequestUi;
  onRequestJoin: () => void;
  onCancelRequest: () => void;
  prefs: EffectPrefs;
  onPrefs: (p: Partial<EffectPrefs>) => void;
  canRequest: boolean;
  requestHint: string | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="More" size="compact" id="plv-viewer-more">
      <div className="plv-menu">
        {guestState === 'requested' ? (
          <button type="button" className="plv-menu-item" onClick={onCancelRequest} id="plv-cancel-request">
            <X size={18} aria-hidden="true" />
            <span>
              Cancel request to join
              <small>The host has not answered yet.</small>
            </span>
          </button>
        ) : guestState === 'accepted' ? null : (
          <button
            type="button"
            className="plv-menu-item"
            onClick={onRequestJoin}
            disabled={!canRequest || guestState === 'busy'}
            id="plv-request-join"
          >
            <Hand size={18} aria-hidden="true" />
            <span>
              Request to join the stage
              <small>{requestHint ?? 'The host decides. Your camera and mic start only if accepted.'}</small>
            </span>
          </button>
        )}
      </div>
      <h3 className="plv-sheet-section">Effects on this device</h3>
      <div className="plv-menu">
        <Toggle icon={<Volume2 size={18} />} label="Sounds" checked={prefs.sound} onChange={(v) => onPrefs({ sound: v })} />
        <Toggle icon={<Vibrate size={18} />} label="Vibration" checked={prefs.haptics} onChange={(v) => onPrefs({ haptics: v })} />
        <Toggle icon={<Sparkles size={18} />} label="Reduce motion" checked={prefs.reducedMotion} onChange={(v) => onPrefs({ reducedMotion: v })} />
      </div>
    </Sheet>
  );
}

export function Toggle({ icon, label, checked, onChange, hint, id }: { icon: ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; id?: string }) {
  return (
    <label className="plv-menu-item plv-toggle-row" htmlFor={id}>
      <span aria-hidden="true">{icon}</span>
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input id={id} type="checkbox" role="switch" className="plv-switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Viewer's options on someone else's comment: local hide + server block. */
export function CommentActionsSheet({
  open,
  onClose,
  author,
  hidden,
  onToggleHide,
  onBlock,
  blocking,
}: {
  open: boolean;
  onClose: () => void;
  author: UserRef | null;
  hidden: boolean;
  onToggleHide: () => void;
  onBlock: () => void;
  blocking: boolean;
}) {
  if (!author) return null;
  return (
    <Sheet open={open} onClose={onClose} title={author.display_name || `@${author.handle}`} subtitle={`@${author.handle}`} size="compact" id="plv-comment-actions">
      <div className="plv-menu">
        <button type="button" className="plv-menu-item" onClick={onToggleHide}>
          <EyeOff size={18} aria-hidden="true" />
          <span>
            {hidden ? 'Show their comments' : 'Hide their comments'}
            <small>Only on your screen. They are not notified.</small>
          </span>
        </button>
        <button type="button" className="plv-menu-item plv-menu-item--danger" onClick={onBlock} disabled={blocking}>
          <Ban size={18} aria-hidden="true" />
          <span>
            {blocking ? 'Blocking…' : 'Block account'}
            <small>You will no longer see each other on Privity.</small>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
