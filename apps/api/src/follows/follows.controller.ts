import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':id/follow')
  async follow(
    @Param('id') followeeId: string,
    @CurrentUser('sub') followerId: string,
  ) {
    return this.followsService.follow(followerId, followeeId);
  }

  @Delete(':id/follow')
  async unfollow(
    @Param('id') followeeId: string,
    @CurrentUser('sub') followerId: string,
  ) {
    return this.followsService.unfollow(followerId, followeeId);
  }

  @Post(':id/follow/accept')
  async acceptFollowRequest(
    @Param('id') requesterId: string,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.followsService.acceptFollowRequest(currentUserId, requesterId);
  }

  @Delete(':id/follow/request')
  async rejectFollowRequest(
    @Param('id') requesterId: string,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.followsService.rejectFollowRequest(currentUserId, requesterId);
  }

  @Get(':id/followers')
  async getFollowers(@Param('id') userId: string) {
    return this.followsService.getFollowers(userId);
  }

  @Get(':id/following')
  async getFollowing(@Param('id') userId: string) {
    return this.followsService.getFollowing(userId);
  }
}
