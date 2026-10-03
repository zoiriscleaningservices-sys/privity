import React, { useState } from 'react';
import { LIVEME_GIFTS } from './liveMeData';

export interface StreamGiftGoal {
  giftId: string;
  giftName: string;
  giftIcon: string;
  targetCount: number;
  currentCount: number;
}

export interface LiveGiftGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoal?: StreamGiftGoal;
  goal?: StreamGiftGoal;
  onSaveGoal: (goal: StreamGiftGoal) => void;
  showToast?: (msg: string) => void;
  isHost?: boolean;
}

export const LiveGiftGoalModal: React.FC<LiveGiftGoalModalProps> = ({
  isOpen,
  onClose,
  currentGoal,
  goal,
  onSaveGoal,
  showToast,
}) => {
  const activeGoal = goal || currentGoal || {
    giftId: 'rose',
    giftName: 'Rose',
    giftIcon: '🌹',
    targetCount: 10,
    currentCount: 0,
  };

  const [selectedGiftId, setSelectedGiftId] = useState<string>(activeGoal.giftId || 'rose');
  const [targetCount, setTargetCount] = useState<number>(activeGoal.targetCount || 10);

  if (!isOpen) return null;

  const selectedGift = LIVEME_GIFTS.find((g) => g.id === selectedGiftId) || LIVEME_GIFTS[0];

  const handleSave = () => {
    onSaveGoal({
      giftId: selectedGift.id,
      giftName: selectedGift.name,
      giftIcon: selectedGift.icon,
      targetCount: Math.max(1, targetCount),
      currentCount: activeGoal.giftId === selectedGift.id ? activeGoal.currentCount : 0,
    });
    if (showToast) {
      showToast(`🎯 Live Gift Goal set to: ${targetCount}x ${selectedGift.icon} ${selectedGift.name}!`);
    }
    onClose();
  };

  return (
    <div className="liveme-goal-modal-backdrop" onClick={onClose}>
      <div className="liveme-goal-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="liveme-goal-modal-header">
          <div className="liveme-goal-title-group">
            <span className="liveme-goal-icon">🎯</span>
            <div>
              <h3>Set Live Stream Gift Goal</h3>
              <p>Pick a gift for your audience to send and reach the goal milestone</p>
            </div>
          </div>
          <button type="button" className="liveme-goal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Selected Goal Preview Banner */}
        <div className="liveme-goal-preview-card">
          <div className="liveme-goal-preview-left">
            <span className="liveme-goal-preview-icon">{selectedGift.icon}</span>
            <div>
              <span className="liveme-goal-preview-name">{selectedGift.name}</span>
              <span className="liveme-goal-preview-cost">🪙 {selectedGift.coins} Coins per gift</span>
            </div>
          </div>
          <div className="liveme-goal-preview-badge">
            {activeGoal.giftId === selectedGift.id ? activeGoal.currentCount : 0} / {targetCount}
          </div>
        </div>

        {/* Target Count Quick Chips */}
        <div className="liveme-goal-count-section">
          <label className="liveme-goal-label">Select Target Quantity:</label>
          <div className="liveme-goal-count-chips">
            {[5, 10, 20, 50, 100].map((num) => (
              <button
                key={num}
                type="button"
                className={`liveme-goal-count-chip ${targetCount === num ? 'active' : ''}`}
                onClick={() => setTargetCount(num)}
              >
                {num}x
              </button>
            ))}
          </div>
        </div>

        {/* Gift Catalog Grid */}
        <div className="liveme-goal-catalog-section">
          <label className="liveme-goal-label">Choose Gift Milestone:</label>
          <div className="liveme-goal-catalog-grid">
            {LIVEME_GIFTS.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`liveme-goal-item-btn ${selectedGiftId === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGiftId(g.id)}
              >
                <span className="liveme-goal-item-icon">{g.icon}</span>
                <span className="liveme-goal-item-name">{g.name}</span>
                <span className="liveme-goal-item-cost">🪙 {g.coins}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="liveme-goal-modal-footer">
          <button type="button" className="liveme-goal-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="liveme-goal-save-btn" onClick={handleSave}>
            🎯 Set Live Goal ({targetCount}x {selectedGift.name})
          </button>
        </div>
      </div>
    </div>
  );
};
