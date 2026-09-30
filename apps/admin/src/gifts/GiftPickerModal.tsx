import React, { useState, useMemo } from 'react';
import { Gift } from './types';
import { DEFAULT_GIFTS } from './defaultGifts';

export interface GiftPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  streamerName: string;
  onSendGift: (gift: Gift, quantity: number) => Promise<boolean | void>;
  onTopUpCoins?: () => void;
  catalog?: Gift[];
}

export const GiftPickerModal: React.FC<GiftPickerModalProps> = ({
  isOpen,
  onClose,
  userCoins,
  streamerName,
  onSendGift,
  onTopUpCoins,
  catalog = DEFAULT_GIFTS,
}) => {
  const [selectedGiftId, setSelectedGiftId] = useState<string>(catalog[0]?.id || 'rose');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSending, setIsSending] = useState<boolean>(false);

  const categories: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'All Gifts' },
    { id: 'love', label: 'Love ❤️' },
    { id: 'premium', label: 'Premium 🌌' },
    { id: 'fantasy', label: 'Fantasy 🐉' },
    { id: 'fun', label: 'Fun 🦟' },
  ];

  const filteredGifts: Gift[] = useMemo(() => {
    return catalog.filter((g: Gift) => {
      if (!g.enabled) return false;
      if (selectedCategory === 'all') return true;
      return g.category === selectedCategory;
    });
  }, [catalog, selectedCategory]);

  const selectedGift: Gift | undefined = useMemo(() => {
    return catalog.find((g: Gift) => g.id === selectedGiftId) || catalog[0];
  }, [catalog, selectedGiftId]);

  if (!isOpen) return null;

  const totalCost = (selectedGift?.coinCost || 0) * quantity;
  const hasSufficientCoins = userCoins >= totalCost;

  const handleSend = async () => {
    if (!selectedGift || isSending) return;
    if (!hasSufficientCoins) {
      onTopUpCoins?.();
      return;
    }

    setIsSending(true);
    try {
      await onSendGift(selectedGift, quantity);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="gift-picker-backdrop" onClick={onClose}>
      <div className="gift-picker-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header with Balance and Close */}
        <div className="gift-picker-header">
          <div className="gift-picker-title-group">
            <span className="gift-picker-title">Send Gift to {streamerName}</span>
            <div className="gift-picker-balance-pill" onClick={onTopUpCoins} title="Coin Balance">
              <span className="coin-icon">🪙</span>
              <span className="coin-amount">{userCoins.toLocaleString()}</span>
              <span className="coin-add-badge">+</span>
            </div>
          </div>
          <button type="button" className="gift-picker-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div className="gift-picker-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`gift-tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Gifts Grid */}
        <div className="gift-picker-grid">
          {filteredGifts.map((gift: Gift) => {
            const isSelected = selectedGiftId === gift.id;
            return (
              <div
                key={gift.id}
                className={`gift-card-item rarity-${gift.rarity} ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedGiftId(gift.id)}
              >
                <div className={`gift-rarity-badge ${gift.rarity}`}>
                  {gift.rarity.toUpperCase()}
                </div>
                <div className="gift-thumbnail-wrap">
                  <img
                    src={gift.icon}
                    alt={gift.name}
                    className="gift-card-img"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <span className="gift-card-name">{gift.name}</span>
                <div className="gift-card-cost-row">
                  <span className="gift-coin-symbol">🪙</span>
                  <span className="gift-card-cost-num">{gift.coinCost.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Quantity Selector & Send Button */}
        <div className="gift-picker-footer">
          {/* Quantity Pills */}
          <div className="gift-quantity-selector">
            <span className="qty-label">Qty:</span>
            {[1, 5, 10, 100].map((qty) => (
              <button
                key={qty}
                type="button"
                className={`qty-pill ${quantity === qty ? 'active' : ''}`}
                onClick={() => setQuantity(qty)}
              >
                x{qty}
              </button>
            ))}
          </div>

          {/* Send Action */}
          <div className="gift-send-action-wrap">
            <button
              type="button"
              className={`btn-send-gift-primary ${!hasSufficientCoins ? 'insufficient' : ''}`}
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? (
                <span>Sending... ⏳</span>
              ) : !hasSufficientCoins ? (
                <span>Get Coins (Need {totalCost.toLocaleString()}) 🪙</span>
              ) : (
                <>
                  <span>Send {selectedGift?.name} {quantity > 1 ? `x${quantity}` : ''}</span>
                  <span className="send-cost-pill">🪙 {totalCost.toLocaleString()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
