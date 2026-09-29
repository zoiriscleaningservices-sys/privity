import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from './feed.service';
import { OptionalAuth } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeedQueryDto, JwtPayload } from '@privity/types';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @OptionalAuth()
  @Get()
  async getFeed(
    @Query() query: FeedQueryDto,
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.feedService.getHomeFeed(user?.sub ?? null, query);
  }
}
