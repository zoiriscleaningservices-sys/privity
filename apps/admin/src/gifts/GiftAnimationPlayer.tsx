import React, { useEffect, useState } from 'react';
import { GiftAnimation } from './GiftAnimation';
import { ActiveGiftQueueItem, GIFT_PRIORITY_MAP } from './types';
import { globalGiftQueue } from './GiftQueueManager';

export interface GiftAnimationPlayerProps {
  isMuted?: boolean;
}

export const GiftAnimationPlayer: React.FC<GiftAnimationPlayerProps> = ({ isMuted = false }) => {
  const [activeItems, setActiveItems] = useState<ActiveGiftQueueItem[]>([]);

  useEffect(() => {
    const unsubscribe = globalGiftQueue.subscribe((items) => {
      setActiveItems(items);
    });
    return unsubscribe;
  }, []);

  if (activeItems.length === 0) return null;

  const majorItem = activeItems.find(
    (item) => (item.gift.priority || GIFT_PRIORITY_MAP[item.gift.rarity] || 1) >= 5
  );
  const minorItems = activeItems.filter((item) => item !== majorItem);

  return (
    <div className="livestream-gift-overlay-stage" aria-label="Livestream Gift Animations Overlay">
      {/* 1. MAJOR / LEGENDARY FULL-SCREEN OVERLAY */}
      {majorItem && (
        <div key={majorItem.queueId} className="major-gift-cinematic-scene">
          {/* Subtle Ambient Cosmic / Energy Glow */}
          <div className={`major-gift-ambient-backdrop gift-ambient-${majorItem.gift.id}`} />

          {/* Transparent Animated Subject */}
          <div className="major-gift-animation-wrapper">
            <GiftAnimation
              gift={majorItem.gift}
              isMuted={isMuted}
              onEnded={() => globalGiftQueue.removeItem(majorItem.queueId)}
            />
          </div>

          {/* Cinematic Sender Announcement Banner */}
          <div className="major-gift-announcement-card animate-fly-up">
            <div className="announcement-crown-pill">PRIVITY ROYAL GIFT</div>
            <div className="announcement-content-row">
              <div className="announcement-avatar-ring">
                <img
                  src={majorItem.event.senderAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt={majorItem.event.senderName}
                  className="announcement-avatar-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="announcement-meta-col">
                <div className="announcement-sender-name">
                  <span className="sender-tag">@{majorItem.event.senderName}</span> sent{' '}
                  <span className="gift-highlight-name">{majorItem.gift.name}</span>
                </div>
                <div className="announcement-sub-tag">
                  {majorItem.gift.category.toUpperCase()} · {majorItem.gift.coinCost.toLocaleString()} COINS
                </div>
              </div>
              <div className="announcement-icon-badge">
                <img src={majorItem.gift.icon} alt="" className="announcement-gift-thumbnail" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MINOR / COMMON / SPECIAL GIFTS FLOATING LANES */}
      {minorItems.map((item) => {
        const lanePositions = [
          { bottom: '28%', left: '8%' },
          { bottom: '38%', right: '12%' },
          { bottom: '48%', left: '16%' },
          { bottom: '22%', right: '22%' },
        ];
        const pos = lanePositions[item.lane % lanePositions.length];

        return (
          <div
            key={item.queueId}
            className={`minor-gift-lane-item lane-${item.lane}`}
            style={{
              position: 'absolute',
              ...pos,
              zIndex: 35,
              pointerEvents: 'none',
            }}
          >
            {/* Sender Message Floating Banner */}
            <div className="minor-gift-sender-banner animate-slide-up">
              <span className="minor-sender-name">@{item.event.senderName}</span>
              <span className="minor-sent-text">sent {item.gift.name}</span>
              <img src={item.gift.icon} alt="" className="minor-gift-icon-tiny" />
              {item.streakCount && item.streakCount > 1 && (
                <span className="minor-gift-streak-badge">x{item.streakCount} 🔥</span>
              )}
            </div>

            {/* Animation */}
            <div className="minor-gift-animation-box">
              <GiftAnimation
                gift={item.gift}
                isMuted={isMuted}
                onEnded={() => globalGiftQueue.removeItem(item.queueId)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
