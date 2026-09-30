import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';
import { GiftCategory, GiftRarity } from '@prisma/client';

export class CreateGiftDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNotEmpty()
  iconUrl: string;

  @IsString()
  @IsNotEmpty()
  animationUrl: string;

  @IsOptional()
  @IsString()
  webmUrl?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsInt()
  @IsPositive()
  coinCost: number;

  @IsOptional()
  @IsEnum(GiftCategory)
  category?: GiftCategory;

  @IsOptional()
  @IsEnum(GiftRarity)
  rarity?: GiftRarity;

  @IsOptional()
  @IsInt()
  @IsPositive()
  animationDuration?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  soundUrl?: string;

  @IsOptional()
  @IsInt()
  maxConcurrent?: number;

  @IsOptional()
  @IsInt()
  priority?: number;
}
