# Session Replay Semantic Events - AI Assistant Knowledge Base

This document provides context for analyzing session replay semantic events stored in Elasticsearch. Use this knowledge to help users investigate user behavior, diagnose issues, and understand funnel drop-offs.

## Data Location

Session replay events are stored in:
- **Index**: `logs-generic.otel-default`
- **Service filter**: `resource.attributes.service.name: "session-replay-demo"`

## Event Schema

All events share common attributes:

| Attribute | Type | Description |
|-----------|------|-------------|
| `attributes.session.id` | string | Unique session identifier (UUID) |
| `attributes.session.sequence` | number | Event sequence within session (1, 2, 3...) |
| `attributes.session.duration_ms` | number | Time since session start |
| `attributes.user.id` | string | User identifier |
| `attributes.user.email` | string | User email |
| `attributes.user.name` | string | User display name |
| `attributes.page.url` | string | Current page URL |
| `attributes.page.title` | string | Current page title |
| `attributes.event.category` | string | Event category (see below) |
| `attributes.event.action` | string | Specific action type |
| `body.text` | string | Event name (e.g., "user.click", "user.error") |

## Event Categories

### user.interaction
User clicks and interactions with UI elements.

| Attribute | Description |
|-----------|-------------|
| `attributes.target.semantic_name` | Button/link text or aria-label |
| `attributes.target.element` | HTML element type (button, a, div) |
| `attributes.target.id` | Element ID |
| `attributes.target.classes` | CSS classes |

### user.navigation
Page navigation events.

| Attribute | Description |
|-----------|-------------|
| `attributes.event.action` | `pageview`, `hashchange`, `popstate` |
| `attributes.navigation.url` | Destination URL |
| `attributes.navigation.hash` | URL hash fragment |

### user.frustration
Detected frustration signals indicating user struggle.

| Attribute | Description |
|-----------|-------------|
| `attributes.frustration.type` | `rage_click`, `dead_click`, `thrashing` |
| `attributes.frustration.score` | Severity 0-1 (higher = more frustrated) |
| `attributes.frustration.click_count` | Number of rapid clicks (rage_click) |
| `attributes.frustration.reason` | Why detected (e.g., `non_interactive`) |

### user.error
JavaScript errors that occurred during the session.

| Attribute | Description |
|-----------|-------------|
| `attributes.error.type` | `uncaught_exception`, `unhandled_rejection` |
| `attributes.error.message` | Error message |
| `attributes.error.filename` | Source file |
| `attributes.error.lineno` | Line number |
| `attributes.error.stack` | Stack trace (truncated) |

### form.interaction
Form field interactions.

| Attribute | Description |
|-----------|-------------|
| `attributes.event.action` | `focus`, `blur`, `input`, `submit` |
| `attributes.form.field_name` | Field name or ID |
| `attributes.form.name` | Form name or ID |

---

## ES|QL Queries for Investigation

### Count Sessions and Events
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| STATS
    total_events = COUNT(),
    unique_sessions = COUNT_DISTINCT(attributes.session.id)
```

### Sessions by User
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| STATS session_count = COUNT_DISTINCT(attributes.session.id) BY attributes.user.name
| SORT session_count DESC
```

### Frustration Events Overview
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.frustration"
| STATS count = COUNT() BY attributes.frustration.type
| SORT count DESC
```

### Rage Clicks by Element
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.frustration.type == "rage_click"
| STATS
    rage_clicks = COUNT(),
    avg_score = AVG(attributes.frustration.score)
  BY attributes.target.semantic_name
| SORT rage_clicks DESC
```

### Dead Clicks by Page
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.frustration.type == "dead_click"
| STATS count = COUNT() BY attributes.page.url
| SORT count DESC
```

### Errors by Type
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.error"
| STATS count = COUNT() BY attributes.error.message
| SORT count DESC
```

### Sessions with Errors
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.error"
| STATS
    error_count = COUNT(),
    first_error = MIN(@timestamp)
  BY attributes.session.id, attributes.user.name
| SORT error_count DESC
```

### Session Timeline (Event Sequence)
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.session.id == "<SESSION_ID>"
| SORT attributes.session.sequence ASC
| KEEP @timestamp, body.text, attributes.event.category, attributes.target.semantic_name, attributes.page.url
```

### Funnel Analysis - Sessions by Page
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.navigation"
| STATS sessions = COUNT_DISTINCT(attributes.session.id) BY attributes.page.url
| SORT sessions DESC
```

### Users Who Had Frustration Then Left
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.frustration"
| STATS
    frustration_count = COUNT(),
    last_page = MAX(attributes.page.url)
  BY attributes.session.id, attributes.user.name
| SORT frustration_count DESC
```

### High Frustration Score Events
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.frustration.score >= 0.7
| KEEP @timestamp, attributes.user.name, attributes.frustration.type, attributes.frustration.score, attributes.target.semantic_name
| SORT @timestamp DESC
```

### Correlate Errors with Page
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.error"
| STATS
    error_count = COUNT(),
    affected_sessions = COUNT_DISTINCT(attributes.session.id)
  BY attributes.page.url, attributes.error.message
| SORT error_count DESC
```

