/**
 * Error Tracking
 *
 * Captures JavaScript errors with user context.
 * Tracks uncaught exceptions and unhandled promise rejections.
 */

export type ErrorType = 'uncaught_exception' | 'unhandled_rejection' | 'console_error';

export interface ErrorContext {
  pageUrl: string;
  pageTitle: string;
  lastClick?: string;
  timeOnPageMs: number;
}

export interface TrackedError {
  type: ErrorType;
  timestamp: number;
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  context: ErrorContext;
}

export interface RecordErrorInput {
  type: ErrorType;
  error?: Error;
  message?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
}

export interface ErrorTrackerConfig {
  /** Callback when error occurs */
  onError: (event: TrackedError) => void;
  /** Window object (injectable for testing) */
  window?: Window;
  /** Maximum stack trace length (default: 4000) */
  maxStackLength?: number;
}

const MAX_STACK_LENGTH = 4000;

export class ErrorTracker {
  private config: ErrorTrackerConfig;
  private win: Window;
  private enabled = false;
  private pageStartTime: number = 0;
  private lastClickedElement: string | undefined;
  private errorCount: number = 0;
  private errorHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  constructor(config: ErrorTrackerConfig) {
    this.config = config;
    this.win = config.window || (typeof window !== 'undefined' ? window : null!);
  }

  /**
   * Enable error tracking
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.pageStartTime = Date.now();
    this.errorCount = 0;

    // Set up error handler
    this.errorHandler = this.handleError.bind(this) as (event: ErrorEvent) => void;
    this.rejectionHandler = this.handleRejection.bind(this);

    this.win.addEventListener('error', this.errorHandler as EventListener);
    this.win.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  /**
   * Disable error tracking
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.errorCount = 0;

    if (this.errorHandler) {
      this.win.removeEventListener('error', this.errorHandler as EventListener);
      this.errorHandler = null;
    }

    if (this.rejectionHandler) {
      this.win.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
  }

  /**
   * Record an error event
   */
  recordError(input: RecordErrorInput): void {
    if (!this.enabled) return;

    const { type, error, message, filename, lineno, colno } = input;

    // Extract message
    const errorMessage = error?.message || message || 'Unknown error';

    // Extract and truncate stack trace
    let stack = error?.stack;
    const maxLength = this.config.maxStackLength || MAX_STACK_LENGTH;
    if (stack && stack.length > maxLength) {
      stack = stack.substring(0, maxLength) + '\n... (truncated)';
    }

    const trackedError: TrackedError = {
      type,
      timestamp: Date.now(),
      message: errorMessage,
      stack,
      filename,
      lineno,
      colno,
      context: {
        pageUrl: this.win.location.href,
        pageTitle: this.win.document.title,
        lastClick: this.lastClickedElement,
        timeOnPageMs: Date.now() - this.pageStartTime,
      },
    };

    this.errorCount++;
    this.config.onError(trackedError);
  }

  /**
   * Record the last clicked element (for context in errors)
   */
  recordLastClick(elementName: string): void {
    this.lastClickedElement = elementName;
  }

  /**
   * Get the total number of errors recorded
   */
  getErrorCount(): number {
    return this.errorCount;
  }

  private handleError(event: globalThis.ErrorEvent): void {
    this.recordError({
      type: 'uncaught_exception',
      error: event.error,
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  }

  private handleRejection(event: PromiseRejectionEvent): void {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : undefined;
    const message = error?.message || String(reason);

    this.recordError({
      type: 'unhandled_rejection',
      error,
      message,
    });
  }
}
