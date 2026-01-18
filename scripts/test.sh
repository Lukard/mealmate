#!/bin/bash
# Run all tests with optional coverage
# Usage:
#   ./scripts/test.sh          # Run all tests
#   ./scripts/test.sh --watch  # Run in watch mode
#   ./scripts/test.sh --coverage # Run with coverage

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse arguments
WATCH_MODE=false
COVERAGE_MODE=false

for arg in "$@"; do
    case $arg in
        --watch|-w)
            WATCH_MODE=true
            ;;
        --coverage|-c)
            COVERAGE_MODE=true
            ;;
        --help|-h)
            echo "Usage: ./scripts/test.sh [options]"
            echo ""
            echo "Options:"
            echo "  --watch, -w     Run tests in watch mode"
            echo "  --coverage, -c  Run tests with coverage report"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
    esac
done

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  MealMate - Test Suite${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

if [ "$WATCH_MODE" = true ]; then
    echo -e "${YELLOW}Running tests in watch mode...${NC}"
    echo ""
    npm run test:watch
elif [ "$COVERAGE_MODE" = true ]; then
    echo -e "${YELLOW}Running tests with coverage...${NC}"
    echo ""
    npm run test:coverage
else
    echo -e "${YELLOW}Running all tests...${NC}"
    echo ""
    npm run test
fi
