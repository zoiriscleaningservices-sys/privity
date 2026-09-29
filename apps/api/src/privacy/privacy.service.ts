import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrivacyCheckContext, PrivacyCheckResult } from '@privity/types';

@Injectable()
export class PrivacyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Pure evaluation function for privacy permissions based on PRD Section 10.3
   */
  evaluatePrivacy(context: PrivacyCheckContext): PrivacyCheckResult {
    // 1. Author can always see their own content
    if (context.isAuthor) {
      return { canView: true };
    }

    // 2. Moderation check: Suspended or banned authors cannot broadcast
    if (context.isAuthorSuspendedOrBanned) {
      return { canView: false, reason: 'Author account is suspended or banned' };
    }

    // 3. Block checks: If author blocks viewer or viewer blocks author, visibility is denied
    if (context.isBlockedByAuthor || context.isViewerBlockingAuthor) {
      return { canView: false, reason: 'Content unavailable due to user blocking' };
    }

    // 4. Close Friends post privacy: Must be explicitly in close friends list
    if (context.postPrivacy === 'close_friends') {
      if (context.isCloseFriend) {
        return { canView: true };
      }
      return { canView: false, reason: 'Visible only to Close Friends' };
    }

    // 5. Followers post privacy: Must be an accepted follower
    if (context.postPrivacy === 'followers') {
      if (context.isFollower) {
        return { canView: true };
      }
      return { canView: false, reason: 'Visible only to approved followers' };
    }

    // 6. Public post privacy:
    // If author's account is private, only followers can view their posts even if marked public
    if (context.authorAccountPrivacy === 'private') {
      if (context.isFollower) {
        return { canView: true };
      }
      return { canView: false, reason: 'Author account is private' };
    }

    // Default for public post on public account: Anyone (including visitors) can view
    return { canView: true };
  }

  /**
   * Resolves context from database and checks if viewer can view author's post
   */
  async canViewPost(postId: string, viewerId: string | null): Promise<boolean> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId, deletedAt: null },
      include: {
        author: true,
      },
    });

    if (!post) {
      return false;
    }

    const author = post.author;
    const isAuthor = viewerId === author.id;

    if (isAuthor) {
      return true;
    }

    // If viewer is not logged in
    if (!viewerId) {
      return (
        !author.isSuspended &&
        !author.isBanned &&
        author.privacySetting === 'public' &&
        post.privacy === 'public'
      );
    }

    // Check relationships in parallel
    const [follow, closeFriend, block1, block2] = await Promise.all([
      this.prisma.follow.findUnique({
        where: {
          followerId_followeeId: {
            followerId: viewerId,
            followeeId: author.id,
          },
        },
      }),
      this.prisma.closeFriend.findUnique({
        where: {
          userId_friendId: {
            userId: author.id,
            friendId: viewerId,
          },
        },
      }),
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: author.id,
            blockedId: viewerId,
          },
        },
      }),
      this.prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: viewerId,
            blockedId: author.id,
          },
        },
      }),
    ]);

    const context: PrivacyCheckContext = {
      authorId: author.id,
      authorAccountPrivacy: author.privacySetting as any,
      postPrivacy: post.privacy as any,
      viewerId,
      isAuthor,
      isFollower: follow?.status === 'accepted',
      isCloseFriend: !!closeFriend,
      isBlockedByAuthor: !!block1,
      isViewerBlockingAuthor: !!block2,
      isAuthorSuspendedOrBanned: author.isSuspended || author.isBanned,
    };

    return this.evaluatePrivacy(context).canView;
  }
}
