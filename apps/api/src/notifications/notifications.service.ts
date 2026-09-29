import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Notification } from '@privity/types';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getUserNotifications(userId: string): Promise<Notification[]> {
    const list = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return list.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as any,
      payload: (n.payload as any) || {},
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async markAsRead(userId: string, notificationIds?: string[]) {
    if (notificationIds && notificationIds.length > 0) {
      await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
        },
        data: { isRead: true },
      });
    } else {
      // Mark all read
      await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }

    return { success: true };
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    return user?.settings || {};
  }

  async updatePreferences(userId: string, settings: any) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { settings },
      select: { settings: true },
    });
    return user.settings;
  }
}
