import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@CurrentUser('sub') userId: string) {
    return this.notificationsService.getUserNotifications(userId);
  }

  @Post('read')
  async markRead(
    @CurrentUser('sub') userId: string,
    @Body('notificationIds') notificationIds?: string[],
  ) {
    return this.notificationsService.markAsRead(userId, notificationIds);
  }

  @Get('preferences')
  async getPreferences(@CurrentUser('sub') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser('sub') userId: string,
    @Body() settings: any,
  ) {
    return this.notificationsService.updatePreferences(userId, settings);
  }
}
