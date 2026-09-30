import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class SendGiftDto {
  @IsString()
  @IsNotEmpty()
  giftId: string;

  @IsString()
  @IsNotEmpty()
  livestreamId: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number = 1;
}
