import React, { useEffect, useState } from 'react';
import { GiftAnimation } from './GiftAnimation';
import { ActiveGiftQueueItem } from './types';
import { globalGiftQueue } from './GiftQueueManager';
import './gifts.css';

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

  // With strict 1-at-a-time sequential queueing, activeItems[0] is the current gift
  const currentItem = activeItems[0];
  if (!currentItem) return null;

  return (
    <div
      className="livestream-gift-overlay-stage comment-area-dock"
      aria-label="Livestream Gift Animations Overlay"
    >
      {/* Visual Animated Subject (Contained above comment banner, never obscures battle camera) */}
      <div className="comment-area-gift-visual-box">
        <GiftAnimation
          gift={currentItem.gift}
          isMuted={isMuted}
          onEnded={() => globalGiftQueue.removeItem(currentItem.queueId)}
        />
      </div>

      {/* Edge-to-Edge Glassmorphism Gift Banner around Comments Area */}
      <div className="comment-area-gift-banner animate-fly-up">
        <div className="comment-gift-avatar-wrap">
          <img
            src={
              currentItem.event.senderAvatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
            }
            alt={currentItem.event.senderName}
            className="comment-gift-avatar-img"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="comment-gift-crown">👑</span>
        </div>

        <div className="comment-gift-meta-col">
          <div className="comment-gift-title-line">
            <span className="comment-gift-sender">@{currentItem.event.senderName}</span>
            <span className="comment-gift-action-text">sent</span>
            <span className="comment-gift-name-highlight">{currentItem.gift.name}</span>
          </div>
          <div className="comment-gift-sub-line">
            <span className="comment-gift-diamonds-tag">
              💎 {currentItem.event.coinValue || currentItem.gift.coinCost} diamonds
            </span>
            <span className="comment-gift-category-tag">
              {currentItem.gift.category.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="comment-gift-icon-wrap">
          <img
            src={currentItem.gift.icon}
            alt={currentItem.gift.name}
            className="comment-gift-icon-img"
          />
          {currentItem.streakCount && currentItem.streakCount > 1 && (
            <span className="comment-gift-combo-badge">
              x{currentItem.streakCount} 🔥
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
