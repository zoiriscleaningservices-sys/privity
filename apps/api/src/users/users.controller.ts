import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/guards/jwt-auth.guard';
import { JwtPayload, UpdateProfileDto } from '@privity/types';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @OptionalAuth()
  @Get(':username')
  async getProfile(
    @Param('username') username: string,
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.usersService.getProfileByUsername(username, user?.sub);
  }

  @Patch(':id')
  async updateProfile(
    @Param('id') id: string,
    @CurrentUser('sub') currentUserId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(id, currentUserId, dto);
  }

  @OptionalAuth()
  @Get(':id/posts')
  async getUserPosts(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.usersService.getUserPosts(id, user?.sub ?? null);
  }

  @Post(':id/close-friends')
  async toggleCloseFriend(
    @Param('id') friendId: string,
    @CurrentUser('sub') currentUserId: string,
  ) {
    return this.usersService.toggleCloseFriend(currentUserId, friendId);
  }

  @Post('me/data-export')
  async exportData(@CurrentUser('sub') currentUserId: string) {
    return this.usersService.exportData(currentUserId);
  }

  @Delete('me')
  async deleteAccount(@CurrentUser('sub') currentUserId: string) {
    return this.usersService.deleteAccount(currentUserId);
  }
}
