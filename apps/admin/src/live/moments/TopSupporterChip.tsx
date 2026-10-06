import React from 'react';
import { Crown } from 'lucide-react';
import { UserRef } from '../core/events';
import { Avatar } from '../ui/Avatar';
import './moments.css';

interface TopSupporterChipProps {
  supporter: UserRef | null;
  totalCoins?: number;
  onClick?: () => void;
}

/** Quiet, persistent recognition of the current #1 supporter (server top_supporters[0]). */
export const TopSupporterChip: React.FC<TopSupporterChipProps> = ({ supporter, totalCoins, onClick }) => {
  if (!supporter) return null;
  const name = supporter.display_name || supporter.handle;
  return (
    <button
      type="button"
      className="live-top-supporter-chip plv-top-chip"
      onClick={onClick}
      aria-label={`Top supporter: ${name}${totalCoins !== undefined ? `, ${totalCoins.toLocaleString()} coins` : ''}. View supporters`}
    >
      <Crown size={13} aria-hidden="true" />
      <Avatar user={supporter} size={20} decorative />
      <span className="plv-top-chip-name">{name}</span>
    </button>
  );
};
