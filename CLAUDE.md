# AI-Native Session Understanding

This document serves as the design spec and context for Claude (or any AI assistant) working on this project.

## Project Vision

Replace traditional session replay (DOM recording + video playback) with an AI-native approach: capture semantically rich events and let AI synthesize understanding through natural language queries.

**Instead of:** "Watch this 45-minute recording to find the bug"

**You get:** "What happened to user David Hope on checkout?" → AI narrates the story with linked traces

## The Problem We're Solving

Session replay exists because of a fundamental gap: when users report issues, we lack context about what happened from their perspective.

Traditional session replay (FullStory, LogRocket, Hotjar) solves this by recording DOM mutations and replaying as video. This approach has fundamental limitations:

| Problem | Impact |
|---------|--------|
| **Privacy nightmare** | Recording everything means PII exposure risk; masking is fragile |
| **Storage bloat** | TB of DOM diffs for "just in case" scenarios |
| **Needle in haystack** | Hours of recordings; finding the 10 relevant seconds is painful |
| **Can't query** | Passive consumption; no "show me rage clicks on submit button" |
| **No semantic understanding** | Records pixels, not meaning |
| **Siloed from APM** | No correlation to backend traces |

## Architecture

### Signal Strategy: Logs + Traces

We use **two complementary OTLP signals**:

| Signal | Use Case | Elastic Destination |
|--------|----------|---------------------|
| **Logs** | Discrete events (clicks, frustration, navigation) | `logs-generic.otel-default` |
| **Traces** | Business operations with duration (checkout flow, API calls) | `traces-generic.otel-default` |

**Why not just Traces?**

Long-lived spans are a known unsolved problem in OpenTelemetry:
- Spans remain in memory until `end()` is called
- If browser closes before span ends → data lost
- `beforeunload` is unreliable (Chrome deprecated `unload`)

Logs solve this: events send immediately, no lifecycle management needed.

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser JS Agent                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Log Provider│  │Trace Provider│  │  Instrumentations   │  │
│  │(user events)│  │(business ops)│  │(clicks, frustration)│  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          │ OTLP/HTTP      │ OTLP/HTTP
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Elastic Cloud                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │logs-generic.otel-   │  │traces-generic.otel-default  │   │
│  │default              │  │                             │   │
│  │                     │  │ Transactions = root spans   │   │
│  │ user.click          │  │ Spans = child spans         │   │
│  │ user.frustration.*  │  │                             │   │
│  │ user.navigation     │  │ checkout.submit             │   │
│  │ form.*              │  │ └─ api.call                 │   │
│  └─────────────────────┘  │    └─ db.query              │   │
│                           └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Elastic APM Terminology

In Elastic APM:
- **Transaction** = root span (no parent) - the entry point
- **Span** = child span (has a parent) - operations within a transaction

To see parent-child relationships, create spans within a transaction context:

```javascript
const tracer = getTracer();

// Transaction (root span)
const checkoutTx = tracer.startSpan('checkout.submit');

// Child spans within the transaction
const apiSpan = tracer.startSpan('api.call', { parent: checkoutTx });
// ... do API call
apiSpan.end();

checkoutTx.end();
```

## Event Schema

### Log Events (OTLP Logs)

All events include session and user context:

```json
{
  "timestamp": "2025-12-30T15:30:00Z",
  "severityNumber": 9,
  "body": "user.click",
  "attributes": {
    "session.id": "sess_abc123",
    "session.sequence": 42,
    "session.duration_ms": 15000,
    "user.id": "david",
    "user.email": "david@example.com",
    "user.name": "David Hope",
    "event.category": "user.interaction",
    "event.action": "click",
    "target.semantic_name": "Submit Order",
    "target.element": "button",
    "target.id": "btn-submit",
    "page.url": "https://example.com/checkout",
    "page.title": "Checkout"
  },
  "resource": {
    "service.name": "session-replay-demo"
  }
}
```

### Frustration Events

```json
{
  "body": "user.frustration.rage_click",
  "attributes": {
    "session.id": "sess_abc123",
    "user.id": "david",
    "event.category": "user.frustration",
    "frustration.type": "rage_click",
    "frustration.score": 0.8,
    "frustration.click_count": 6,
    "frustration.duration_ms": 850,
    "target.semantic_name": "Submit Order"
  }
}
```

