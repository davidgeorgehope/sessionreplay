import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FormTracker, type FormEvent, type FormFieldEvent } from './forms';

describe('FormTracker', () => {
  let tracker: FormTracker;
  let formEvents: FormEvent[];
  let fieldEvents: FormFieldEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    formEvents = [];
    fieldEvents = [];
    tracker = new FormTracker({
      onFormEvent: (event) => formEvents.push(event),
      onFieldEvent: (event) => fieldEvents.push(event),
    });
  });

  afterEach(() => {
    tracker.reset();
    vi.useRealTimers();
  });

  describe('field focus tracking', () => {
    it('should track when a field receives focus', () => {
      const field = createMockField('email', 'input');

      tracker.recordFieldFocus(field);

      // No event until blur
      expect(fieldEvents).toHaveLength(0);
    });

    it('should emit event when field loses focus', () => {
      const field = createMockField('email', 'input');

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(5000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents).toHaveLength(1);
      expect(fieldEvents[0].fieldName).toBe('email');
      expect(fieldEvents[0].timeSpentMs).toBe(5000);
    });

    it('should include field type in event', () => {
      const field = createMockField('password', 'input', 'password');

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(1000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents[0].fieldType).toBe('password');
    });
  });

  describe('hesitation detection', () => {
    it('should detect hesitation on field (>10s focus)', () => {
      const field = createMockField('credit-card', 'input');

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(15000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents[0].hesitation).toBe(true);
      expect(fieldEvents[0].frustrationScore).toBeGreaterThanOrEqual(0.5);
    });

    it('should not flag hesitation for short focus', () => {
      const field = createMockField('name', 'input');

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(3000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents[0].hesitation).toBe(false);
    });

    it('should allow custom hesitation threshold', () => {
      tracker = new FormTracker({
        onFormEvent: (event) => formEvents.push(event),
        onFieldEvent: (event) => fieldEvents.push(event),
        hesitationThresholdMs: 5000,
      });

      const field = createMockField('phone', 'input');

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(6000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents[0].hesitation).toBe(true);
    });
  });

  describe('form submission', () => {
    it('should track successful form submission', () => {
      tracker.recordFormSubmit('checkout-form', true);

      expect(formEvents).toHaveLength(1);
      expect(formEvents[0].formName).toBe('checkout-form');
      expect(formEvents[0].action).toBe('submit');
      expect(formEvents[0].success).toBe(true);
    });

    it('should track failed form submission', () => {
      tracker.recordFormSubmit('login-form', false, 'Invalid credentials');

      expect(formEvents[0].success).toBe(false);
      expect(formEvents[0].errorMessage).toBe('Invalid credentials');
    });
  });

  describe('form abandonment', () => {
    it('should detect form abandonment', () => {
      const field = createMockField('email', 'input');

      // Start interacting with form
      tracker.recordFieldFocus(field);
      tracker.recordFieldBlur(field);

      // Abandon the form
      tracker.recordFormAbandon('signup-form');

      expect(formEvents).toHaveLength(1);
      expect(formEvents[0].action).toBe('abandon');
      expect(formEvents[0].formName).toBe('signup-form');
    });

    it('should include total time spent on form', () => {
      const field1 = createMockField('email', 'input');
      const field2 = createMockField('password', 'input');

      tracker.recordFieldFocus(field1);
      vi.advanceTimersByTime(3000);
      tracker.recordFieldBlur(field1);

      tracker.recordFieldFocus(field2);
      vi.advanceTimersByTime(2000);
      tracker.recordFieldBlur(field2);

      tracker.recordFormAbandon('signup-form');

      expect(formEvents[0].totalTimeMs).toBe(5000);
    });
  });

  describe('field interaction count', () => {
    it('should count interactions per field', () => {
      const field = createMockField('phone', 'input');

      // Multiple focus/blur cycles (user correcting input)
      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(1000);
      tracker.recordFieldBlur(field);

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(1000);
      tracker.recordFieldBlur(field);

      tracker.recordFieldFocus(field);
      vi.advanceTimersByTime(1000);
      tracker.recordFieldBlur(field);

      expect(fieldEvents).toHaveLength(3);
      expect(fieldEvents[2].interactionCount).toBe(3);
    });
  });
});

// Helper to create mock form fields
function createMockField(
  name: string,
  tagName: string,
  type = 'text',
  id?: string
): Element {
  return {
    tagName: tagName.toUpperCase(),
    id: id || name,
    getAttribute: (attr: string) => {
      if (attr === 'name') return name;
      if (attr === 'type') return type;
      if (attr === 'id') return id || name;
      return null;
    },
  } as unknown as Element;
}
