export type GiftCategory = 'love' | 'premium' | 'fantasy' | 'fun' | 'special';

export type GiftRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'special';

export interface Gift {
  id: string;
  name: string;
  description?: string;
  icon: string;
  animationUrl: string;
  webmUrl?: string;
  previewUrl?: string;
  coinCost: number;
  category: GiftCategory;
  rarity: GiftRarity;
  animationDuration: number;
  enabled: boolean;
  soundUrl?: string;
  maxConcurrent?: number;
  priority?: number;
}

export interface GiftEvent {
  id: string;
  livestreamId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName?: string;
  giftId: string;
  giftName: string;
  giftIcon?: string;
  quantity: number;
  coinValue: number;
  createdAt: string;
}

export interface GiftTransaction {
  id: string;
  giftId: string;
  senderId: string;
  recipientId: string;
  livestreamId: string;
  quantity: number;
  coinCost: number;
  totalCoinCost: number;
  createdAt: string;
}

export interface SendGiftDto {
  giftId: string;
  livestreamId: string;
  recipientId: string;
  quantity?: number;
}

export interface SendGiftResponse {
  success: boolean;
  transaction: GiftTransaction;
  newBalance: number;
  giftEvent: GiftEvent;
}