### Event Categories

| Category | Events | Description |
|----------|--------|-------------|
| `user.interaction` | `click` | User clicks on elements |
| `user.frustration` | `rage_click`, `dead_click`, `thrashing` | Frustration signals |
| `user.navigation` | `pageview`, `hashchange` | Page navigation |
| `user.error` | errors | JavaScript errors |
| `form.interaction` | `focus`, `blur`, `submit` | Form behavior |

## Frustration Detection

### Rage Clicks
Multiple rapid clicks on same element indicating frustration.

**Config:**
- `clickThreshold`: Min clicks to trigger (default: 3)
- `timeWindowMs`: Time window in ms (default: 1000)

**Score:** 0-1 based on click count and velocity

### Dead Clicks
Clicks on non-interactive elements (user expected action).

**Detection:**
- Element is not `<a>`, `<button>`, `<input>`, etc.
- No click handler attached
- Not inside interactive parent

### Thrashing
Rapid scroll direction changes indicating user is lost.

**Config:**
- `minDirectionChanges`: Min changes to trigger (default: 3)
- `timeWindowMs`: Time window in ms (default: 2000)

## Project Structure

```
sessionreplay/
├── packages/
│   └── browser-agent/           # Browser instrumentation
│       ├── src/
│       │   ├── provider.ts      # Trace provider (business spans)
│       │   ├── log-provider.ts  # Log provider (user events)
│       │   ├── session.ts       # Session ID + user management
│       │   ├── events.ts        # Event emitter helpers
│       │   ├── semantic/        # Semantic instrumentation
│       │   │   ├── clicks.ts    # Click tracking
│       │   │   ├── forms.ts     # Form tracking
│       │   │   ├── navigation.ts
│       │   │   └── errors.ts
│       │   └── frustration/     # Frustration detection
│       │       ├── rage-click.ts
│       │       ├── dead-click.ts
│       │       └── thrashing.ts
│       └── dist/
│           └── browser.js       # Browser bundle (all deps included)
├── examples/
│   └── demo-app/                # Demo application
│       ├── index.html           # Demo UI
│       ├── demo.js              # Instrumentation setup
│       ├── server.js            # Dev server
│       ├── load-test.js         # Playwright automation
│       └── start.js             # Launcher script
├── scripts/
│   └── kibana/                  # Dashboard definitions
│       ├── visualizations.ts
│       └── dashboards.ts
├── start.sh                     # Quick start script
├── CLAUDE.md                    # This file
└── README.md                    # User-facing docs
```

## Quick Start

```bash
# 1. Configure OTLP credentials
cp examples/demo-app/.env.example examples/demo-app/.env
# Edit .env with your Elastic Cloud credentials

# 2. Start demo with load testing
./start.sh

# Or manually:
node examples/demo-app/start.js --load
```

## API Reference

### Session Management

```typescript
import {
  getSessionId,      // Get current session ID
  setUser,           // Set user identity
  clearUser,         // Clear user (logout)
  getUser,           // Get current user
  resetSession,      // Force new session
} from '@session-replay/browser-agent';

// Set user after login
setUser({
  id: 'david',
  email: 'david@example.com',
  name: 'David Hope'
});
```

### Log Provider

```typescript
import {
  createSessionLogProvider,
  emitSessionEvent,
  emitClickEvent,
  emitFrustrationEvent,
} from '@session-replay/browser-agent';

// Initialize
const logProvider = createSessionLogProvider({
  serviceName: 'my-app',
  endpoint: 'https://your-elastic.cloud:443/v1/logs',
  apiKey: 'your-api-key',
});

// Emit custom events
emitSessionEvent({
  name: 'custom.event',
  attributes: {
    'event.category': 'user.interaction',
    'custom.field': 'value',
  },
});
```

### Trace Provider (Business Operations)

