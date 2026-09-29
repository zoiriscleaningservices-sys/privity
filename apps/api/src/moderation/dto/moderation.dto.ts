import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
} from 'class-validator';
import {
  ReportPriority,
  ReportReason,
  ReportTargetType,
  ModerationActionType,
} from '@privity/types';

export class CreateReportDto {
  @IsEnum(['user', 'post', 'comment'])
  targetType: ReportTargetType;

  @IsString()
  @IsNotEmpty()
  targetId: string;

  @IsEnum([
    'spam',
    'harassment',
    'hate_abuse',
    'sexual_content',
    'violence',
    'fraud_scam',
    'impersonation',
    'copyright',
    'other',
  ])
  reason: ReportReason;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ModerationActionDto {
  @IsEnum(['dismiss', 'warn', 'remove_content', 'suspend', 'ban'])
  action: ModerationActionType;

  @IsString()
  @IsNotEmpty()
  note: string;

  @IsOptional()
  @IsNumber()
  suspensionDurationHours?: number;
}
