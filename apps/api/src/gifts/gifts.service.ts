import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendGiftDto } from './dto/send-gift.dto';
import { CreateGiftDto } from './dto/create-gift.dto';
import { Gift, GiftCategory, GiftRarity } from '@prisma/client';

export const INITIAL_GIFTS_SEED: Array<{
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  animationUrl: string;
  webmUrl?: string;
  coinCost: number;
  category: GiftCategory;
  rarity: GiftRarity;
  animationDuration: number;
  enabled: boolean;
  soundUrl?: string;
  maxConcurrent: number;
  priority: number;
}> = [
  {
    id: 'rose',
    name: 'Rose',
    description: 'Realistic blooming red rose with petals and golden sparkles',
    iconUrl: '/gifts/rose/icon.webp',
    animationUrl: '/gifts/rose/animation.apng',
    webmUrl: '/gifts/rose/animation.webm',
    coinCost: 10,
    category: GiftCategory.love,
    rarity: GiftRarity.common,
    animationDuration: 3000,
    enabled: true,
    soundUrl: '/gifts/rose/sound.mp3',
    maxConcurrent: 5,
    priority: 1,
  },
  {
    id: 'tropical-mosquito',
    name: 'Tropical Mosquito',
    description: 'Cyber-mosquito with neon wings, sunglasses, water droplets and colorful particles',
    iconUrl: '/gifts/tropical-mosquito/icon.webp',
    animationUrl: '/gifts/tropical-mosquito/animation.apng',
    webmUrl: '/gifts/tropical-mosquito/animation.webm',
    coinCost: 250,
    category: GiftCategory.fun,
    rarity: GiftRarity.special,
    animationDuration: 8000,
    enabled: true,
    soundUrl: '/gifts/tropical-mosquito/sound.mp3',
    maxConcurrent: 2,
    priority: 4,
  },
  {
    id: 'super-galaxy',
    name: 'Super Galaxy',
    description: 'Cosmic galaxy gift box opening into miniature universe with orbiting planets and Privity crown',
    iconUrl: '/gifts/super-galaxy/icon.webp',
    animationUrl: '/gifts/super-galaxy/animation.apng',
    webmUrl: '/gifts/super-galaxy/animation.webm',
    coinCost: 5000,
    category: GiftCategory.premium,
    rarity: GiftRarity.legendary,
    animationDuration: 10000,
    enabled: true,
    soundUrl: '/gifts/super-galaxy/sound.mp3',
    maxConcurrent: 1,
    priority: 5,
  },
  {
    id: 'dragon',
    name: 'Dragon',
    description: 'Massive blue-energy dragon rising, flying, roaring, with blue energy eruption and Privity crown',
    iconUrl: '/gifts/dragon/icon.webp',
    animationUrl: '/gifts/dragon/animation.apng',
    webmUrl: '/gifts/dragon/animation.webm',
    coinCost: 10000,
    category: GiftCategory.fantasy,
    rarity: GiftRarity.legendary,
    animationDuration: 8000,
    enabled: true,
    soundUrl: '/gifts/dragon/sound.mp3',
    maxConcurrent: 1,
    priority: 5,
  },
];

