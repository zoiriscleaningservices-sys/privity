import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OptionalAuth } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '@privity/types';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:id/comments')
  async createComment(
    @Param('id') postId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.createComment(postId, userId, dto);
  }

  @OptionalAuth()
  @Get('posts/:id/comments')
  async getComments(
    @Param('id') postId: string,
    @CurrentUser() user?: JwtPayload | null,
  ) {
    return this.commentsService.getCommentsByPostId(postId, user?.sub ?? null);
  }

  @Patch('comments/:id')
  async editComment(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.editComment(id, userId, dto);
  }

  @Delete('comments/:id')
  async deleteComment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commentsService.deleteComment(id, user.sub, user.role);
  }
}
