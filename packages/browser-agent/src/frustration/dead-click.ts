import { emitFrustrationEvent, type SessionEventAttributes } from '../events';
import { getSemanticName } from '../semantic/clicks';

/**
 * Event emitted when a dead click is detected
 */
export interface DeadClickEvent {
  /** The element that was clicked */
  element: Element;
  /** Element tag name */
  elementTag: string;
  /** Element ID if present */
  elementId?: string;
  /** Frustration score from 0-1 */
  score: number;
  /** Reason for dead click */
  reason: 'non_interactive' | 'disabled' | 'no_href';
  /** Whether the element visually looks clickable */
  looksClickable?: boolean;
  /** Timestamp of the click */
  timestamp: number;
}

/**
 * Configuration for the dead click detector
 */
export interface DeadClickDetectorConfig {
  /** Callback when dead click is detected (optional) */
  onDeadClick?: (event: DeadClickEvent) => void;
  /** Document to attach listeners to (default: document) */
  document?: Document;
  /** Whether to emit OTLP log events (default: true) */
  emitLogs?: boolean;
  /** Whether to check parent elements for interactivity (default: true) */
  checkParents?: boolean;
}

/**
 * Options for recording a click
 */
export interface RecordClickOptions {
  /** Whether the element looks clickable (e.g., has pointer cursor) */
  looksClickable?: boolean;
  /** Whether to check parent elements for interactivity */
  checkParents?: boolean;
}

/** Interactive element tag names */
const INTERACTIVE_TAGS = new Set([
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
  'SUMMARY',
  'DETAILS',
]);

/** Interactive ARIA roles */
const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'menuitem',
  'tab',
  'checkbox',
  'radio',
  'switch',
  'slider',
  'spinbutton',
  'combobox',
  'listbox',
  'option',
  'textbox',
]);

/**
 * Checks if an element is interactive (can receive clicks meaningfully)
 */
export function isInteractiveElement(element: Element): boolean {
  const tagName = element.tagName.toUpperCase();

  // Check if disabled
  if (element.hasAttribute('disabled')) {
    return false;
  }

  // Check interactive tags
  if (INTERACTIVE_TAGS.has(tagName)) {
    return true;
  }

  // Check anchor tags - need href to be interactive
  if (tagName === 'A') {
    return element.hasAttribute('href');
  }

  // Check ARIA roles
  const role = element.getAttribute('role');
  if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) {
    return true;
  }

  // Check tabindex (indicates focusable/interactive)
  if (element.hasAttribute('tabindex')) {
    return true;
  }

  // Check for event handler attributes
  if (element.hasAttribute('onclick') ||
      element.hasAttribute('onmousedown') ||
      element.hasAttribute('onmouseup')) {
    return true;
  }

  return false;
}

/**
 * Gets the reason why a click is considered dead
 */
function getDeadClickReason(element: Element): DeadClickEvent['reason'] {
  // Check if it's a disabled interactive element
  if (element.hasAttribute('disabled')) {
    return 'disabled';
  }

  // Check if it's an anchor without href
  if (element.tagName.toUpperCase() === 'A' && !element.hasAttribute('href')) {
    return 'no_href';
  }

  return 'non_interactive';
}

/**
 * Detects dead clicks - clicks on non-interactive elements
 */
export class DeadClickDetector {
  private config: {
    onDeadClick?: (event: DeadClickEvent) => void;
    document: Document;
    emitLogs: boolean;
    checkParents: boolean;
  };
  private enabled = false;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(config: DeadClickDetectorConfig) {
    this.config = {
      onDeadClick: config.onDeadClick,
      document: config.document ?? (typeof document !== 'undefined' ? document : null as unknown as Document),
      emitLogs: config.emitLogs ?? true,
      checkParents: config.checkParents ?? true,
    };
  }

  /**
   * Enables dead click detection by attaching document listeners
   */
  enable(): void {
    if (this.enabled || !this.config.document) return;

    this.clickHandler = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        // Check if element looks clickable (has pointer cursor)
        let looksClickable = false;
        if (typeof window !== 'undefined') {
          const style = window.getComputedStyle(target);
          looksClickable = style.cursor === 'pointer';
        }
        this.recordClick(target, { looksClickable, checkParents: this.config.checkParents });
      }
    };

    this.config.document.addEventListener('click', this.clickHandler, { capture: true });
    this.enabled = true;
  }

  /**
   * Disables dead click detection
   */
  disable(): void {
    if (!this.enabled || !this.clickHandler || !this.config.document) return;

    this.config.document.removeEventListener('click', this.clickHandler, { capture: true });
    this.clickHandler = null;
    this.enabled = false;
  }

  /**
   * Records a click and checks if it's a dead click
   */
  recordClick(element: Element, options: RecordClickOptions = {}): void {
    const { looksClickable = false, checkParents = this.config.checkParents } = options;

    // Check if element or any parent is interactive
    let currentElement: Element | null = element;
    let isInteractive = false;

    if (checkParents) {
      while (currentElement) {
        if (isInteractiveElement(currentElement)) {
          isInteractive = true;
          break;
        }
        currentElement = currentElement.parentElement;
      }
    } else {
      isInteractive = isInteractiveElement(element);
    }

    // If interactive, not a dead click
    if (isInteractive) {
      return;
    }

    // This is a dead click
    const deadClickEvent = this.createDeadClickEvent(element, looksClickable);

    // Emit log event if configured
    if (this.config.emitLogs) {
      const semanticName = getSemanticName(element);
      const attrs: Partial<SessionEventAttributes> = {
        'target.semantic_name': semanticName,
        'target.element': deadClickEvent.elementTag,
        'frustration.reason': deadClickEvent.reason,
      };
      if (deadClickEvent.elementId) {
        attrs['target.id'] = deadClickEvent.elementId;
      }
      if (deadClickEvent.looksClickable) {
        attrs['frustration.looks_clickable'] = true;
      }
      emitFrustrationEvent('dead_click', deadClickEvent.score, attrs);
    }

    // Call callback if provided
    if (this.config.onDeadClick) {
      this.config.onDeadClick(deadClickEvent);
    }
  }

  /**
   * Creates a dead click event
   */
  private createDeadClickEvent(
    element: Element,
    looksClickable: boolean
  ): DeadClickEvent {
    const reason = getDeadClickReason(element);

    // Calculate score based on factors:
    // - Higher if element looks clickable (user was fooled)
    // - Medium for disabled elements (might be confusing)
    // - Lower for random non-interactive elements
    let score = 0.3; // Base score

    if (looksClickable) {
      score = 0.7; // Element looks clickable but isn't - more frustrating
    } else if (reason === 'disabled') {
      score = 0.5; // Disabled element - moderately frustrating
    } else if (reason === 'no_href') {
      score = 0.6; // Link without href - somewhat frustrating
    }

    return {
      element,
      elementTag: element.tagName.toLowerCase(),
      elementId: element.id || undefined,
      score,
      reason,
      looksClickable: looksClickable || undefined,
      timestamp: Date.now(),
    };
  }
}
