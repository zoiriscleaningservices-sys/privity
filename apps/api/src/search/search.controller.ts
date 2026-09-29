import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { OptionalAuth } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '@privity/types';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @OptionalAuth()
  @Get()
  async search(
    @Query('q') query: string,
    @Query('type') type: 'users' | 'posts' | 'tags' | 'all' = 'all',
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.searchService.search(query, type, user?.sub ?? null);
  }

  @OptionalAuth()
  @Get('discovery')
  async getDiscovery(@CurrentUser() user?: JwtPayload | null) {
    return this.searchService.getDiscovery(user?.sub ?? null);
  }
}
