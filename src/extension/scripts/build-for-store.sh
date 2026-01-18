#!/bin/bash

# Build script for Chrome Web Store submission
# Usage: ./scripts/build-for-store.sh

set -e

echo "========================================"
echo "MealMate Extension - Chrome Web Store Build"
echo "========================================"
echo ""

# Navigate to extension directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$EXT_DIR"

echo "[1/6] Cleaning previous builds..."
rm -rf build/
rm -f mealmate-extension.zip
echo "      Done."
echo ""

echo "[2/6] Installing dependencies..."
npm install --legacy-peer-deps
echo "      Done."
echo ""

echo "[3/6] Running type check..."
npm run type-check || echo "      Warning: Type check had issues, continuing..."
echo ""

echo "[4/6] Building for Chrome (Manifest V3)..."
npm run build
echo "      Done."
echo ""

echo "[5/6] Verifying build output..."
BUILD_DIR="build/chrome-mv3-prod"

if [ ! -d "$BUILD_DIR" ]; then
    echo "      ERROR: Build directory not found: $BUILD_DIR"
    exit 1
fi

# Check required files
REQUIRED_FILES=("manifest.json" "popup.html")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$BUILD_DIR/$file" ]; then
        echo "      ERROR: Required file missing: $file"
        exit 1
    fi
done

echo "      Build directory: $BUILD_DIR"
echo "      Contents:"
ls -la "$BUILD_DIR"
echo ""

echo "[6/6] Creating ZIP archive..."
cd "$BUILD_DIR"
zip -r "../../mealmate-extension.zip" . -x "*.map" -x ".DS_Store"
cd "$EXT_DIR"

# Get file size
ZIP_SIZE=$(du -h mealmate-extension.zip | cut -f1)

echo ""
echo "========================================"
echo "BUILD COMPLETE"
echo "========================================"
echo ""
echo "Output file: $EXT_DIR/mealmate-extension.zip"
echo "File size: $ZIP_SIZE"
echo ""
echo "Next steps:"
echo "1. Go to https://chrome.google.com/webstore/devconsole"
echo "2. Click 'New Item'"
echo "3. Upload mealmate-extension.zip"
echo "4. Fill in store listing details (see STORE_LISTING.md)"
echo "5. Add screenshots and promotional images"
echo "6. Submit for review"
echo ""
echo "Pre-submission checklist:"
echo "[ ] Icons generated (16x16, 48x48, 128x128)"
echo "[ ] Screenshots prepared (5 required)"
echo "[ ] Privacy policy published online"
echo "[ ] Store listing text reviewed"
echo "[ ] Test extension locally before submitting"
echo ""
