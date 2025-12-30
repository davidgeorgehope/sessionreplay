/**
 * Session Event Emitter
 * High-level helper for emitting session replay events as OTLP logs
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import { trace, context } from '@opentelemetry/api';
import { getLogger } from './log-provider';
import { getSessionId, getNextSequence, getSessionDuration, getUser } from './session';

/**
 * Event categories for session replay
 */
export type EventCategory =
  | 'user.interaction'
  | 'user.navigation'
  | 'user.error'
  | 'user.frustration'
  | 'form.interaction'
  | 'page.lifecycle';

/**
 * Frustration types that can be detected
 */
export type FrustrationType =
  | 'rage_click'
  | 'dead_click'
  | 'thrashing'
  | 'form_hesitation'
  | 'error_blindness';

/**
 * Base attributes for all session events
 */
export interface BaseEventAttributes {
  /** Event category */
  'event.category': EventCategory;
  /** Specific action within the category */
  'event.action'?: string;
  /** Page URL where event occurred */
  'page.url': string;
  /** Page title */
  'page.title': string;
}

/**
 * Target element attributes for interaction events
 */
export interface TargetAttributes {
  /** Semantic name of the target (button text, aria-label, etc.) */
  'target.semantic_name'?: string;
  /** HTML element tag name */
  'target.element'?: string;
  /** Element ID */
  'target.id'?: string;
  /** Element CSS classes (space-separated) */
  'target.classes'?: string;
  /** React/Vue component name if detected */
  'target.component'?: string;
  /** Data attributes (prefixed with target.data.) */
  [key: `target.data.${string}`]: string | undefined;
}

/**
 * Frustration signal attributes
 */
export interface FrustrationAttributes {
  /** Type of frustration detected */
  'frustration.type'?: FrustrationType;
  /** Frustration severity score 0-1 */
  'frustration.score'?: number;
  /** Additional frustration context */
  'frustration.details'?: string;
}

/**
 * Combined event attributes type
 */
export type SessionEventAttributes = BaseEventAttributes &
  Partial<TargetAttributes> &
  Partial<FrustrationAttributes> &
  Record<string, string | number | boolean | undefined>;

/**
 * Options for emitting a session event
 */
export interface EmitEventOptions {
  /** Event name (becomes the log body) */
  name: string;
  /** Event attributes */
  attributes: Partial<SessionEventAttributes>;
  /** Severity level, defaults to INFO */
  severity?: SeverityNumber;
  /** Optional trace ID for correlation with backend traces */
  traceId?: string;
}

/**
 * Emits a session event as an OTLP log record.
 * Automatically includes session context (session.id, sequence, page info).
 *
 * @param options - Event options
 */
export function emitSessionEvent(options: EmitEventOptions): void {
  const logger = getLogger();

  // Debug: check if we have a real logger
  if (typeof console !== 'undefined' && (logger as any).constructor?.name) {
    console.debug('[SessionReplay] Logger type:', (logger as any).constructor.name);
  }

  // Get page context
  const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pageTitle = typeof document !== 'undefined' ? document.title : '';

  // Build attributes with session context
  const attributes: Record<string, string | number | boolean> = {
    'session.id': getSessionId(),
    'session.sequence': getNextSequence(),
    'session.duration_ms': getSessionDuration(),
    'page.url': pageUrl,
    'page.title': pageTitle,
    ...filterUndefined(options.attributes),
  };

  // Add user identity if set
  const user = getUser();
  if (user) {
    attributes['user.id'] = user.id;
    if (user.email) {
      attributes['user.email'] = user.email;
    }
    if (user.name) {
      attributes['user.name'] = user.name;
    }
  }

  // Add trace context if there's an active span (auto-correlation)
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    if (spanContext.traceId) {
      attributes['trace.id'] = spanContext.traceId;
    }
    if (spanContext.spanId) {
      attributes['span.id'] = spanContext.spanId;
    }
  }

  // Add trace ID if explicitly provided (for backend correlation)
  if (options.traceId) {
    attributes['trace.id'] = options.traceId;
  }

  // Emit the log record
  const logRecord = {
    body: options.name,
    severityNumber: options.severity ?? SeverityNumber.INFO,
    attributes,
  };

  // Debug logging
  if (typeof console !== 'undefined') {
    console.debug('[SessionReplay] Emitting log:', options.name, attributes['session.sequence']);
  }

  try {
    logger.emit(logRecord);
    console.debug('[SessionReplay] logger.emit completed');
  } catch (e) {
    console.error('[SessionReplay] logger.emit error:', e);
  }
}

/**
 * Convenience function for emitting click events
 */
export function emitClickEvent(
  semanticName: string,
  element: string,
  attributes: Partial<SessionEventAttributes> = {}
): void {
  emitSessionEvent({
    name: 'user.click',
    attributes: {
      'event.category': 'user.interaction',
      'event.action': 'click',
      'target.semantic_name': semanticName,
      'target.element': element,
      ...attributes,
    },
  });
}

/**
 * Convenience function for emitting navigation events
 */
export function emitNavigationEvent(
  action: 'pageview' | 'hashchange' | 'popstate' | 'pushstate',
  url: string,
  attributes: Partial<SessionEventAttributes> = {}
): void {
  emitSessionEvent({
    name: 'user.navigation',
    attributes: {
      'event.category': 'user.navigation',
      'event.action': action,
      'navigation.url': url,
      ...attributes,
    },
  });
}

/**
 * Convenience function for emitting error events
 */
export function emitErrorEvent(
  message: string,
  attributes: Partial<SessionEventAttributes> = {}
): void {
  emitSessionEvent({
    name: 'user.error',
    severity: SeverityNumber.ERROR,
    attributes: {
      'event.category': 'user.error',
      'error.message': message,
      ...attributes,
    },
  });
}

/**
 * Convenience function for emitting frustration events
 */
export function emitFrustrationEvent(
  type: FrustrationType,
  score: number,
  attributes: Partial<SessionEventAttributes> = {}
): void {
  emitSessionEvent({
    name: `user.frustration.${type}`,
    attributes: {
      'event.category': 'user.frustration',
      'event.action': type,
      'frustration.type': type,
      'frustration.score': score,
      ...attributes,
    },
  });
}

/**
 * Convenience function for emitting form events
 */
export function emitFormEvent(
  action: 'focus' | 'blur' | 'input' | 'submit' | 'abandon',
  fieldName: string,
  attributes: Partial<SessionEventAttributes> = {}
): void {
  emitSessionEvent({
    name: `form.${action}`,
    attributes: {
      'event.category': 'form.interaction',
      'event.action': action,
      'form.field_name': fieldName,
      ...attributes,
    },
  });
}

/**
 * Filters out undefined values from an object
 */
function filterUndefined(
  obj: Record<string, unknown>
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      }
    }
  }
  return result;
}
