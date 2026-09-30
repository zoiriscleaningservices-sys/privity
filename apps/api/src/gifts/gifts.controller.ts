import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { GiftsService } from './gifts.service';
import { SendGiftDto } from './dto/send-gift.dto';
import { CreateGiftDto } from './dto/create-gift.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '@privity/types';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Public()
  @Get()
  async getCatalog() {
    return this.giftsService.getGiftsCatalog();
  }

  @Public()
  @Get(':id')
  async getGiftById(@Param('id') id: string) {
    return this.giftsService.getGiftById(id);
  }

  @Get('user/balance')
  async getBalance(@CurrentUser('sub') userId: string) {
    if (!userId) throw new UnauthorizedException();
    return this.giftsService.getUserBalance(userId);
  }

  @Post('send')
  async sendGift(
    @CurrentUser('sub') userId: string,
    @Body() dto: SendGiftDto,
  ) {
    if (!userId) throw new UnauthorizedException('Authentication required to send gifts');
    return this.giftsService.sendGift(userId, dto);
  }

  @Post('admin')
  async adminUpsertGift(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateGiftDto,
  ) {
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedException('Admin permissions required');
    }
    return this.giftsService.adminCreateOrUpdateGift(dto);
  }
}
