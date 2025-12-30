/**
 * Navigation Tracking
 *
 * Tracks page views and route changes for SPAs.
 * Captures page loads, SPA navigation (pushState/replaceState), and page unloads.
 */

export type NavigationType = 'page_load' | 'route_change' | 'page_unload';

export interface NavigationEvent {
  type: NavigationType;
  timestamp: number;
  toUrl: string;
  pageTitle: string;
  fromUrl?: string;
  referrer?: string;
  durationMs?: number;
}

export interface NavigationTrackerConfig {
  /** Callback when navigation occurs */
  onNavigation: (event: NavigationEvent) => void;
  /** Window object (injectable for testing) */
  window?: Window;
}

export class NavigationTracker {
  private config: NavigationTrackerConfig;
  private win: Window;
  private enabled = false;
  private currentUrl: string;
  private currentTitle: string;
  private pageStartTime: number;
  private popstateHandler: ((event: PopStateEvent) => void) | null = null;
  private beforeunloadHandler: ((event: BeforeUnloadEvent) => void) | null = null;

  constructor(config: NavigationTrackerConfig) {
    this.config = config;
    this.win = config.window || (typeof window !== 'undefined' ? window : null!);
    this.currentUrl = '';
    this.currentTitle = '';
    this.pageStartTime = 0;
  }

  /**
   * Enable navigation tracking
   */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;

    // Initialize current page state
    this.currentUrl = this.win.location.href;
    this.currentTitle = this.win.document.title;
    this.pageStartTime = Date.now();

    // Emit initial page load event
    this.config.onNavigation({
      type: 'page_load',
      timestamp: Date.now(),
      toUrl: this.currentUrl,
      pageTitle: this.currentTitle,
      referrer: this.win.document.referrer || undefined,
    });

    // Set up event listeners
    this.popstateHandler = this.handlePopstate.bind(this);
    this.beforeunloadHandler = this.handleBeforeunload.bind(this);

    this.win.addEventListener('popstate', this.popstateHandler);
    this.win.addEventListener('beforeunload', this.beforeunloadHandler);
  }

  /**
   * Disable navigation tracking
   */
  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;

    if (this.popstateHandler) {
      this.win.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }

    if (this.beforeunloadHandler) {
      this.win.removeEventListener('beforeunload', this.beforeunloadHandler);
      this.beforeunloadHandler = null;
    }
  }

  /**
   * Record a navigation event (call this after pushState/replaceState)
   */
  recordNavigation(toUrl: string, pageTitle: string): void {
    if (!this.enabled) return;

    const now = Date.now();
    const durationMs = now - this.pageStartTime;

    this.config.onNavigation({
      type: 'route_change',
      timestamp: now,
      fromUrl: this.currentUrl,
      toUrl,
      pageTitle,
      durationMs,
    });

    // Update state for next navigation
    this.currentUrl = toUrl;
    this.currentTitle = pageTitle;
    this.pageStartTime = now;
  }

  /**
   * Record page unload event
   */
  recordUnload(): void {
    if (!this.enabled) return;

    const now = Date.now();
    const durationMs = now - this.pageStartTime;

    this.config.onNavigation({
      type: 'page_unload',
      timestamp: now,
      toUrl: this.currentUrl,
      pageTitle: this.currentTitle,
      durationMs,
    });
  }

  /**
   * Get information about the current page
   */
  getCurrentPageInfo(): { url: string; timeOnPageMs: number } {
    return {
      url: this.currentUrl,
      timeOnPageMs: Date.now() - this.pageStartTime,
    };
  }

  private handlePopstate(_event: PopStateEvent): void {
    // When popstate fires, the URL has already changed
    const newUrl = this.win.location.href;
    const newTitle = this.win.document.title;

    if (newUrl !== this.currentUrl) {
      this.recordNavigation(newUrl, newTitle);
    }
  }

  private handleBeforeunload(_event: BeforeUnloadEvent): void {
    this.recordUnload();
  }
}
