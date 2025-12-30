/**
 * OTLP Log Provider for session replay events
 * Configures OpenTelemetry logging SDK for browser use
 */

import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export interface LogProviderConfig {
  /** Service name for OTEL resource */
  serviceName: string;

  /** OTLP endpoint for logs (e.g., http://localhost:4318/v1/logs) */
  endpoint: string;

  /** API key for Elastic Cloud (adds Authorization: ApiKey header) */
  apiKey?: string;

  /** Enable debug logging */
  debug?: boolean;

  /** Batch processor configuration */
  batch?: {
    /** Max log records in queue before dropping, default 100 */
    maxQueueSize?: number;
    /** Max records per batch, default 10 */
    maxBatchSize?: number;
    /** Delay before export in ms, default 500 */
    scheduledDelayMs?: number;
    /** Export timeout in ms, default 30000 */
    exportTimeoutMs?: number;
  };
}

let loggerProviderInstance: LoggerProvider | null = null;

/**
 * Creates and registers an OpenTelemetry log provider for session replay.
 *
 * @param config - Configuration options for the log provider
 * @returns The configured LoggerProvider instance
 */
export function createSessionLogProvider(config: LogProviderConfig): LoggerProvider {
  // Create resource with service name
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  // Configure exporter headers
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `ApiKey ${config.apiKey}`;
  }

  // Determine logs endpoint
  // If endpoint ends with /traces, replace with /logs
  // Otherwise append /v1/logs
  let logsEndpoint = config.endpoint;
  if (logsEndpoint.endsWith('/v1/traces')) {
    logsEndpoint = logsEndpoint.replace('/v1/traces', '/v1/logs');
  } else if (!logsEndpoint.endsWith('/v1/logs')) {
    logsEndpoint = logsEndpoint.replace(/\/?$/, '/v1/logs');
  }

  if (config.debug) {
    console.log('[SessionReplay] Log endpoint:', logsEndpoint);
    console.log('[SessionReplay] Original endpoint:', config.endpoint);
  }

  // Create OTLP log exporter
  const exporter = new OTLPLogExporter({
    url: logsEndpoint,
    headers,
  });

  // Use SimpleLogRecordProcessor for immediate export
  // This ensures logs are sent before page unload
  const logRecordProcessor = new SimpleLogRecordProcessor(exporter);

  // Verify processor has onEmit
  if (config.debug) {
    console.log('[SessionReplay] Processor has onEmit:', typeof (logRecordProcessor as any).onEmit);
    console.log('[SessionReplay] Exporter type:', exporter.constructor.name);
  }

  if (config.debug) {
    console.log('[SessionReplay] Using SimpleLogRecordProcessor for immediate export');
  }

  // Create provider with processor
  const provider = new LoggerProvider({
    resource,
    processors: [logRecordProcessor],
  });

  if (config.debug) {
    console.log('[SessionReplay] LogRecordProcessor attached');
  }

  // Register as global provider
  logs.setGlobalLoggerProvider(provider);

  // Store instance for shutdown
  loggerProviderInstance = provider;

  // Flush on page unload to ensure logs are sent
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Force flush when page is hidden
        provider.forceFlush().catch(() => {});
      }
    });

    window.addEventListener('beforeunload', () => {
      provider.forceFlush().catch(() => {});
    });
  }

  if (config.debug) {
    console.log('[SessionReplay] Log provider initialized', {
      serviceName: config.serviceName,
      endpoint: logsEndpoint,
    });
  }

  return provider;
}

/**
 * Shuts down the log provider and flushes any pending log records.
 */
export async function shutdownLogProvider(): Promise<void> {
  if (loggerProviderInstance) {
    await loggerProviderInstance.shutdown();
    loggerProviderInstance = null;
  }
}

/**
 * Gets a logger instance for emitting log records.
 *
 * @param name - Logger name, defaults to 'session-replay'
 * @param version - Logger version
 * @returns Logger instance
 */
export function getLogger(name = 'session-replay', version = '0.0.1') {
  return logs.getLogger(name, version);
}

// Re-export SeverityNumber for convenience
export { SeverityNumber };
