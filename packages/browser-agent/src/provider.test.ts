import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { trace } from '@opentelemetry/api';
import { createSessionReplayProvider, shutdownProvider } from './provider';
import type { SessionReplayConfig } from './types';

describe('SessionReplayProvider', () => {
  const defaultConfig: SessionReplayConfig = {
    serviceName: 'test-service',
    endpoint: 'http://localhost:4318/v1/traces',
  };

  afterEach(async () => {
    await shutdownProvider();
    // Reset the global tracer provider
    vi.restoreAllMocks();
  });

  describe('createSessionReplayProvider', () => {
    it('should create a provider without throwing', () => {
      expect(() => createSessionReplayProvider(defaultConfig)).not.toThrow();
    });

    it('should register with the global tracer provider', () => {
      createSessionReplayProvider(defaultConfig);

      const tracer = trace.getTracer('test-tracer');
      expect(tracer).toBeDefined();
    });

    it('should create a tracer with the configured service name', () => {
      const provider = createSessionReplayProvider(defaultConfig);

      const tracer = provider.getTracer('session-replay');
      expect(tracer).toBeDefined();
    });

    it('should apply sample rate when configured', () => {
      const config: SessionReplayConfig = {
        ...defaultConfig,
        sampleRate: 0.5,
      };

      // Should not throw with sample rate
      expect(() => createSessionReplayProvider(config)).not.toThrow();
    });

    it('should configure batch processor with custom settings', () => {
      const config: SessionReplayConfig = {
        ...defaultConfig,
        batch: {
          maxQueueSize: 50,
          maxBatchSize: 5,
          scheduledDelayMs: 1000,
          exportTimeoutMs: 10000,
        },
      };

      expect(() => createSessionReplayProvider(config)).not.toThrow();
    });

    it('should include API key in headers when provided', () => {
      const config: SessionReplayConfig = {
        ...defaultConfig,
        apiKey: 'test-api-key',
      };

      // Should not throw - we'll verify headers in integration tests
      expect(() => createSessionReplayProvider(config)).not.toThrow();
    });
  });

  describe('tracer functionality', () => {
    it('should be able to start a span', () => {
      createSessionReplayProvider(defaultConfig);

      const tracer = trace.getTracer('session-replay');
      const span = tracer.startSpan('test-span');

      expect(span).toBeDefined();
      expect(span.isRecording()).toBe(true);

      span.end();
    });

    it('should be able to set span attributes', () => {
      createSessionReplayProvider(defaultConfig);

      const tracer = trace.getTracer('session-replay');
      const span = tracer.startSpan('test-span');

      // Should not throw when setting attributes
      expect(() => {
        span.setAttribute('event.type', 'click');
        span.setAttribute('target.semantic_name', 'Submit Button');
        span.setAttribute('frustration.score', 0.8);
      }).not.toThrow();

      span.end();
    });
  });
});
