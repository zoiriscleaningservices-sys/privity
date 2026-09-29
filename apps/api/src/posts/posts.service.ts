import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from '../privacy/privacy.service';
import { CreatePostDto, UpdatePostCaptionDto } from './dto/post.dto';
import { Post } from '@privity/types';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private privacyService: PrivacyService,
  ) {}

  async createPost(authorId: string, dto: CreatePostDto): Promise<Post> {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        type: dto.type,
        contentUrl: dto.contentUrl,
        thumbnailUrl: dto.thumbnailUrl,
        caption: dto.caption,
        tags: dto.tags || [],
        privacy: dto.privacy,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
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
    });

    return this.mapPost(post, authorId);
  }

  async getPostById(postId: string, viewerId: string | null): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
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

    if (!post) {
      throw new NotFoundException('The requested post does not exist.');
    }

    const canView = await this.privacyService.canViewPost(postId, viewerId);
    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this post.');
    }

    let isLiked = false;
    let isSaved = false;

    if (viewerId) {
      const [like, save] = await Promise.all([
        this.prisma.like.findUnique({
          where: {
            userId_postId: {
              userId: viewerId,
              postId: post.id,
            },
          },
        }),
        this.prisma.save.findUnique({
          where: {
            userId_postId: {
              userId: viewerId,
              postId: post.id,
            },
          },
        }),
      ]);
      isLiked = !!like;
      isSaved = !!save;
    }

    return {
      ...this.mapPost(post, viewerId),
      isLiked,
      isSaved,
    };
  }

  async editCaption(postId: string, authorId: string, dto: UpdatePostCaptionDto): Promise<Post> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
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

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== authorId) {
      throw new ForbiddenException('Only the author can edit this post');
    }

    // PRD 12.4: Caption editing is available for 15 minutes after publication
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (post.createdAt < fifteenMinutesAgo) {
      throw new BadRequestException('Caption can only be edited within 15 minutes of publication.');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        caption: dto.caption,
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
    });

    return this.mapPost(updated, authorId);
  }

  async deletePost(postId: string, userId: string, userRole: string): Promise<{ success: boolean }> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
      throw new ForbiddenException('You do not have permission to delete this post');
    }

    // Soft delete
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async likePost(postId: string, userId: string): Promise<{ likesCount: number; isLiked: boolean }> {
    const canView = await this.privacyService.canViewPost(postId, userId);
    if (!canView) {
      throw new ForbiddenException('Cannot interact with private content');
    }

    // Unique constraint prevents duplicate likes
    await this.prisma.like.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      update: {},
      create: {
        userId,
        postId,
      },
    });

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: {
        likesCount: { increment: 1 },
      },
      select: { likesCount: true, authorId: true },
    });

    // Notify author if not liking own post
    if (updated.authorId !== userId) {
      await this.prisma.notification.create({
        data: {
          userId: updated.authorId,
          type: 'like',
          payload: { postId, actorId: userId },
        },
      });
    }

    return { likesCount: updated.likesCount, isLiked: true };
  }

  async unlikePost(postId: string, userId: string): Promise<{ likesCount: number; isLiked: boolean }> {
    const deleted = await this.prisma.like.deleteMany({
      where: {
        userId,
        postId,
      },
    });

    let likesCount = 0;
    if (deleted.count > 0) {
      const updated = await this.prisma.post.update({
        where: { id: postId },
        data: {
          likesCount: { decrement: 1 },
        },
        select: { likesCount: true },
      });
      likesCount = Math.max(0, updated.likesCount);
    }

    return { likesCount, isLiked: false };
  }

  async savePost(postId: string, userId: string): Promise<{ isSaved: boolean }> {
    const canView = await this.privacyService.canViewPost(postId, userId);
    if (!canView) {
      throw new ForbiddenException('Cannot save private content');
    }

    await this.prisma.save.upsert({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
      update: {},
      create: {
        userId,
        postId,
      },
    });

    await this.prisma.post.update({
      where: { id: postId },
      data: { savesCount: { increment: 1 } },
    });

    return { isSaved: true };
  }

  async unsavePost(postId: string, userId: string): Promise<{ isSaved: boolean }> {
    const deleted = await this.prisma.save.deleteMany({
      where: {
        userId,
        postId,
      },
    });

    if (deleted.count > 0) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { savesCount: { decrement: 1 } },
      });
    }

    return { isSaved: false };
  }

  private mapPost(post: any, viewerId?: string | null): Post {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const canEditCaption = viewerId === post.authorId && post.createdAt > fifteenMinutesAgo;

    return {
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
      canEditCaption,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
