export type ReportTargetType = 'user' | 'post' | 'comment';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_abuse'
  | 'sexual_content'
  | 'violence'
  | 'fraud_scam'
  | 'impersonation'
  | 'copyright'
  | 'other';

export type ReportStatus = 'open' | 'under_review' | 'resolved';

export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ModerationActionType =
  | 'dismiss'
  | 'warn'
  | 'remove_content'
  | 'suspend'
  | 'ban';

export interface Report {
  id: string;
  reporterId: string;
  reporterUsername?: string;
  targetType: ReportTargetType;
  targetId: string;
  targetContentSummary?: string;
  targetAuthorUsername?: string;
  reason: ReportReason;
  notes?: string;
  status: ReportStatus;
  priority: ReportPriority;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface ModerationActionDto {
  action: ModerationActionType;
  note: string;
  suspensionDurationHours?: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorUsername: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
