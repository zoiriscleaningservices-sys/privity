import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto, ModerationActionDto } from './dto/moderation.dto';
import { Report, AuditLogEntry } from '@privity/types';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto): Promise<{ success: boolean; reportId: string }> {
    // Validate target exists
    if (dto.targetType === 'user') {
      const u = await this.prisma.user.findUnique({ where: { id: dto.targetId } });
      if (!u) throw new NotFoundException('User to report not found');
    } else if (dto.targetType === 'post') {
      const p = await this.prisma.post.findUnique({ where: { id: dto.targetId } });
      if (!p) throw new NotFoundException('Post to report not found');
    } else if (dto.targetType === 'comment') {
      const c = await this.prisma.comment.findUnique({ where: { id: dto.targetId } });
      if (!c) throw new NotFoundException('Comment to report not found');
    }

    // Determine initial priority based on reason
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    if (['violence', 'sexual_content', 'hate_abuse'].includes(dto.reason)) {
      priority = 'urgent';
    } else if (['harassment', 'fraud_scam'].includes(dto.reason)) {
      priority = 'high';
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        notes: dto.notes,
        priority,
        status: 'open',
      },
    });

    return { success: true, reportId: report.id };
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    // Block user
    await this.prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId,
          blockedId,
        },
      },
      update: {},
      create: {
        blockerId,
        blockedId,
      },
    });

    // Remove existing follow relationships in both directions
    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followeeId: blockedId },
          { followerId: blockedId, followeeId: blockerId },
        ],
      },
    });

    // Remove from close friends
    await this.prisma.closeFriend.deleteMany({
      where: {
        OR: [
          { userId: blockerId, friendId: blockedId },
          { userId: blockedId, friendId: blockerId },
        ],
      },
    });

    return { success: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { success: true };
  }

  // --- ADMIN & MODERATION DASHBOARD APIS ---

  async getReports(status?: string, priority?: string): Promise<Report[]> {
    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        reporter: {
          select: { username: true },
        },
      },
      take: 50,
    });

    return reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporterUsername: r.reporter.username,
      targetType: r.targetType as any,
      targetId: r.targetId,
      reason: r.reason as any,
      notes: r.notes || undefined,
      status: r.status as any,
      priority: r.priority as any,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() || null,
      resolvedBy: r.resolvedById,
    }));
  }

  async executeModerationAction(
    reportId: string,
    actorId: string,
    actorUsername: string,
    dto: ModerationActionDto,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Apply action on the target
    if (dto.action === 'remove_content') {
      if (report.targetType === 'post') {
        await this.prisma.post.update({
          where: { id: report.targetId },
          data: { deletedAt: new Date() },
        });
      } else if (report.targetType === 'comment') {
        await this.prisma.comment.update({
          where: { id: report.targetId },
          data: { deletedAt: new Date() },
        });
      }
    } else if (dto.action === 'suspend') {
      const hours = dto.suspensionDurationHours || 24;
      const suspendedUntil = new Date(Date.now() + hours * 3600 * 1000);
      let targetUserId = report.targetId;

      if (report.targetType === 'post') {
        const p = await this.prisma.post.findUnique({ where: { id: report.targetId } });
        if (p) targetUserId = p.authorId;
      } else if (report.targetType === 'comment') {
        const c = await this.prisma.comment.findUnique({ where: { id: report.targetId } });
        if (c) targetUserId = c.authorId;
      }

      await this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isSuspended: true,
          suspendedUntil,
        },
      });
    } else if (dto.action === 'ban') {
      let targetUserId = report.targetId;
      if (report.targetType === 'post') {
        const p = await this.prisma.post.findUnique({ where: { id: report.targetId } });
        if (p) targetUserId = p.authorId;
      } else if (report.targetType === 'comment') {
        const c = await this.prisma.comment.findUnique({ where: { id: report.targetId } });
        if (c) targetUserId = c.authorId;
      }

      await this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isBanned: true,
          isSuspended: true,
        },
      });
    }

    // Update Report status
    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedById: actorId,
      },
    });

    // Record Audit Log entry
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: dto.action,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: dto.note,
        metadata: {
          reportId,
          actorUsername,
          suspensionDurationHours: dto.suspensionDurationHours,
        },
      },
    });

    return { success: true, report: updatedReport };
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { username: true } },
      },
    });

    return logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actorUsername: l.actor.username,
      action: l.action,
      targetType: l.targetType,
      targetId: l.targetId,
      reason: l.reason,
      metadata: (l.metadata as any) || {},
      timestamp: l.createdAt.toISOString(),
    }));
  }

  async getAdminStats() {
    const [openReports, activeSuspensions, totalUsers, totalPosts] = await Promise.all([
      this.prisma.report.count({ where: { status: 'open' } }),
      this.prisma.user.count({ where: { OR: [{ isSuspended: true }, { isBanned: true }] } }),
      this.prisma.user.count(),
      this.prisma.post.count({ where: { deletedAt: null } }),
    ]);

    return {
      openReports,
      activeSuspensions,
      totalUsers,
      totalPosts,
    };
  }

  async getAdminUsers(query?: string) {
    const q = (query || '').trim();
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        isVerified: true,
        isSuspended: true,
        isBanned: true,
        privacySetting: true,
        createdAt: true,
      },
    });
  }
}
