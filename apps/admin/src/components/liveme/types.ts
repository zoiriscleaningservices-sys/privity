export interface LiveMeStreamer {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  category: string;
  title: string;
  description: string;
  viewersCount: number;
  totalViews: string;
  popularity: string;
  diamonds: number;
  likesCount: number;
  videoStreamUrl?: string;
  posterUrl: string;
  tags: string[];
  tagBadge?: string;
  isHost?: boolean;
  isCameraStream?: boolean;
  peerId?: string;
  topContributors: LiveMeContributor[];
}

export interface LiveMeContributor {
  id: string;
  name: string;
  avatar: string;
  rank: 1 | 2 | 3;
  contribution: number;
}

export interface LiveMeChatMessage {
  id: string;
  user: string;
  handle: string;
  avatar?: string;
  level?: number;
  badge?: string;
  text: string;
  isHost?: boolean;
  isSystem?: boolean;
  isJoin?: boolean;
  giftInfo?: {
    name: string;
    icon: string;
    imageIcon?: string;
    count: number;
    coins: number;
  };
  timestamp: number;
}

export interface LiveMeGiftItem {
  id: string;
  name: string;
  coins: number;
  icon: string;
  imageIcon?: string;
  soundUrl?: string;
  category: 'popular' | 'special' | 'pranks' | 'nvip' | 'celebrity';
  isAnimation?: boolean;
  animationKey?: 'rose' | 'dragon' | 'super-galaxy' | 'tropical-mosquito';
  tag?: string;
}

export interface RechargeTier {
  id: string;
  coins: number;
  bonusCoins: number;
  priceUsd: number;
  popular?: boolean;
}
