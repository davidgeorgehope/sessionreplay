#!/bin/bash
#
# Session Replay Demo Launcher
# Quick start script to build and run the demo with load testing
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================"
echo "  Session Replay Demo"
echo "============================================================"

# Check for .env file
if [ ! -f "examples/demo-app/.env" ]; then
    echo -e "${YELLOW}Warning: examples/demo-app/.env not found${NC}"
    echo ""
    if [ -f "examples/demo-app/.env.example" ]; then
        echo "Creating from .env.example..."
        cp examples/demo-app/.env.example examples/demo-app/.env
        echo -e "${YELLOW}Please edit examples/demo-app/.env with your Elastic Cloud credentials${NC}"
        echo ""
    else
        echo "Please create examples/demo-app/.env with:"
        echo "  OTEL_EXPORTER_OTLP_ENDPOINT=https://your-endpoint"
        echo "  OTEL_EXPORTER_OTLP_HEADERS=Authorization=ApiKey YOUR_KEY"
        echo "  OTEL_RESOURCE_ATTRIBUTES=service.name=session-replay-demo"
        exit 1
    fi
fi

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is required but not installed${NC}"
    echo "Install with: npm install -g pnpm"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${GREEN}Installing dependencies...${NC}"
    pnpm install
fi

# Pass through environment variables
export ITERATIONS="${ITERATIONS:-3}"
export HEADLESS="${HEADLESS:-true}"

echo ""
echo "Configuration:"
echo "  ITERATIONS: $ITERATIONS"
echo "  HEADLESS: $HEADLESS"
echo "============================================================"
echo ""

# Run the demo
exec node examples/demo-app/start.js --load
