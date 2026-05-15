import { randomUUID } from 'crypto';

export interface BaseEvent {
  eventId: string;
  timestamp: string;
  tenantId: string;
}

export interface AuraEvent extends BaseEvent {
  type: string;
  payload: Record<string, any>;
}

export const TOPICS = {
  AUDIT_COMPLETED: 'audit.completed',
  COMPETITOR_REPORT_READY: 'competitor.report.ready',
  STRATEGY_GENERATED: 'strategy.generated',
  POST_READY: 'post.ready',
  POST_APPROVED: 'post.approved',
  POST_PUBLISHED: 'post.published',
} as const;

export function createEvent(
  type: string,
  tenantId: string,
  payload: Record<string, any>
): AuraEvent {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    tenantId,
    type,
    payload,
  };
}
