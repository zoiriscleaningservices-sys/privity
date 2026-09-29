import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from '../privacy/privacy.service';
import { FeedQueryDto, FeedResponse, Post } from '@privity/types';

@Injectable()
export class FeedService {
  constructor(
    private prisma: PrismaService,
    private privacyService: PrivacyService,
  ) {}

  async getHomeFeed(viewerId: string | null, query: FeedQueryDto): Promise<FeedResponse> {
    const limit = Math.min(query.limit ? Number(query.limit) : 20, 50);

    // Decode cursor: base64(createdAt:postId)
    let cursorDate: Date | undefined;
    let cursorId: string | undefined;

    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf-8');
        const [timeStr, id] = decoded.split(':::');
        if (timeStr && id) {
          cursorDate = new Date(timeStr);
          cursorId = id;
        }
      } catch (err) {
        // Fallback to no cursor
      }
    }

    // Determine followed user IDs if viewer is logged in
    let followedUserIds: string[] = [];
    if (viewerId) {
      const follows = await this.prisma.follow.findMany({
        where: { followerId: viewerId, status: 'accepted' },
        select: { followeeId: true },
      });
      followedUserIds = follows.map((f) => f.followeeId);
      // Include viewer's own posts in their feed
      followedUserIds.push(viewerId);
    }

    // Build Prisma query condition
    const whereCondition: any = {
      deletedAt: null,
      scheduledAt: null, // Only published posts
    };

    if (query.type && query.type !== 'all') {
      whereCondition.type = query.type;
    }

    if (cursorDate && cursorId) {
      whereCondition.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: cursorId } },
      ];
    }

    // Follow-first ranking: If following anyone, prioritize posts by followed users or discoverable public posts
    if (followedUserIds.length > 0) {
      whereCondition.OR = [
        { authorId: { in: followedUserIds } },
        { privacy: 'public', author: { privacySetting: 'public' } },
      ];
      if (cursorDate && cursorId) {
        whereCondition.AND = [
          {
            OR: [
              { createdAt: { lt: cursorDate } },
              { createdAt: cursorDate, id: { lt: cursorId } },
            ],
          },
        ];
      }
    } else {
      // Anonymous or new user without follows: Show public posts from public accounts
      whereCondition.privacy = 'public';
      whereCondition.author = { privacySetting: 'public' };
    }

    // Fetch batch (fetch extra to filter out any privacy mismatches)
    const rawPosts = await this.prisma.post.findMany({
      where: whereCondition,
      take: limit * 2,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

    // Enforce Privacy Check on all fetched items
    const validPosts: Post[] = [];
    for (const post of rawPosts) {
      if (validPosts.length >= limit) {
        break;
      }
      const canView = await this.privacyService.canViewPost(post.id, viewerId);
      if (canView) {
        let isLiked = false;
        let isSaved = false;

        if (viewerId) {
          const [like, save] = await Promise.all([
            this.prisma.like.findUnique({
              where: { userId_postId: { userId: viewerId, postId: post.id } },
            }),
            this.prisma.save.findUnique({
              where: { userId_postId: { userId: viewerId, postId: post.id } },
            }),
          ]);
          isLiked = !!like;
          isSaved = !!save;
        }

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const canEditCaption = viewerId === post.authorId && post.createdAt > fifteenMinutesAgo;

        validPosts.push({
          id: post.id,
          authorId: post.authorId,
          author: {
            id: post.author.id,
            username: post.author.username,
            displayName: post.author.displayName,
            avatarUrl: post.author.avatarUrl || undefined,
            isVerified: post.author.isVerified,
          },
          type: post.type,
          contentUrl: post.contentUrl,
          thumbnailUrl: post.thumbnailUrl,
          caption: post.caption,
          tags: post.tags,
          privacy: post.privacy,
          visibilityId: post.visibilityId,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          sharesCount: post.sharesCount,
          savesCount: post.savesCount,
          isLiked,
          isSaved,
          canEditCaption,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        });
      }
    }

    // Generate next cursor if items exist
    let nextCursor: string | null = null;
    if (validPosts.length > 0 && rawPosts.length >= limit) {
      const lastItem = validPosts[validPosts.length - 1];
      nextCursor = Buffer.from(`${lastItem.createdAt}:::${lastItem.id}`).toString('base64');
    }

    return {
      items: validPosts,
      nextCursor,
      hasMore: !!nextCursor,
    };
  }
}
