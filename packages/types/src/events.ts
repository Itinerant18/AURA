export interface BaseEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
}

export interface AuditCompletedEvent extends BaseEvent {
  type: 'audit.completed';
  payload: { auditReportId: string };
}

export interface CompetitorReportReadyEvent extends BaseEvent {
  type: 'competitor.report.ready';
  payload: { reportIds: string[] };
}

export interface StrategyGeneratedEvent extends BaseEvent {
  type: 'strategy.generated';
  payload: { calendarId: string };
}

export interface PostReadyEvent extends BaseEvent {
  type: 'post.ready';
  payload: { postId: string };
}

export interface PostApprovedEvent extends BaseEvent {
  type: 'post.approved';
  payload: { postId: string; scheduledFor: string };
}

export interface PostPublishedEvent extends BaseEvent {
  type: 'post.published';
  payload: { postId: string; platformPostId: string };
}

export type AuraEvent =
  | AuditCompletedEvent
  | CompetitorReportReadyEvent
  | StrategyGeneratedEvent
  | PostReadyEvent
  | PostApprovedEvent
  | PostPublishedEvent;