@Injectable()
export class GiftsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedInitialGifts();
    } catch (e) {
      console.warn('Gifts initialization/seed skipped or deferred:', (e as Error).message);
    }
  }

  async seedInitialGifts(): Promise<void> {
    for (const g of INITIAL_GIFTS_SEED) {
      await this.prisma.gift.upsert({
        where: { id: g.id },
        update: {
          name: g.name,
          description: g.description,
          iconUrl: g.iconUrl,
          animationUrl: g.animationUrl,
          webmUrl: g.webmUrl,
          coinCost: g.coinCost,
          category: g.category,
          rarity: g.rarity,
          animationDuration: g.animationDuration,
          enabled: g.enabled,
          soundUrl: g.soundUrl,
          maxConcurrent: g.maxConcurrent,
          priority: g.priority,
        },
        create: g,
      });
    }
  }

  async getGiftsCatalog(includeDisabled = false): Promise<Gift[]> {
    return this.prisma.gift.findMany({
      where: includeDisabled ? {} : { enabled: true },
      orderBy: [{ priority: 'desc' }, { coinCost: 'asc' }],
    });
  }

  async getGiftById(id: string): Promise<Gift> {
    const gift = await this.prisma.gift.findUnique({ where: { id } });
    if (!gift) {
      throw new NotFoundException(`Gift with id '${id}' not found`);
    }
    return gift;
  }

  async getUserBalance(userId: string): Promise<{ userId: string; coins: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coins: true },
    });
    if (!user) {
      throw new NotFoundException(`User with id '${userId}' not found`);
    }
    return { userId: user.id, coins: user.coins };
  }

  async sendGift(senderId: string, dto: SendGiftDto) {
    const rawQty = dto.quantity !== undefined ? dto.quantity : 1;
    if (typeof rawQty !== 'number' || !Number.isInteger(rawQty) || rawQty <= 0) {
      throw new BadRequestException('Quantity must be a positive integer of at least 1');
    }
    const quantity = rawQty;

    if (senderId === dto.recipientId) {
      throw new ForbiddenException('Platform rules prohibit sending gifts to yourself');
    }

    const gift = await this.prisma.gift.findUnique({
      where: { id: dto.giftId },
    });

    if (!gift) {
      throw new NotFoundException(`Gift '${dto.giftId}' not found`);
    }

    if (!gift.enabled) {
      throw new BadRequestException(`Gift '${gift.name}' is currently disabled`);
    }

    const totalCoinCost = gift.coinCost * quantity;

    // Execute atomic transaction for coin deduction and transaction records
    const result = await this.prisma.$transaction(async (tx) => {
      const sender = await tx.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, displayName: true, avatarUrl: true, coins: true },
      });

      if (!sender) {
        throw new NotFoundException('Sender account not found');
      }

      if (sender.coins < totalCoinCost) {
        throw new BadRequestException(
          `Insufficient coins. Required: ${totalCoinCost}, Available: ${sender.coins}`,
        );
      }

      // Check recipient exists
      const recipient = await tx.user.findUnique({
        where: { id: dto.recipientId },
        select: { id: true, username: true, displayName: true },
      });

      if (!recipient) {
        throw new NotFoundException('Streamer/Recipient account not found');
      }

      // Deduct sender balance
      const updatedSender = await tx.user.update({
        where: { id: senderId },
        data: { coins: { decrement: totalCoinCost } },
        select: { coins: true },
      });

      // Credit recipient balance (streamers receive gift revenue/coins)
      await tx.user.update({
        where: { id: dto.recipientId },
        data: { coins: { increment: totalCoinCost } },
      });

      // Record transaction
      const transaction = await tx.giftTransaction.create({
        data: {
          giftId: gift.id,
          senderId,
          recipientId: dto.recipientId,
          livestreamId: dto.livestreamId,
          quantity,
          coinCost: gift.coinCost,
          totalCoinCost,
        },
      });

      // Record livestream gift event
      const eventRecord = await tx.livestreamGiftEvent.create({
        data: {
          livestreamId: dto.livestreamId,
          senderId,
          recipientId: dto.recipientId,
          giftId: gift.id,
          quantity,
          coinValue: totalCoinCost,
        },
      });

      const giftEvent = {
        id: eventRecord.id,
        livestreamId: dto.livestreamId,
        senderId: sender.id,
        senderName: sender.displayName || sender.username,
        senderAvatar: sender.avatarUrl,
        recipientId: recipient.id,
        recipientName: recipient.displayName || recipient.username,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.iconUrl,
        quantity,
        coinValue: totalCoinCost,
        createdAt: eventRecord.createdAt.toISOString(),
      };

      return {
        transaction,
        newBalance: updatedSender.coins,
        giftEvent,
      };
    });

    return {
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
      giftEvent: result.giftEvent,
    };
  }

  async adminCreateOrUpdateGift(dto: CreateGiftDto): Promise<Gift> {
    return this.prisma.gift.upsert({
      where: { id: dto.id },
      update: {
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        animationUrl: dto.animationUrl,
        webmUrl: dto.webmUrl,
        previewUrl: dto.previewUrl,
        coinCost: dto.coinCost,
        category: dto.category ?? GiftCategory.special,
        rarity: dto.rarity ?? GiftRarity.common,
        animationDuration: dto.animationDuration ?? 3000,
        enabled: dto.enabled ?? true,
        soundUrl: dto.soundUrl,
        maxConcurrent: dto.maxConcurrent ?? 3,
        priority: dto.priority ?? 1,
      },
      create: {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        iconUrl: dto.iconUrl,
        animationUrl: dto.animationUrl,
        webmUrl: dto.webmUrl,
        previewUrl: dto.previewUrl,
        coinCost: dto.coinCost,
        category: dto.category ?? GiftCategory.special,
        rarity: dto.rarity ?? GiftRarity.common,
        animationDuration: dto.animationDuration ?? 3000,
        enabled: dto.enabled ?? true,
        soundUrl: dto.soundUrl,
        maxConcurrent: dto.maxConcurrent ?? 3,
        priority: dto.priority ?? 1,
      },
    });
  }
}
