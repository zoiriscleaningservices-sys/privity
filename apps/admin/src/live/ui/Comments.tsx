import { FormEvent, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Send } from 'lucide-react';
import type { LiveComment } from '../client/commentStore';
import type { ShowChatLine } from '../show/types';
import { describeLiveError, ErrorDescription } from '../client/errors';
import { Avatar } from './Avatar';

/** At most this many rows are in the DOM, whatever the chat rate. */
const RENDER_LIMIT = 60;

type Row =
  | { kind: 'comment'; key: string; at: number; c: LiveComment }
  | { kind: 'event'; key: string; at: number; line: ShowChatLine };

export interface CommentListProps {
  comments: ReadonlyArray<LiveComment>;
  events: ReadonlyArray<ShowChatLine>;
  hostId: string;
  meId: string | null;
  hiddenAuthors?: ReadonlySet<string>;
  /** Tap on a comment (moderation for the host, profile actions for viewers). */
  onSelect?: (c: LiveComment) => void;
  variant?: 'overlay' | 'panel';
  label?: string;
}

/**
 * Comment stream. Newest at the bottom, sticks to the bottom unless the reader scrolls up
 * (then a "new messages" pill appears). Bounded DOM, faded top edge in overlay mode.
 */
export const CommentList = memo(function CommentList({
  comments,
  events,
  hostId,
  meId,
  hiddenAuthors,
  onSelect,
  variant = 'overlay',
  label = 'Comments',
}: CommentListProps) {
  const rows = useMemo<Row[]>(() => {
    const merged: Row[] = [];
    for (const c of comments) {
      if (hiddenAuthors?.has(c.author.id)) continue;
      merged.push({ kind: 'comment', key: `c:${c.id}`, at: c.createdAt, c });
    }
    for (const line of events) merged.push({ kind: 'event', key: `e:${line.id}`, at: line.created_at, line });
    merged.sort((a, b) => a.at - b.at);
    return merged.slice(-RENDER_LIMIT);
  }, [comments, events, hiddenAuthors]);

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const [unseen, setUnseen] = useState(0);
  const lastKey = rows.length ? rows[rows.length - 1].key : '';
  const prevLast = useRef(lastKey);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || lastKey === prevLast.current) return;
    prevLast.current = lastKey;
    if (pinned.current) el.scrollTop = el.scrollHeight;
    else setUnseen((n) => n + 1);
  }, [lastKey]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    pinned.current = atBottom;
    if (atBottom && unseen) setUnseen(0);
  };

  const jump = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    pinned.current = true;
    setUnseen(0);
  };

  return (
    <div className={`plv-comments plv-comments--${variant}`}>
      <div ref={scroller} className="plv-comments-scroll" onScroll={onScroll} role="log" aria-label={label} aria-live="off" tabIndex={0}>
        {rows.length === 0 && <p className="plv-comments-empty">{variant === 'panel' ? 'No comments yet. They will appear here.' : 'Say hi to start the chat.'}</p>}
        {rows.map((r) =>
          r.kind === 'comment' ? (
            <CommentRow key={r.key} c={r.c} isHost={r.c.author.id === hostId} isMe={r.c.author.id === meId} onSelect={onSelect} />
          ) : (
            <div key={r.key} className={`plv-chat-event plv-chat-event--${r.line.tone}`}>
              {r.line.text}
            </div>
          ),
        )}
      </div>
      {unseen > 0 && (
        <button type="button" className="plv-comments-new" onClick={jump}>
          <ArrowDown size={14} aria-hidden="true" /> {unseen > 9 ? '9+' : unseen} new
        </button>
      )}
    </div>
  );
});

const CommentRow = memo(function CommentRow({
  c,
  isHost,
  isMe,
  onSelect,
}: {
  c: LiveComment;
  isHost: boolean;
  isMe: boolean;
  onSelect?: (c: LiveComment) => void;
}) {
  const name = c.author.display_name || c.author.handle;
  const content = (
    <>
      <Avatar user={c.author} size={26} decorative />
      <span className="plv-comment-text">
        <span className="plv-comment-author">
          {name}
          {isHost && <span className="plv-role-tag">Host</span>}
          {isMe && !isHost && <span className="plv-role-tag plv-role-tag--me">You</span>}
        </span>
        <span className="plv-comment-body">{c.text}</span>
      </span>
    </>
  );
  return onSelect ? (
    <button type="button" className="plv-comment" onClick={() => onSelect(c)} aria-label={`${name}: ${c.text}. Options`}>
      {content}
    </button>
  ) : (
    <div className="plv-comment">{content}</div>
  );
});

/**
 * Comment composer. Sends through LiveCommands; the comment appears in the list only when the
 * server's COMMENT_CREATED event arrives. Errors say what happened and what to do next.
 */
export function CommentComposer({
  send,
  disabledReason,
  placeholder = 'Add a comment…',
  id = 'plv-comment-input',
  onFocusChange,
}: {
  send: (text: string) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  disabledReason?: string | null;
  placeholder?: string;
  id?: string;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const max = 300;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy || disabledReason) return;
    setBusy(true);
    setError(null);
    const res = await send(value);
    setBusy(false);
    if (res.ok) setText('');
    else setError(describeLiveError(res.code, res.message));
  };

  return (
    <form className="plv-composer" onSubmit={submit}>
      {error && (
        <div className="plv-composer-error" role="alert">
          <strong>{error.title}.</strong> {error.body}
          <button type="button" className="plv-link-btn" onClick={() => setError(null)}>
            OK
          </button>
        </div>
      )}
      <div className={`plv-composer-field ${disabledReason ? 'is-disabled' : ''}`}>
        <label htmlFor={id} className="plv-visually-hidden">
          Comment
        </label>
        <input
          id={id}
          className="plv-composer-input"
          value={text}
          maxLength={max}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabledReason ?? placeholder}
          disabled={!!disabledReason}
          enterKeyHint="send"
          autoComplete="off"
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
        />
        {text.length > max - 40 && (
          <span className="plv-composer-count" aria-live="polite">
            {max - text.length}
          </span>
        )}
        <button
          type="submit"
          className="plv-composer-send"
          aria-label="Send comment"
          disabled={!text.trim() || busy || !!disabledReason}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
