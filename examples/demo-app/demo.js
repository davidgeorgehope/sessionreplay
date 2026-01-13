/**
 * Demo app initialization script
 * Initializes the session replay agent with OTLP logs
 */

import {
  // OpenTelemetry API (re-exported from bundle)
  trace,
  context,
  // Trace provider (for custom business spans)
  createSessionReplayProvider,
  getTracer,
  // Log provider (for session events)
  createSessionLogProvider,
  // Session management
  getSessionId,
  setUser,
  // Instrumentation
  ClickInstrumentation,
  RageClickDetector,
  DeadClickDetector,
  ThrashingDetector,
  ErrorTracker,
  // Event helpers (for custom events)
  emitSessionEvent,
  emitErrorEvent,
  // Funnel tracking (Meta Pixel + GA4 compatible)
  trackViewContent,
  trackAddToCart,
  trackViewCart,
  trackInitiateCheckout,
  trackAddPaymentInfo,
  trackPurchase,
} from '../../packages/browser-agent/dist/browser.js';

// Get config from window (set by server or defaults)
const config = window.__SESSION_REPLAY_CONFIG__ || {
  endpoint: 'http://localhost:4318/v1/traces',
  serviceName: 'demo-app',
  debug: true,
};

// Event log helper for UI
const eventLog = document.getElementById('event-log');
function logEvent(type, details) {
  const li = document.createElement('li');
  li.textContent = `${type}: ${JSON.stringify(details).slice(0, 50)}...`;
  eventLog.insertBefore(li, eventLog.firstChild);

  while (eventLog.children.length > 20) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

// Initialize the trace provider (for custom business spans)
console.log('[Demo] Initializing Session Replay with config:', config);
const traceProvider = createSessionReplayProvider({
  serviceName: config.serviceName,
  endpoint: config.endpoint,
  apiKey: config.apiKey,
  debug: config.debug,
});

// Initialize the log provider (for session events)
const logProvider = createSessionLogProvider({
  serviceName: config.serviceName,
  endpoint: config.endpoint, // Will auto-convert /v1/traces to /v1/logs
  apiKey: config.apiKey,
  debug: config.debug,
});

const tracer = getTracer();
const sessionId = getSessionId();

// Set user identity (from config or default)
const user = window.__SESSION_REPLAY_USER__ || {
  id: 'demo-user',
  email: 'demo@example.com',
  name: 'Demo User',
};
setUser(user);

console.log('[Demo] Session ID:', sessionId);
console.log('[Demo] User:', user.id);
logEvent('init', { sessionId: sessionId.slice(0, 8) + '...', userId: user.id });

// Initialize click instrumentation (auto-emits logs)
const clickInstrumentation = new ClickInstrumentation({
  document: document,
  captureCoordinates: false,
});
clickInstrumentation.enable();
console.log('[Demo] Click instrumentation enabled');

// Initialize rage click detector (auto-emits logs)
const rageClickDetector = new RageClickDetector({
  clickThreshold: 3,
  timeWindowMs: 1000,
  onRageClick: (event) => {
    logEvent('RAGE', { clicks: event.clickCount, target: event.target?.semanticName });
    console.warn('[Demo] RAGE CLICK DETECTED:', event);
  },
});
rageClickDetector.enable();
console.log('[Demo] Rage click detector enabled');

// Initialize dead click detector (auto-emits logs)
const deadClickDetector = new DeadClickDetector({
  checkParents: true,
  onDeadClick: (event) => {
    logEvent('DEAD', { target: event.elementTag });
    console.warn('[Demo] DEAD CLICK DETECTED:', event);
  },
});
deadClickDetector.enable();
console.log('[Demo] Dead click detector enabled');

// Initialize thrashing detector (auto-emits logs)
const scrollArea = document.getElementById('scroll-area');
if (scrollArea) {
  const thrashingDetector = new ThrashingDetector({
    window: window,
    minDirectionChanges: 4,
    timeWindowMs: 2000,
    onThrashing: (event) => {
      logEvent('THRASH', { changes: event.directionChanges });
      console.warn('[Demo] THRASHING DETECTED:', event);
    },
  });
  thrashingDetector.enable();
  console.log('[Demo] Thrashing detector enabled');
}

// Initialize error tracker (emits logs for JS errors)
const errorTracker = new ErrorTracker({
  window: window,
  onError: (event) => {
    logEvent('ERROR', { type: event.type, message: event.message.slice(0, 50) });
    console.error('[Demo] ERROR TRACKED:', event);

    // Emit as session log event
    emitErrorEvent(event.message, {
      'error.type': event.type,
      'error.filename': event.filename,
      'error.lineno': event.lineno,
      'error.colno': event.colno,
      'error.stack': event.stack?.slice(0, 500),
    });
  },
});
errorTracker.enable();
console.log('[Demo] Error tracker enabled');

// Wire up demo buttons

// Slow action button (for rage click testing)
document.getElementById('btn-slow-action').addEventListener('click', () => {
  setTimeout(() => {
    console.log('[Demo] Slow action completed');
  }, 2000);
});

// Error simulation buttons
document.getElementById('btn-js-error').addEventListener('click', () => {
  throw new Error('Simulated JavaScript error from demo');
});

document.getElementById('btn-promise-error').addEventListener('click', () => {
  Promise.reject(new Error('Simulated unhandled promise rejection'));
});

document.getElementById('btn-network-error').addEventListener('click', async () => {
  try {
    await fetch('/api/nonexistent-endpoint');
  } catch (e) {
    console.error('Network error:', e);
  }
});

// Form submission - use trace for business operation with correlated logs + funnel tracking
document.getElementById('checkout-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const span = tracer.startSpan('checkout.submit');
  const orderId = 'ORD-' + Date.now();

  // Track funnel: add payment info (Meta: AddPaymentInfo, GA4: add_payment_info)
  trackAddPaymentInfo({
    value: 99.99,
    currency: 'USD',
    paymentType: 'credit_card',
  });

  // Use context.with() to emit logs within the trace context
  // This links the log event to the trace via trace.id and span.id
  context.with(trace.setSpan(context.active(), span), () => {
    // Log event is now correlated with the checkout span
    emitSessionEvent({
      name: 'checkout.started',
      attributes: {
        'event.category': 'form.interaction',
        'event.action': 'submit_start',
        'form.name': 'checkout-form',
      },
    });
  });

  setTimeout(() => {
    context.with(trace.setSpan(context.active(), span), () => {
      span.setAttribute('checkout.success', true);
      span.setAttribute('order.id', orderId);

      // Track funnel: purchase completed (Meta: Purchase, GA4: purchase)
      trackPurchase({
        transactionId: orderId,
        value: 99.99,
        currency: 'USD',
        contentIds: ['PROD-123'],
        numItems: 1,
      });

      // Emit completion log within trace context
      emitSessionEvent({
        name: 'checkout.completed',
        attributes: {
          'event.category': 'form.interaction',
          'event.action': 'submit_complete',
          'form.name': 'checkout-form',
          'form.success': true,
        },
      });

      span.end();
    });

    alert('Order submitted successfully!');
    logEvent('submit', { success: true });
  }, 500);
});

