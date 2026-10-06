import { ReactNode, memo, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Eye, RefreshCw, Signal, SignalHigh, SignalLow, SignalMedium, WifiOff } from 'lucide-react';
import type { ConnectionState } from '../client/connection';
import type { ErrorDescription } from '../client/errors';
import { formatCount, formatDuration, useNow } from './hooks';

/** LIVE pill with an elapsed clock derived from the server's started_at. */
export const LiveBadge = memo(function LiveBadge({ startedAt, ended }: { startedAt: number | null; ended?: boolean }) {
  const now = useNow(1000, !ended && startedAt !== null);
  return (
    <span className={`plv-live-badge ${ended ? 'is-ended' : ''}`}>
      <span className="plv-live-dot" aria-hidden="true" />
      <span className="plv-live-word">{ended ? 'Ended' : 'LIVE'}</span>
      {startedAt !== null && !ended && (
        <span className="plv-live-clock" aria-label={`Live for ${formatDuration(now - startedAt)}`}>
          {formatDuration(now - startedAt)}
        </span>
      )}
    </span>
  );
});

export const ViewerCount = memo(function ViewerCount({ count }: { count: number }) {
  return (
    <span className="plv-chip" aria-label={`${count} watching`}>
      <Eye size={14} aria-hidden="true" />
      <span className="plv-num">{formatCount(count)}</span>
    </span>
  );
});

const QUALITY_TEXT = { excellent: 'Excellent', good: 'Good', weak: 'Weak' } as const;

/**
 * Connection status. The realtime link state is real. Media quality is shown only when a
 * telemetry source exists (Stage 4: WebRTC stats); Lab-injected values are labelled "Simulated".
 */
export const ConnectionIndicator = memo(function ConnectionIndicator({
  connection,
  compact,
}: {
  connection: ConnectionState;
  compact?: boolean;
}) {
  const { link, quality, source } = connection;
  if (link === 'reconnecting' || link === 'connecting') {
    return (
      <span className="plv-conn plv-conn--warn" role="status">
        <RefreshCw size={14} className="plv-spin" aria-hidden="true" />
        <span>{link === 'connecting' ? 'Connecting' : 'Reconnecting'}</span>
      </span>
    );
  }
  if (link === 'disconnected') {
    return (
      <span className="plv-conn plv-conn--bad" role="status">
        <WifiOff size={14} aria-hidden="true" />
        <span>Offline</span>
      </span>
    );
  }
  if (source === 'none' || quality === 'unknown') {
    // Real link, no media telemetry yet: say only what we know.
    return compact ? null : (
      <span className="plv-conn" title="Realtime connection is up. Video quality data is not available yet.">
        <Signal size={14} aria-hidden="true" />
        <span>Connected</span>
      </span>
    );
  }
  const Icon = quality === 'excellent' ? SignalHigh : quality === 'good' ? SignalMedium : SignalLow;
  const tone = quality === 'weak' ? 'plv-conn--warn' : '';
  const detail = [
    connection.rttMs != null ? `${Math.round(connection.rttMs)} ms` : null,
    connection.packetLossPct != null ? `${connection.packetLossPct.toFixed(1)}% loss` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className={`plv-conn ${tone}`} title={detail || undefined} aria-label={`Connection ${QUALITY_TEXT[quality]}${source === 'simulated' ? ' (simulated)' : ''}`}>
      <Icon size={14} aria-hidden="true" />
      <span>{QUALITY_TEXT[quality]}</span>
      {source === 'simulated' && <span className="plv-sim-tag">Sim</span>}
    </span>
  );
});

/** Full-screen state: what happened + what to do next. */
export function StateScreen({
  icon,
  title,
  body,
  primary,
  secondary,
  tone = 'neutral',
}: {
  icon?: ReactNode;
  title: string;
  body: ReactNode;
  primary?: { label: string; onClick: () => void; id?: string };
  secondary?: { label: string; onClick: () => void; id?: string };
  tone?: 'neutral' | 'warn' | 'bad';
}) {
  return (
    <div className={`plv-state plv-state--${tone}`} role="alert">
      <div className="plv-state-icon" aria-hidden="true">
        {icon ?? <AlertTriangle size={28} />}
      </div>
      <h2 className="plv-state-title">{title}</h2>
      <div className="plv-state-body">{body}</div>
      {(primary || secondary) && (
        <div className="plv-state-actions">
          {primary && (
            <button id={primary.id} type="button" className="plv-btn plv-btn--iris" onClick={primary.onClick}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button id={secondary.id} type="button" className="plv-btn plv-btn--ghost" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline error card used inside sheets and composers. */
export function InlineNotice({
  error,
  actions,
  onDismiss,
}: {
  error: ErrorDescription;
  actions?: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="plv-notice" role="alert">
      <AlertTriangle size={18} className="plv-notice-icon" aria-hidden="true" />
      <div className="plv-notice-text">
        <strong>{error.title}</strong>
        <span>{error.body}</span>
        {(actions || onDismiss) && (
          <div className="plv-notice-actions">
            {actions}
            {onDismiss && (
              <button type="button" className="plv-link-btn" onClick={onDismiss}>
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn';
}

/** Short-lived, non-blocking feedback for the person's own actions (not show moments). */
export function useToasts(ttlMs = 3200) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = timers.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);
  const push = useCallback(
    (text: string, tone: ToastItem['tone'] = 'info') => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-2), { id, text, tone }]);
      const t = setTimeout(() => {
        timers.current.delete(t);
        setItems((list) => list.filter((i) => i.id !== id));
      }, ttlMs);
      timers.current.add(t);
    },
    [ttlMs],
  );
  return { items, push };
}

export function ToastStack({ items }: { items: ReadonlyArray<ToastItem> }) {
  return (
    <div className="plv-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`plv-toast plv-toast--${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