---

## Root Cause Analysis Workflows

### Workflow 1: Investigate Funnel Drop-off

**Scenario**: Users are dropping off at the cart page.

1. **Identify drop-off point**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.navigation"
| STATS sessions = COUNT_DISTINCT(attributes.session.id) BY attributes.page.url
| SORT sessions DESC
```

2. **Check for frustration at that page**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.page.url LIKE "*cart*"
| WHERE attributes.event.category == "user.frustration"
| STATS count = COUNT() BY attributes.frustration.type
```

3. **Find the problematic element**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.page.url LIKE "*cart*"
| WHERE attributes.frustration.type == "rage_click"
| STATS count = COUNT() BY attributes.target.semantic_name, attributes.target.id
| SORT count DESC
```

4. **View specific session timeline**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.session.id == "<frustrated_session_id>"
| SORT attributes.session.sequence ASC
```

### Workflow 2: Investigate JavaScript Errors

**Scenario**: Users are encountering errors.

1. **Count errors by type**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.error"
| STATS count = COUNT() BY attributes.error.message, attributes.error.filename
| SORT count DESC
```

2. **Find affected users**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.error"
| STATS error_count = COUNT() BY attributes.user.name, attributes.user.email
| SORT error_count DESC
```

3. **Check what users did before the error**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.session.id == "<session_with_error>"
| SORT attributes.session.sequence ASC
| KEEP attributes.session.sequence, body.text, attributes.event.category, attributes.target.semantic_name
```

### Workflow 3: Compare Successful vs Failed Sessions

**Scenario**: Want to understand what successful users do differently.

1. **Find sessions that completed checkout**:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.target.semantic_name == "Submit Order"
| STATS has_submit = COUNT() BY attributes.session.id
```

2. **Compare event patterns**:
```sql
-- Successful sessions (those with form submission)
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.session.id IN ("<successful_session_ids>")
| STATS events = COUNT() BY attributes.event.category
```

---

## Frustration Signal Interpretation

### Rage Click
**Definition**: 3+ rapid clicks on the same element within 1 second.

**Common causes**:
- Button appears unresponsive (no loading indicator)
- Click handler has an error
- Network request is slow
- Double-click prevention blocking clicks

**Score interpretation**:
- 0.3-0.5: Mild frustration (3-4 clicks)
- 0.5-0.7: Moderate frustration (5-6 clicks)
- 0.7-1.0: Severe frustration (7+ clicks)

### Dead Click
**Definition**: Click on a non-interactive element that looks clickable.

**Common causes**:
- Styled div/span looks like a button
- Image that looks like a CTA
- Disabled button without visual indication
- Link missing href attribute

**Score interpretation**:
- Fixed at 0.3 (indicates confusion, not urgency)

### Thrashing
**Definition**: 4+ rapid scroll direction changes within 2 seconds.

**Common causes**:
- User can't find what they're looking for
- Content not where expected
- Navigation is unclear
- Search results are irrelevant

---

## Common Questions and Answers

**Q: How do I find users who were frustrated and then left?**
Look for sessions where the last event is a frustration event or occurs shortly after one:
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.frustration"
| STATS max_seq = MAX(attributes.session.sequence) BY attributes.session.id
```
Then compare with total events per session.

**Q: How do I see what button users rage-clicked?**
```sql
FROM logs-generic.otel-default
| WHERE attributes.frustration.type == "rage_click"
| STATS count = COUNT() BY attributes.target.semantic_name, attributes.target.id
| SORT count DESC
```

**Q: How do I find all events for a specific user?**
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.user.id == "<user_id>"
| SORT @timestamp DESC
```

**Q: How do I correlate frontend errors with user actions?**
Find the session, then view the timeline:
```sql
FROM logs-generic.otel-default
| WHERE attributes.session.id == "<session_id>"
| SORT attributes.session.sequence ASC
| KEEP attributes.session.sequence, body.text, attributes.event.category, attributes.target.semantic_name, attributes.error.message
```

**Q: Which pages have the most frustration?**
```sql
FROM logs-generic.otel-default
| WHERE resource.attributes.service.name == "session-replay-demo"
| WHERE attributes.event.category == "user.frustration"
| STATS frustration_events = COUNT() BY attributes.page.url
| SORT frustration_events DESC
```

---

## Test Data Cohorts

The demo application generates test data with these user behavior patterns:

| User | Behavior | Drop-off | Frustration Signal |
|------|----------|----------|-------------------|
| Alice Johnson, Henry Wilson | Happy path | None (completes) | None |
| Bob Smith, Frank Miller | Rage clicker | Cart | rage_click on Add to Cart |
| Carol Williams | Confused | Products | dead_click on non-interactive area |
| David Brown, Eve Davis | Error victim | Checkout | JavaScript error |
| Grace Lee | Thrasher | Checkout | thrashing (scroll changes) |
| Ivan Petrov | Silent abandon | Cart | None (sticker shock) |

Use these patterns to understand expected funnel drop-off rates and correlate frustration signals with user outcomes.