// Add cart button - use trace for business operation + funnel tracking
document.getElementById('btn-add-cart').addEventListener('click', () => {
  const span = tracer.startSpan('cart.add_item');
  span.setAttribute('product.id', '123');
  span.setAttribute('product.category', 'electronics');
  span.end();

  // Track funnel event (Meta: AddToCart, GA4: add_to_cart)
  trackAddToCart({
    contentId: 'PROD-123',
    contentName: 'Demo Product',
    contentCategory: 'Electronics',
    value: 49.99,
    currency: 'USD',
    quantity: 1,
  });

  logEvent('action', { action: 'add_to_cart' });
});

// Buy now button - demonstrates parent-child span hierarchy + funnel tracking
document.getElementById('btn-buy-now').addEventListener('click', () => {
  // Track funnel: initiate checkout (Meta: InitiateCheckout, GA4: begin_checkout)
  trackInitiateCheckout({
    value: 149.99,
    currency: 'USD',
    numItems: 3,
    contentIds: ['PROD-123', 'PROD-456', 'PROD-789'],
  });

  // Parent span (Transaction in Elastic APM)
  const parentSpan = tracer.startSpan('checkout.buy_now');

  // Execute child operations within parent context
  context.with(trace.setSpan(context.active(), parentSpan), () => {
    // Child span 1: Validate cart
    const validateSpan = tracer.startSpan('checkout.validate_cart');
    validateSpan.setAttribute('cart.items', 3);
    validateSpan.setAttribute('cart.total', 149.99);

    // Simulate validation work
    setTimeout(() => {
      validateSpan.end();

      // Child span 2: Process payment (nested within parent)
      context.with(trace.setSpan(context.active(), parentSpan), () => {
        const paymentSpan = tracer.startSpan('checkout.process_payment');
        paymentSpan.setAttribute('payment.method', 'credit_card');
        paymentSpan.setAttribute('payment.amount', 149.99);

        // Track funnel: add payment info (Meta: AddPaymentInfo, GA4: add_payment_info)
        trackAddPaymentInfo({
          value: 149.99,
          currency: 'USD',
          paymentType: 'credit_card',
        });

        // Emit correlated log event
        emitSessionEvent({
          name: 'payment.started',
          attributes: {
            'event.category': 'user.interaction',
            'event.action': 'payment_start',
            'payment.method': 'credit_card',
          },
        });

        setTimeout(() => {
          paymentSpan.setAttribute('payment.status', 'success');
          paymentSpan.end();

          // Child span 3: Confirm order
          context.with(trace.setSpan(context.active(), parentSpan), () => {
            const confirmSpan = tracer.startSpan('checkout.confirm_order');
            const orderId = 'ORD-' + Date.now();
            confirmSpan.setAttribute('order.id', orderId);
            confirmSpan.end();

            // Track funnel: purchase completed (Meta: Purchase, GA4: purchase)
            trackPurchase({
              transactionId: orderId,
              value: 149.99,
              currency: 'USD',
              contentIds: ['PROD-123', 'PROD-456', 'PROD-789'],
              numItems: 3,
            });

            // End parent span after all children complete
            parentSpan.setAttribute('checkout.success', true);
            parentSpan.end();

            logEvent('action', { action: 'buy_now', success: true });
          });
        }, 100);
      });
    }, 50);
  });
});

