/**
 * Configuration for the Session Replay browser agent
 */
export interface SessionReplayConfig {
  /** Service name for OTEL resource */
  serviceName: string;

  /** OTLP endpoint (e.g., http://localhost:4318/v1/traces) */
  endpoint: string;

  /** API key for Elastic Cloud (adds Authorization: ApiKey header) */
  apiKey?: string;

  /** Sample rate 0-1, default 1.0 (100%) */
  sampleRate?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Batch processor configuration */
  batch?: {
    /** Max spans in queue before dropping, default 100 */
    maxQueueSize?: number;
    /** Max spans per batch, default 10 */
    maxBatchSize?: number;
    /** Delay before export in ms, default 500 */
    scheduledDelayMs?: number;
    /** Export timeout in ms, default 30000 */
    exportTimeoutMs?: number;
  };
}

/**
 * Semantic information about a click target
 */
export interface ClickTarget {
  /** Semantic name (innerText, aria-label, or title) */
  semanticName: string;
  /** HTML element tag name */
  element: string;
  /** Element ID if present */
  id?: string;
  /** CSS classes */
  classes?: string[];
  /** React/Vue component name if detectable */
  component?: string;
  /** data-* attributes */
  dataAttributes?: Record<string, string>;
}

/**
 * Frustration signal detected during user interaction
 */
export interface FrustrationSignal {
  /** Type of frustration detected */
  type: 'rage_click' | 'dead_click' | 'thrashing' | 'form_hesitation' | 'error_blindness';
  /** Severity score 0-1 */
  score: number;
  /** Additional context */
  details?: Record<string, unknown>;
}

/**
 * User interaction event with semantic context
 */
export interface SemanticEvent {
  /** Event type */
  type: 'click' | 'input' | 'submit' | 'navigation' | 'error';
  /** Timestamp */
  timestamp: number;
  /** Target element info */
  target?: ClickTarget;
  /** Page context */
  page: {
    url: string;
    title: string;
    referrer?: string;
  };
  /** Any frustration signals detected */
  frustration?: FrustrationSignal;
  /** Session ID */
  sessionId: string;
  /** User ID if known */
  userId?: string;
}
