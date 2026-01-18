#!/bin/bash
# Build all packages in correct dependency order
# This ensures shared packages are built before dependent packages

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  MealMate - Build All Packages${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Get the root directory
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Build function with error handling
build_package() {
    local package=$1
    local name=$2

    echo -e "${YELLOW}Building ${name}...${NC}"
    if npm run build --workspace="$package" 2>&1; then
        echo -e "${GREEN}[OK]${NC} ${name} built successfully"
    else
        echo -e "${RED}[FAIL]${NC} ${name} build failed"
        exit 1
    fi
    echo ""
}

# Build in dependency order
echo "Building packages in dependency order..."
echo ""

# 1. Shared (no dependencies)
build_package "@meal-automation/shared" "Shared Types"

# 2. Core (depends on shared)
build_package "@meal-automation/core" "Core Business Logic"

# 3. Scraper (depends on shared)
build_package "@meal-automation/scraper" "Scraper Engine"

# 4. API (depends on shared, core, scraper)
build_package "@meal-automation/api" "REST API"

# 5. UI (depends on shared)
build_package "@meal-automation/ui" "Web UI"

# 6. Extension (depends on shared)
build_package "@meal-automation/extension" "Browser Extension"

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  All packages built successfully!${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
