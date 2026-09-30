import { Test, TestingModule } from '@nestjs/testing';
import { GiftsService } from './gifts.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GiftCategory, GiftRarity } from '@prisma/client';

describe('GiftsService', () => {
  let service: GiftsService;
  let mockPrisma: any;

  const mockGift = {
    id: 'rose',
    name: 'Rose',
    description: 'Realistic blooming red rose',
    iconUrl: '/gifts/rose/icon.webp',
    animationUrl: '/gifts/rose/animation.apng',
    coinCost: 10,
    category: GiftCategory.love,
    rarity: GiftRarity.common,
    animationDuration: 3000,
    enabled: true,
    soundUrl: '/gifts/rose/sound.mp3',
    maxConcurrent: 5,
    priority: 1,
  };

  const mockSender = {
    id: 'user-sender',
    username: 'luciano',
    displayName: 'Luciano',
    avatarUrl: 'https://example.com/avatar.jpg',
    coins: 100,
  };

  const mockRecipient = {
    id: 'user-streamer',
    username: 'streamer_pro',
    displayName: 'Elena Streamer',
  };

  beforeEach(async () => {
    mockPrisma = {
      gift: {
        findMany: jest.fn().mockResolvedValue([mockGift]),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'rose') return Promise.resolve(mockGift);
          if (where.id === 'disabled-gift') return Promise.resolve({ ...mockGift, id: 'disabled-gift', enabled: false });
          return Promise.resolve(null);
        }),
        upsert: jest.fn().mockResolvedValue(mockGift),
      },
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-sender') return Promise.resolve({ ...mockSender });
          if (where.id === 'user-streamer') return Promise.resolve({ ...mockRecipient });
          return Promise.resolve(null);
        }),
        update: jest.fn(),
      },
      giftTransaction: {
        create: jest.fn(),
      },
      livestreamGiftEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<GiftsService>(GiftsService);
  });

  describe('getGiftsCatalog', () => {
    it('returns enabled gifts ordered by priority and cost', async () => {
      const catalog = await service.getGiftsCatalog();
      expect(catalog).toEqual([mockGift]);
      expect(mockPrisma.gift.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
        orderBy: [{ priority: 'desc' }, { coinCost: 'asc' }],
      });
    });
  });

  describe('sendGift', () => {
    it('successfully processes gift transaction and deducts coins atomically', async () => {
      const quantity = 3;
      const totalCost = mockGift.coinCost * quantity; // 30

      mockPrisma.user.update
        .mockResolvedValueOnce({ coins: mockSender.coins - totalCost }) // sender decrement
        .mockResolvedValueOnce({ coins: totalCost }); // recipient increment

      const createdTx = {
        id: 'tx-123',
        giftId: mockGift.id,
        senderId: mockSender.id,
        recipientId: mockRecipient.id,
        livestreamId: 'live-stream-1',
        quantity,
        coinCost: mockGift.coinCost,
        totalCoinCost: totalCost,
        createdAt: new Date(),
      };
      mockPrisma.giftTransaction.create.mockResolvedValue(createdTx);

      const createdEvent = {
        id: 'event-123',
        livestreamId: 'live-stream-1',
        senderId: mockSender.id,
        recipientId: mockRecipient.id,
        giftId: mockGift.id,
        quantity,
        coinValue: totalCost,
        createdAt: new Date(),
      };
      mockPrisma.livestreamGiftEvent.create.mockResolvedValue(createdEvent);

      const result = await service.sendGift(mockSender.id, {
        giftId: 'rose',
        recipientId: mockRecipient.id,
        livestreamId: 'live-stream-1',
        quantity,
      });

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(70);
      expect(result.transaction.totalCoinCost).toBe(30);
      expect(result.giftEvent.giftName).toBe('Rose');
      expect(result.giftEvent.coinValue).toBe(30);

      // Verify atomic database updates
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockSender.id },
        data: { coins: { decrement: totalCost } },
        select: { coins: true },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockRecipient.id },
        data: { coins: { increment: totalCost } },
      });
    });

    it('rejects sending gift when user has insufficient coins', async () => {
      mockPrisma.user.findUnique.mockImplementation(({ where }) => {
        if (where.id === 'user-poor') return Promise.resolve({ ...mockSender, id: 'user-poor', coins: 5 });
        if (where.id === 'user-streamer') return Promise.resolve(mockRecipient);
        return Promise.resolve(null);
      });

      await expect(
        service.sendGift('user-poor', {
          giftId: 'rose',
          recipientId: mockRecipient.id,
          livestreamId: 'live-stream-1',
          quantity: 1, // costs 10
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects sending a disabled gift', async () => {
      await expect(
        service.sendGift(mockSender.id, {
          giftId: 'disabled-gift',
          recipientId: mockRecipient.id,
          livestreamId: 'live-stream-1',
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects sending a nonexistent gift', async () => {
      await expect(
        service.sendGift(mockSender.id, {
          giftId: 'ghost-gift',
          recipientId: mockRecipient.id,
          livestreamId: 'live-stream-1',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('prevents sending gifts to yourself', async () => {
      await expect(
        service.sendGift(mockSender.id, {
          giftId: 'rose',
          recipientId: mockSender.id,
          livestreamId: 'live-stream-1',
          quantity: 1,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid or non-positive quantities', async () => {
      await expect(
        service.sendGift(mockSender.id, {
          giftId: 'rose',
          recipientId: mockRecipient.id,
          livestreamId: 'live-stream-1',
          quantity: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
