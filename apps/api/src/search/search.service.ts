import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from '../privacy/privacy.service';

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private privacyService: PrivacyService,
  ) {}

  async search(query: string, type: 'users' | 'posts' | 'tags' | 'all' = 'all', viewerId: string | null) {
    const q = (query || '').trim();
    if (!q) {
      return { users: [], posts: [], tags: [] };
    }

    const results: any = {};

    if (type === 'users' || type === 'all') {
      const users = await this.prisma.user.findMany({
        where: {
          isBanned: false,
          isSuspended: false,
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isVerified: true,
          privacySetting: true,
        },
        take: 20,
      });
      results.users = users;
    }

    if (type === 'posts' || type === 'all') {
      // Find candidate public posts
      const rawPosts = await this.prisma.post.findMany({
        where: {
          deletedAt: null,
          scheduledAt: null,
          privacy: 'public',
          author: {
            privacySetting: 'public',
            isBanned: false,
            isSuspended: false,
          },
          OR: [
            { caption: { contains: q, mode: 'insensitive' } },
            { tags: { has: q.toLowerCase().replace('#', '') } },
          ],
        },
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              isVerified: true,
            },
          },
        },
        take: 20,
      });

      // Confirm with privacy service
      const verifiedPosts = [];
      for (const post of rawPosts) {
        if (await this.privacyService.canViewPost(post.id, viewerId)) {
          verifiedPosts.push(post);
        }
      }
      results.posts = verifiedPosts;
    }

    if (type === 'tags' || type === 'all') {
      const cleanTag = q.toLowerCase().replace('#', '');
      const postsWithTags = await this.prisma.post.findMany({
        where: {
          deletedAt: null,
          privacy: 'public',
          author: { privacySetting: 'public' },
          tags: { hasSome: [cleanTag] },
        },
        select: { tags: true },
        take: 50,
      });

      const tagCounts = new Map<string, number>();
      for (const p of postsWithTags) {
        for (const tag of p.tags) {
          if (tag.toLowerCase().includes(cleanTag)) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }

      results.tags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    return results;
  }

  async getDiscovery(viewerId: string | null) {
    // 1. Suggested users (popular or recent creators)
    const suggestedUsers = await this.prisma.user.findMany({
      where: {
        isBanned: false,
        isSuspended: false,
        privacySetting: 'public',
        ...(viewerId ? { id: { not: viewerId } } : {}),
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
      },
    });

    // 2. Trending public posts
    const trendingPosts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        scheduledAt: null,
        privacy: 'public',
        author: {
          privacySetting: 'public',
          isBanned: false,
          isSuspended: false,
        },
      },
      orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      include: {
        author: {
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

    return {
      suggestedUsers,
      trendingPosts,
      popularTags: ['privity', 'creators', 'photography', 'tech', 'minimal', 'daily'],
    };
  }
}
