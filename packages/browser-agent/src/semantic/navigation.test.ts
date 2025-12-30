import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NavigationTracker, type NavigationEvent } from './navigation';

describe('NavigationTracker', () => {
  let tracker: NavigationTracker;
  let events: NavigationEvent[];
  let mockWindow: {
    location: { href: string; pathname: string };
    document: { title: string; referrer: string };
    history: {
      pushState: ReturnType<typeof vi.fn>;
      replaceState: ReturnType<typeof vi.fn>;
    };
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];

    mockWindow = {
      location: { href: 'http://localhost/page1', pathname: '/page1' },
      document: { title: 'Page 1', referrer: 'http://google.com' },
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    tracker = new NavigationTracker({
      onNavigation: (event) => events.push(event),
      window: mockWindow as unknown as Window,
    });
  });

  afterEach(() => {
    tracker.disable();
    vi.useRealTimers();
  });

  describe('page load tracking', () => {
    it('should emit page_load event on enable', () => {
      tracker.enable();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('page_load');
      expect(events[0].toUrl).toBe('http://localhost/page1');
      expect(events[0].pageTitle).toBe('Page 1');
    });

    it('should include referrer in page_load event', () => {
      tracker.enable();

      expect(events[0].referrer).toBe('http://google.com');
    });

    it('should not emit page_load if disabled', () => {
      // Don't call enable
      expect(events).toHaveLength(0);
    });
  });

  describe('SPA navigation tracking', () => {
    it('should track history.pushState', () => {
      tracker.enable();
      events = []; // Clear initial page_load

      // Simulate pushState
      mockWindow.location.href = 'http://localhost/page2';
      mockWindow.location.pathname = '/page2';
      mockWindow.document.title = 'Page 2';

      tracker.recordNavigation('http://localhost/page2', 'Page 2');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('route_change');
      expect(events[0].fromUrl).toBe('http://localhost/page1');
      expect(events[0].toUrl).toBe('http://localhost/page2');
    });

    it('should track time spent on previous page', () => {
      tracker.enable();
      events = [];

      // Spend 5 seconds on page
      vi.advanceTimersByTime(5000);

      tracker.recordNavigation('http://localhost/page2', 'Page 2');

      expect(events[0].durationMs).toBeCloseTo(5000, -2);
    });

    it('should update internal state after navigation', () => {
      tracker.enable();
      events = [];

      // First navigation
      mockWindow.location.href = 'http://localhost/page2';
      tracker.recordNavigation('http://localhost/page2', 'Page 2');

      vi.advanceTimersByTime(3000);

      // Second navigation
      tracker.recordNavigation('http://localhost/page3', 'Page 3');

      expect(events[1].fromUrl).toBe('http://localhost/page2');
      expect(events[1].toUrl).toBe('http://localhost/page3');
      expect(events[1].durationMs).toBeCloseTo(3000, -2);
    });
  });

  describe('popstate handling', () => {
    it('should register popstate listener on enable', () => {
      tracker.enable();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });

    it('should remove popstate listener on disable', () => {
      tracker.enable();
      tracker.disable();

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });
  });

  describe('beforeunload handling', () => {
    it('should register beforeunload listener on enable', () => {
      tracker.enable();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should emit page_unload event', () => {
      tracker.enable();
      events = [];

      vi.advanceTimersByTime(10000);

      tracker.recordUnload();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('page_unload');
      expect(events[0].durationMs).toBeCloseTo(10000, -2);
    });
  });

  describe('event details', () => {
    it('should include timestamp', () => {
      const before = Date.now();
      tracker.enable();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
    });

    it('should include page title', () => {
      tracker.enable();
      events = [];

      tracker.recordNavigation('http://localhost/new', 'New Page Title');

      expect(events[0].pageTitle).toBe('New Page Title');
    });
  });

  describe('getCurrentPageInfo', () => {
    it('should return current page URL and time on page', () => {
      tracker.enable();
      vi.advanceTimersByTime(7000);

      const info = tracker.getCurrentPageInfo();

      expect(info.url).toBe('http://localhost/page1');
      expect(info.timeOnPageMs).toBeCloseTo(7000, -2);
    });
  });
});
