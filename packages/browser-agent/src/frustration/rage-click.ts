/**
 * Event emitted when a rage click is detected
 */
export interface RageClickEvent {
  /** Number of rapid clicks detected */
  clickCount: number;
  /** Duration of the click sequence in milliseconds */
  durationMs: number;
  /** Frustration score from 0-1 */
  score: number;
  /** Element identifier (id or generated) */
  elementId: string;
  /** Timestamp when rage click was detected */
  timestamp: number;
  /** The element that was rage-clicked */
  element: Element;
}

/**
 * Configuration for the rage click detector
 */
export interface RageClickDetectorConfig {
  /** Callback when rage click is detected */
  onRageClick: (event: RageClickEvent) => void;
  /** Minimum clicks to trigger detection (default: 3) */
  clickThreshold?: number;
  /** Time window for clicks in ms (default: 1000) */
  timeWindowMs?: number;
}

interface ClickRecord {
  timestamp: number;
  element: Element;
}

/**
 * Detects rage clicks - rapid repeated clicks indicating user frustration
 */
export class RageClickDetector {
  private config: Required<RageClickDetectorConfig>;
  private clicksByElement: Map<string, ClickRecord[]> = new Map();

  constructor(config: RageClickDetectorConfig) {
    this.config = {
      onRageClick: config.onRageClick,
      clickThreshold: config.clickThreshold ?? 3,
      timeWindowMs: config.timeWindowMs ?? 1000,
    };
  }

  /**
   * Records a click event and checks for rage clicking
   */
  recordClick(element: Element): void {
    const elementId = this.getElementId(element);
    const now = Date.now();

    // Get or create click history for this element
    let clicks = this.clicksByElement.get(elementId);
    if (!clicks) {
      clicks = [];
      this.clicksByElement.set(elementId, clicks);
    }

    // Add new click
    clicks.push({ timestamp: now, element });

    // Remove clicks outside the time window
    const cutoff = now - this.config.timeWindowMs;
    while (clicks.length > 0 && clicks[0].timestamp < cutoff) {
      clicks.shift();
    }

    // Check if we've reached the threshold
    if (clicks.length >= this.config.clickThreshold) {
      const event = this.createRageClickEvent(clicks, elementId);
      this.config.onRageClick(event);

      // Reset clicks for this element after detection
      this.clicksByElement.set(elementId, []);
    }
  }

  /**
   * Creates a rage click event from click history
   */
  private createRageClickEvent(clicks: ClickRecord[], elementId: string): RageClickEvent {
    const firstClick = clicks[0];
    const lastClick = clicks[clicks.length - 1];
    const durationMs = lastClick.timestamp - firstClick.timestamp;

    return {
      clickCount: clicks.length,
      durationMs,
      score: this.calculateScore(clicks.length, durationMs),
      elementId,
      timestamp: lastClick.timestamp,
      element: lastClick.element,
    };
  }

  /**
   * Calculates frustration score based on click velocity and count
   *
   * Score factors:
   * - More clicks = higher frustration
   * - Faster clicks = higher frustration
   *
   * Returns value between 0 and 1
   */
  private calculateScore(clickCount: number, durationMs: number): number {
    // Base score from click count (3 clicks = 0.3, 6 clicks = 0.6, etc.)
    const countScore = Math.min(clickCount / 10, 1);

    // Velocity score (clicks per second, normalized)
    // 10 clicks/sec = very fast = high score
    const clicksPerSecond = durationMs > 0 ? (clickCount / durationMs) * 1000 : 10;
    const velocityScore = Math.min(clicksPerSecond / 10, 1);

    // Combine scores with weights
    const combinedScore = (countScore * 0.4) + (velocityScore * 0.6);

    // Ensure we're in 0-1 range and round to 2 decimal places
    return Math.round(Math.min(Math.max(combinedScore, 0), 1) * 100) / 100;
  }

  /**
   * Gets a stable identifier for an element
   */
  private getElementId(element: Element): string {
    // Prefer ID if available
    if (element.id) {
      return element.id;
    }

    // Fall back to a generated identifier
    // In a real implementation, we might use a WeakMap for better tracking
    const tag = element.tagName.toLowerCase();
    const classes = element.className && typeof element.className === 'string'
      ? '.' + element.className.split(' ').filter(Boolean).join('.')
      : '';

    return `${tag}${classes}`;
  }

  /**
   * Resets all click tracking
   */
  reset(): void {
    this.clicksByElement.clear();
  }

  /**
   * Cleans up stale click records (call periodically for long-running sessions)
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.timeWindowMs;

    for (const [elementId, clicks] of this.clicksByElement.entries()) {
      // Remove old clicks
      while (clicks.length > 0 && clicks[0].timestamp < cutoff) {
        clicks.shift();
      }

      // Remove empty entries
      if (clicks.length === 0) {
        this.clicksByElement.delete(elementId);
      }
    }
  }
}
