import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostCaptionDto } from './dto/post.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '@privity/types';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  async createPost(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(userId, dto);
  }

  @OptionalAuth()
  @Get(':id')
  async getPost(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.postsService.getPostById(id, user?.sub ?? null);
  }

  @Patch(':id')
  async editCaption(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePostCaptionDto,
  ) {
    return this.postsService.editCaption(id, userId, dto);
  }

  @Delete(':id')
  async deletePost(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.postsService.deletePost(id, user.sub, user.role);
  }

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  async likePost(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postsService.likePost(id, userId);
  }

  @Delete(':id/like')
  async unlikePost(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postsService.unlikePost(id, userId);
  }

  @Post(':id/save')
  @HttpCode(HttpStatus.OK)
  async savePost(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postsService.savePost(id, userId);
  }

  @Delete(':id/save')
  async unsavePost(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postsService.unsavePost(id, userId);
  }
}
