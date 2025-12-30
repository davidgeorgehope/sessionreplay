/**
 * Event for form-level actions
 */
export interface FormEvent {
  /** Form name or ID */
  formName: string;
  /** Action that occurred */
  action: 'submit' | 'abandon';
  /** Whether submission was successful (for submit action) */
  success?: boolean;
  /** Error message if submission failed */
  errorMessage?: string;
  /** Total time spent on form in ms */
  totalTimeMs?: number;
  /** Number of fields interacted with */
  fieldsInteracted?: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Event for field-level interactions
 */
export interface FormFieldEvent {
  /** Field name attribute */
  fieldName: string;
  /** Field type (text, email, password, etc.) */
  fieldType: string;
  /** Time spent on this field in ms */
  timeSpentMs: number;
  /** Whether this indicates hesitation */
  hesitation: boolean;
  /** Frustration score 0-1 */
  frustrationScore: number;
  /** Number of times this field was focused */
  interactionCount: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Configuration for form tracking
 */
export interface FormTrackerConfig {
  /** Callback for form-level events */
  onFormEvent: (event: FormEvent) => void;
  /** Callback for field-level events */
  onFieldEvent: (event: FormFieldEvent) => void;
  /** Time threshold for hesitation detection in ms (default: 10000) */
  hesitationThresholdMs?: number;
}

interface FieldState {
  focusTime: number | null;
  totalTime: number;
  interactionCount: number;
}

/**
 * Tracks form interactions and detects hesitation patterns
 */
export class FormTracker {
  private config: Required<FormTrackerConfig>;
  private fieldStates: Map<string, FieldState> = new Map();
  private totalFormTime = 0;

  constructor(config: FormTrackerConfig) {
    this.config = {
      onFormEvent: config.onFormEvent,
      onFieldEvent: config.onFieldEvent,
      hesitationThresholdMs: config.hesitationThresholdMs ?? 10000,
    };
  }

  /**
   * Records when a field receives focus
   */
  recordFieldFocus(element: Element): void {
    const fieldName = this.getFieldName(element);
    const state = this.fieldStates.get(fieldName) || {
      focusTime: null,
      totalTime: 0,
      interactionCount: 0,
    };

    state.focusTime = Date.now();
    state.interactionCount++;
    this.fieldStates.set(fieldName, state);
  }

  /**
   * Records when a field loses focus
   */
  recordFieldBlur(element: Element): void {
    const fieldName = this.getFieldName(element);
    const state = this.fieldStates.get(fieldName);

    if (!state || state.focusTime === null) {
      return;
    }

    const timeSpentMs = Date.now() - state.focusTime;
    state.totalTime += timeSpentMs;
    state.focusTime = null;
    this.totalFormTime += timeSpentMs;

    const hesitation = timeSpentMs >= this.config.hesitationThresholdMs;
    const frustrationScore = this.calculateFieldFrustration(
      timeSpentMs,
      state.interactionCount,
      hesitation
    );

    const event: FormFieldEvent = {
      fieldName,
      fieldType: this.getFieldType(element),
      timeSpentMs,
      hesitation,
      frustrationScore,
      interactionCount: state.interactionCount,
      timestamp: Date.now(),
    };

    this.config.onFieldEvent(event);
  }

  /**
   * Records a form submission
   */
  recordFormSubmit(
    formName: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const event: FormEvent = {
      formName,
      action: 'submit',
      success,
      errorMessage,
      totalTimeMs: this.totalFormTime,
      fieldsInteracted: this.fieldStates.size,
      timestamp: Date.now(),
    };

    this.config.onFormEvent(event);
  }

  /**
   * Records form abandonment (user navigates away without submitting)
   */
  recordFormAbandon(formName: string): void {
    const event: FormEvent = {
      formName,
      action: 'abandon',
      totalTimeMs: this.totalFormTime,
      fieldsInteracted: this.fieldStates.size,
      timestamp: Date.now(),
    };

    this.config.onFormEvent(event);
  }

  /**
   * Resets all tracking state
   */
  reset(): void {
    this.fieldStates.clear();
    this.totalFormTime = 0;
  }

  /**
   * Gets the field name from an element
   */
  private getFieldName(element: Element): string {
    return (
      element.getAttribute('name') ||
      element.getAttribute('id') ||
      element.tagName.toLowerCase()
    );
  }

  /**
   * Gets the field type from an element
   */
  private getFieldType(element: Element): string {
    if (element.tagName.toUpperCase() === 'INPUT') {
      return element.getAttribute('type') || 'text';
    }
    return element.tagName.toLowerCase();
  }

  /**
   * Calculates frustration score for a field interaction
   */
  private calculateFieldFrustration(
    timeSpentMs: number,
    interactionCount: number,
    hesitation: boolean
  ): number {
    let score = 0;

    // Hesitation is a strong signal
    if (hesitation) {
      score += 0.5;
    }

    // Multiple interactions suggest correction/confusion
    if (interactionCount > 2) {
      score += Math.min((interactionCount - 2) * 0.1, 0.3);
    }

    // Very long time even without hesitation threshold
    if (timeSpentMs > 30000) {
      score += 0.2;
    }

    return Math.min(score, 1);
  }
}
