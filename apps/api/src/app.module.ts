import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PrivacyModule } from './privacy/privacy.module';
import { UsersModule } from './users/users.module';
import { FollowsModule } from './follows/follows.module';
import { PostsModule } from './posts/posts.module';
import { FeedModule } from './feed/feed.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { ModerationModule } from './moderation/moderation.module';
import { MediaModule } from './media/media.module';
import { GiftsModule } from './gifts/gifts.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PrivacyModule,
    AuthModule,
    UsersModule,
    FollowsModule,
    PostsModule,
    FeedModule,
    CommentsModule,
    NotificationsModule,
    SearchModule,
    ModerationModule,
    MediaModule,
    GiftsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