```typescript
import {
  createSessionReplayProvider,
  getTracer,
  trace,
  context,
} from '@session-replay/browser-agent';

// Initialize
const traceProvider = createSessionReplayProvider({
  serviceName: 'my-app',
  endpoint: 'https://your-elastic.cloud:443/v1/traces',
  apiKey: 'your-api-key',
});

// Create business operation spans
const tracer = getTracer();
const span = tracer.startSpan('checkout.submit');
span.setAttribute('cart.total', 149.99);
// ... do checkout
span.end();
```

### Parent-Child Span Hierarchy

To create child spans under a parent (visible as Transaction → Spans in Elastic APM):

```typescript
import { trace, context, getTracer, emitSessionEvent } from '@session-replay/browser-agent';

const tracer = getTracer();

// Parent span (becomes Transaction in Elastic)
const parentSpan = tracer.startSpan('checkout.buy_now');

// Execute child operations within parent context
context.with(trace.setSpan(context.active(), parentSpan), () => {
  // Child span 1
  const validateSpan = tracer.startSpan('checkout.validate_cart');
  validateSpan.setAttribute('cart.items', 3);
  validateSpan.end();

  // Child span 2
  const paymentSpan = tracer.startSpan('checkout.process_payment');
  paymentSpan.setAttribute('payment.method', 'credit_card');

  // Logs emitted within trace context are auto-correlated
  emitSessionEvent({
    name: 'payment.started',
    attributes: { 'event.category': 'user.interaction' },
  });
  // This log will have trace.id and span.id attributes!

  paymentSpan.end();
});

parentSpan.end();
```

### Trace-Log Correlation

Logs emitted within an active trace context automatically include `trace.id` and `span.id`:

```json
{
  "body": "payment.started",
  "attributes": {
    "session.id": "sess_abc123",
    "trace.id": "32f9e17f...",
    "span.id": "9ac7c0be...",
    "event.category": "user.interaction"
  }
}
```

Query correlated logs in Elastic:
```sql
FROM logs-generic.otel-default
| WHERE attributes.trace.id == "32f9e17f..."
```

### Frustration Detectors

```typescript
import {
  RageClickDetector,
  DeadClickDetector,
  ThrashingDetector,
} from '@session-replay/browser-agent';

// All detectors auto-emit logs when enabled
const rageDetector = new RageClickDetector({
  clickThreshold: 3,
  timeWindowMs: 1000,
  emitLogs: true,  // default
  onRageClick: (event) => console.log('Rage!', event),
});
rageDetector.enable();
```

## Elastic Queries

### ES|QL Examples

```sql
-- All events for a user
FROM logs-generic.otel-default
| WHERE attributes.user.id == "david"
| SORT @timestamp ASC

-- Frustrated users today
FROM logs-generic.otel-default
| WHERE attributes.frustration.type IS NOT NULL
| STATS count = COUNT() BY attributes.user.id
| SORT count DESC

-- Rage clicks by page
FROM logs-generic.otel-default
| WHERE attributes.frustration.type == "rage_click"
| STATS count = COUNT() BY attributes.page.url
| SORT count DESC

-- Session timeline
FROM logs-generic.otel-default
| WHERE attributes.session.id == "sess_abc123"
| SORT attributes.session.sequence ASC
```

### KQL Examples (Discover)

```
# All frustration events
attributes.frustration.type: *

# Specific user's session
attributes.user.id: "david" AND attributes.session.id: "sess_abc123"

# High frustration score
attributes.frustration.score >= 0.7
```

## Development

### Building

```bash
cd packages/browser-agent
pnpm install
pnpm build
```

### Testing

```bash
# Unit tests
pnpm test

# Load testing with Playwright
SESSIONS=10 node examples/demo-app/start.js --load

# Interactive (non-headless)
HEADLESS=false node examples/demo-app/start.js --load
```

### Load Test Flow

The load test (`examples/demo-app/load-test.js`) simulates realistic user sessions with the following flow:

1. **Session Initialization**
   - Sets a random user from test pool (Alice, Bob, Carol, David)
   - User has id, email, and name attributes

2. **Navigation Events**
   - Page view to home page (hash: `#home`)
   - Navigation events emitted with `user.navigation` category

3. **Interaction Events**
   - Click on "Dashboard" link → `user.click` event
   - Click on "Products" link → `user.click` event
   - Click on "Checkout" link → `user.click` event

