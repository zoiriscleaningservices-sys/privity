export type CameraMode = 'POST' | 'CREATE' | 'LIVE' | 'STORY';

export type DurationMode = '10m' | '60s' | '15s' | 'PHOTO' | 'TEXT';

export type CameraFilter = 'none' | 'cyberpunk' | 'golden' | 'noir' | 'vhs' | 'vivid' | 'emerald';

export type ARSticker = 'none' | 'hud' | 'stars' | 'glasses' | 'sparkles' | 'crown';

export interface SoundTrack {
  id: string;
  name: string;
  artist: string;
  duration: string;
  genre: string;
  bpm?: number;
}

export interface CapturedMedia {
  type: 'photo' | 'video';
  dataUrl: string;
  blob?: Blob;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export const PRESET_SOUNDS: SoundTrack[] = [
  { id: 'sound-1', name: 'Privity Neon Pulse', artist: 'CyberWave Labs', duration: '0:32', genre: 'Electronic / Synth' },
  { id: 'sound-2', name: 'Golden Hour Chill', artist: 'Elena & The LoFi', duration: '0:45', genre: 'Chillhop' },
  { id: 'sound-3', name: 'Tokyo Night Drive', artist: 'Kenji Visuals', duration: '0:28', genre: 'Future Bass' },
  { id: 'sound-4', name: 'Acoustic Sunrise Glow', artist: 'Marcus Solo', duration: '0:50', genre: 'Acoustic' },
  { id: 'sound-5', name: 'Hyper Pop Sparks', artist: 'Vance & Co.', duration: '0:30', genre: 'Hyperpop' },
  { id: 'sound-6', name: 'Deep Space Drone', artist: 'Julian Thorne', duration: '1:00', genre: 'Ambient' },
];

export const FILTER_PRESETS: { id: CameraFilter; label: string; filterStyle: string; icon: string }[] = [
  { id: 'none', label: 'Normal', filterStyle: 'none', icon: '⚪' },
  { id: 'cyberpunk', label: 'Cyberpunk', filterStyle: 'contrast(1.25) saturate(1.4) hue-rotate(-15deg)', icon: '🔮' },
  { id: 'golden', label: 'Golden Hour', filterStyle: 'sepia(0.25) saturate(1.3) brightness(1.06)', icon: '🌅' },
  { id: 'noir', label: 'B&W Noir', filterStyle: 'grayscale(1) contrast(1.3) brightness(0.95)', icon: '🎞️' },
  { id: 'vhs', label: 'Vintage VHS', filterStyle: 'contrast(1.15) brightness(1.1) saturate(1.2)', icon: '📼' },
  { id: 'vivid', label: 'Vivid Neon', filterStyle: 'saturate(1.7) contrast(1.15)', icon: '🌈' },
  { id: 'emerald', label: 'Emerald Glow', filterStyle: 'hue-rotate(60deg) saturate(1.2)', icon: '✨' },
];

export const AR_EFFECTS: { id: ARSticker; label: string; preview: string; name: string }[] = [
  { id: 'none', label: 'Clean', preview: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', name: 'None' },
  { id: 'hud', label: 'Cyber HUD', preview: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', name: 'AI Vision' },
  { id: 'stars', label: 'Star Dust', preview: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100', name: 'Stars' },
  { id: 'glasses', label: 'Neon Shades', preview: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100', name: 'Shades' },
  { id: 'sparkles', label: 'Glow Magic', preview: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', name: 'Sparkles' },
  { id: 'crown', label: 'Crown Aura', preview: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100', name: 'Crown' },
];
