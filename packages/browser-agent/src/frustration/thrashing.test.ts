import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThrashingDetector, type ThrashingEvent } from './thrashing';

describe('ThrashingDetector', () => {
  let detector: ThrashingDetector;
  let events: ThrashingEvent[];
  let mockWindow: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    location: { href: string };
    document: {
      documentElement: { scrollHeight: number; clientHeight: number };
    };
    scrollY: number;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];

    mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { href: 'http://localhost/page' },
      document: {
        documentElement: { scrollHeight: 2000, clientHeight: 800 },
      },
      scrollY: 0,
    };

    detector = new ThrashingDetector({
      onThrashing: (event) => events.push(event),
      window: mockWindow as unknown as Window,
    });
  });

  afterEach(() => {
    detector.disable();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should register scroll listener on enable', () => {
      detector.enable();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should remove scroll listener on disable', () => {
      detector.enable();
      detector.disable();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('thrashing detection', () => {
    it('should detect rapid direction changes', () => {
      detector.enable();

      // Simulate scrolling down then up rapidly
      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50; // up
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 150; // down
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 80; // up
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 200; // down
      detector.recordScroll();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('thrashing');
    });

    it('should not trigger on normal scrolling', () => {
      detector.enable();

      // Simulate smooth scrolling down
      for (let i = 0; i < 10; i++) {
        mockWindow.scrollY = (i + 1) * 50;
        detector.recordScroll();
        vi.advanceTimersByTime(100);
      }

      expect(events).toHaveLength(0);
    });

    it('should not trigger on single direction change', () => {
      detector.enable();

      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50; // one change
      detector.recordScroll();

      expect(events).toHaveLength(0);
    });

    it('should calculate direction changes count', () => {
      detector.enable();

      // 4 direction changes
      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 150;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 80;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 200;
      detector.recordScroll();

      expect(events[0].directionChanges).toBeGreaterThanOrEqual(3);
    });

    it('should reset after time window expires', () => {
      detector.enable();

      // Start with some direction changes
      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50;
      detector.recordScroll();

      // Wait longer than the time window
      vi.advanceTimersByTime(3000);

      // Start fresh - only 2 changes, not enough
      mockWindow.scrollY = 60;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 40;
      detector.recordScroll();

      expect(events).toHaveLength(0);
    });
  });

  describe('frustration score', () => {
    it('should calculate score based on direction changes', () => {
      detector.enable();

      // Multiple rapid direction changes
      const positions = [0, 100, 50, 150, 60, 180, 70];
      for (const pos of positions) {
        mockWindow.scrollY = pos;
        detector.recordScroll();
        vi.advanceTimersByTime(100);
      }

      expect(events[0].score).toBeGreaterThan(0);
      expect(events[0].score).toBeLessThanOrEqual(1);
    });
  });

  describe('scroll metrics', () => {
    it('should calculate scroll depth percentage', () => {
      detector.enable();

      mockWindow.scrollY = 600; // 600 of 1200 scrollable (2000 - 800)
      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 150;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 80;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 600;
      detector.recordScroll();

      expect(events[0].scrollDepthPercent).toBeDefined();
      expect(events[0].scrollDepthPercent).toBeGreaterThanOrEqual(0);
      expect(events[0].scrollDepthPercent).toBeLessThanOrEqual(100);
    });

    it('should track total scroll distance', () => {
      detector.enable();

      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 150;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 80;
      detector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 200;
      detector.recordScroll();

      // Should have tracked distance
      expect(events[0].scrollDistance).toBeGreaterThan(0);
    });

    it('should include page URL', () => {
      detector.enable();

      const positions = [0, 100, 50, 150, 60, 180];
      for (const pos of positions) {
        mockWindow.scrollY = pos;
        detector.recordScroll();
        vi.advanceTimersByTime(100);
      }

      expect(events[0].pageUrl).toBe('http://localhost/page');
    });

    it('should include duration of thrashing window', () => {
      detector.enable();

      mockWindow.scrollY = 100;
      detector.recordScroll();
      vi.advanceTimersByTime(200);

      mockWindow.scrollY = 50;
      detector.recordScroll();
      vi.advanceTimersByTime(200);

      mockWindow.scrollY = 150;
      detector.recordScroll();
      vi.advanceTimersByTime(200);

      mockWindow.scrollY = 80;
      detector.recordScroll();
      vi.advanceTimersByTime(200);

      mockWindow.scrollY = 200;
      detector.recordScroll();

      expect(events[0].durationMs).toBeGreaterThan(0);
    });
  });

  describe('event details', () => {
    it('should include timestamp', () => {
      detector.enable();

      const positions = [0, 100, 50, 150, 60, 180];
      const before = Date.now();
      for (const pos of positions) {
        mockWindow.scrollY = pos;
        detector.recordScroll();
        vi.advanceTimersByTime(100);
      }

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('configuration', () => {
    it('should respect custom threshold for direction changes', () => {
      const customDetector = new ThrashingDetector({
        onThrashing: (event) => events.push(event),
        window: mockWindow as unknown as Window,
        minDirectionChanges: 5, // Higher threshold
      });

      customDetector.enable();

      // Only 3 direction changes - not enough
      mockWindow.scrollY = 100;
      customDetector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 50;
      customDetector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 150;
      customDetector.recordScroll();
      vi.advanceTimersByTime(100);

      mockWindow.scrollY = 80;
      customDetector.recordScroll();

      expect(events).toHaveLength(0);

      customDetector.disable();
    });

    it('should respect custom time window', () => {
      const customDetector = new ThrashingDetector({
        onThrashing: (event) => events.push(event),
        window: mockWindow as unknown as Window,
        timeWindowMs: 500, // Shorter window
      });

      customDetector.enable();

      // Changes spread over longer than 500ms - each one 300ms apart
      // so only 1-2 will be within the window at any time, never 3
      mockWindow.scrollY = 100;
      customDetector.recordScroll();
      vi.advanceTimersByTime(300);

      mockWindow.scrollY = 50;
      customDetector.recordScroll();
      vi.advanceTimersByTime(300);

      mockWindow.scrollY = 150;
      customDetector.recordScroll();
      vi.advanceTimersByTime(300);

      mockWindow.scrollY = 80;
      customDetector.recordScroll();

      expect(events).toHaveLength(0);

      customDetector.disable();
    });
  });
});
