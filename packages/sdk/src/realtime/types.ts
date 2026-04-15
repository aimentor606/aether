export interface StreamEvent {
  type: string;
  data: unknown;
  timestamp?: number;
}

export interface EventStream {
  start(): Promise<void>;
  stop(): void;
  on(eventType: string, callback: (event: StreamEvent) => void): void;
  off(eventType: string, callback: (event: StreamEvent) => void): void;
}
