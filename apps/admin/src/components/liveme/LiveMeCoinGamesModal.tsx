import React, { useState } from 'react';

interface LiveMeCoinGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  onCoinsChange: (delta: number) => void;
  showToast: (msg: string) => void;
}

export const LiveMeCoinGamesModal: React.FC<LiveMeCoinGamesModalProps> = ({
  isOpen,
  onClose,
  userCoins,
  onCoinsChange,
  showToast,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  if (!isOpen) return null;

  const prizes = [100, 20, 200, 50, 500, 10];

  const handleSpin = () => {
    if (isSpinning) return;
    if (userCoins < 20) {
      showToast('⚠️ Need at least 20 coins to spin! Recharge to play.');
      return;
    }

    // Deduct entry fee
    onCoinsChange(-20);
    setIsSpinning(true);

    const randomIndex = Math.floor(Math.random() * prizes.length);
    const prizeWon = prizes[randomIndex];
    const segmentAngle = 360 / prizes.length;
    const extraSpins = 360 * 5;
    const targetRotation = rotation + extraSpins + (randomIndex * segmentAngle);

    setRotation(targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      onCoinsChange(prizeWon);
      showToast(`🎉 JACKPOT! You won +${prizeWon} Gold Coins! 🪙`);
    }, 3600);
  };

  return (
    <div className="liveme-recharge-backdrop" onClick={onClose}>
      <div className="liveme-games-modal-window" onClick={(e) => e.stopPropagation()}>
        <div className="liveme-games-header">
          <div className="liveme-games-title">
            <span>🎮</span>
            <span>LiveMe Coin Games · Lucky Wheel</span>
          </div>
          <button
            type="button"
            className="liveme-recharge-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
          Spin to win up to <strong style={{ color: '#fbbf24' }}>500 Gold Coins</strong>! (Cost: 20 🪙)
        </div>

        {/* Wheel Box */}
        <div style={{ position: 'relative', margin: '10px auto' }}>
          <div className="liveme-wheel-pointer" />
          <div
            className="liveme-wheel-canvas"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="liveme-wheel-center">
              <span>WIN</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
          <span style={{ fontSize: '13px', color: '#fbbf24', fontWeight: 700 }}>
            🪙 Your Balance: {userCoins.toLocaleString()}
          </span>
          <button
            type="button"
            className="liveme-spin-btn"
            onClick={handleSpin}
            disabled={isSpinning}
            style={{ opacity: isSpinning ? 0.7 : 1 }}
          >
            {isSpinning ? 'Spinning...' : 'SPIN (20 🪙)'}
          </button>
        </div>
      </div>
    </div>
  );
};
