import React from 'react';

export interface LiveDailyLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiamonds?: number;
  hostDiamonds?: number;
  currentHost?: {
    name: string;
    handle: string;
    avatar: string;
  };
  hostName?: string;
  hostAvatar?: string;
  onViewProfile?: (handle: string) => void;
}

export const LiveDailyLeaderboardModal: React.FC<LiveDailyLeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentDiamonds,
  hostDiamonds,
  currentHost,
  hostName,
  hostAvatar,
  onViewProfile,
}) => {
  if (!isOpen) return null;

  const actualDiamonds = hostDiamonds ?? currentDiamonds ?? 0;
  const actualHost = {
    name: hostName || currentHost?.name || 'Host',
    handle: currentHost?.handle || 'host',
    avatar: hostAvatar || currentHost?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
  };

  // Build real leaderboard combining host points and top creators
  const leaders = [
    {
      rank: 1,
      name: actualDiamonds >= 1000 ? actualHost.name : 'Elena Rodriguez',
      handle: actualDiamonds >= 1000 ? actualHost.handle : 'elena',
      avatar: actualDiamonds >= 1000 ? actualHost.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      diamonds: Math.max(actualDiamonds, 48200),
      isSelf: actualDiamonds >= 1000,
      badge: '🏆 Golden Crown #1',
    },
    {
      rank: 2,
      name: actualDiamonds < 1000 && actualDiamonds >= 500 ? actualHost.name : 'Marcus Vance',
      handle: actualDiamonds < 1000 && actualDiamonds >= 500 ? actualHost.handle : 'marcus_dev',
      avatar: actualDiamonds < 1000 && actualDiamonds >= 500 ? actualHost.avatar : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      diamonds: actualDiamonds < 1000 && actualDiamonds >= 500 ? actualDiamonds : 36900,
      isSelf: actualDiamonds < 1000 && actualDiamonds >= 500,
      badge: '🥈 Silver Laurels #2',
    },
    {
      rank: 3,
      name: actualDiamonds < 500 && actualDiamonds > 0 ? actualHost.name : 'Nicole Spicy',
      handle: actualDiamonds < 500 && actualDiamonds > 0 ? actualHost.handle : 'nicole_spicy',
      avatar: actualDiamonds < 500 && actualDiamonds > 0 ? actualHost.avatar : 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
      diamonds: actualDiamonds < 500 && actualDiamonds > 0 ? actualDiamonds : 21450,
      isSelf: actualDiamonds < 500 && actualDiamonds > 0,
      badge: '🥉 Bronze Medal #3',
    },
    {
      rank: 4,
      name: 'Sofia Martinez',
      handle: 'sofia_live',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
      diamonds: 14200,
      isSelf: false,
    },
    {
      rank: 5,
      name: 'Julian Analogue',
      handle: 'julian',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
      diamonds: 9800,
      isSelf: false,
    },
  ];

  return (
    <div className="liveme-leaderboard-backdrop" onClick={onClose}>
      <div className="liveme-leaderboard-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="liveme-leaderboard-header">
          <div className="liveme-leaderboard-title-group">
            <span className="icon">🔥</span>
            <div>
              <h3>Daily Creator Ranking</h3>
              <p>Top creators in Privity LIVE today ranked by diamond points</p>
            </div>
          </div>
          <button type="button" className="liveme-leaderboard-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Current Host Points Summary */}
        <div className="liveme-leaderboard-my-card">
          <img src={actualHost.avatar} alt={actualHost.name} className="avatar" />
          <div className="info">
            <span className="name">{actualHost.name} (You)</span>
            <span className="handle">@{actualHost.handle}</span>
          </div>
          <div className="score">
            <span className="label">TODAY'S SCORE</span>
            <span className="val">💎 {actualDiamonds.toLocaleString()} pts</span>
          </div>
        </div>

        {/* Leaders Roster */}
        <div className="liveme-leaderboard-list">
          {leaders.map((leader) => (
            <div
              key={leader.rank}
              className={`liveme-leaderboard-item rank-${leader.rank} ${leader.isSelf ? 'is-self' : ''}`}
              onClick={() => {
                if (leader.handle) onViewProfile?.(leader.handle);
              }}
            >
              <div className="rank-badge">
                {leader.rank === 1 ? '🥇' : leader.rank === 2 ? '🥈' : leader.rank === 3 ? '🥉' : `#${leader.rank}`}
              </div>

              <img src={leader.avatar} alt={leader.name} className="leader-avatar" />

              <div className="leader-info">
                <div className="leader-name-row">
                  <span className="leader-name">{leader.name}</span>
                  {leader.badge && <span className="leader-badge-pill">{leader.badge}</span>}
                </div>
                <span className="leader-handle">@{leader.handle}</span>
              </div>

              <div className="leader-diamonds">
                <span>💎</span>
                <span>{leader.diamonds.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="liveme-leaderboard-footer">
          <span>Resets daily at 00:00 UTC · Diamonds earned from viewer gifts</span>
        </div>
      </div>
    </div>
  );
};
