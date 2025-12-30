import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorTracker, type TrackedError } from './errors';

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;
  let events: TrackedError[];
  let mockWindow: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    location: { href: string };
    document: { title: string };
  };

  beforeEach(() => {
    events = [];

    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { href: 'http://localhost/page' },
      document: { title: 'Test Page' },
    };

    tracker = new ErrorTracker({
      onError: (event) => events.push(event),
      window: mockWindow as unknown as Window,
    });
  });

  afterEach(() => {
    tracker.disable();
  });

  describe('initialization', () => {
    it('should register error handler on enable', () => {
      tracker.enable();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
    });

    it('should register unhandledrejection handler on enable', () => {
      tracker.enable();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });

    it('should remove handlers on disable', () => {
      tracker.enable();
      tracker.disable();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      );
    });
  });

  describe('uncaught exception handling', () => {
    it('should capture error events', () => {
      tracker.enable();

      const error = new Error('Something went wrong');
      tracker.recordError({
        type: 'uncaught_exception',
        error,
        filename: 'app.js',
        lineno: 42,
        colno: 10,
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('uncaught_exception');
      expect(events[0].message).toBe('Something went wrong');
    });

    it('should capture stack trace', () => {
      tracker.enable();

      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:10:5\n    at main.js:1:1';

      tracker.recordError({
        type: 'uncaught_exception',
        error,
      });

      expect(events[0].stack).toContain('at test.js:10:5');
    });

    it('should capture filename and line/column', () => {
      tracker.enable();

      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Test'),
        filename: 'component.tsx',
        lineno: 100,
        colno: 25,
      });

      expect(events[0].filename).toBe('component.tsx');
      expect(events[0].lineno).toBe(100);
      expect(events[0].colno).toBe(25);
    });

    it('should handle errors without stack traces', () => {
      tracker.enable();

      const error = new Error('No stack');
      error.stack = undefined;

      tracker.recordError({
        type: 'uncaught_exception',
        error,
      });

      expect(events).toHaveLength(1);
      expect(events[0].stack).toBeUndefined();
    });

    it('should handle string errors', () => {
      tracker.enable();

      tracker.recordError({
        type: 'uncaught_exception',
        message: 'String error message',
      });

      expect(events[0].message).toBe('String error message');
    });
  });

  describe('unhandled rejection handling', () => {
    it('should capture unhandled rejections', () => {
      tracker.enable();

      const error = new Error('Promise rejected');
      tracker.recordError({
        type: 'unhandled_rejection',
        error,
      });

      expect(events[0].type).toBe('unhandled_rejection');
      expect(events[0].message).toBe('Promise rejected');
    });

    it('should handle non-Error rejection reasons', () => {
      tracker.enable();

      tracker.recordError({
        type: 'unhandled_rejection',
        message: 'string rejection',
      });

      expect(events[0].message).toBe('string rejection');
    });
  });

  describe('context tracking', () => {
    it('should include page URL in error context', () => {
      tracker.enable();

      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Test'),
      });

      expect(events[0].context.pageUrl).toBe('http://localhost/page');
    });

    it('should include page title in error context', () => {
      tracker.enable();

      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Test'),
      });

      expect(events[0].context.pageTitle).toBe('Test Page');
    });

    it('should track last clicked element', () => {
      tracker.enable();

      tracker.recordLastClick('Submit Button');

      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Submission failed'),
      });

      expect(events[0].context.lastClick).toBe('Submit Button');
    });

    it('should include time on page', () => {
      vi.useFakeTimers();

      tracker.enable();

      vi.advanceTimersByTime(5000);

      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Test'),
      });

      expect(events[0].context.timeOnPageMs).toBeCloseTo(5000, -2);

      vi.useRealTimers();
    });
  });

  describe('stack trace handling', () => {
    it('should truncate very long stack traces', () => {
      tracker.enable();

      const error = new Error('Test');
      // Create a long stack trace
      error.stack = 'Error: Test\n' + Array(500).fill('    at function.name (file.js:1:1)').join('\n');

      tracker.recordError({
        type: 'uncaught_exception',
        error,
      });

      // Should be truncated to reasonable length
      expect(events[0].stack!.length).toBeLessThan(5000);
    });
  });

  describe('event details', () => {
    it('should include timestamp', () => {
      tracker.enable();

      const before = Date.now();
      tracker.recordError({
        type: 'uncaught_exception',
        error: new Error('Test'),
      });

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('error count tracking', () => {
    it('should track error count', () => {
      tracker.enable();

      tracker.recordError({ type: 'uncaught_exception', error: new Error('1') });
      tracker.recordError({ type: 'uncaught_exception', error: new Error('2') });
      tracker.recordError({ type: 'unhandled_rejection', error: new Error('3') });

      expect(tracker.getErrorCount()).toBe(3);
    });

    it('should reset error count on disable', () => {
      tracker.enable();
      tracker.recordError({ type: 'uncaught_exception', error: new Error('1') });
      tracker.disable();

      expect(tracker.getErrorCount()).toBe(0);
    });
  });
});
