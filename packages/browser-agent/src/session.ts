/**
 * Session management for browser agent
 * Handles session ID generation and persistence via sessionStorage
 */

const SESSION_STORAGE_KEY = 'session_replay_session';

interface SessionData {
  id: string;
  sequence: number;
  startedAt: number;
  userId?: string;
  userEmail?: string;
  userName?: string;
}

let currentSession: SessionData | null = null;

/**
 * Generates a UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Loads session from sessionStorage or creates a new one
 */
function loadOrCreateSession(): SessionData {
  // Try to load from sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionData;
        // Validate the session data
        if (parsed.id && typeof parsed.sequence === 'number') {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Create new session
  return {
    id: generateUUID(),
    sequence: 0,
    startedAt: Date.now(),
  };
}

/**
 * Persists session to sessionStorage
 */
function persistSession(session: SessionData): void {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Ignore storage errors (quota exceeded, private mode, etc.)
    }
  }
}

/**
 * Gets or creates the current session
 */
function getSession(): SessionData {
  if (!currentSession) {
    currentSession = loadOrCreateSession();
    persistSession(currentSession);
  }
  return currentSession;
}

/**
 * Returns the current session ID
 */
export function getSessionId(): string {
  return getSession().id;
}

/**
 * Returns the session start timestamp
 */
export function getSessionStartTime(): number {
  return getSession().startedAt;
}

/**
 * Returns the next sequence number and increments the counter
 * Sequence numbers are used to order events within a session
 */
export function getNextSequence(): number {
  const session = getSession();
  const seq = session.sequence;
  session.sequence++;
  persistSession(session);
  return seq;
}

/**
 * Returns the current sequence number without incrementing
 */
export function getCurrentSequence(): number {
  return getSession().sequence;
}

/**
 * Resets the session (creates a new session ID)
 * Call this to force a new session (e.g., on logout)
 */
export function resetSession(): void {
  currentSession = {
    id: generateUUID(),
    sequence: 0,
    startedAt: Date.now(),
  };
  persistSession(currentSession);
}

/**
 * Gets the time elapsed since session start in milliseconds
 */
export function getSessionDuration(): number {
  return Date.now() - getSession().startedAt;
}

/**
 * User identity information
 */
export interface UserIdentity {
  /** Unique user identifier */
  id: string;
  /** User's email address (optional) */
  email?: string;
  /** User's display name (optional) */
  name?: string;
}

/**
 * Sets the user identity for the current session.
 * Call this after user login to associate events with a user.
 */
export function setUser(user: UserIdentity): void {
  const session = getSession();
  session.userId = user.id;
  session.userEmail = user.email;
  session.userName = user.name;
  persistSession(session);
}

/**
 * Clears the user identity (e.g., on logout)
 */
export function clearUser(): void {
  const session = getSession();
  delete session.userId;
  delete session.userEmail;
  delete session.userName;
  persistSession(session);
}

/**
 * Gets the current user identity, if set
 */
export function getUser(): UserIdentity | null {
  const session = getSession();
  if (!session.userId) {
    return null;
  }
  return {
    id: session.userId,
    email: session.userEmail,
    name: session.userName,
  };
}