// Navigation tracking with funnel events
window.addEventListener('hashchange', () => {
  const hash = window.location.hash;

  emitSessionEvent({
    name: 'user.navigation',
    attributes: {
      'event.category': 'user.navigation',
      'event.action': 'hashchange',
      'navigation.hash': hash,
    },
  });

  // Track funnel events based on page
  if (hash === '#products') {
    // Track funnel: view content (Meta: ViewContent, GA4: view_item)
    trackViewContent({
      contentId: 'product-list',
      contentName: 'Product Catalog',
      contentType: 'product_list',
      contentCategory: 'Electronics',
    });
  } else if (hash === '#cart') {
    // Track funnel: view cart (GA4: view_cart)
    trackViewCart({
      value: 49.99,
      currency: 'USD',
      items: [{ id: 'PROD-123', name: 'Demo Product', price: 49.99, quantity: 1 }],
    });
  } else if (hash === '#checkout') {
    // Track funnel: initiate checkout (Meta: InitiateCheckout, GA4: begin_checkout)
    trackInitiateCheckout({
      value: 49.99,
      currency: 'USD',
      numItems: 1,
      contentIds: ['PROD-123'],
    });
  }

  logEvent('nav', { hash: hash });
});

console.log('[Demo] Session Replay demo initialized!');
logEvent('ready', { status: 'ok' });

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  clickInstrumentation.disable();
  rageClickDetector.disable();
  deadClickDetector.disable();
});
