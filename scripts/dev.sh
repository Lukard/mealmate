#!/bin/bash
# Start all services for development
# This script starts both the API and UI servers concurrently

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  MealMate - Development Servers${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Get the root directory (parent of scripts/)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    # Kill all child processes
    pkill -P $$ 2>/dev/null || true
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM EXIT

# Check if ports are available
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Check ports
echo "Checking ports..."
API_PORT_FREE=true
UI_PORT_FREE=true

if ! check_port 3001; then
    API_PORT_FREE=false
fi

if ! check_port 3000; then
    UI_PORT_FREE=false
fi

echo ""

# Start API server
if [ "$API_PORT_FREE" = true ]; then
    echo -e "${BLUE}[API]${NC} Starting API server on port 3001..."
    npm run dev:api &
    API_PID=$!
else
    echo -e "${YELLOW}[API]${NC} Skipping API start (port 3001 in use)"
fi

# Small delay to let API start first
sleep 2

# Start UI server
if [ "$UI_PORT_FREE" = true ]; then
    echo -e "${BLUE}[UI]${NC} Starting UI server on port 3000..."
    npm run dev:ui &
    UI_PID=$!
else
    echo -e "${YELLOW}[UI]${NC} Skipping UI start (port 3000 in use)"
fi

echo ""
echo -e "${GREEN}Development servers starting...${NC}"
echo ""
echo "  API: http://localhost:3001"
echo "  UI:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for all background processes
wait
