#!/bin/bash
# MealMate Production Deployment Script
# This script deploys the application to Vercel (UI) and Railway (API)

set -e

echo "======================================"
echo "  MealMate - Production Deployment"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_step "Checking prerequisites..."

if ! command -v vercel &> /dev/null; then
    print_error "Vercel CLI not found. Install with: npm install -g vercel"
    exit 1
fi

if ! command -v railway &> /dev/null; then
    print_error "Railway CLI not found. Install with: npm install -g @railway/cli"
    exit 1
fi

print_success "All prerequisites met"

# Generate secrets if not provided
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET=$(openssl rand -base64 32)
    print_warning "Generated new JWT_SECRET"
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
    export JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    print_warning "Generated new JWT_REFRESH_SECRET"
fi

# Deploy UI to Vercel
deploy_ui() {
    print_step "Deploying UI to Vercel..."
    cd src/ui

    if [ "$1" == "--prod" ]; then
        vercel --prod
    else
        vercel
    fi

    cd ../..
    print_success "UI deployed to Vercel"
}

# Deploy API to Railway
deploy_api() {
    print_step "Deploying API to Railway..."
    cd src/api

    railway up

    cd ../..
    print_success "API deployed to Railway"
}

# Main deployment flow
main() {
    echo ""
    echo "Select deployment option:"
    echo "1) Deploy UI only (Vercel)"
    echo "2) Deploy API only (Railway)"
    echo "3) Deploy both (Full deployment)"
    echo "4) Preview deployment (staging)"
    echo ""
    read -p "Enter choice [1-4]: " choice

    case $choice in
        1)
            deploy_ui --prod
            ;;
        2)
            deploy_api
            ;;
        3)
            deploy_api
            deploy_ui --prod
            ;;
        4)
            deploy_ui
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac

    echo ""
    echo "======================================"
    echo -e "${GREEN}  Deployment Complete!${NC}"
    echo "======================================"
    echo ""
    echo "Next steps:"
    echo "1. Configure environment variables in platform dashboards"
    echo "2. Run database migrations: cd src/api && npm run db:migrate"
    echo "3. Seed the database: npm run db:seed"
    echo "4. Test the endpoints"
    echo ""
}

# Run main function or specific command
if [ "$1" == "ui" ]; then
    deploy_ui --prod
elif [ "$1" == "api" ]; then
    deploy_api
elif [ "$1" == "all" ]; then
    deploy_api
    deploy_ui --prod
else
    main
fi
