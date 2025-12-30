# Session Replay Alternative: AI-Native Session Understanding

An open-source alternative to traditional session replay. Instead of recording DOM mutations and playing back video, we capture semantically rich events and use AI to synthesize understanding.

## The Problem

Session replay tools (FullStory, LogRocket, Hotjar) solve a real problem: understanding what users experience when something goes wrong. But they do it by recording everything—DOM mutations, mouse movements, page state—and replaying it as video.

This approach has issues:

- **Privacy risk**: Recording everything means PII exposure; masking is fragile
- **Storage cost**: Terabytes of data for "just in case"
- **Time cost**: Watch hours of video to find 10 seconds of relevance
- **No queryability**: Can't ask "show me users who rage-clicked"
- **No correlation**: Recordings don't link to backend APM traces

## Our Approach

Capture **meaning**, not pixels. Instead of DOM diffs, we collect semantic events:

```json
{
  "body": "user.click",
  "attributes": {
    "session.id": "sess_abc123",
    "user.id": "david",
    "target.semantic_name": "Submit Order",
    "event.category": "user.interaction",
    "frustration.type": "rage_click",
    "frustration.score": 0.8
  }
}
```

Then use AI to answer questions:

> "What happened to user David Hope on checkout?"

AI responds:
> David loaded checkout at 14:32. He clicked "Submit" 6 times (rage clicking). The Stripe API returned 402 but the frontend swallowed the error—user saw nothing. He abandoned after 2 refreshes. Trace: abc123.

## Quick Start

```bash
# Clone and install
git clone https://github.com/anthropics/sessionreplay.git
cd sessionreplay
pnpm install

# Configure credentials
cp examples/demo-app/.env.example examples/demo-app/.env
# Edit .env with your Elastic Cloud OTLP endpoint and API key

# Run demo with automated testing
./start.sh
```

## Architecture

We use **two OTLP signals**:

| Signal | Purpose | Elastic Index |
|--------|---------|---------------|
| **Logs** | Discrete events (clicks, frustration) | `logs-generic.otel-default` |
| **Traces** | Business operations (checkout flow) | `traces-generic.otel-default` |

```
Browser Agent                    Elastic Cloud
┌─────────────┐                 ┌─────────────────────────┐
│ Log Provider│──OTLP/HTTP───▶ │ logs-generic.otel-default│
│ (events)    │                 │ - user.click            │
└─────────────┘                 │ - user.frustration.*    │
┌─────────────┐                 ├─────────────────────────┤
│Trace Provider──OTLP/HTTP───▶ │ traces-generic.otel-    │
│ (operations)│                 │ default (APM)           │
└─────────────┘                 │ - checkout.submit       │
                                └─────────────────────────┘
```

**Why Logs for events?** Logs send immediately. Traces require span.end() which can be lost if the user closes the tab.

## Usage

### Basic Setup

```javascript
import {
  createSessionLogProvider,
  createSessionReplayProvider,
  setUser,
  ClickInstrumentation,
  RageClickDetector,
  DeadClickDetector,
  ThrashingDetector,
} from '@anthropic/session-replay-browser-agent';

// Initialize providers
createSessionLogProvider({
  serviceName: 'my-app',
  endpoint: 'https://your-elastic.cloud:443/v1/logs',
  apiKey: 'your-api-key',
});

createSessionReplayProvider({
  serviceName: 'my-app',
  endpoint: 'https://your-elastic.cloud:443/v1/traces',
  apiKey: 'your-api-key',
});

// Set user identity (included in all events)
setUser({
  id: 'user123',
  email: 'user@example.com',
  name: 'User Name'
});

// Enable auto-instrumentation
new ClickInstrumentation({ document }).enable();
new RageClickDetector({ clickThreshold: 3 }).enable();
new DeadClickDetector().enable();
new ThrashingDetector({ window }).enable();
```

### Custom Events

```javascript
import { emitSessionEvent, getTracer } from '@anthropic/session-replay-browser-agent';

// Emit a custom log event
emitSessionEvent({
  name: 'feature.used',
  attributes: {
    'event.category': 'user.interaction',
    'feature.name': 'dark-mode-toggle',
  },
});

// Create a business operation trace
const tracer = getTracer();
const span = tracer.startSpan('checkout.submit');
span.setAttribute('cart.total', 149.99);
// ... process checkout
span.end();
```

### Parent-Child Spans with Correlated Logs

