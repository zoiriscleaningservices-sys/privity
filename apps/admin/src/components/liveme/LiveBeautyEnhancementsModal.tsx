import React, { useState } from 'react';

export interface BeautyFilterPreset {
  id: string;
  name: string;
  thumbnail: string;
  cssFilter: string;
  icon: string;
}

export const BEAUTY_FILTERS: BeautyFilterPreset[] = [
  { id: 'normal', name: 'Original', thumbnail: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120', cssFilter: 'none', icon: '✨' },
  { id: 'radiant', name: 'Radiant Glow', thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120', cssFilter: 'brightness(1.1) contrast(1.05) saturate(1.15)', icon: '🌟' },
  { id: 'porcelain', name: 'Porcelain White', thumbnail: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120', cssFilter: 'brightness(1.18) contrast(0.96) saturate(1.08)', icon: '🤍' },
  { id: 'golden', name: 'Golden Hour', thumbnail: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120', cssFilter: 'sepia(0.2) saturate(1.35) brightness(1.08) hue-rotate(-8deg)', icon: '🌅' },
  { id: 'velvet', name: 'Soft Velvet', thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', cssFilter: 'contrast(0.92) brightness(1.12) saturate(1.2)', icon: '🌸' },
  { id: 'cyber', name: 'Cyber Neon', thumbnail: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120', cssFilter: 'contrast(1.22) saturate(1.45) hue-rotate(15deg) brightness(1.05)', icon: '⚡' },
  { id: 'studio', name: 'Studio Crisp', thumbnail: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120', cssFilter: 'contrast(1.15) brightness(1.06) saturate(1.12)', icon: '📸' },
  { id: 'noir', name: 'Cinema Noir', thumbnail: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120', cssFilter: 'grayscale(1) contrast(1.3) brightness(1.05)', icon: '🎬' },
];

export const LIGHTING_PRESETS = [
  { id: 'none', name: 'Natural', icon: '☀️' },
  { id: 'ring_light', name: 'Ring Light', icon: '💡' },
  { id: 'sunset_lamp', name: 'Sunset Lamp', icon: '🌇' },
  { id: 'cyber_ambient', name: 'Cyber Neon', icon: '🟣' },
  { id: 'warm_candle', name: 'Warm Amber', icon: '🕯️' },
];

export interface LiveBeautyEnhancementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skinSmoothing: number; // 0 - 100
  onSkinSmoothingChange?: (val: number) => void;
  setSkinSmoothing?: (val: number | ((prev: number) => number)) => void;
  skinLightening: number; // 0 - 100
  onSkinLighteningChange?: (val: number) => void;
  setSkinLightening?: (val: number | ((prev: number) => number)) => void;
  skinTone: string; // 'natural' | 'porcelain' | 'rosy' | 'golden'
  onSkinToneChange?: (tone: any) => void;
  setSkinTone?: (tone: any) => void;
  activeFilter?: string;
  activeBeautyFilter?: string;
  onFilterChange?: (filterId: string) => void;
  setActiveBeautyFilter?: (filterId: string) => void;
  activeLighting?: string;
  onLightingChange?: (lightingId: string) => void;
  setActiveLighting?: (lightingId: string) => void;
  onResetAll: () => void;
  showToast?: (msg: string) => void;
}

export const LiveBeautyEnhancementsModal: React.FC<LiveBeautyEnhancementsModalProps> = ({
  isOpen,
  onClose,
  skinSmoothing,
  onSkinSmoothingChange,
  setSkinSmoothing,
  skinLightening,
  onSkinLighteningChange,
  setSkinLightening,
  skinTone,
  onSkinToneChange,
  setSkinTone,
  activeFilter,
  activeBeautyFilter,
  onFilterChange,
  setActiveBeautyFilter,
  activeLighting = 'none',
  onLightingChange,
  setActiveLighting,
  onResetAll,
  showToast,
}) => {
  const [tab, setTab] = useState<'skin' | 'filters' | 'lighting'>('skin');

  const handleSmoothChange = onSkinSmoothingChange || setSkinSmoothing || (() => {});
  const handleLighteningChange = onSkinLighteningChange || setSkinLightening || (() => {});
  const handleToneChange = onSkinToneChange || setSkinTone || (() => {});
  const currentFilter = activeBeautyFilter || activeFilter || 'normal';
  const handleFilterSelect = onFilterChange || setActiveBeautyFilter || (() => {});
  const handleLightingSelect = onLightingChange || setActiveLighting || (() => {});

  if (!isOpen) return null;

  return (
    <div className="liveme-enhancements-backdrop" onClick={onClose}>
      <div className="liveme-enhancements-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="liveme-enhancements-header">
          <div className="liveme-enhancements-title-box">
            <span className="liveme-enhancements-sparkle">🪄</span>
            <div>
              <h3 className="liveme-enhancements-title">Beauty & Studio Enhancements</h3>
              <p className="liveme-enhancements-sub">Studio-grade skin lighting, beauty filters & ambiance</p>
            </div>
          </div>
          <div className="liveme-enhancements-top-actions">
            <button
              type="button"
              className="liveme-enhancements-reset-btn"
              onClick={() => {
                onResetAll();
                if (showToast) showToast('✨ Beauty enhancements reset to original natural state.');
              }}
              title="Reset all enhancements"
            >
              Reset
            </button>
            <button type="button" className="liveme-enhancements-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="liveme-enhancements-tabs">
          <button
            type="button"
            className={`liveme-enhancements-tab ${tab === 'skin' ? 'active' : ''}`}
            onClick={() => setTab('skin')}
          >
            ✨ Skin & Tone
          </button>
          <button
            type="button"
            className={`liveme-enhancements-tab ${tab === 'filters' ? 'active' : ''}`}
            onClick={() => setTab('filters')}
          >
            🎨 Visual Filters
          </button>
          <button
            type="button"
            className={`liveme-enhancements-tab ${tab === 'lighting' ? 'active' : ''}`}
            onClick={() => setTab('lighting')}
          >
            💡 Studio Lighting
          </button>
        </div>

        {/* TAB 1: SKIN & TONE */}
        {tab === 'skin' && (
          <div className="liveme-enhancements-body">
            {/* Skin Tone Selector */}
            <div className="liveme-enhancements-section">
              <label className="liveme-slider-label">
                <span>Skin Tone Base</span>
                <span className="liveme-slider-value">{skinTone.toUpperCase()}</span>
              </label>
              <div className="liveme-tone-chips">
                {[
                  { id: 'natural', label: 'Natural Glow', color: '#f5d0b5' },
                  { id: 'porcelain', label: 'Porcelain White', color: '#ffede0' },
                  { id: 'rosy', label: 'Rosy Blush', color: '#ffccd5' },
                  { id: 'golden', label: 'Warm Golden', color: '#e6b980' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`liveme-tone-chip ${skinTone === t.id ? 'active' : ''}`}
                    onClick={() => {
                      handleToneChange(t.id);
                      if (showToast) showToast(`✨ Skin tone preset: ${t.label}`);
                    }}
                  >
                    <span className="liveme-tone-dot" style={{ background: t.color }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Skin Lightening Slider */}
            <div className="liveme-enhancements-section">
              <div className="liveme-slider-label">
                <span>🌟 Skin Brightening & Radiance</span>
                <span className="liveme-slider-value">+{skinLightening}%</span>
              </div>
              <div className="liveme-slider-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={skinLightening}
                  className="liveme-beauty-range"
                  onChange={(e) => handleLighteningChange(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Skin Smoothing Slider */}
            <div className="liveme-enhancements-section">
              <div className="liveme-slider-label">
                <span>💎 Smoothness & Soft Focus</span>
                <span className="liveme-slider-value">+{skinSmoothing}%</span>
              </div>
              <div className="liveme-slider-row">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={skinSmoothing}
                  className="liveme-beauty-range"
                  onChange={(e) => handleSmoothChange(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: VISUAL FILTERS */}
        {tab === 'filters' && (
          <div className="liveme-enhancements-body">
            <div className="liveme-filters-grid">
              {BEAUTY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`liveme-filter-card ${currentFilter === f.id ? 'active' : ''}`}
                  onClick={() => {
                    handleFilterSelect(f.id);
                    if (showToast) showToast(`🎨 Applied ${f.name} filter`);
                  }}
                >
                  <div className="liveme-filter-thumb-wrap">
                    <img src={f.thumbnail} alt={f.name} className="liveme-filter-thumb" />
                    {currentFilter === f.id && <span className="liveme-filter-check">✓</span>}
                  </div>
                  <span className="liveme-filter-name">{f.icon} {f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: STUDIO LIGHTING */}
        {tab === 'lighting' && (
          <div className="liveme-enhancements-body">
            <div className="liveme-lighting-chips">
              {LIGHTING_PRESETS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`liveme-lighting-card ${activeLighting === l.id ? 'active' : ''}`}
                  onClick={() => {
                    handleLightingSelect(l.id);
                    if (showToast) showToast(`💡 Studio atmosphere: ${l.name}`);
                  }}
                >
                  <span className="liveme-lighting-icon">{l.icon}</span>
                  <span className="liveme-lighting-title">{l.name}</span>
                  {activeLighting === l.id && <span className="liveme-lighting-active-badge">Active</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer Done Button */}
        <div className="liveme-enhancements-footer">
          <button type="button" className="liveme-enhancements-done-btn" onClick={onClose}>
            ✓ Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
