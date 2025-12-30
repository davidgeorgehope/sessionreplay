import { trace } from '@opentelemetry/api';
import type { ClickTarget } from '../types';

const MAX_SEMANTIC_NAME_LENGTH = 50;

/**
 * Configuration for click instrumentation
 */
export interface ClickInstrumentationConfig {
  /** Document to attach listeners to */
  document: Document;
  /** Whether to capture coordinates (default: false for privacy) */
  captureCoordinates?: boolean;
  /** Elements to ignore (CSS selector) */
  ignoreSelector?: string;
}

/**
 * Extracts a semantic name from an element.
 * Priority: aria-label > innerText/textContent > title > alt > placeholder > tag name
 */
export function getSemanticName(element: Element): string {
  // Check aria-label first (most semantic)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return truncate(ariaLabel.trim());
  }

  // Check innerText/textContent for buttons/links
  // Use textContent as fallback for JSDOM compatibility
  // Don't use instanceof as it fails across different window contexts
  const text = ((element as HTMLElement).innerText || element.textContent || '').trim();
  if (text && text.length > 0) {
    return truncate(text);
  }

  // Check title attribute
  const title = element.getAttribute('title');
  if (title) {
    return truncate(title.trim());
  }

  // Check alt for images
  const alt = element.getAttribute('alt');
  if (alt) {
    return truncate(alt.trim());
  }

  // Check placeholder for inputs
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    return truncate(placeholder.trim());
  }

  // Check value for submit buttons
  if (element instanceof HTMLInputElement && element.type === 'submit') {
    return truncate(element.value || 'Submit');
  }

  // Fallback to tag name
  return `<${element.tagName.toLowerCase()}>`;
}

/**
 * Truncates a string to max length with ellipsis
 */
function truncate(text: string, maxLength = MAX_SEMANTIC_NAME_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

/**
 * Extracts data-* attributes from an element
 */
export function getDataAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};

  // Get all attributes and filter for data-*
  const attrs = element.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name.startsWith('data-')) {
      // Convert data-product-id to product-id (remove 'data-' prefix)
      const key = attr.name.substring(5);
      result[key] = attr.value;
    }
  }

  return result;
}

/**
 * Attempts to extract the React component name from a DOM element.
 * This works by looking for React's internal fiber keys.
 */
export function getReactComponentName(element: Element): string | undefined {
  // React attaches fiber nodes with keys like __reactFiber$xxx
  const fiberKey = Object.keys(element).find(key =>
    key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  );

  if (!fiberKey) {
    return undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fiber = (element as any)[fiberKey];
    if (fiber?.return?.type) {
      const type = fiber.return.type;
      // Prefer displayName, then name
      return type.displayName || type.name || undefined;
    }
  } catch {
    // Ignore errors accessing React internals
  }

  return undefined;
}

/**
 * Builds a ClickTarget from a DOM element
 */
export function buildClickTarget(element: Element): ClickTarget {
  const target: ClickTarget = {
    semanticName: getSemanticName(element),
    element: element.tagName.toLowerCase(),
  };

  // Add ID if present
  if (element.id) {
    target.id = element.id;
  }

  // Add classes
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(Boolean);
    if (classes.length > 0) {
      target.classes = classes;
    }
  }

  // Add data attributes
  const dataAttrs = getDataAttributes(element);
  if (Object.keys(dataAttrs).length > 0) {
    target.dataAttributes = dataAttrs;
  }

  // Try to get React component name
  const componentName = getReactComponentName(element);
  if (componentName) {
    target.component = componentName;
  }

  return target;
}

/**
 * Instrumentation for capturing semantic click events
 */
export class ClickInstrumentation {
  private config: ClickInstrumentationConfig;
  private enabled = false;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(config: ClickInstrumentationConfig) {
    this.config = config;
  }

  /**
   * Enables click instrumentation
   */
  enable(): void {
    if (this.enabled) return;

    this.clickHandler = this.handleClick.bind(this);
    this.config.document.addEventListener('click', this.clickHandler, { capture: true });
    this.enabled = true;
  }

  /**
   * Disables click instrumentation
   */
  disable(): void {
    if (!this.enabled || !this.clickHandler) return;

    this.config.document.removeEventListener('click', this.clickHandler, { capture: true });
    this.clickHandler = null;
    this.enabled = false;
  }

  /**
   * Handles a click event
   */
  private handleClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Check ignore selector
    if (this.config.ignoreSelector && target.matches(this.config.ignoreSelector)) {
      return;
    }

    const tracer = trace.getTracer('session-replay');
    const clickTarget = buildClickTarget(target);

    const span = tracer.startSpan('user.click', {
      attributes: {
        'event.type': 'user.interaction',
        'event.action': 'click',
        'target.semantic_name': clickTarget.semanticName,
        'target.element': clickTarget.element,
        'target.id': clickTarget.id || '',
        'target.classes': clickTarget.classes?.join(' ') || '',
        'target.component': clickTarget.component || '',
        'page.url': this.config.document.location?.href || '',
        'page.title': this.config.document.title || '',
      },
    });

    // Add data attributes as span attributes
    if (clickTarget.dataAttributes) {
      for (const [key, value] of Object.entries(clickTarget.dataAttributes)) {
        span.setAttribute(`target.data.${key}`, value);
      }
    }

    // Add coordinates if configured
    if (this.config.captureCoordinates) {
      span.setAttribute('event.x', event.clientX);
      span.setAttribute('event.y', event.clientY);
    }

    span.end();
  }
}
