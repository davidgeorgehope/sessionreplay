/**
 * Scroll Thrashing Detection
 *
 * Detects rapid scroll direction changes indicating user confusion.
 * Thrashing occurs when users scroll up and down repeatedly looking for content.
 */

import { emitFrustrationEvent, type SessionEventAttributes } from '../events';

export interface ThrashingEvent {
  type: 'thrashing';
  timestamp: number;
  score: number; // 0-1 frustration score
  directionChanges: number;
  durationMs: number;
  scrollDistance: number;
  scrollDepthPercent: number;
  pageUrl: string;
}

export interface ThrashingDetectorConfig {
  /** Callback when thrashing detected (optional) */
  onThrashing?: (event: ThrashingEvent) => void;
  /** Window object (injectable for testing) */
  window?: Window;
  /** Minimum direction changes to trigger (default: 3) */
  minDirectionChanges?: number;
  /** Time window in ms to detect thrashing (default: 2000) */
  timeWindowMs?: number;
  /** Whether to emit OTLP log events (default: true) */
  emitLogs?: boolean;
}

interface ScrollRecord {
  position: number;
  timestamp: number;
  direction: 'up' | 'down' | null;
}

const DEFAULT_MIN_DIRECTION_CHANGES = 3;
const DEFAULT_TIME_WINDOW_MS = 2000;

export class ThrashingDetector {
  private config: ThrashingDetectorConfig & { emitLogs: boolean };
  private win: Window;
  private enabled = false;
  private scrollHandler: (() => void) | null = null;
  private scrollRecords: ScrollRecord[] = [];
  private lastPosition: number = 0;
  private lastDirection: 'up' | 'down' | null = null;
  private totalDistance: number = 0;

  constructor(config: ThrashingDetectorConfig) {
    this.config = {
      ...config,
      emitLogs: config.emitLogs ?? true,
    };
    this.win = config.window || (typeof window !== 'undefined' ? window : null!);
  }

  /**
   * Enable thrashing detection
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.reset();
    this.lastPosition = this.win.scrollY;

    this.scrollHandler = this.handleScroll.bind(this);
    this.win.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  /**
   * Disable thrashing detection
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.scrollHandler) {
      this.win.removeEventListener('scroll', this.scrollHandler, { passive: true } as EventListenerOptions);
      this.scrollHandler = null;
    }

    this.reset();
  }

  /**
   * Record a scroll event (called internally or externally)
   */
  recordScroll(): void {
    if (!this.enabled) return;

    const currentPosition = this.win.scrollY;
    const now = Date.now();
    const timeWindow = this.config.timeWindowMs || DEFAULT_TIME_WINDOW_MS;

    // Calculate direction
    const delta = currentPosition - this.lastPosition;
    if (delta === 0) return; // No movement

    const direction: 'up' | 'down' = delta < 0 ? 'up' : 'down';
    const distance = Math.abs(delta);
    this.totalDistance += distance;

    // Clean old records outside time window
    this.scrollRecords = this.scrollRecords.filter(
      (record) => now - record.timestamp < timeWindow
    );

    // If direction changed, record it
    if (this.lastDirection !== null && direction !== this.lastDirection) {
      this.scrollRecords.push({
        position: currentPosition,
        timestamp: now,
        direction,
      });

      // Check for thrashing
      this.checkForThrashing(now);
    }

    this.lastPosition = currentPosition;
    this.lastDirection = direction;
  }

  private handleScroll(): void {
    this.recordScroll();
  }

  private checkForThrashing(now: number): void {
    const minChanges = this.config.minDirectionChanges || DEFAULT_MIN_DIRECTION_CHANGES;
    const timeWindow = this.config.timeWindowMs || DEFAULT_TIME_WINDOW_MS;

    // Count direction changes in the time window
    const recentRecords = this.scrollRecords.filter(
      (record) => now - record.timestamp < timeWindow
    );

    if (recentRecords.length >= minChanges) {
      // Calculate frustration score based on frequency
      const score = Math.min(1, recentRecords.length / (minChanges * 2));

      const duration = recentRecords.length > 0
        ? now - recentRecords[0].timestamp
        : 0;

      const event: ThrashingEvent = {
        type: 'thrashing',
        timestamp: now,
        score,
        directionChanges: recentRecords.length,
        durationMs: duration,
        scrollDistance: this.totalDistance,
        scrollDepthPercent: this.calculateScrollDepth(),
        pageUrl: this.win.location.href,
      };

      // Emit log event if configured
      if (this.config.emitLogs) {
        const attrs: Partial<SessionEventAttributes> = {
          'frustration.direction_changes': event.directionChanges,
          'frustration.duration_ms': event.durationMs,
          'frustration.scroll_distance': event.scrollDistance,
          'frustration.scroll_depth_percent': Math.round(event.scrollDepthPercent),
        };
        emitFrustrationEvent('thrashing', event.score, attrs);
      }

      // Call callback if provided
      if (this.config.onThrashing) {
        this.config.onThrashing(event);
      }

      // Reset after detection to avoid repeated events
      this.reset();
    }
  }

  private calculateScrollDepth(): number {
    const docHeight = this.win.document.documentElement.scrollHeight;
    const viewportHeight = this.win.document.documentElement.clientHeight;
    const scrollableHeight = docHeight - viewportHeight;

    if (scrollableHeight <= 0) return 100;

    const depth = (this.win.scrollY / scrollableHeight) * 100;
    return Math.min(100, Math.max(0, depth));
  }

  private reset(): void {
    this.scrollRecords = [];
    this.totalDistance = 0;
    this.lastDirection = null;
  }
}
