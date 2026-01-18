#!/bin/bash
# Full project setup script for MealMate
# Run this script after cloning the repository

set -e  # Exit on any error

echo "======================================"
echo "  MealMate - Project Setup"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo ""
    echo -e "${YELLOW}>>> $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        print_success "Node.js $(node -v) detected"
    else
        print_error "Node.js 20+ required. Current: $(node -v)"
        exit 1
    fi
else
    print_error "Node.js not found. Please install Node.js 20+"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    print_success "npm $(npm -v) detected"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

# Check Git
if command -v git &> /dev/null; then
    print_success "Git $(git --version | cut -d' ' -f3) detected"
else
    print_warning "Git not found. Some features may not work"
fi

# Install dependencies
print_step "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Build shared packages first (required for other packages)
print_step "Building shared packages..."
npm run build --workspace=@meal-automation/shared
print_success "Shared package built"

# Build core package
print_step "Building core package..."
npm run build --workspace=@meal-automation/core
print_success "Core package built"

# Build scraper package
print_step "Building scraper package..."
npm run build --workspace=@meal-automation/scraper
print_success "Scraper package built"

# Setup API environment
print_step "Setting up API environment..."
if [ -f "src/api/.env" ]; then
    print_warning ".env already exists in src/api. Skipping..."
else
    if [ -f "src/api/.env.example" ]; then
        cp src/api/.env.example src/api/.env
        print_success "Created src/api/.env from example"
        print_warning "Please edit src/api/.env with your database credentials"
    else
        # Create a basic .env file
        cat > src/api/.env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meal_automation

# JWT Configuration
JWT_SECRET=change-this-to-a-secure-secret-key
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000
EOF
        print_success "Created src/api/.env with default values"
        print_warning "Please edit src/api/.env with your actual configuration"
    fi
fi

# Build API
print_step "Building API package..."
npm run build --workspace=@meal-automation/api
print_success "API package built"

# Setup UI
print_step "Setting up UI..."
# Check if .env.local exists
if [ ! -f "src/ui/.env.local" ]; then
    cat > src/ui/.env.local << 'EOF'
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# App Configuration
NEXT_PUBLIC_APP_NAME=MealMate
EOF
    print_success "Created src/ui/.env.local"
fi
print_success "UI setup complete"

# Setup Extension
print_step "Setting up Browser Extension..."
# Extension doesn't need special setup, just build
print_success "Extension ready (run 'npm run dev --workspace=@meal-automation/extension' to develop)"

# Run type check
print_step "Running type check..."
npm run typecheck || print_warning "Type check found some issues. Review and fix them."

# Final summary
echo ""
echo "======================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your database in src/api/.env"
echo "   DATABASE_URL=postgresql://user:pass@localhost:5432/meal_automation"
echo ""
echo "2. Start the development servers:"
echo "   npm run dev:api    # API server on port 3001"
echo "   npm run dev:ui     # UI server on port 3000"
echo ""
echo "3. Or start both with:"
echo "   bash scripts/dev.sh"
echo ""
echo "4. For the browser extension:"
echo "   npm run dev --workspace=@meal-automation/extension"
echo "   Then load the extension in Chrome from src/extension/build"
echo ""
echo "5. Run tests:"
echo "   npm run test       # Unit tests"
echo "   npm run test:e2e   # E2E tests"
echo ""
echo "Happy coding!"
echo ""