```javascript
import { trace, context, getTracer, emitSessionEvent } from '@anthropic/session-replay-browser-agent';

const tracer = getTracer();

// Parent span (Transaction in Elastic APM)
const checkoutSpan = tracer.startSpan('checkout.buy_now');

// Child spans within parent context
context.with(trace.setSpan(context.active(), checkoutSpan), () => {
  const validateSpan = tracer.startSpan('checkout.validate_cart');
  validateSpan.end();

  const paymentSpan = tracer.startSpan('checkout.process_payment');

  // Logs emitted here automatically include trace.id and span.id!
  emitSessionEvent({
    name: 'payment.started',
    attributes: { 'payment.method': 'credit_card' },
  });

  paymentSpan.end();
});

checkoutSpan.end();
```

## Integrating in Your App

### React Example

```jsx
// src/instrumentation.js
import {
  createSessionLogProvider,
  createSessionReplayProvider,
  setUser,
  ClickInstrumentation,
  RageClickDetector,
  DeadClickDetector,
} from '@anthropic/session-replay-browser-agent';

export function initSessionReplay(config) {
  // Initialize providers
  createSessionLogProvider({
    serviceName: config.serviceName,
    endpoint: config.otlpEndpoint,
    apiKey: config.apiKey,
  });

  createSessionReplayProvider({
    serviceName: config.serviceName,
    endpoint: config.otlpEndpoint,
    apiKey: config.apiKey,
  });

  // Enable auto-instrumentation
  new ClickInstrumentation({ document }).enable();
  new RageClickDetector({ clickThreshold: 3 }).enable();
  new DeadClickDetector().enable();
}

export { setUser, emitSessionEvent, getTracer } from '@anthropic/session-replay-browser-agent';
```

```jsx
// src/App.jsx
import { useEffect } from 'react';
import { initSessionReplay, setUser } from './instrumentation';

function App() {
  useEffect(() => {
    // Initialize on app mount
    initSessionReplay({
      serviceName: 'my-react-app',
      otlpEndpoint: import.meta.env.VITE_OTLP_ENDPOINT,
      apiKey: import.meta.env.VITE_OTLP_API_KEY,
    });
  }, []);

  const handleLogin = (user) => {
    // Set user identity after authentication
    setUser({
      id: user.id,
      email: user.email,
      name: user.displayName,
    });
  };

  return <YourApp onLogin={handleLogin} />;
}
```

### Vanilla JavaScript Example

```html
<!-- Include the browser bundle -->
<script type="module">
  import {
    createSessionLogProvider,
    createSessionReplayProvider,
    setUser,
    ClickInstrumentation,
    RageClickDetector,
    emitSessionEvent,
  } from 'https://unpkg.com/@anthropic/session-replay-browser-agent/dist/browser.js';

  // Initialize
  createSessionLogProvider({
    serviceName: 'my-website',
    endpoint: 'https://your-elastic.cloud:443/v1/logs',
    apiKey: 'your-api-key',
  });

  createSessionReplayProvider({
    serviceName: 'my-website',
    endpoint: 'https://your-elastic.cloud:443/v1/traces',
    apiKey: 'your-api-key',
  });

  // Enable instrumentation
  new ClickInstrumentation({ document }).enable();
  new RageClickDetector({ clickThreshold: 3 }).enable();

  // Set user when known
  document.addEventListener('userLoggedIn', (e) => {
    setUser({ id: e.detail.userId, email: e.detail.email });
  });

  // Track custom events
  document.getElementById('signup-btn').addEventListener('click', () => {
    emitSessionEvent({
      name: 'signup.clicked',
      attributes: { 'event.category': 'user.interaction' },
    });
  });
</script>
```

### Next.js Example

```jsx
// app/providers.jsx
'use client';
import { useEffect } from 'react';

export function SessionReplayProvider({ children }) {
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    import('@anthropic/session-replay-browser-agent').then(({
      createSessionLogProvider,
      createSessionReplayProvider,
      ClickInstrumentation,
      RageClickDetector,
    }) => {
      createSessionLogProvider({
        serviceName: 'my-nextjs-app',
        endpoint: process.env.NEXT_PUBLIC_OTLP_ENDPOINT,
        apiKey: process.env.NEXT_PUBLIC_OTLP_API_KEY,
      });

      createSessionReplayProvider({
        serviceName: 'my-nextjs-app',
        endpoint: process.env.NEXT_PUBLIC_OTLP_ENDPOINT,
        apiKey: process.env.NEXT_PUBLIC_OTLP_API_KEY,
      });

      new ClickInstrumentation({ document }).enable();
      new RageClickDetector({ clickThreshold: 3 }).enable();
    });
  }, []);

  return children;
}
```

