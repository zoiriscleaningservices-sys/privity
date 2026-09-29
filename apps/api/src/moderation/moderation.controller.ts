import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { CreateReportDto, ModerationActionDto } from './dto/moderation.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '@privity/types';

@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  // User Reporting
  @Post('reports')
  async createReport(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.moderationService.createReport(userId, dto);
  }

  // User Blocking
  @Post('users/:id/block')
  async blockUser(
    @Param('id') blockedId: string,
    @CurrentUser('sub') blockerId: string,
  ) {
    return this.moderationService.blockUser(blockerId, blockedId);
  }

  @Delete('users/:id/block')
  async unblockUser(
    @Param('id') blockedId: string,
    @CurrentUser('sub') blockerId: string,
  ) {
    return this.moderationService.unblockUser(blockerId, blockedId);
  }

  // Admin / Moderator Protected Endpoints
  @Roles('moderator', 'admin')
  @UseGuards(RolesGuard)
  @Get('admin/reports')
  async getReports(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.moderationService.getReports(status, priority);
  }

  @Roles('moderator', 'admin')
  @UseGuards(RolesGuard)
  @Post('admin/reports/:id/action')
  async executeAction(
    @Param('id') reportId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ModerationActionDto,
  ) {
    return this.moderationService.executeModerationAction(
      reportId,
      user.sub,
      user.username,
      dto,
    );
  }

  @Roles('moderator', 'admin')
  @UseGuards(RolesGuard)
  @Get('admin/audit-logs')
  async getAuditLogs() {
    return this.moderationService.getAuditLogs();
  }

  @Roles('moderator', 'admin')
  @UseGuards(RolesGuard)
  @Get('admin/stats')
  async getAdminStats() {
    return this.moderationService.getAdminStats();
  }

  @Roles('moderator', 'admin')
  @UseGuards(RolesGuard)
  @Get('admin/users')
  async getAdminUsers(@Query('q') query?: string) {
    return this.moderationService.getAdminUsers(query);
  }
}
