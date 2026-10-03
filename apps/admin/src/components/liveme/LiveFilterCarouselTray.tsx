import React from 'react';

export interface FilterPreset {
  id: string;
  name: string;
  cssFilter: string;
  previewColor: string;
  icon: string;
  emoji: string;
}

export const LIVE_FILTERS: FilterPreset[] = [
  {
    id: 'original',
    name: 'Original',
    cssFilter: 'none',
    previewColor: '#64748b',
    icon: '👤',
    emoji: '✨',
  },
  {
    id: 'glam',
    name: 'Glam',
    cssFilter: 'contrast(1.08) brightness(1.06) saturate(1.22) drop-shadow(0 0 8px rgba(244,63,94,0.18))',
    previewColor: '#ec4899',
    icon: '💄',
    emoji: '🌸',
  },
  {
    id: 'porcelain',
    name: 'Porcelain',
    cssFilter: 'brightness(1.10) contrast(1.02) saturate(1.08)',
    previewColor: '#f1f5f9',
    icon: '🧖‍♀️',
    emoji: '💎',
  },
  {
    id: 'golden',
    name: 'Golden',
    cssFilter: 'sepia(0.22) saturate(1.35) contrast(1.08) brightness(1.04)',
    previewColor: '#f59e0b',
    icon: '🌅',
    emoji: '✨',
  },
  {
    id: 'velvet',
    name: 'Velvet',
    cssFilter: 'contrast(1.20) saturate(1.18) brightness(0.96)',
    previewColor: '#8b5cf6',
    icon: '🎭',
    emoji: '💜',
  },
  {
    id: 'neon',
    name: 'Neon Pop',
    cssFilter: 'hue-rotate(295deg) saturate(1.50) contrast(1.15)',
    previewColor: '#06b6d4',
    icon: '⚡',
    emoji: '🔮',
  },
  {
    id: 'studio',
    name: 'Studio',
    cssFilter: 'contrast(1.12) brightness(1.08) saturate(1.10)',
    previewColor: '#3b82f6',
    icon: '💡',
    emoji: '📸',
  },
  {
    id: 'noir',
    name: 'Noir',
    cssFilter: 'grayscale(1) contrast(1.35) brightness(0.92)',
    previewColor: '#1e293b',
    icon: '🎬',
    emoji: '🖤',
  },
  {
    id: 'anime',
    name: 'Anime',
    cssFilter: 'saturate(1.70) contrast(1.18) brightness(1.08)',
    previewColor: '#f43f5e',
    icon: '🧚',
    emoji: '🎀',
  },
  {
    id: 'joker',
    name: 'Joker',
    cssFilter: 'hue-rotate(60deg) contrast(1.30) saturate(1.45)',
    previewColor: '#10b981',
    icon: '🃏',
    emoji: '💚',
  },
];

export interface LiveFilterCarouselTrayProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilterId: string;
  onSelectFilter: (filter: FilterPreset) => void;
  onToggleFullscreen?: () => void;
  showToast: (msg: string) => void;
}

export const LiveFilterCarouselTray: React.FC<LiveFilterCarouselTrayProps> = ({
  isOpen,
  onClose,
  activeFilterId,
  onSelectFilter,
  onToggleFullscreen,
  showToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="tiktok-filter-tray-wrapper" role="region" aria-label="Filters and Effects Carousel">
      {/* Left Action: Full Frame / AR Toggle */}
      <button
        type="button"
        className="tiktok-filter-tray-action-btn"
        onClick={() => {
          if (onToggleFullscreen) onToggleFullscreen();
          showToast('📐 Camera Frame Adjusted');
        }}
        title="Adjust Camera Aspect / Frame"
      >
        <span className="tiktok-filter-frame-icon">⛶</span>
      </button>

      {/* Horizontal Scrollable Filter Cards Matching Screenshot 4 */}
      <div className="tiktok-filter-cards-scroll">
        {LIVE_FILTERS.map((f) => {
          const isSelected = activeFilterId === f.id;

          return (
            <div
              key={f.id}
              className={`tiktok-filter-card ${isSelected ? 'active' : ''}`}
              onClick={() => {
                onSelectFilter(f);
                showToast(`✨ Filter: ${f.name}`);
              }}
              title={f.name}
            >
              <div
                className="tiktok-filter-card-thumb"
                style={{
                  background: `linear-gradient(135deg, ${f.previewColor}33, ${f.previewColor}aa)`,
                }}
              >
                <span className="tiktok-filter-thumb-icon">{f.icon}</span>
                <span className="tiktok-filter-thumb-emoji">{f.emoji}</span>
              </div>
              <span className="tiktok-filter-card-name">{f.name}</span>
            </div>
          );
        })}
      </div>

      {/* Right Action: Close Tray */}
      <button
        type="button"
        className="tiktok-filter-tray-action-btn close"
        onClick={onClose}
        title="Close Filters"
        aria-label="Close filters"
      >
        ✕
      </button>
    </div>
  );
};
