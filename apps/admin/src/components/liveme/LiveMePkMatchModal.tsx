import React, { useState, useEffect } from 'react';
import { LiveMeStreamer } from './types';
import { LIVEME_STREAMERS } from './liveMeData';
import { RoomViewer } from './LiveMeViewersModal';
import { liveStreamSync } from '../../services/liveStreamSyncService';

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
  // Guest Co-Hosting Props
  viewers?: RoomViewer[];
  activeAudience?: RoomViewer[];
  activeGuests?: RoomViewer[];
  onInviteGuest?: (viewer: RoomViewer) => void;
  onRemoveGuest?: (handle: string) => void;
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
  viewers = [],
  activeAudience = [],
  activeGuests = [],
  onInviteGuest,
  onRemoveGuest,
}) => {
  const audienceList = viewers.length > 0 ? viewers : activeAudience;
  const [activeTab, setActiveTab] = useState<'battle_radar' | 'battle_roster' | 'guests'>('battle_radar');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [matchedCandidate, setMatchedCandidate] = useState<LiveMeStreamer | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Eligible streamers for battle: Combine real network broadcasters with catalog creators
  const eligibleStreamers = React.useMemo(() => {
    const networkStreams = liveStreamSync.getStreamersList().filter((s) => !s.isHost);
    const combined: LiveMeStreamer[] = [...networkStreams];
    for (const ms of LIVEME_STREAMERS) {
      if (!ms.isHost && !combined.some((s) => s.id === ms.id || s.handle === ms.handle)) {
        combined.push(ms);
      }
    }
    return combined;
  }, []);

  // Trigger quick match radar scan
  const startQuickScan = () => {
    setIsScanning(true);
    setMatchedCandidate(null);
    setTimeout(() => {
      // Pick random creator from available streamers
      const randomStreamer = eligibleStreamers[Math.floor(Math.random() * eligibleStreamers.length)] || eligibleStreamers[0];
      setMatchedCandidate(randomStreamer);
      setIsScanning(false);
      showToast(`⚡ Rival Match Found: ${randomStreamer.name}!`);
    }, 1100);
  };

  useEffect(() => {
    if (isOpen && !isPkBattleActive && !matchedCandidate && !isScanning && activeTab === 'battle_radar') {
      startQuickScan();
    }
  }, [isOpen, isPkBattleActive, activeTab]);

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
                {isPkBattleActive ? 'PK Battle in Progress' : 'Battles & Co-Hosting Arena'}
              </h3>
              <p className="liveme-pk-modal-subtitle">
                {isPkBattleActive
                  ? `Battling @${currentRival.handle} · 60s Tug-of-War Duel`
                  : 'Search for active creators to battle, or bring up guests to co-host'}
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
            {/* Tab Navigation: Quick Match vs Live Creators vs Guests */}
            <div className="liveme-pk-tabs-bar">
              <button
                type="button"
                className={`liveme-pk-tab-btn ${activeTab === 'battle_radar' ? 'active' : ''}`}
                onClick={() => setActiveTab('battle_radar')}
              >
                ⚡ Battle Radar
              </button>
              <button
                type="button"
                className={`liveme-pk-tab-btn ${activeTab === 'battle_roster' ? 'active' : ''}`}
                onClick={() => setActiveTab('battle_roster')}
              >
                🥊 Search Battle ({eligibleStreamers.length})
              </button>
              <button
                type="button"
                className={`liveme-pk-tab-btn ${activeTab === 'guests' ? 'active' : ''}`}
                onClick={() => setActiveTab('guests')}
              >
                👥 Co-Host Guests ({viewers.length})
              </button>
            </div>

            {/* TAB 1: QUICK MATCH RADAR */}
            {activeTab === 'battle_radar' && (
              <div className="liveme-pk-quick-wrap">
                {isScanning ? (
                  <div className="liveme-pk-radar-box">
                    <div className="liveme-pk-radar-sweep" />
                    <div className="liveme-pk-radar-circle r1" />
                    <div className="liveme-pk-radar-circle r2" />
                    <div className="liveme-pk-radar-circle r3" />
                    <div className="liveme-pk-radar-core">⚡</div>
                    <div className="liveme-pk-radar-status">Scanning active live creators on Privity...</div>
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
                        ⚔️ Request to Battle {matchedCandidate.name.split(' ')[0]}!
                      </button>

                      <button
                        type="button"
                        className="liveme-pk-reroll-btn"
                        onClick={startQuickScan}
                      >
                        🔍 Scan Another Creator
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

            {/* TAB 2: LIVE CREATORS ROSTER / SEARCH */}
            {activeTab === 'battle_roster' && (
              <div className="liveme-pk-roster-wrap">
                <div className="liveme-pk-search-box">
                  <input
                    type="text"
                    className="liveme-pk-search-input"
                    placeholder="Search active live creators to challenge..."
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
                            {streamer.category} · 👥 {streamer.viewersCount} watching
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="liveme-pk-challenge-btn"
                        onClick={() => {
                          onStartPkBattle(streamer);
                          onClose();
                          showToast(`🥊 Battle request sent! PK Battle started with ${streamer.name}!`);
                        }}
                      >
                        ⚔️ Battle
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: INVITE GUEST / CO-HOST */}
            {activeTab === 'guests' && (
              <div className="liveme-pk-roster-wrap">
                {activeGuests.length > 0 && (
                  <div className="liveme-pk-active-guests-section">
                    <span className="liveme-pk-section-title">Active Co-Hosts on Screen:</span>
                    {activeGuests.map((g) => (
                      <div key={g.handle} className="liveme-pk-roster-item active-guest">
                        <div className="liveme-pk-roster-item-left">
                          <div className="liveme-pk-roster-avatar-box">
                            <img src={g.avatar} alt={g.name} />
                            <span className="liveme-roster-pulse-dot guest" />
                          </div>
                          <div className="liveme-pk-roster-info">
                            <div className="liveme-pk-roster-name">{g.name} (Co-Host)</div>
                            <div className="liveme-pk-roster-cat">@{g.handle} · On Live Stage</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="liveme-pk-action-btn danger small"
                          onClick={() => {
                            onRemoveGuest?.(g.handle);
                            showToast(`Disconnected co-host @${g.handle}`);
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <span className="liveme-pk-section-title">
                  Room Viewers ({audienceList.length} Available to Invite):
                </span>

                {audienceList.length === 0 ? (
                  <div className="liveme-pk-empty-viewers">
                    <span className="icon">👥</span>
                    <p>No other viewers in the room right now.</p>
                    <span className="sub">When users join your live stream, they will appear here and you can bring them up as a guest!</span>
                  </div>
                ) : (
                  <div className="liveme-pk-roster-list">
                    {audienceList.map((viewer) => {
                      const isAlreadyGuest = activeGuests.some((g) => g.handle === viewer.handle);
                      return (
                        <div key={viewer.handle} className="liveme-pk-roster-item">
                          <div className="liveme-pk-roster-item-left">
                            <div className="liveme-pk-roster-avatar-box">
                              <img src={viewer.avatar} alt={viewer.name} />
                              <span className="liveme-roster-level-tag">⭐{viewer.level}</span>
                            </div>
                            <div className="liveme-pk-roster-info">
                              <div className="liveme-pk-roster-name">{viewer.name}</div>
                              <div className="liveme-pk-roster-cat">@{viewer.handle} · Audience</div>
                            </div>
                          </div>

                          {isAlreadyGuest ? (
                            <span className="liveme-guest-on-stage-badge">On Stage</span>
                          ) : (
                            <button
                              type="button"
                              className="liveme-pk-challenge-btn guest"
                              onClick={() => {
                                onInviteGuest?.(viewer);
                                onClose();
                                showToast(`🎙️ Brought @${viewer.handle} up on stage as a Co-Host!`);
                              }}
                            >
                              Bring Up Guest
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
