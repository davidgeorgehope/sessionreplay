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
  /** Callback when dead click is detected */
  onDeadClick: (event: DeadClickEvent) => void;
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
  private config: DeadClickDetectorConfig;

  constructor(config: DeadClickDetectorConfig) {
    this.config = config;
  }

  /**
   * Records a click and checks if it's a dead click
   */
  recordClick(element: Element, options: RecordClickOptions = {}): void {
    const { looksClickable = false, checkParents = false } = options;

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
    const event = this.createDeadClickEvent(element, looksClickable);
    this.config.onDeadClick(event);
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
