export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string;
  payload: TPayload;
}
