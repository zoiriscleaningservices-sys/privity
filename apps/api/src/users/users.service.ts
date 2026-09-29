import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from '../privacy/privacy.service';
import { UserProfile, UpdateProfileDto } from '@privity/types';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private privacyService: PrivacyService,
  ) {}

  async getProfileByUsername(
    username: string,
    currentUserId?: string | null,
  ): Promise<UserProfile> {
    const user = await this.prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      include: {
        _count: {
          select: {
            followers: { where: { status: 'accepted' } },
            following: { where: { status: 'accepted' } },
            posts: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let isFollowing = false;
    let isFollowPending = false;
    let isCloseFriend = false;

    if (currentUserId && currentUserId !== user.id) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: currentUserId,
            followeeId: user.id,
          },
        },
      });

      if (follow) {
        isFollowing = follow.status === 'accepted';
        isFollowPending = follow.status === 'pending';
      }

      const closeFriend = await this.prisma.closeFriend.findUnique({
        where: {
          userId_friendId: {
            userId: user.id,
            friendId: currentUserId,
          },
        },
      });
      isCloseFriend = !!closeFriend;
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: currentUserId === user.id ? user.email : undefined,
      phone: currentUserId === user.id ? user.phone || undefined : undefined,
      bio: user.bio || undefined,
      avatarUrl: user.avatarUrl || undefined,
      privacySetting: user.privacySetting as any,
      role: user.role as any,
      isVerified: user.isVerified,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      postCount: user._count.posts,
      pinnedPostId: user.pinnedPostId,
      isFollowing,
      isFollowPending,
      isCloseFriend,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    currentUserId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    if (userId !== currentUserId) {
      throw new ForbiddenException('Cannot edit another user profile');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        privacySetting: dto.privacySetting as any,
        pinnedPostId: dto.pinnedPostId,
      },
      include: {
        _count: {
          select: {
            followers: { where: { status: 'accepted' } },
            following: { where: { status: 'accepted' } },
            posts: { where: { deletedAt: null } },
          },
        },
      },
    });

    return {
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      email: updated.email,
      phone: updated.phone || undefined,
      bio: updated.bio || undefined,
      avatarUrl: updated.avatarUrl || undefined,
      privacySetting: updated.privacySetting as any,
      role: updated.role as any,
      isVerified: updated.isVerified,
      followerCount: updated._count.followers,
      followingCount: updated._count.following,
      postCount: updated._count.posts,
      pinnedPostId: updated.pinnedPostId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async getUserPosts(authorId: string, viewerId: string | null) {
    const rawPosts = await this.prisma.post.findMany({
      where: {
        authorId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            privacySetting: true,
            isSuspended: true,
            isBanned: true,
          },
        },
      },
    });

    // Enforce Privacy Check on each post
    const filteredPosts = [];
    for (const post of rawPosts) {
      const allowed = await this.privacyService.canViewPost(post.id, viewerId);
      if (allowed) {
        filteredPosts.push(post);
      }
    }

    return filteredPosts;
  }

  async toggleCloseFriend(ownerId: string, friendId: string) {
    const existing = await this.prisma.closeFriend.findUnique({
      where: {
        userId_friendId: {
          userId: ownerId,
          friendId,
        },
      },
    });

    if (existing) {
      await this.prisma.closeFriend.delete({
        where: { id: existing.id },
      });
      return { isCloseFriend: false };
    } else {
      await this.prisma.closeFriend.create({
        data: {
          userId: ownerId,
          friendId,
        },
      });
      return { isCloseFriend: true };
    }
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        posts: true,
        comments: true,
        likes: true,
        saves: true,
        followers: true,
        following: true,
      },
    });
    return { data: user, exportDate: new Date().toISOString() };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.delete({
      where: { id: userId },
    });
    return { success: true, message: 'Account permanently deleted' };
  }
}
