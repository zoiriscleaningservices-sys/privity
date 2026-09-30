import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 1. Flip Camera: Two curved arrows forming a counter-clockwise circle */
export const IconCameraFlip: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

/** 2. Enhance: Diagonal magic wand with 4 spark lines */
export const IconCameraEnhance: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="m14 4 6 6-12 12H2v-6L14 4Z" />
    <path d="m18 2 2 2" />
    <path d="M12 2l-1 2" />
    <path d="M22 12l-2-1" />
    <path d="m5 19 2-2" />
  </svg>
);

/** 3. Effects: Two 4-point sparkle stars */
export const IconCameraEffects: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4L12 2Z" />
    <path d="M19 16l1.2 2.8L23 20l-2.8 1.2L19 24l-1.2-2.8L15 20l2.8-1.2L19 16Z" />
  </svg>
);

/** 4. Settings: Cogwheel with red notification badge support */
export const IconCameraSettings: React.FC<IconProps & { hasBadge?: boolean }> = ({ size = 28, color = '#ffffff', hasBadge = true }) => (
  <div style={{ position: 'relative', display: 'inline-flex' }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
    {hasBadge && (
      <span style={{
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: '#ff2b54',
        border: '1.5px solid #000',
        boxShadow: '0 0 6px #ff2b54',
      }} />
    )}
  </div>
);

/** 5. Multi-guest: 4-slot grid with checkmark badge */
export const IconCameraMultiGuest: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="3" width="8" height="8" rx="2" />
    <rect x="3" y="13" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
    <path d="m15.5 17 1.5 1.5 3-3" stroke={color} strokeWidth="2" />
  </svg>
);

/** 6. Business: Storefront awning */
export const IconCameraBusiness: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M3 9l1-5h16l1 5" />
    <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    <path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
    <path d="M9 21v-4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4" />
  </svg>
);

/** 7. Service+: Chat bubble with rising arrow and diagonal slash */
export const IconCameraServicePlus: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="m8 13 4-4m0 0h-3m3 0v3" />
    <circle cx="16" cy="11" r="3" stroke="#ff2b54" strokeWidth="1.8" />
    <line x1="14" y1="9" x2="18" y2="13" stroke="#ff2b54" strokeWidth="1.8" />
  </svg>
);

/** 8. Fan Club: Heart badge */
export const IconCameraFanClub: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    <path d="M12 7l1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.4-2.5 1.4.5-2.8-2-2 2.8-.4Z" fill={color} stroke="none" />
  </svg>
);

/** 9. Interact: Chat bubble with OX game / poll symbols inside */
export const IconCameraInteract: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <rect x="3" y="4" width="18" height="13" rx="3" />
    <path d="M8 17l-3 4v-4" />
    <circle cx="8.5" cy="10.5" r="2.2" />
    <path d="m14 8.5 3 4m0-4-3 4" strokeWidth="2.4" />
  </svg>
);

/** 10. Share: Curved forward arrow */
export const IconCameraShare: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M15 4l6 5-6 5V10c-7 0-11 3-12 9 1-6 4-10 12-10V4z" />
  </svg>
);

/** 11. Promote: Flame outline */
export const IconCameraPromote: React.FC<IconProps> = ({ size = 28, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

/** Speed / 4-Point Star Rays (Screenshot 1, item 2) */
export const IconCameraSpeedStar: React.FC<IconProps> = ({ size = 26, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
  </svg>
);

/** Beauty / Smiley face with cheek sparkle (Screenshot 1, item 3) */
export const IconCameraBeautySmiley: React.FC<IconProps> = ({ size = 26, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <circle cx="11" cy="12" r="9" />
    <path d="M8 10h.01M14 10h.01" strokeWidth="3" />
    <path d="M7.5 14.5a4.5 4.5 0 0 0 7 0" />
    <path d="M19 2l.8 1.8L21 4.5l-1.8.8L19 7l-.8-1.7L16.5 4.5l1.7-.7L19 2Z" fill="#ffffff" stroke="none" />
  </svg>
);

/** Timer (Screenshot 1, item 4) */
export const IconCameraTimer: React.FC<IconProps> = ({ size = 26, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M10 2h4" />
  </svg>
);

/** Grid / Split Layout (Screenshot 1, item 5) */
export const IconCameraGrid: React.FC<IconProps> = ({ size = 26, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </svg>
);

/** Dual / Guest Silhouette with check badge (Screenshot 1, item 6) */
export const IconCameraDual: React.FC<IconProps> = ({ size = 26, color = '#ffffff' }) => (
  <div style={{ position: 'relative', display: 'inline-flex' }}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
    <div style={{
      position: 'absolute',
      bottom: 0,
      right: -4,
      width: 13,
      height: 13,
      borderRadius: '50%',
      backgroundColor: '#ff2b54',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1.5px solid #000',
    }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  </div>
);

/** Down Chevron Expander (Screenshot 1, item 7) */
export const IconCameraChevronDown: React.FC<IconProps> = ({ size = 24, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Target / Live Goal Icon */
export const IconLiveGoalTarget: React.FC<IconProps> = ({ size = 18, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" fill={color} />
  </svg>
);

/** Voice chat handset */
export const IconVoiceChatHandset: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/** Device Camera */
export const IconDeviceCameraVideo: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" fill={color} />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

/** Lock / Management */
export const IconLockManagement: React.FC<IconProps> = ({ size = 16, color = '#ffffff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
