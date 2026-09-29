import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyService } from '../privacy/privacy.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { Comment } from '@privity/types';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private privacyService: PrivacyService,
  ) {}

  async createComment(
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    const canView = await this.privacyService.canViewPost(postId, authorId);
    if (!canView) {
      throw new ForbiddenException('Cannot comment on private content');
    }

    // If replying, enforce 1-level nesting per PRD 13.2
    if (dto.parentCommentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentCommentId },
      });

      if (!parent || parent.postId !== postId) {
        throw new NotFoundException('Parent comment not found for this post');
      }

      if (parent.parentCommentId) {
        throw new BadRequestException(
          'Nested replies are limited to 1 level. You can only reply directly to root comments.',
        );
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId,
        authorId,
        text: dto.text,
        parentCommentId: dto.parentCommentId || null,
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

    // Update post comments count
    await this.prisma.post.update({
      where: { id: postId },
      data: { commentsCount: { increment: 1 } },
    });

    return {
      id: comment.id,
      postId: comment.postId,
      authorId: comment.authorId,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        displayName: comment.author.displayName,
        avatarUrl: comment.author.avatarUrl || undefined,
        isVerified: comment.author.isVerified,
      },
      text: comment.text,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt.toISOString(),
      editedAt: comment.editedAt?.toISOString() || null,
    };
  }

  async getCommentsByPostId(
    postId: string,
    viewerId: string | null,
  ): Promise<Comment[]> {
    const canView = await this.privacyService.canViewPost(postId, viewerId);
    if (!canView) {
      throw new ForbiddenException('Cannot view comments for private content');
    }

    // Get root comments
    const rootComments = await this.prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
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
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
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
        },
      },
    });

    return rootComments.map((root) => ({
      id: root.id,
      postId: root.postId,
      authorId: root.authorId,
      author: {
        id: root.author.id,
        username: root.author.username,
        displayName: root.author.displayName,
        avatarUrl: root.author.avatarUrl || undefined,
        isVerified: root.author.isVerified,
      },
      text: root.text,
      parentCommentId: null,
      repliesCount: root.replies.length,
      replies: root.replies.map((reply) => ({
        id: reply.id,
        postId: reply.postId,
        authorId: reply.authorId,
        author: {
          id: reply.author.id,
          username: reply.author.username,
          displayName: reply.author.displayName,
          avatarUrl: reply.author.avatarUrl || undefined,
          isVerified: reply.author.isVerified,
        },
        text: reply.text,
        parentCommentId: reply.parentCommentId,
        createdAt: reply.createdAt.toISOString(),
        editedAt: reply.editedAt?.toISOString() || null,
      })),
      createdAt: root.createdAt.toISOString(),
      editedAt: root.editedAt?.toISOString() || null,
    }));
  }

  async editComment(
    commentId: string,
    authorId: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId, deletedAt: null },
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

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== authorId) {
      throw new ForbiddenException('Only the author can edit this comment');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        text: dto.text,
        editedAt: new Date(),
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

    return {
      id: updated.id,
      postId: updated.postId,
      authorId: updated.authorId,
      author: {
        id: updated.author.id,
        username: updated.author.username,
        displayName: updated.author.displayName,
        avatarUrl: updated.author.avatarUrl || undefined,
        isVerified: updated.author.isVerified,
      },
      text: updated.text,
      parentCommentId: updated.parentCommentId,
      createdAt: updated.createdAt.toISOString(),
      editedAt: updated.editedAt?.toISOString() || null,
    };
  }

  async deleteComment(
    commentId: string,
    userId: string,
    userRole: string,
  ): Promise<{ success: boolean }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
      throw new ForbiddenException('You do not have permission to delete this comment');
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.post.update({
      where: { id: comment.postId },
      data: { commentsCount: { decrement: 1 } },
    });

    return { success: true };
  }
}
