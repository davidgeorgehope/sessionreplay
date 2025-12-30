import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RageClickDetector, type RageClickEvent } from './rage-click';

describe('RageClickDetector', () => {
  let detector: RageClickDetector;
  let detectedEvents: RageClickEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    detectedEvents = [];
    detector = new RageClickDetector({
      onRageClick: (event) => detectedEvents.push(event),
    });
  });

  afterEach(() => {
    detector.reset();
    vi.useRealTimers();
  });

  describe('detection threshold', () => {
    it('should not detect rage click with only 2 clicks', () => {
      const element = createMockElement('button');

      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(0);
    });

    it('should detect rage click with 3 clicks within 1 second', () => {
      const element = createMockElement('button');

      detector.recordClick(element);
      vi.advanceTimersByTime(200);
      detector.recordClick(element);
      vi.advanceTimersByTime(200);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].clickCount).toBe(3);
    });

    it('should detect rage click with 5 clicks within 1 second', () => {
      const element = createMockElement('button');

      for (let i = 0; i < 5; i++) {
        detector.recordClick(element);
        vi.advanceTimersByTime(150);
      }

      // Triggers at 3 clicks (threshold), resets, then continues
      // 5 clicks = trigger at 3, reset, then 2 more (not enough for second trigger)
      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].clickCount).toBe(3); // First threshold hit
    });

    it('should not detect rage click if clicks are too slow', () => {
      const element = createMockElement('button');

      detector.recordClick(element);
      vi.advanceTimersByTime(600);
      detector.recordClick(element);
      vi.advanceTimersByTime(600);
      detector.recordClick(element);

      // 3 clicks over 1.2 seconds - not rage clicking
      expect(detectedEvents).toHaveLength(0);
    });
  });

  describe('element tracking', () => {
    it('should track clicks on different elements separately', () => {
      const button1 = createMockElement('button', 'btn-1');
      const button2 = createMockElement('button', 'btn-2');

      // Click button1 twice
      detector.recordClick(button1);
      vi.advanceTimersByTime(100);
      detector.recordClick(button1);

      // Click button2 twice
      vi.advanceTimersByTime(100);
      detector.recordClick(button2);
      vi.advanceTimersByTime(100);
      detector.recordClick(button2);

      // Neither should trigger rage click (only 2 clicks each)
      expect(detectedEvents).toHaveLength(0);
    });

    it('should detect rage click on specific element only', () => {
      const button1 = createMockElement('button', 'btn-1');
      const button2 = createMockElement('button', 'btn-2');

      // Rage click on button1
      detector.recordClick(button1);
      vi.advanceTimersByTime(100);
      detector.recordClick(button1);
      vi.advanceTimersByTime(100);
      detector.recordClick(button1);

      // Single click on button2
      detector.recordClick(button2);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].elementId).toBe('btn-1');
    });
  });

  describe('frustration score', () => {
    it('should calculate score based on click velocity', () => {
      const element = createMockElement('button');

      // Very fast clicks (high frustration)
      detector.recordClick(element);
      vi.advanceTimersByTime(50);
      detector.recordClick(element);
      vi.advanceTimersByTime(50);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].score).toBeGreaterThan(0.7);
    });

    it('should have lower score for slower rage clicks', () => {
      const element = createMockElement('button');

      // Slower clicks (lower frustration but still rage click)
      detector.recordClick(element);
      vi.advanceTimersByTime(300);
      detector.recordClick(element);
      vi.advanceTimersByTime(300);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].score).toBeLessThan(0.7);
      expect(detectedEvents[0].score).toBeGreaterThan(0.3);
    });

    it('should trigger multiple times with sustained rapid clicking', () => {
      const element = createMockElement('button');

      // 6 rapid clicks - triggers at 3, resets, triggers again at 6
      for (let i = 0; i < 6; i++) {
        detector.recordClick(element);
        vi.advanceTimersByTime(80);
      }

      // Should trigger twice (at 3 clicks and at 6 clicks)
      expect(detectedEvents).toHaveLength(2);
      expect(detectedEvents[0].clickCount).toBe(3);
      expect(detectedEvents[1].clickCount).toBe(3);
      // Both should have high scores due to rapid clicking
      expect(detectedEvents[0].score).toBeGreaterThan(0.5);
      expect(detectedEvents[1].score).toBeGreaterThan(0.5);
    });
  });

  describe('event details', () => {
    it('should include duration in event', () => {
      const element = createMockElement('button', 'submit-btn');

      detector.recordClick(element);
      vi.advanceTimersByTime(150);
      detector.recordClick(element);
      vi.advanceTimersByTime(150);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);
      expect(detectedEvents[0].durationMs).toBeCloseTo(300, -1);
    });

    it('should include element identifier', () => {
      const element = createMockElement('button', 'checkout-btn');

      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      expect(detectedEvents[0].elementId).toBe('checkout-btn');
    });

    it('should include timestamp', () => {
      const element = createMockElement('button');

      const startTime = Date.now();
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      expect(detectedEvents[0].timestamp).toBeGreaterThanOrEqual(startTime);
    });
  });

  describe('reset and cleanup', () => {
    it('should reset click history after detection', () => {
      const element = createMockElement('button');

      // First rage click
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);

      // Wait a bit then start new sequence
      vi.advanceTimersByTime(500);

      // Second rage click should require 3 new clicks
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(2);
    });

    it('should clean up old clicks after timeout', () => {
      const element = createMockElement('button');

      detector.recordClick(element);
      detector.recordClick(element);

      // Wait for timeout (clicks should be forgotten)
      vi.advanceTimersByTime(2000);

      // These should start a new sequence
      detector.recordClick(element);
      vi.advanceTimersByTime(100);
      detector.recordClick(element);

      // Only 2 clicks in new sequence - no rage click
      expect(detectedEvents).toHaveLength(0);
    });
  });

  describe('configurable threshold', () => {
    it('should allow custom click threshold', () => {
      detector = new RageClickDetector({
        onRageClick: (event) => detectedEvents.push(event),
        clickThreshold: 5, // Require 5 clicks instead of 3
      });

      const element = createMockElement('button');

      // 4 clicks - not enough
      for (let i = 0; i < 4; i++) {
        detector.recordClick(element);
        vi.advanceTimersByTime(100);
      }

      expect(detectedEvents).toHaveLength(0);

      // 5th click triggers
      detector.recordClick(element);

      expect(detectedEvents).toHaveLength(1);
    });

    it('should allow custom time window', () => {
      detector = new RageClickDetector({
        onRageClick: (event) => detectedEvents.push(event),
        timeWindowMs: 500, // Shorter window
      });

      const element = createMockElement('button');

      detector.recordClick(element);
      vi.advanceTimersByTime(200);
      detector.recordClick(element);
      vi.advanceTimersByTime(200);
      detector.recordClick(element);

      // 3 clicks in 400ms, but 500ms window - still OK
      expect(detectedEvents).toHaveLength(1);
    });
  });
});

// Helper to create mock elements
function createMockElement(tagName: string, id?: string): Element {
  const element = {
    tagName: tagName.toUpperCase(),
    id: id || '',
    getAttribute: (name: string) => (name === 'id' ? id : null),
  } as unknown as Element;
  return element;
}
