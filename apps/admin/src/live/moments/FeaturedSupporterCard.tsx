import React from 'react';
import { UserRef } from '../core/events';
import { Crown, UserPlus, UserCheck, X } from '../design/icons';
import { Avatar } from '../ui/Avatar';
import './moments.css';

interface FeaturedSupporterCardProps {
  user: UserRef;
  rank?: number;
  totalCoins?: number;
  isFollowing?: boolean;
  onFollowToggle?: () => void;
  onClose?: () => void;
}

export const FeaturedSupporterCard: React.FC<FeaturedSupporterCardProps> = ({
  user,
  rank,
  totalCoins,
  isFollowing = false,
  onFollowToggle,
  onClose,
}) => {
  const name = user.display_name || user.handle;

  return (
    <div className="live-supporter-card" role="dialog" aria-label={`Supporter ${name}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <Avatar user={user} size={40} decorative />
          {rank === 1 && (
            <div style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#fbbf24',
              borderRadius: '50%',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Crown size={12} fill="#030407" color="#030407" />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800, fontSize: '14px', color: '#ffffff' }}>{name}</div>
          <div style={{ fontSize: '12px', color: 'var(--live-text-muted)' }}>@{user.handle}</div>
          {totalCoins !== undefined && (
            <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700, marginTop: '2px' }}>
              {totalCoins.toLocaleString()} coins sent
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {onFollowToggle && (
          <button
            type="button"
            onClick={onFollowToggle}
            className="live-btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '9999px',
              background: isFollowing ? 'rgba(71, 85, 105, 0.4)' : 'var(--live-gradient-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {isFollowing ? (
              <>
                <UserCheck size={13} />
                <span>Following</span>
              </>
            ) : (
              <>
                <UserPlus size={13} />
                <span>Follow</span>
              </>
            )}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="live-btn-icon"
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--live-text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
