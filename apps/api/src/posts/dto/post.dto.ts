import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PostPrivacy, PostType } from '@privity/types';

export class CreatePostDto {
  @IsEnum(['text', 'image', 'video'])
  type: PostType;

  @IsOptional()
  @IsString()
  contentUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsString()
  @MaxLength(2200)
  caption: string;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsEnum(['public', 'followers', 'close_friends'])
  privacy: PostPrivacy;

  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class UpdatePostCaptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2200)
  caption: string;
}
