#!/usr/bin/env node
/**
 * Verify session replay logs and traces are appearing in Elastic
 * Queries both logs-generic.otel-default and traces indices
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from this directory
config({ path: join(__dirname, '.env') });

const ES_ENDPOINT = process.env.ES_ENDPOINT;
const ES_API_KEY = process.env.ES_API_KEY;
const SERVICE_NAME = 'session-replay-demo';

if (!ES_ENDPOINT || !ES_API_KEY) {
  console.error('Missing ES_ENDPOINT or ES_API_KEY in .env');
  process.exit(1);
}

async function queryElastic(index, query) {
  const response = await fetch(`${ES_ENDPOINT}/${index}/_search`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${ES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error(`ES query failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function getRecentLogs(limit = 10) {
  const query = {
    size: limit,
    query: {
      bool: {
        must: [
          { match: { 'resource.attributes.service.name': SERVICE_NAME } }
        ]
      }
    },
    sort: [{ '@timestamp': 'desc' }],
  };

  return queryElastic('logs-generic.otel-default', query);
}

async function getRecentTraces(limit = 10) {
  const query = {
    size: limit,
    query: {
      bool: {
        must: [
          { match: { 'resource.attributes.service.name': SERVICE_NAME } }
        ]
      }
    },
    sort: [{ '@timestamp': 'desc' }],
  };

  return queryElastic('traces-generic.otel-default', query);
}

async function getEventTypeCounts() {
  const query = {
    size: 0,
    query: {
      bool: {
        must: [
          { match: { 'resource.attributes.service.name': SERVICE_NAME } }
        ]
      }
    },
    aggs: {
      by_event: {
        terms: {
          field: 'body.text.keyword',
          size: 20
        }
      }
    }
  };

  return queryElastic('logs-generic.otel-default', query);
}

async function getFrustrationEvents() {
  const query = {
    size: 20,
    query: {
      bool: {
        must: [
          { match: { 'resource.attributes.service.name': SERVICE_NAME } },
          { exists: { field: 'attributes.frustration.type' } }
        ]
      }
    },
    sort: [{ '@timestamp': 'desc' }],
  };

  return queryElastic('logs-generic.otel-default', query);
}

async function getUserSessions() {
  const query = {
    size: 0,
    query: {
      bool: {
        must: [
          { match: { 'resource.attributes.service.name': SERVICE_NAME } }
        ]
      }
    },
    aggs: {
      by_user: {
        terms: {
          field: 'attributes.user.id.keyword',
          size: 50
        },
        aggs: {
          sessions: {
            cardinality: {
              field: 'attributes.session.id.keyword'
            }
          },
          latest: {
            max: {
              field: '@timestamp'
            }
          }
        }
      }
    }
  };

  return queryElastic('logs-generic.otel-default', query);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Session Replay Elastic Verification');
  console.log('='.repeat(60));
  console.log(`\nEndpoint: ${ES_ENDPOINT}`);
  console.log(`Service:  ${SERVICE_NAME}\n`);

  try {
    // Recent logs
    console.log('\n--- Recent Logs (last 5) ---');
    const logs = await getRecentLogs(5);
    console.log(`Total logs: ${logs.hits.total.value}${logs.hits.total.relation === 'gte' ? '+' : ''}`);

    for (const hit of logs.hits.hits) {
      const src = hit._source;
      const ts = new Date(src['@timestamp']).toISOString();
      const event = src.body?.text || 'unknown';
      const sessionSeq = src.attributes?.['session.sequence'];
      const target = src.attributes?.['target.semantic_name'] || '';
      const user = src.attributes?.['user.id'] || 'anonymous';
      console.log(`  ${ts} | ${event.padEnd(30)} | seq=${sessionSeq?.toString().padStart(3)} | user=${user} | ${target}`);
    }

    // Event type counts
    console.log('\n--- Event Type Breakdown ---');
    const counts = await getEventTypeCounts();
    const buckets = counts.aggregations?.by_event?.buckets || [];
    for (const b of buckets) {
      console.log(`  ${b.key.padEnd(35)} ${b.doc_count}`);
    }

    // Frustration events
    console.log('\n--- Recent Frustration Events ---');
    const frustration = await getFrustrationEvents();
    if (frustration.hits.hits.length === 0) {
      console.log('  No frustration events found');
    } else {
      for (const hit of frustration.hits.hits.slice(0, 5)) {
        const src = hit._source;
        const ts = new Date(src['@timestamp']).toLocaleTimeString();
        const type = src.attributes?.['frustration.type'] || 'unknown';
        const score = src.attributes?.['frustration.score'] || 0;
        const user = src.attributes?.['user.id'] || 'anonymous';
        console.log(`  ${ts} | ${type.padEnd(15)} | score=${score.toFixed(2)} | user=${user}`);
      }
    }

    // User sessions
    console.log('\n--- User Sessions ---');
    const users = await getUserSessions();
    const userBuckets = users.aggregations?.by_user?.buckets || [];
    if (userBuckets.length === 0) {
      console.log('  No user sessions found');
    } else {
      for (const b of userBuckets) {
        const lastSeen = new Date(b.latest.value).toISOString();
        console.log(`  ${b.key.padEnd(20)} | ${b.doc_count.toString().padStart(4)} events | ${b.sessions.value} sessions | last: ${lastSeen}`);
      }
    }

    // Recent traces
    console.log('\n--- Recent Traces (last 5) ---');
    try {
      const traces = await getRecentTraces(5);
      console.log(`Total traces: ${traces.hits.total.value}${traces.hits.total.relation === 'gte' ? '+' : ''}`);

      for (const hit of traces.hits.hits) {
        const src = hit._source;
        const ts = new Date(src['@timestamp']).toISOString();
        const name = src.name || 'unknown';
        const duration = src.duration ? `${(src.duration / 1000000).toFixed(2)}ms` : 'N/A';
        console.log(`  ${ts} | ${name.padEnd(30)} | duration=${duration}`);
      }
    } catch (e) {
      console.log(`  Could not query traces: ${e.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Verification complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
