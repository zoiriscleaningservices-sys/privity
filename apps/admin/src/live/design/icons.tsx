import React from 'react';
import {
  Volume2,
  VolumeX,
  Vibrate,
  X,
  Send,
  Share2,
  Users,
  Eye,
  Gift as GiftIcon,
  Flame,
  Swords,
  Trophy,
  Crown,
  Sparkles,
  Shield,
  Heart,
  MessageCircle,
  Camera,
  Mic,
  MicOff,
  SwitchCamera,
  Play,
  RotateCcw,
  Zap,
  Check,
  AlertTriangle,
  Radio,
  UserCheck,
  UserPlus,
  Coins,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  Settings,
} from 'lucide-react';

export {
  Volume2,
  VolumeX,
  Vibrate,
  X,
  Send,
  Share2,
  Users,
  Eye,
  GiftIcon,
  Flame,
  Swords,
  Trophy,
  Crown,
  Sparkles,
  Shield,
  Heart,
  MessageCircle,
  Camera,
  Mic,
  MicOff,
  SwitchCamera,
  Play,
  RotateCcw,
  Zap,
  Check,
  AlertTriangle,
  Radio,
  UserCheck,
  UserPlus,
  Coins,
  ChevronRight,
  Maximize2,
  Minimize2,
  Sliders,
  Settings,
};

/** Privity Brand Emblem SVG */
export const PrivityEmblemIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M12 2L3 7V12C3 17.5 7 21.5 12 22C17 21.5 21 17.5 21 12V7L12 2Z"
      stroke="url(#privity-emblem-grad)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 7L16 11H8L12 7Z"
      fill="url(#privity-emblem-grad)"
    />
    <path
      d="M12 17V12"
      stroke="url(#privity-emblem-grad)"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="privity-emblem-grad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1" />
        <stop offset="0.5" stopColor="#a855f7" />
        <stop offset="1" stopColor="#ec4899" />
      </linearGradient>
    </defs>
  </svg>
);

/** Double Multiplier 2X Badge SVG */
export const Double2XBadge: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect width="32" height="32" rx="8" fill="url(#double-2x-grad)" />
    <path
      d="M8 12.5C8 10.5 9.5 9 11.5 9C13.5 9 15 10.5 15 12.5C15 14.5 13 16.5 9 20H15.5V22H8V20L12.5 15C13.5 14 13.5 13 13.5 12.5C13.5 11.5 12.5 10.5 11.5 10.5C10.5 10.5 9.5 11.5 9.5 12.5H8Z"
      fill="#030407"
      fontWeight="bold"
    />
    <path
      d="M17.5 10L20.5 15.5L17.5 21H19.5L21.5 17.5L23.5 21H25.5L22.5 15.5L25.5 10H23.5L21.5 13.5L19.5 10H17.5Z"
      fill="#030407"
      fontWeight="bold"
    />
    <defs>
      <linearGradient id="double-2x-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f59e0b" />
        <stop offset="0.5" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#fef08a" />
      </linearGradient>
    </defs>
  </svg>
);
