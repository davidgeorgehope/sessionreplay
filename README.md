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
  "event": "user.interaction",
  "action": "click",
  "target": {
    "semantic_name": "Submit Order",
    "component": "CheckoutForm"
  },
  "frustration_signals": {
    "rapid_clicks": 6
  },
  "trace_id": "abc123"
}
```

Then use AI to answer questions:

> "What happened to user David Hope on checkout?"

AI responds:
> David loaded checkout at 14:32. He clicked "Submit" 6 times (rage clicking). The Stripe API returned 402 but the frontend swallowed the error—user saw nothing. He abandoned after 2 refreshes. Trace: abc123.

## Key Features

- **Semantic event capture**: Track what users do, not what pixels change
- **Frustration detection**: Rage clicks, dead clicks, form hesitation, scroll thrashing
- **OTLP native**: Standard OpenTelemetry protocol; works with Elastic Cloud
- **APM correlation**: Every frontend event links to backend traces
- **AI query interface**: Natural language questions about sessions (via Elastic AI Assistant)
- **Privacy-first**: Structured events, not raw DOM recording

## Quick Start

### 1. Install

```bash
npm install @anthropic/session-replay-browser-agent
```

### 2. Configure for Elastic Cloud

```typescript
import {
  createSessionReplayProvider,
  ClickInstrumentation,
  RageClickDetector,
  DeadClickDetector,
  NavigationTracker,
  ErrorTracker,
  ThrashingDetector,
} from '@anthropic/session-replay-browser-agent';

// Point to Elastic Cloud's managed OTLP endpoint
createSessionReplayProvider({
  serviceName: 'my-app',
  endpoint: 'https://<your-motlp-endpoint>',  // From Elastic Cloud console
  apiKey: '<your-api-key>',
});

// Enable instrumentation
new ClickInstrumentation({ document }).enable();
new NavigationTracker({ onNavigation: console.log }).enable();
new ErrorTracker({ onError: console.log }).enable();
new ThrashingDetector({ onThrashing: console.log }).enable();

// Frustration detection
const rageDetector = new RageClickDetector({ onRageClick: console.log });
const deadDetector = new DeadClickDetector({ onDeadClick: console.log });

document.addEventListener('click', (e) => {
  const target = e.target as Element;
  rageDetector.recordClick(target);
  deadDetector.recordClick(target);
}, { capture: true });
```

### 3. Find your Elastic Cloud endpoint

In Elastic Cloud: **Observability → Add data → Applications → OpenTelemetry**

## What Gets Captured

### Clicks
- Semantic name (button text, aria-label)
- React component name (auto-detected)
- Element details (tag, id, classes, data attributes)
- Page context (URL, title)

### Frustration Signals
- **Rage clicks**: 3+ rapid clicks on same element
- **Dead clicks**: Clicks on non-interactive elements
- **Form hesitation**: 10+ seconds on a form field
- **Scroll thrashing**: Rapid scroll direction changes (user confused)

### Navigation
- Page loads with referrer
- SPA route changes
- Time on page

### Errors
- Uncaught exceptions with stack traces
- Unhandled promise rejections
- Context: last click, page URL, time on page

## Project Structure

```
sessionreplay/
├── packages/
│   └── browser-agent/          # Core instrumentation library
│       ├── src/
│       │   ├── provider.ts     # OTEL provider setup
│       │   ├── semantic/       # Semantic event capture
│       │   │   ├── clicks.ts
│       │   │   ├── forms.ts
│       │   │   ├── navigation.ts
│       │   │   └── errors.ts
│       │   └── frustration/    # Frustration detection
│       │       ├── rage-click.ts
│       │       ├── dead-click.ts
│       │       └── thrashing.ts
│       └── dist/
├── apps/
│   └── demo/                   # React demo application
└── scripts/                    # Kibana dashboard setup
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests (127 tests)
pnpm test

# Build
pnpm build

# Run demo app
cd apps/demo && pnpm dev
```

## Tech Stack

- **Browser instrumentation**: TypeScript, OpenTelemetry SDK
- **Transport**: OTLP (OpenTelemetry Protocol)
- **Backend**: Elastic Cloud (managed OTLP endpoint)
- **AI layer**: Elastic AI Assistant

## License

MIT

## Author

David Hope ([@davidgeorgehope](https://github.com/davidgeorgehope))
