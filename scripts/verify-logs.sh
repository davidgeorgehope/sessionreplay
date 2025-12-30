#!/bin/bash
#
# Verify session replay logs in Elastic
# Uses the ES_ENDPOINT and ES_API_KEY from .env
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../examples/demo-app/.env"

# Load .env
if [ -f "$ENV_FILE" ]; then
    export $(grep -E '^(ES_ENDPOINT|ES_API_KEY)=' "$ENV_FILE" | xargs)
fi

if [ -z "$ES_ENDPOINT" ] || [ -z "$ES_API_KEY" ]; then
    echo "Error: ES_ENDPOINT or ES_API_KEY not set"
    echo "Please check examples/demo-app/.env"
    exit 1
fi

SERVICE_NAME="${1:-session-replay-demo}"
LIMIT="${2:-10}"

echo "============================================================"
echo "Session Replay Logs - Elastic Query"
echo "============================================================"
echo "Index:   logs-generic.otel-default"
echo "Service: $SERVICE_NAME"
echo "Limit:   $LIMIT"
echo "============================================================"

# Query recent logs
echo -e "\n--- Recent Logs ---"
curl -s "$ES_ENDPOINT/logs-generic.otel-default/_search" \
  -H "Authorization: ApiKey $ES_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": $LIMIT,
    \"query\": {
      \"match\": {
        \"resource.attributes.service.name\": \"$SERVICE_NAME\"
      }
    },
    \"sort\": [{\"@timestamp\": \"desc\"}]
  }" | jq -r '.hits.hits[] | "\(._source["@timestamp"]) | \(._source.body.text // "unknown") | user=\(._source.attributes["user.id"] // "anon") | \(._source.attributes["target.semantic_name"] // "")"'

# Count by event type
echo -e "\n--- Event Counts ---"
curl -s "$ES_ENDPOINT/logs-generic.otel-default/_search" \
  -H "Authorization: ApiKey $ES_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"size\": 0,
    \"query\": {
      \"match\": {
        \"resource.attributes.service.name\": \"$SERVICE_NAME\"
      }
    },
    \"aggs\": {
      \"by_event\": {
        \"terms\": {
          \"field\": \"body.text.keyword\",
          \"size\": 20
        }
      }
    }
  }" | jq -r '.aggregations.by_event.buckets[] | "\(.key): \(.doc_count)"'

echo -e "\n============================================================"
echo "Query complete!"
echo ""
echo "Kibana URL: ${KIBANA_URL:-https://o11y-project-c09e2f.kb.us-east-1.aws.elastic.cloud}"
echo ""
echo "KQL Query: resource.attributes.service.name: \"$SERVICE_NAME\""
echo "============================================================"
