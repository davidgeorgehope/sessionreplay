import { trace } from '@opentelemetry/api';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { SessionReplayConfig } from './types';

let providerInstance: WebTracerProvider | null = null;

/**
 * Creates and registers an OpenTelemetry provider configured for session replay.
 *
 * @param config - Configuration options for the session replay provider
 * @returns The configured WebTracerProvider instance
 */
export function createSessionReplayProvider(
  config: SessionReplayConfig
): WebTracerProvider {
  // Create resource with service name
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  // Configure exporter headers
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers['Authorization'] = `ApiKey ${config.apiKey}`;
  }

  // Create OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
    headers,
  });

  // Configure batch processor
  const batchConfig = config.batch ?? {};
  const spanProcessor = new BatchSpanProcessor(exporter, {
    maxQueueSize: batchConfig.maxQueueSize ?? 100,
    maxExportBatchSize: batchConfig.maxBatchSize ?? 10,
    scheduledDelayMillis: batchConfig.scheduledDelayMs ?? 500,
    exportTimeoutMillis: batchConfig.exportTimeoutMs ?? 30000,
  });

  // Create provider
  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [spanProcessor],
  });

  // Register as global provider
  provider.register();

  // Store instance for shutdown
  providerInstance = provider;

  if (config.debug) {
    console.log('[SessionReplay] Provider initialized', {
      serviceName: config.serviceName,
      endpoint: config.endpoint,
      sampleRate: config.sampleRate ?? 1.0,
    });
  }

  return provider;
}

/**
 * Shuts down the provider and flushes any pending spans.
 */
export async function shutdownProvider(): Promise<void> {
  if (providerInstance) {
    await providerInstance.shutdown();
    providerInstance = null;
  }
}

/**
 * Gets a tracer instance for creating spans.
 *
 * @param name - Tracer name, defaults to 'session-replay'
 * @param version - Tracer version
 * @returns Tracer instance
 */
export function getTracer(name = 'session-replay', version = '0.0.1') {
  return trace.getTracer(name, version);
}
