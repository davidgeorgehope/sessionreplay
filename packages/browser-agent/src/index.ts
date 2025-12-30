// Core provider
export {
  createSessionReplayProvider,
  shutdownProvider,
  getTracer,
} from './provider';

// Semantic instrumentation
export {
  ClickInstrumentation,
  getSemanticName,
  getDataAttributes,
  getReactComponentName,
  buildClickTarget,
} from './semantic/clicks';

export { FormTracker } from './semantic/forms';

export { NavigationTracker } from './semantic/navigation';

export { ErrorTracker } from './semantic/errors';

// Frustration detection
export { RageClickDetector } from './frustration/rage-click';
export { DeadClickDetector, isInteractiveElement } from './frustration/dead-click';
export { ThrashingDetector } from './frustration/thrashing';

// Types
export type {
  SessionReplayConfig,
  ClickTarget,
  FrustrationSignal,
  SemanticEvent,
} from './types';

export type { ClickInstrumentationConfig } from './semantic/clicks';
export type { FormTrackerConfig, FormEvent, FormFieldEvent } from './semantic/forms';
export type { RageClickEvent, RageClickDetectorConfig } from './frustration/rage-click';
export type { DeadClickEvent, DeadClickDetectorConfig } from './frustration/dead-click';
export type { NavigationEvent, NavigationTrackerConfig } from './semantic/navigation';
export type { TrackedError, ErrorTrackerConfig, ErrorContext } from './semantic/errors';
export type { ThrashingEvent, ThrashingDetectorConfig } from './frustration/thrashing';