4. **Rage Click Detection**
   - 5 rapid clicks on the submit button (within 1 second)
   - Triggers `user.frustration.rage_click` event
   - Score: 0.6-1.0 depending on velocity

5. **Dead Click Detection**
   - Click on non-interactive element (`#dead-click-area`)
   - Triggers `user.frustration.dead_click` event
   - Score: 0.3 (non-interactive element)

6. **Thrashing Detection**
   - 5 rapid scroll direction changes
   - May trigger `user.frustration.thrashing` event

7. **Form Submission & Checkout Flow**
   - Click submit button → triggers checkout trace
   - Creates parent-child span hierarchy:
     ```
     checkout.submit (Transaction)
     └── checkout.validate_cart (Span)
     └── checkout.process_payment (Span)
     ```
   - `checkout.started` and `checkout.completed` log events

### Test Users

| User ID | Name | Email |
|---------|------|-------|
| alice | Alice Johnson | alice@example.com |
| bob | Bob Smith | bob@example.com |
| carol | Carol Williams | carol@example.com |
| david | David Brown | david@example.com |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSIONS` | Number of simulated user sessions | 3 |
| `HEADLESS` | Run browser in headless mode | true |
| `PORT` | Demo server port | 3000 |

### Kibana Dashboard

The dashboard is deployed to: `https://[KIBANA_URL]/app/dashboards#/view/session-replay-dashboard`

**Visualizations:**
- **Total Sessions**: Unique count of session IDs
- **Frustrated Sessions**: Sessions with frustration events
- **Active Sessions Over Time**: Area chart of sessions by timestamp
- **Events by Category**: Stacked area of event categories
- **Frustration Over Time**: Line chart of frustration events
- **Frustration by Type**: Donut chart (rage_click, dead_click, thrashing)
- **Rage Click Hotspots**: Bar chart of elements receiving rage clicks
- **Page Flow**: Horizontal bar of page URLs by session count
- **Top Frustrated Users**: Users with most frustration events
- **Top Frustration Pages**: Pages with most frustration events
- **Session Explorer**: Data table for drilling into sessions
- **Errors by Page**: Bar chart of errors by page URL

### Dashboard Deployment

```bash
# Export dashboard to NDJSON
cd scripts
pnpm exec tsx -e "
import { getSessionReplayDashboard } from './kibana/dashboards.ts';
console.log(JSON.stringify(getSessionReplayDashboard()));
" > /tmp/dashboard.ndjson

# Import to Kibana (with overwrite)
curl -X POST "$KIBANA_URL/api/saved_objects/_import?overwrite=true" \
  -H "Authorization: ApiKey $ES_API_KEY" \
  -H "kbn-xsrf: true" \
  --form file=@/tmp/dashboard.ndjson
```

## Key Design Principles

1. **Logs for events, Traces for operations**: User interactions are discrete events (logs), business flows have duration (traces)
2. **Semantic over syntactic**: Capture meaning ("Submit Order" button), not pixels
3. **Privacy by design**: Structured events only, no DOM recording
4. **Immediate delivery**: Logs send instantly, no data loss on tab close
5. **Correlation-first**: session.id links events, trace_id links to backend
6. **AI-native**: Structured for LLM consumption and natural language queries

## For Claude

When working on this project:

- Events go to logs (`logs-generic.otel-default`), business operations go to traces
- User identity via `setUser()` - automatically included in all events
- Frustration detectors auto-emit logs when `emitLogs: true` (default)
- In Elastic: Transaction = root span, Span = child span
- Keep the browser bundle lightweight
- All instrumentation should be opt-in and non-intrusive

## Session Replay Use Cases

### 1. Funnel Drop-off Analysis
**Question**: "Where are users dropping off and why?"

| Funnel Stage | Drop-off Signal | Root Cause Pattern |
|--------------|-----------------|-------------------|
| Products → Cart | No `add-to-cart` click | Pricing confusion, no CTA visibility |
| Cart → Checkout | Cart abandonment | Shipping cost surprise, login wall |
| Checkout → Payment | Form abandonment | Confusing fields, validation errors |
| Payment → Confirmation | Rage click on submit | Button disabled, slow API, payment error |

