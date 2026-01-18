# Development Setup Guide

This guide will help you set up your local development environment for the Meal Automation project.

## Prerequisites

Before you begin, ensure you have the following installed:

| Software | Version | Required |
|----------|---------|----------|
| Node.js | 20.x or higher | Yes |
| npm | 9.x or higher | Yes |
| Git | 2.x or higher | Yes |
| VS Code | Latest | Recommended |

### Verify Prerequisites

```bash
# Check Node.js version
node --version
# Should output: v20.x.x or higher

# Check npm version
npm --version
# Should output: 9.x.x or higher

# Check Git version
git --version
```

## Project Structure

```
meal-automation/
├── docs/                    # Documentation
│   ├── guides/             # User guides
│   ├── api/                # API documentation
│   ├── architecture/       # Architecture docs
│   └── development/        # Developer guides
├── src/
│   ├── core/               # Core business logic
│   ├── scraper/            # Supermarket scraping engine
│   ├── api/                # REST API server
│   ├── ui/                 # React frontend
│   ├── extension/          # Browser extension
│   └── shared/             # Shared types and utilities
├── package.json            # Root package.json (workspaces)
├── tsconfig.json           # TypeScript configuration
└── CLAUDE.md               # AI assistant configuration
```

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd meal-automation
```

### 2. Install Dependencies

The project uses npm workspaces. Installing from the root will install all workspace dependencies:

```bash
npm install
```

### 3. Environment Configuration

Create environment files for each workspace that needs them:

```bash
# API configuration
cp src/api/.env.example src/api/.env

# Scraper configuration
cp src/scraper/.env.example src/scraper/.env
```

Edit each `.env` file with your local configuration.

### 4. Build the Project

Build all workspaces:

```bash
npm run build
```

Or build specific workspaces:

```bash
npm run build --workspace=@meal-automation/core
npm run build --workspace=@meal-automation/shared
```

### 5. Run Development Servers

Start the API server:

```bash
npm run dev:api
```

Start the UI development server:

```bash
npm run dev:ui
```

## Workspaces Overview

### @meal-automation/shared

Shared TypeScript types, interfaces, and utilities used across all packages.

```bash
# Build shared
npm run build --workspace=@meal-automation/shared

# Watch mode
npm run dev --workspace=@meal-automation/shared
```

### @meal-automation/core

Core business logic including meal planning algorithms, product matching, and grocery list generation.

```bash
# Build core
npm run build --workspace=@meal-automation/core

# Run tests
npm run test --workspace=@meal-automation/core
```

### @meal-automation/scraper

Supermarket scraping engine using Playwright for product data extraction.

```bash
# Build scraper
npm run build --workspace=@meal-automation/scraper

# Run scraper (requires configuration)
npm run scrape --workspace=@meal-automation/scraper
```

### @meal-automation/api

REST API server built with Node.js.

```bash
# Start development server
npm run dev --workspace=@meal-automation/api

# Start production server
npm run start --workspace=@meal-automation/api
```

### @meal-automation/ui

React frontend application.

```bash
# Start development server
npm run dev --workspace=@meal-automation/ui

# Build for production
npm run build --workspace=@meal-automation/ui
```

### Browser Extension

Chrome extension for cart automation.

```bash
# Build extension
npm run build --workspace=@meal-automation/extension

# Load in Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select src/extension/dist folder
```

## Development Workflow

### Code Style

The project uses ESLint and Prettier for code formatting:

```bash
# Lint all files
npm run lint

# Fix linting issues
npm run lint -- --fix

# Format code
npm run format
```

### TypeScript Configuration

The root `tsconfig.json` defines path aliases for workspace imports:

```typescript
// Import from shared workspace
import { MealPlan } from '@meal-automation/shared';

// Import from core workspace
import { generateMealPlan } from '@meal-automation/core';
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests for specific workspace
npm run test --workspace=@meal-automation/core

# Run tests in watch mode
npm run test -- --watch
```

### Debugging

#### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:api"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--watch"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

## Common Tasks

### Adding a New Dependency

```bash
# Add to specific workspace
npm install <package> --workspace=@meal-automation/core

# Add as dev dependency
npm install -D <package> --workspace=@meal-automation/api

# Add to root (shared across all workspaces)
npm install -D <package>
```

### Creating a New Module

1. Create the module directory in the appropriate workspace
2. Add necessary type exports to workspace `index.ts`
3. Update the workspace `package.json` if needed
4. Add path alias in root `tsconfig.json` if cross-workspace import needed

### Running the Scraper

The scraper requires additional setup:

```bash
# Install Playwright browsers
npx playwright install chromium

# Configure scraper settings in src/scraper/.env
# Run the scraper
npm run scrape --workspace=@meal-automation/scraper
```

## Troubleshooting

### Common Issues

#### Module not found errors

```bash
# Ensure all workspaces are built
npm run build

# Clear and reinstall node_modules
rm -rf node_modules
rm -rf src/*/node_modules
npm install
```

#### TypeScript path resolution issues

```bash
# Rebuild TypeScript references
npm run build --workspace=@meal-automation/shared
```

#### Playwright browser issues

```bash
# Reinstall browsers
npx playwright install

# Install system dependencies (Linux)
npx playwright install-deps
```

### Getting Help

- Check the [Architecture Overview](../architecture/overview.md) for system understanding
- Review [Contributing Guidelines](./contributing.md) before submitting changes
- Search existing issues before creating new ones

## Next Steps

- Read the [Architecture Overview](../architecture/overview.md)
- Review [Contributing Guidelines](./contributing.md)
- Check the [API Documentation](../api/overview.md)