## What Gets Captured

### Clicks
- Semantic name (button text, aria-label)
- React component name (auto-detected)
- Element details (tag, id, classes, data attributes)
- Page context (URL, title)

### Frustration Signals
| Signal | Detection | Score |
|--------|-----------|-------|
| **Rage clicks** | 3+ rapid clicks on same element | Based on velocity |
| **Dead clicks** | Clicks on non-interactive elements | Binary (0 or 1) |
| **Thrashing** | 4+ scroll direction changes in 2s | Based on frequency |

### User Context
All events automatically include:
- `session.id` - UUID for browser session
- `session.sequence` - Event order within session
- `user.id`, `user.email`, `user.name` - If set via `setUser()`

## Querying in Elastic

### ES|QL Examples

```sql
-- All events for a user
FROM logs-generic.otel-default
| WHERE attributes.user.id == "david"
| SORT @timestamp ASC

-- Find frustrated users
FROM logs-generic.otel-default
| WHERE attributes.frustration.type IS NOT NULL
| STATS count = COUNT() BY attributes.user.id
| SORT count DESC

-- Session timeline
FROM logs-generic.otel-default
| WHERE attributes.session.id == "sess_abc123"
| SORT attributes.session.sequence ASC
```

### KQL (Discover)

```
# All frustration events
attributes.frustration.type: *

# High frustration score
attributes.frustration.score >= 0.7

# Specific user
attributes.user.id: "david"
```

## Configuration

### Environment Variables

Create `examples/demo-app/.env`:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-id.ingest.us-east-1.aws.elastic.cloud:443
OTEL_EXPORTER_OTLP_HEADERS=Authorization=ApiKey YOUR_API_KEY
OTEL_RESOURCE_ATTRIBUTES=service.name=my-app
```

### Finding Your Elastic Endpoint

In Elastic Cloud: **Observability → Add data → OpenTelemetry**

## Project Structure

```
sessionreplay/
├── packages/
│   └── browser-agent/          # Core instrumentation library
│       ├── src/
│       │   ├── provider.ts     # Trace provider (APM transactions)
│       │   ├── log-provider.ts # Log provider (user events)
│       │   ├── session.ts      # Session ID + user management
│       │   ├── events.ts       # Event emitter helpers
│       │   ├── semantic/       # Auto-instrumentation
│       │   │   ├── clicks.ts
│       │   │   ├── forms.ts
│       │   │   ├── navigation.ts
│       │   │   └── errors.ts
│       │   └── frustration/    # Frustration detection
│       │       ├── rage-click.ts
│       │       ├── dead-click.ts
│       │       └── thrashing.ts
│       └── dist/
│           └── browser.js      # Browser bundle
├── examples/
│   └── demo-app/               # Demo application
│       ├── demo.js             # Instrumentation setup
│       ├── load-test.js        # Playwright automation
│       └── start.js            # Launcher
├── scripts/
│   └── kibana/                 # Dashboard definitions
├── start.sh                    # Quick start script
├── CLAUDE.md                   # Detailed architecture
└── README.md                   # This file
```

## Verification

After running the demo, verify data is flowing to Elastic:

```bash
# Run the verification script
node examples/demo-app/verify-elastic.js

# Or use the shell script
./scripts/verify-logs.sh
```

Expected output:
```
--- Recent Logs (last 5) ---
Total logs: 140
  2025-12-30T21:38:32.870Z | user.click | user=alice | Submit Order
  2025-12-30T21:38:31.204Z | user.frustration.dead_click | user=alice | ...

--- Event Type Breakdown ---
  user.click: 85
  user.frustration.rage_click: 12
  user.navigation: 25
  ...
```

## Development

```bash
# Install dependencies
pnpm install

# Build browser agent
cd packages/browser-agent && pnpm build

# Run tests
pnpm test

# Run demo with load testing
./start.sh

# Or with options
ITERATIONS=10 HEADLESS=false ./start.sh

# Verify data in Elastic
node examples/demo-app/verify-elastic.js
```

## Tech Stack

- **Browser instrumentation**: TypeScript, OpenTelemetry SDK
- **Transport**: OTLP (OpenTelemetry Protocol) - Logs + Traces
- **Backend**: Elastic Cloud (managed OTLP endpoint)
- **AI layer**: Elastic AI Assistant / custom LLM integration

## License

MIT

## Author

David Hope ([@davidgeorgehope](https://github.com/davidgeorgehope))
