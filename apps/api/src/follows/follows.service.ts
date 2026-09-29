import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  async follow(followerId: string, followeeId: string) {
    if (followerId === followeeId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const followee = await this.prisma.user.findUnique({
      where: { id: followeeId },
    });

    if (!followee) {
      throw new NotFoundException('User to follow not found');
    }

    // Determine status based on followee account privacy
    const initialStatus = followee.privacySetting === 'private' ? 'pending' : 'accepted';

    const follow = await this.prisma.follow.upsert({
      where: {
        followerId_followeeId: {
          followerId,
          followeeId,
        },
      },
      update: {
        status: initialStatus,
      },
      create: {
        followerId,
        followeeId,
        status: initialStatus,
      },
    });

    // Create notification for followee
    await this.prisma.notification.create({
      data: {
        userId: followeeId,
        type: initialStatus === 'pending' ? 'follow_request' : 'new_follower',
        payload: {
          followerId,
          status: initialStatus,
        },
      },
    });

    return {
      status: follow.status,
      isPending: follow.status === 'pending',
      isAccepted: follow.status === 'accepted',
    };
  }

  async unfollow(followerId: string, followeeId: string) {
    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followeeId,
      },
    });
    return { success: true };
  }

  async acceptFollowRequest(currentUserId: string, requesterId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: requesterId,
          followeeId: currentUserId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('Follow request not found');
    }

    const updated = await this.prisma.follow.update({
      where: { id: follow.id },
      data: { status: 'accepted' },
    });

    // Notify requester that follow was accepted
    await this.prisma.notification.create({
      data: {
        userId: requesterId,
        type: 'follow_request_accepted',
        payload: {
          followeeId: currentUserId,
        },
      },
    });

    return { success: true, status: updated.status };
  }

  async rejectFollowRequest(currentUserId: string, requesterId: string) {
    await this.prisma.follow.deleteMany({
      where: {
        followerId: requesterId,
        followeeId: currentUserId,
        status: 'pending',
      },
    });
    return { success: true };
  }

  async getFollowers(userId: string) {
    const list = await this.prisma.follow.findMany({
      where: { followeeId: userId, status: 'accepted' },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });
    return list.map((f) => f.follower);
  }

  async getFollowing(userId: string) {
    const list = await this.prisma.follow.findMany({
      where: { followerId: userId, status: 'accepted' },
      include: {
        followee: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
      },
    });
    return list.map((f) => f.followee);
  }
}
