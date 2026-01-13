import {
  createSessionReplayProvider,
  ClickInstrumentation,
  RageClickDetector,
  DeadClickDetector,
  FormTracker,
  NavigationTracker,
  ErrorTracker,
  ThrashingDetector,
  getTracer,
  getSemanticName,
} from '@session-replay/browser-agent';

// Initialize OpenTelemetry provider
const provider = createSessionReplayProvider({
  serviceName: 'session-replay-demo',
  endpoint: 'http://localhost:4318/v1/traces',
  debug: true,
});

// Initialize click instrumentation
const clickInstrumentation = new ClickInstrumentation({
  document,
});
clickInstrumentation.enable();

// Initialize rage click detection
const rageClickDetector = new RageClickDetector({
  onRageClick: (event) => {
    console.log('[Frustration] Rage click detected:', event);
    const tracer = getTracer();
    const span = tracer.startSpan('frustration.rage_click');
    span.setAttribute('frustration.type', 'rage_click');
    span.setAttribute('frustration.click_count', event.clickCount);
    span.setAttribute('frustration.duration_ms', event.durationMs);
    span.setAttribute('frustration.score', event.score);
    span.setAttribute('target.id', event.elementId);
    span.end();
  },
});

// Initialize dead click detection
const deadClickDetector = new DeadClickDetector({
  onDeadClick: (event) => {
    console.log('[Frustration] Dead click detected:', event);
    const tracer = getTracer();
    const span = tracer.startSpan('frustration.dead_click');
    span.setAttribute('frustration.type', 'dead_click');
    span.setAttribute('frustration.reason', event.reason);
    span.setAttribute('frustration.score', event.score);
    span.setAttribute('target.tag', event.elementTag);
    span.setAttribute('target.id', event.elementId || '');
    span.end();
  },
});

// Initialize form tracking
const formTracker = new FormTracker({
  onFormEvent: (event) => {
    console.log('[Form] Form event:', event);
    const tracer = getTracer();
    const span = tracer.startSpan(`form.${event.action}`);
    span.setAttribute('form.name', event.formName);
    span.setAttribute('form.action', event.action);
    if (event.success !== undefined) {
      span.setAttribute('form.success', event.success);
    }
    if (event.totalTimeMs) {
      span.setAttribute('form.total_time_ms', event.totalTimeMs);
    }
    span.end();
  },
  onFieldEvent: (event) => {
    console.log('[Form] Field event:', event);
    if (event.hesitation) {
      const tracer = getTracer();
      const span = tracer.startSpan('frustration.form_hesitation');
      span.setAttribute('frustration.type', 'form_hesitation');
      span.setAttribute('field.name', event.fieldName);
      span.setAttribute('field.time_spent_ms', event.timeSpentMs);
      span.setAttribute('frustration.score', event.frustrationScore);
      span.end();
    }
  },
});

// Hook up global click listener for frustration detection
document.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target) {
    rageClickDetector.recordClick(target);
    deadClickDetector.recordClick(target);
  }
}, { capture: true });

// Hook up form field listeners
document.addEventListener('focusin', (event) => {
  const target = event.target as Element;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    formTracker.recordFieldFocus(target);
  }
}, { capture: true });

document.addEventListener('focusout', (event) => {
  const target = event.target as Element;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    formTracker.recordFieldBlur(target);
  }
}, { capture: true });

// Initialize navigation tracking
const navigationTracker = new NavigationTracker({
  onNavigation: (event) => {
    console.log('[Navigation]', event.type, event);
    const tracer = getTracer();
    const span = tracer.startSpan(`navigation.${event.type}`);
    span.setAttribute('navigation.type', event.type);
    span.setAttribute('navigation.to_url', event.toUrl);
    span.setAttribute('page.title', event.pageTitle);
    if (event.fromUrl) {
      span.setAttribute('navigation.from_url', event.fromUrl);
    }
    if (event.referrer) {
      span.setAttribute('page.referrer', event.referrer);
    }
    if (event.durationMs !== undefined) {
      span.setAttribute('navigation.duration_ms', event.durationMs);
    }
    span.end();
  },
});
navigationTracker.enable();

// Initialize error tracking
const errorTracker = new ErrorTracker({
  onError: (event) => {
    console.log('[Error]', event.type, event);
    const tracer = getTracer();
    const span = tracer.startSpan(`error.${event.type}`);
    span.setAttribute('error.type', event.type);
    span.setAttribute('error.message', event.message);
    if (event.stack) {
      span.setAttribute('error.stack', event.stack);
    }
    if (event.filename) {
      span.setAttribute('error.filename', event.filename);
    }
    if (event.lineno) {
      span.setAttribute('error.lineno', event.lineno);
    }
    if (event.colno) {
      span.setAttribute('error.colno', event.colno);
    }
    span.setAttribute('error.context.page_url', event.context.pageUrl);
    span.setAttribute('error.context.page_title', event.context.pageTitle);
    if (event.context.lastClick) {
      span.setAttribute('error.context.last_click', event.context.lastClick);
    }
    span.setAttribute('error.context.time_on_page_ms', event.context.timeOnPageMs);
    span.end();
  },
});
errorTracker.enable();

// Initialize thrashing detection
const thrashingDetector = new ThrashingDetector({
  onThrashing: (event) => {
    console.log('[Frustration] Thrashing detected:', event);
    const tracer = getTracer();
    const span = tracer.startSpan('frustration.thrashing');
    span.setAttribute('frustration.type', 'thrashing');
    span.setAttribute('frustration.score', event.score);
    span.setAttribute('frustration.direction_changes', event.directionChanges);
    span.setAttribute('frustration.duration_ms', event.durationMs);
    span.setAttribute('frustration.scroll_distance', event.scrollDistance);
    span.setAttribute('page.scroll_depth_percent', event.scrollDepthPercent);
    span.setAttribute('page.url', event.pageUrl);
    span.end();
  },
});
thrashingDetector.enable();

// Track last click for error context
document.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target) {
    const name = getSemanticName(target);
    errorTracker.recordLastClick(name);
  }
}, { capture: true });

// Export for use in components
export {
  provider,
  formTracker,
  rageClickDetector,
  deadClickDetector,
  navigationTracker,
  errorTracker,
  thrashingDetector,
};
