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

## Our Approach

### Core Insight

We don't need video. We need **understanding**. Capture semantically rich events, let AI synthesize the narrative.

### Architecture

```
┌─────────────────────┐     OTLP      ┌─────────────────────┐
│  Browser JS Agent   │──────────────▶│   OTEL Collector    │
│  (semantic events)  │               └──────────┬──────────┘
└─────────────────────┘                          │
                                                 ▼
                                      ┌─────────────────────┐
                                      │   Elastic APM/Logs  │
                                      │  (indexed events)   │
                                      └──────────┬──────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │    AI Query Layer   │
                                      │  (LLM + RAG/Tools)  │
                                      └─────────────────────┘
```

### What We Capture (Semantic Events)

Instead of DOM mutations, we capture meaning:

```json
{
  "event": "user.interaction",
  "action": "click",
  "target": {
    "semantic_name": "Submit Order",
    "component": "CheckoutForm",
    "element": "button#submit",
    "context": { "cart_total": 149.99, "items": 3 }
  },
  "frustration_signals": {
    "rapid_clicks": 6,
    "time_since_page_load": 45000,
    "previous_attempts": 2
  },
  "session_id": "sess_abc123",
  "trace_id": "trace_xyz789",
  "user": { "id": "david.hope" }
}
```

### Frustration & Intent Signals

Key behavioral signals to detect and capture:

- **Rage clicks**: Multiple rapid clicks on same element (frustration)
- **Dead clicks**: Clicks on non-interactive elements (user expected action)
- **Thrashing**: Rapid scroll up/down (user is lost)
- **Form hesitation**: Long pauses on fields (confusion, looking up info)
- **Error blindness**: User continues after unnoticed error
- **Abandonment patterns**: Where in flow users leave

### AI Query Interface

The LLM should support queries like:

| Query | Expected Behavior |
|-------|-------------------|
| "What did user X experience?" | Narrate their session as a story |
| "Why did checkout fail for user X?" | Trace frontend → API → backend error |
| "Show me frustrated users today" | Find sessions with rage clicks, errors |
| "What's common among cart abandoners?" | Pattern analysis across sessions |
| "Summarize errors on /settings this week" | Aggregate frontend errors with context |

## Technical Decisions

### Why OTLP?

- Standard protocol; works with any OTEL-compatible backend
- Elastic supports OTLP natively
- Enables correlation between frontend events and backend traces via `trace_id`
- Future-proof; not locked to any vendor

### Why Elastic?

- Already have trace/span model for APM
- Good query capabilities for the patterns we need
- Can correlate frontend events with existing backend traces
- Native OTLP ingestion

### Browser Instrumentation Strategy

Build on OpenTelemetry Browser SDK with custom instrumentation:

1. **Core OTEL**: Use `@opentelemetry/sdk-trace-web` for base infrastructure
2. **Auto-instrumentation**: Leverage existing plugins for XHR, fetch, document load
3. **Custom semantic layer**: Our instrumentation for:
   - Semantic click tracking (not coordinates)
   - Frustration signal detection
   - Form behavior analytics
   - Error context capture
   - Component/framework awareness (React, Vue, etc.)

## Data Model

### Session Document

```json
{
  "session_id": "sess_abc123",
  "user_id": "david.hope",
  "started_at": "2025-12-29T14:32:00Z",
  "ended_at": "2025-12-29T14:47:00Z",
  "pages_visited": ["/products", "/cart", "/checkout"],
  "frustration_score": 0.72,
  "errors_encountered": 2,
  "outcome": "abandoned"
}
```

### Event Document

```json
{
  "event_id": "evt_123",
  "session_id": "sess_abc123",
  "timestamp": "2025-12-29T14:45:23Z",
  "event_type": "user.interaction",
  "action": "click",
  "target": {
    "semantic_name": "Submit Order",
    "component": "CheckoutForm"
  },
  "frustration_signals": { "rapid_clicks": 6 },
  "trace_id": "trace_xyz789"
}
```

### Correlation to APM

The `trace_id` field in frontend events links to backend traces:

```
Frontend Event (trace_id: xyz789)
    ↓
Backend Span (trace_id: xyz789, service: checkout-api)
    ↓
Database Span (trace_id: xyz789, service: postgres)
    ↓
Error: "Card declined" (trace_id: xyz789)
```

AI can traverse this entire chain to explain what happened.

## Project Structure (Planned)

```
sessionreplay/
├── packages/
│   ├── browser-agent/       # Browser instrumentation
│   │   ├── src/
│   │   │   ├── semantic/    # Semantic event capture
│   │   │   ├── frustration/ # Frustration signal detection
│   │   │   ├── forms/       # Form behavior tracking
│   │   │   └── exporter/    # OTLP export
│   │   └── package.json
│   ├── collector-config/    # OTEL collector configuration
│   └── ai-query/            # AI query interface
├── examples/
│   ├── react-app/           # Example React integration
│   └── vanilla-js/          # Vanilla JS integration
├── docs/
│   └── schema.md            # Event schema documentation
├── CLAUDE.md                # This file
└── README.md                # Project overview
```

## Development Phases

### Phase 1: Browser Agent Foundation
- [ ] Set up OTEL browser SDK
- [ ] Implement semantic click tracking
- [ ] Basic frustration detection (rage clicks)
- [ ] OTLP export to Elastic

### Phase 2: Rich Event Capture
- [ ] Form behavior analytics
- [ ] Component awareness (React/Vue)
- [ ] Error context capture
- [ ] Navigation and page lifecycle

### Phase 3: AI Query Layer
- [ ] Elasticsearch query interface
- [ ] LLM integration (tool use for search)
- [ ] Session narrative generation
- [ ] Pattern detection queries

### Phase 4: Polish & Examples
- [ ] Framework-specific integrations
- [ ] Dashboard/visualization
- [ ] Documentation
- [ ] Example applications

## Key Design Principles

1. **Semantic over syntactic**: Capture meaning, not pixels
2. **Privacy by design**: Only capture structured events, not raw DOM
3. **Correlation-first**: Every event links to traces
4. **Query over watch**: Data should be queryable, not just viewable
5. **AI-native**: Designed for LLM consumption from the start

## For Claude

When working on this project:

- The goal is an AI-native alternative to session replay
- We're using OTLP/OpenTelemetry for instrumentation
- Target backend is Elastic (but architecture should be backend-agnostic)
- Focus on semantic event capture, not DOM recording
- Frustration signals are a key differentiator
- Everything should correlate via trace_id

When implementing:
- Use TypeScript for the browser agent
- Follow OpenTelemetry conventions where applicable
- Keep the agent lightweight (bundle size matters)
- Make instrumentation non-intrusive to host applications
