import React, { useState, useEffect } from 'react';
import { LiveMeStreamer } from './types';
import { LIVEME_STREAMERS } from './liveMeData';

export interface LiveMePkMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPkBattleActive: boolean;
  currentRival: LiveMeStreamer;
  hostScore: number;
  rivalScore: number;
  roundTimer: number;
  onStartPkBattle: (rival: LiveMeStreamer) => void;
  onEndPkBattle: () => void;
  onRematch: () => void;
  showToast: (msg: string) => void;
}

export const LiveMePkMatchModal: React.FC<LiveMePkMatchModalProps> = ({
  isOpen,
  onClose,
  isPkBattleActive,
  currentRival,
  hostScore,
  rivalScore,
  roundTimer,
  onStartPkBattle,
  onEndPkBattle,
  onRematch,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'quick' | 'roster'>('quick');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [matchedCandidate, setMatchedCandidate] = useState<LiveMeStreamer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Eligible streamers for battle (exclude current user / duplicates)
  const eligibleStreamers = LIVEME_STREAMERS.filter((s) => !s.isHost);

  // Trigger quick match radar scan
  const startQuickScan = () => {
    setIsScanning(true);
    setMatchedCandidate(null);
    setTimeout(() => {
      // Pick random creator
      const randomStreamer = eligibleStreamers[Math.floor(Math.random() * eligibleStreamers.length)] || eligibleStreamers[0];
      setMatchedCandidate(randomStreamer);
      setIsScanning(false);
      showToast(`⚡ Rival Match Found: ${randomStreamer.name}!`);
    }, 1200);
  };

  useEffect(() => {
    if (isOpen && !isPkBattleActive && !matchedCandidate && !isScanning) {
      startQuickScan();
    }
  }, [isOpen, isPkBattleActive]);

  if (!isOpen) return null;

  const filteredStreamers = eligibleStreamers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="liveme-pk-modal-backdrop" onClick={onClose}>
      <div className="liveme-pk-modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="liveme-pk-modal-header">
          <div className="liveme-pk-modal-title-group">
            <span className="liveme-pk-modal-swords">⚔️</span>
            <div>
              <h3 className="liveme-pk-modal-title">
                {isPkBattleActive ? 'PK Battle in Progress' : 'Match & Battle Live Creators'}
              </h3>
              <p className="liveme-pk-modal-subtitle">
                {isPkBattleActive
                  ? `Battling @${currentRival.handle} · 60s Tug-of-War Duel`
                  : 'Challenge another live creator in a real-time sparks battle'}
              </p>
            </div>
          </div>
          <button type="button" className="liveme-pk-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* If ALREADY IN BATTLE: Show Active Battle Controls */}
        {isPkBattleActive ? (
          <div className="liveme-pk-active-card">
            <div className="liveme-pk-active-duelists">
              <div className="liveme-pk-active-user">
                <span className="liveme-pk-active-badge host">Host</span>
                <span className="liveme-pk-active-score">🪙 {hostScore.toLocaleString()}</span>
              </div>
              <div className="liveme-pk-active-vs">
                <span className="liveme-pk-vs-text">VS</span>
                <span className="liveme-pk-active-timer">⏱️ {roundTimer}s</span>
              </div>
              <div className="liveme-pk-active-user">
                <img src={currentRival.avatar} alt={currentRival.name} className="liveme-pk-active-avatar" />
                <span className="liveme-pk-active-name">{currentRival.name}</span>
                <span className="liveme-pk-active-score">🪙 {rivalScore.toLocaleString()}</span>
              </div>
            </div>

            <div className="liveme-pk-active-actions">
              <button
                type="button"
                className="liveme-pk-action-btn rematch"
                onClick={() => {
                  onRematch();
                  onClose();
                  showToast('🔄 Rematch round initiated (60s)!');
                }}
              >
                🔄 Rematch Round (60s)
              </button>

              <button
                type="button"
                className="liveme-pk-action-btn danger"
                onClick={() => {
                  onEndPkBattle();
                  onClose();
                  showToast('⏹️ PK Battle ended. Stream returned to full screen solo mode.');
                }}
              >
                ⏹️ End PK Battle (Full Screen)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation: Quick Match vs Roster */}
            <div className="liveme-pk-tabs-bar">
              <button
                type="button"
                className={`liveme-pk-tab-btn ${activeTab === 'quick' ? 'active' : ''}`}
                onClick={() => setActiveTab('quick')}
              >
                ⚡ Quick Match Radar
              </button>
              <button
                type="button"
                className={`liveme-pk-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
                onClick={() => setActiveTab('roster')}
              >
                👥 Live Creators ({eligibleStreamers.length})
              </button>
            </div>

            {/* TAB 1: QUICK MATCH RADAR */}
            {activeTab === 'quick' && (
              <div className="liveme-pk-quick-wrap">
                {isScanning ? (
                  <div className="liveme-pk-radar-box">
                    <div className="liveme-pk-radar-sweep" />
                    <div className="liveme-pk-radar-circle r1" />
                    <div className="liveme-pk-radar-circle r2" />
                    <div className="liveme-pk-radar-circle r3" />
                    <div className="liveme-pk-radar-core">⚡</div>
                    <div className="liveme-pk-radar-status">Scanning Privity live creators...</div>
                  </div>
                ) : matchedCandidate ? (
                  <div className="liveme-pk-candidate-card">
                    <div className="liveme-pk-candidate-top">
                      <div className="liveme-pk-candidate-avatar-wrap">
                        <img
                          src={matchedCandidate.avatar}
                          alt={matchedCandidate.name}
                          className="liveme-pk-candidate-avatar"
                        />
                        <span className="liveme-pk-live-ring" />
                      </div>
                      <div className="liveme-pk-candidate-meta">
                        <div className="liveme-pk-candidate-name">{matchedCandidate.name}</div>
                        <div className="liveme-pk-candidate-cat">@{matchedCandidate.handle} · {matchedCandidate.category}</div>
                        <div className="liveme-pk-candidate-viewers">👥 {matchedCandidate.viewersCount} watching live</div>
                      </div>
                    </div>

                    <div className="liveme-pk-candidate-preview-box">
                      <span>🥊 60s Duel Match Found · Tap below to challenge!</span>
                    </div>

                    <div className="liveme-pk-candidate-actions">
                      <button
                        type="button"
                        className="liveme-pk-start-btn"
                        onClick={() => {
                          onStartPkBattle(matchedCandidate);
                          onClose();
                          showToast(`🥊 PK Battle started against ${matchedCandidate.name}!`);
                        }}
                      >
                        ⚔️ Challenge {matchedCandidate.name.split(' ')[0]} to Battle!
                      </button>

                      <button
                        type="button"
                        className="liveme-pk-reroll-btn"
                        onClick={startQuickScan}
                      >
                        🔍 Find Another Creator
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="liveme-pk-start-btn" onClick={startQuickScan}>
                    ⚡ Start Quick Match Radar
                  </button>
                )}
              </div>
            )}

            {/* TAB 2: LIVE CREATORS ROSTER */}
            {activeTab === 'roster' && (
              <div className="liveme-pk-roster-wrap">
                <div className="liveme-pk-search-box">
                  <input
                    type="text"
                    className="liveme-pk-search-input"
                    placeholder="Search active creators by name or category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="liveme-pk-roster-list">
                  {filteredStreamers.map((streamer) => (
                    <div key={streamer.id} className="liveme-pk-roster-item">
                      <div className="liveme-pk-roster-item-left">
                        <div className="liveme-pk-roster-avatar-box">
                          <img src={streamer.avatar} alt={streamer.name} />
                          <span className="liveme-roster-pulse-dot" />
                        </div>
                        <div className="liveme-pk-roster-info">
                          <div className="liveme-pk-roster-name">{streamer.name}</div>
                          <div className="liveme-pk-roster-cat">
                            {streamer.category} · 👥 {streamer.viewersCount}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="liveme-pk-challenge-btn"
                        onClick={() => {
                          onStartPkBattle(streamer);
                          onClose();
                          showToast(`🥊 Challenge accepted! PK Battle started with ${streamer.name}!`);
                        }}
                      >
                        ⚔️ Challenge
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
