import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Coins, RefreshCw, Swords } from 'lucide-react';
import type { CatalogGift, GiftCatalog, GiftSendData, LiveCommands, WalletInfo } from '../client/LiveCommands';
import { newIdempotencyKey } from '../client/LiveCommands';
import { describeLiveError, ErrorDescription } from '../client/errors';
import { Sheet } from './primitives';
import { InlineNotice } from './status';

const QUANTITIES = [1, 5, 10, 99];

type SendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'failed'; code: string; error: ErrorDescription }
  | { kind: 'sent'; data: GiftSendData; gift: CatalogGift; quantity: number };

export interface GiftTrayProps {
  open: boolean;
  onClose: () => void;
  commands: LiveCommands;
  liveId: string;
  /** Current battle in the room (server state). Sent as `expected_battle_id`. */
  battleId: string | null;
  battleScoring: boolean;
  recipientName: string;
}

/**
 * Gift tray. Catalog, prices and balance come from the server (`get_gift_catalog`,
 * `get_wallet`, `live_send_gift`). The client never computes what was charged or scored;
 * after a send it shows the server's answer (balance, battle outcome, message).
 */
export function GiftTray({ open, onClose, commands, liveId, battleId, battleScoring, recipientName }: GiftTrayProps) {
  const [catalog, setCatalog] = useState<GiftCatalog | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [send, setSend] = useState<SendState>({ kind: 'idle' });
  const lastAttempt = useRef<{ key: string; giftId: string; quantity: number; mode: 'auto' | 'outside_battle' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [c, w] = await Promise.all([commands.getCatalog(), commands.getWallet()]);
    setLoading(false);
    if (!c.ok) return setLoadError(describeLiveError(c.code, c.message));
    if (!w.ok) return setLoadError(describeLiveError(w.code, w.message));
    setCatalog(c.data);
    setWallet(w.data);
    setSelectedId((id) => id ?? c.data.gifts[0]?.id ?? null);
  }, [commands]);

  useEffect(() => {
    if (open) {
      setSend({ kind: 'idle' });
      void load();
    }
  }, [open, load]);

  const gift = useMemo(() => catalog?.gifts.find((g) => g.id === selectedId) ?? null, [catalog, selectedId]);
  const quantities = useMemo(() => QUANTITIES.filter((q) => q <= (catalog?.max_quantity ?? 1)), [catalog]);
  const displayTotal = gift ? gift.coin_cost * quantity : 0;
  const spendable = wallet?.spendable ?? 0;
  const short = !!wallet && !!gift && displayTotal > spendable;

  const doSend = async (mode: 'auto' | 'outside_battle', retrySameKey = false) => {
    if (!gift) return;
    const prev = lastAttempt.current;
    const key =
      retrySameKey && prev && prev.giftId === gift.id && prev.quantity === quantity && prev.mode === mode ? prev.key : newIdempotencyKey();
    lastAttempt.current = { key, giftId: gift.id, quantity, mode };
    setSend({ kind: 'sending' });
    const res = await commands.sendGift({
      liveId,
      giftId: gift.id,
      quantity,
      idempotencyKey: key,
      battleMode: mode,
      expectedBattleId: mode === 'auto' ? battleId : null,
    });
    if (res.ok) {
      setWallet((w) => (w ? { ...w, spendable: res.data.balance, [res.data.currency]: res.data.balance } : w));
      setSend({ kind: 'sent', data: res.data, gift, quantity });
      return;
    }
    setSend({ kind: 'failed', code: res.code, error: describeLiveError(res.code, res.message) });
    if (res.code === 'INSUFFICIENT_FUNDS') {
      const w = await commands.getWallet();
      if (w.ok) setWallet(w.data);
    }
  };

  const currencyLabel = wallet?.active_currency === 'test_coins' ? 'test coins' : 'coins';

  const footer = (
    <div className="plv-gift-foot">
      <div className="plv-wallet" aria-live="polite">
        <Coins size={16} aria-hidden="true" />
        {wallet ? (
          <span>
            <strong className="plv-num">{wallet.spendable.toLocaleString()}</strong> {currencyLabel}
          </span>
        ) : (
          <span>Balance unavailable</span>
        )}
        {wallet?.active_currency === 'test_coins' && <span className="plv-sim-tag">Test credits</span>}
      </div>
      <div className="plv-gift-qty" role="radiogroup" aria-label="Quantity">
        {quantities.map((q) => (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={quantity === q}
            className={`plv-qty ${quantity === q ? 'is-on' : ''}`}
            onClick={() => setQuantity(q)}
          >
            ×{q}
          </button>
        ))}
      </div>
      <button
        id="plv-gift-send"
        type="button"
        className="plv-btn plv-btn--iris plv-gift-send"
        disabled={!gift || send.kind === 'sending' || short || !!loadError}
        onClick={() => doSend('auto')}
      >
        {send.kind === 'sending'
          ? 'Sending…'
          : short
            ? 'Not enough coins'
            : gift
              ? `Send · ${displayTotal.toLocaleString()}`
              : 'Send'}
      </button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Send a gift"
      subtitle={`To ${recipientName}`}
      footer={catalog ? footer : undefined}
      id="plv-gift-tray"
      size="tall"
    >
      {battleScoring && (
        <p className="plv-gift-battle-note">
          <Swords size={14} aria-hidden="true" /> Battle is live — gifts count toward {recipientName}&rsquo;s score.
        </p>
      )}
      {loading && !catalog && <div className="plv-skeleton-grid" aria-label="Loading gifts" />}
      {loadError && (
        <InlineNotice
          error={loadError}
          actions={
            <button type="button" className="plv-link-btn" onClick={() => void load()}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </button>
          }
        />
      )}
      {catalog && (
        <div className="plv-gift-grid" role="radiogroup" aria-label="Gifts">
          {catalog.gifts.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={g.id === selectedId}
              className={`plv-gift plv-gift--${g.rarity} ${g.id === selectedId ? 'is-on' : ''}`}
              onClick={() => {
                setSelectedId(g.id);
                if (send.kind !== 'sending') setSend({ kind: 'idle' });
              }}
              data-gift-id={g.id}
            >
              <img src={g.icon_url} alt="" className="plv-gift-icon" loading="lazy" draggable={false} />
              <span className="plv-gift-name">{g.name}</span>
              <span className="plv-gift-cost">
                <Coins size={12} aria-hidden="true" />
                <span className="plv-num">{g.coin_cost.toLocaleString()}</span>
              </span>
              {g.rarity !== 'common' && <span className="plv-gift-rarity">{g.rarity}</span>}
            </button>
          ))}
        </div>
      )}

      {send.kind === 'sent' && <SentReceipt state={send} />}
      {send.kind === 'failed' && (
        <InlineNotice
          error={send.error}
          onDismiss={() => setSend({ kind: 'idle' })}
          actions={
            send.error.action === 'send_outside_battle' ? (
              <button type="button" className="plv-btn plv-btn--small plv-btn--iris" onClick={() => doSend('outside_battle')}>
                Send as LIVE gift
              </button>
            ) : send.error.action === 'retry' ? (
              <button type="button" className="plv-btn plv-btn--small plv-btn--ghost" onClick={() => doSend(lastAttempt.current?.mode ?? 'auto', true)}>
                Try again
              </button>
            ) : send.error.action === 'get_coins' ? (
              <span className="plv-notice-hint">
                {wallet?.purchases_enabled ? 'Top up your coins from your wallet.' : 'Coin purchases are not available in this environment.'}
              </span>
            ) : null
          }
        />
      )}
    </Sheet>
  );
}

function SentReceipt({ state }: { state: Extract<SendState, { kind: 'sent' }> }) {
  const { data, gift, quantity } = state;
  let detail: string;
  if (data.battle_outcome === 'counted') detail = `+${data.battle_points.toLocaleString()} battle points${data.multiplier > 1 ? ` (${data.multiplier}× bonus)` : ''}`;
  else if (data.battle_outcome === 'excluded') detail = data.message ?? 'Sent as a LIVE gift — it did not affect the battle score.';
  else detail = 'Thank you for supporting this LIVE.';
  return (
    <div className="plv-receipt" role="status">
      <span className="plv-receipt-check" aria-hidden="true">
        <Check size={16} />
      </span>
      <div>
        <strong>
          Sent {quantity > 1 ? `${quantity}× ` : ''}
          {gift.name}
        </strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}
