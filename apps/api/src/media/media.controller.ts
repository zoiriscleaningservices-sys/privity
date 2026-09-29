import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { randomUUID } from 'crypto';

@Controller('media')
export class MediaController {
  @Post('upload-url')
  async getUploadUrl(
    @CurrentUser('sub') userId: string,
    @Body('fileType') fileType: string,
    @Body('fileName') fileName: string,
  ) {
    if (!fileType) {
      throw new BadRequestException('fileType is required');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(fileType)) {
      throw new BadRequestException('Unsupported media file type');
    }

    const extension = fileName?.split('.').pop() || 'bin';
    const mediaId = randomUUID();
    const objectKey = `uploads/${userId}/${mediaId}.${extension}`;

    // Pre-signed S3 URL generation simulation for local/dev
    const uploadUrl = `https://privity-media-storage-dev.s3.amazonaws.com/${objectKey}?signature=dev_signed_${randomUUID()}`;
    const publicCdnUrl = `https://cdn.privity.internal/${objectKey}`;

    return {
      uploadUrl,
      objectKey,
      cdnUrl: publicCdnUrl,
      mediaId,
    };
  }
}
