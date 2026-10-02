import React, { useState } from 'react';
import { RECHARGE_TIERS } from './liveMeData';

interface LiveMeRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userCoins: number;
  userName?: string;
  userAvatar?: string;
  onRechargeSuccess: (coinsAdded: number) => void;
}

export const LiveMeRechargeModal: React.FC<LiveMeRechargeModalProps> = ({
  isOpen,
  onClose,
  userCoins,
  userName = 'Member',
  userAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  onRechargeSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'resellers'>('channels');
  const [selectedChannel, setSelectedChannel] = useState<'visa1' | 'visa2' | 'razer-gold' | 'razer-pin'>('visa1');
  const [vipProgress, setVipProgress] = useState(0.2);

  if (!isOpen) return null;

  const handleSelectTier = (tier: typeof RECHARGE_TIERS[0]) => {
    const totalCoins = tier.coins + tier.bonusCoins;
    setVipProgress((prev) => Math.min(1, prev + 0.35));
    onRechargeSuccess(totalCoins);
  };

  return (
    <div className="liveme-recharge-backdrop" onClick={onClose}>
      <div className="liveme-recharge-window" onClick={(e) => e.stopPropagation()}>
        {/* Purple Top Bar */}
        <div className="liveme-recharge-topbar">
          <span className="liveme-recharge-title">Recharge</span>
          <button
            type="button"
            className="liveme-recharge-close"
            onClick={onClose}
            title="Close Recharge"
          >
            ✕
          </button>
        </div>

        {/* Profile Card Banner matching Screenshot media_1790808683457.png */}
        <div className="liveme-recharge-user-card">
          <div className="liveme-recharge-user-row">
            <img
              src={userAvatar}
              alt={userName}
              className="liveme-recharge-avatar"
            />
            <div className="liveme-recharge-user-info">
              <div className="liveme-recharge-username-row">
                <span>{userName}</span>
                <span className="liveme-recharge-level-badge">🛡️ 0</span>
              </div>

              {/* VIP0 -> VIP1 Progress Slider */}
              <div className="liveme-vip-progress-wrap">
                <span>VIP0</span>
                <div className="liveme-vip-track">
                  <div
                    className="liveme-vip-fill"
                    style={{ width: `${vipProgress * 100}%` }}
                  />
                </div>
                <span>VIP1</span>
                <span className="liveme-vip-ratio">{Math.round(vipProgress * 100)}/100</span>
              </div>
            </div>
          </div>

          {/* Account Balance & Country Row */}
          <div className="liveme-recharge-stats-row">
            <div className="liveme-recharge-stat-block">
              <span className="liveme-recharge-stat-label">Account balance</span>
              <span className="liveme-recharge-stat-val">
                🪙 {userCoins.toLocaleString()} ⟳
              </span>
            </div>
            <div className="liveme-recharge-stat-block" style={{ alignItems: 'flex-end' }}>
              <span className="liveme-recharge-stat-label">Country/Region</span>
              <span className="liveme-recharge-stat-val">
                🇺🇸 U.S.A &gt;
              </span>
            </div>
          </div>
        </div>

        {/* White Content Section with Channels & Recharge Tiers */}
        <div className="liveme-recharge-content">
          <div className="liveme-recharge-tabs">
            <button
              type="button"
              className={`liveme-recharge-tab-btn ${activeTab === 'channels' ? 'active' : ''}`}
              onClick={() => setActiveTab('channels')}
            >
              Channels
            </button>
            <button
              type="button"
              className={`liveme-recharge-tab-btn ${activeTab === 'resellers' ? 'active' : ''}`}
              onClick={() => setActiveTab('resellers')}
            >
              Official Resellers
            </button>
          </div>

          {/* Channels Grid */}
          <div className="liveme-channels-grid">
            <div
              className={`liveme-channel-item ${selectedChannel === 'visa1' ? 'selected' : ''}`}
              onClick={() => setSelectedChannel('visa1')}
            >
              <span className="liveme-channel-logo-text">💳 VISA / MC</span>
              <span className="liveme-channel-sub">Credit/Debit</span>
              {selectedChannel === 'visa1' && <span className="liveme-channel-check">✓</span>}
            </div>

            <div
              className={`liveme-channel-item ${selectedChannel === 'visa2' ? 'selected' : ''}`}
              onClick={() => setSelectedChannel('visa2')}
            >
              <span className="liveme-channel-logo-text">💳 Fast Pay</span>
              <span className="liveme-channel-sub">Credit/Debit</span>
              {selectedChannel === 'visa2' && <span className="liveme-channel-check">✓</span>}
            </div>

            <div
              className={`liveme-channel-item ${selectedChannel === 'razer-gold' ? 'selected' : ''}`}
              onClick={() => setSelectedChannel('razer-gold')}
            >
              <span className="liveme-channel-logo-text">🟡 Razer Gold</span>
              <span className="liveme-channel-sub">Wallet</span>
              {selectedChannel === 'razer-gold' && <span className="liveme-channel-check">✓</span>}
            </div>

            <div
              className={`liveme-channel-item ${selectedChannel === 'razer-pin' ? 'selected' : ''}`}
              onClick={() => setSelectedChannel('razer-pin')}
            >
              <span className="liveme-channel-logo-text">🟢 Razer PIN</span>
              <span className="liveme-channel-sub">Direct PIN</span>
              {selectedChannel === 'razer-pin' && <span className="liveme-channel-check">✓</span>}
            </div>
          </div>

          {/* Recharge Amount Section */}
          <div className="liveme-recharge-amount-label">Recharge Amount</div>
          <div className="liveme-tiers-grid">
            {RECHARGE_TIERS.map((tier) => (
              <div
                key={tier.id}
                className="liveme-tier-card"
                onClick={() => handleSelectTier(tier)}
                title={`Click to recharge ${tier.coins + tier.bonusCoins} coins for $${tier.priceUsd.toFixed(2)}`}
              >
                <div className="liveme-tier-coins">
                  <span>🪙</span>
                  <span>{tier.coins}</span>
                </div>
                <div className="liveme-tier-bonus">+{tier.bonusCoins} coins</div>
                <div className="liveme-tier-price">${tier.priceUsd.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