### 2. Rage Click Investigation
**Question**: "Why are users clicking repeatedly on this button?"

**Root Causes**:
- Button disabled during API call (no loading indicator)
- JavaScript error preventing handler
- Network timeout (correlate with trace data)
- Double-click protection blocking legitimate clicks

### 3. Dead Click Confusion
**Question**: "Why do users click on things that don't work?"

**Root Causes**:
- Styled div looks like a button
- Link missing href attribute
- Disabled state not visually obvious
- Image that looks like a CTA

### 4. Error → Abandonment Correlation
**Question**: "Are JavaScript errors causing users to leave?"

**Pattern**: User hits error → no more events → session ended

### 5. Thrashing / Lost Users
**Question**: "Why are users scrolling frantically?"

**Root Causes**:
- Content not where expected
- Search results irrelevant
- Navigation unclear
- Missing "back to top" on long pages

### 6. Form Abandonment Analysis
**Question**: "Which field makes users give up?"

**Pattern**: Users bail after a specific field → investigate that field's UX

### 7. Slow UI Response Detection
**Question**: "Is our UI too slow?"

**Correlation**: `trace.id` links click to backend call duration

### 8. Success vs Failure Path Comparison
**Question**: "What do converting users do differently?"

**Approach**: Compare event patterns between successful and failed sessions

## Root Cause Analysis Workflow

### Step 1: Identify the Problem (Dashboard)
- Funnel shows drop-off at a specific stage
- "Frustrated Sessions" metric is high

### Step 2: Segment the Drop-offs (ES|QL)
```sql
-- What frustration types are occurring at cart?
FROM logs-generic.otel-default
| WHERE attributes.page.url LIKE "*cart*"
| WHERE attributes.frustration.type IS NOT NULL
| STATS
    rage_clicks = COUNT_IF(attributes.frustration.type == "rage_click"),
    dead_clicks = COUNT_IF(attributes.frustration.type == "dead_click"),
    errors = COUNT_IF(attributes.event.category == "user.error")
```

### Step 3: Find the Pattern (Correlation)
```sql
-- What element are they rage-clicking?
FROM logs-generic.otel-default
| WHERE attributes.frustration.type == "rage_click"
| WHERE attributes.page.url LIKE "*cart*"
| STATS count = COUNT() BY attributes.target.semantic_name
| SORT count DESC
```

### Step 4: Drill into a Session (Timeline)
```sql
-- See exact event sequence for a frustrated user
FROM logs-generic.otel-default
| WHERE attributes.session.id == "sess_abc123"
| SORT attributes.session.sequence ASC
```

### Step 5: Correlate with Backend (Traces)
```sql
-- Find slow API calls from the session
FROM traces-generic.otel-default
| WHERE trace.id == "trace_from_session"
| SORT @timestamp ASC
```

### Step 6: Fix & Verify
- Implement fix (loading spinner, error handling, etc.)
- Re-run load tests
- Watch frustration rate drop in dashboard

## Load Test Behavior Cohorts

The load test simulates realistic funnel drop-offs with these user behavior patterns:

| Cohort | Weight | Journey | Frustration Signal |
|--------|--------|---------|-------------------|
| `happy_path` | 25% | home → products → cart → checkout → **purchase** | None |
| `rage_click_cart` | 20% | home → products → cart → **DROP** | Rage click on Add to Cart |
| `dead_click_confused` | 15% | home → products → **DROP** | Dead click on price area |
| `error_victim` | 20% | home → products → cart → checkout → **DROP** | JS error on checkout |
| `thrasher` | 10% | home → products → cart → checkout → **DROP** | Thrashing (scroll changes) |
| `silent_abandon` | 10% | home → products → cart → **DROP** | None (sticker shock) |

### Expected Funnel Distribution

For 50 sessions:
```
Home:     50 sessions (100%)
Products: ~45 sessions (90%)
Cart:     ~32 sessions (65%)
Checkout: ~22 sessions (45%)
Purchase: ~12 sessions (25%)
```

### Running the Load Test

```bash
# Generate funnel data
cd /path/to/sessionreplay/examples/demo-app
SESSIONS=50 HEADLESS=true node load-test.js

# Or via start script
SESSIONS=50 node start.js --load
```
