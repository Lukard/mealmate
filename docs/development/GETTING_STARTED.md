# Getting Started - Development Guide

This guide will help you set up your local development environment for the MealMate project and get you up and running quickly.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software

| Software | Minimum Version | Check Command | Download |
|----------|-----------------|---------------|----------|
| **Node.js** | 20.0.0 | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | 9.0.0 | `npm --version` | Included with Node.js |
| **Git** | 2.0.0 | `git --version` | [git-scm.com](https://git-scm.com/) |

### Optional but Recommended

| Software | Purpose | Download |
|----------|---------|----------|
| **PostgreSQL** | Database for API | [postgresql.org](https://www.postgresql.org/download/) |
| **VS Code** | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com/) |
| **Docker** | Containerized database | [docker.com](https://www.docker.com/) |

### Verify Your Environment

Run these commands to verify your setup:

```bash
# Node.js (should be v20.x.x or higher)
node --version

# npm (should be 9.x.x or higher)
npm --version

# Git
git --version
```

## Quick Setup (5 minutes)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd meal-automation
```

### 2. Run the Setup Script

The easiest way to get started is using our setup script:

```bash
bash scripts/setup.sh
```

This script will:
- Check your prerequisites
- Install all dependencies
- Build shared packages
- Create environment files
- Run type checks

### 3. Configure Your Environment

Edit the environment file for the API:

```bash
# Edit the API configuration
nano src/api/.env
# or
code src/api/.env
```

Update these values with your database credentials:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/meal_automation
JWT_SECRET=your-secure-secret-key
```

### 4. Start Development Servers

```bash
# Start both API and UI servers
bash scripts/dev.sh
```

Or start them individually:

```bash
# Terminal 1: API server (port 3001)
npm run dev:api

# Terminal 2: UI server (port 3000)
npm run dev:ui
```

### 5. Verify Everything Works

- Open http://localhost:3000 - You should see the MealMate UI
- Open http://localhost:3001 - You should see the API response

## Manual Setup (Detailed Steps)

If you prefer to set up manually or if the script doesn't work for your environment:

### Step 1: Install Dependencies

```bash
# From the project root
npm install
```

This installs dependencies for all workspaces using npm workspaces.

### Step 2: Build Packages in Order

The packages have dependencies on each other, so build them in this order:

```bash
# 1. Shared types (no dependencies)
npm run build --workspace=@meal-automation/shared

# 2. Core business logic (depends on shared)
npm run build --workspace=@meal-automation/core

# 3. Scraper engine (depends on shared)
npm run build --workspace=@meal-automation/scraper

# 4. API (depends on shared, core, scraper)
npm run build --workspace=@meal-automation/api

# 5. UI (depends on shared)
npm run build --workspace=@meal-automation/ui

# 6. Extension (depends on shared)
npm run build --workspace=@meal-automation/extension
```

Or use the build script:

```bash
bash scripts/build.sh
```

### Step 3: Database Setup

If you're working with the API, you'll need PostgreSQL:

#### Option A: Local PostgreSQL

```bash
# Create the database
createdb meal_automation

# Run migrations
npm run db:push --workspace=@meal-automation/api
```

#### Option B: Docker

```bash
# Start PostgreSQL in Docker
docker run --name meal-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meal_automation -p 5432:5432 -d postgres:16

# Run migrations
npm run db:push --workspace=@meal-automation/api
```

### Step 4: Start Development

```bash
# Start API
npm run dev:api

# In another terminal, start UI
npm run dev:ui
```

## Working with Each Package

### @meal-automation/shared

Contains shared TypeScript types and utilities.

```bash
# Build
npm run build --workspace=@meal-automation/shared

# Watch mode (auto-rebuild on changes)
npm run dev --workspace=@meal-automation/shared
```

### @meal-automation/core

Business logic for meal planning, product matching, and grocery optimization.

```bash
# Build
npm run build --workspace=@meal-automation/core

# Run tests
npm run test --workspace=@meal-automation/core
```

### @meal-automation/scraper

Supermarket scraping engine with adapters for DIA, Mercadona, Carrefour.

```bash
# Build
npm run build --workspace=@meal-automation/scraper

# Run tests
npm run test --workspace=@meal-automation/scraper
```

### @meal-automation/api

REST API built with Hono and Drizzle ORM.

```bash
# Development server with hot reload
npm run dev:api

# Database commands
npm run db:push --workspace=@meal-automation/api    # Push schema
npm run db:studio --workspace=@meal-automation/api  # Open Drizzle Studio
```

### @meal-automation/ui

Next.js frontend application.

```bash
# Development server
npm run dev:ui

# Build for production
npm run build --workspace=@meal-automation/ui

# Start production server
npm run start --workspace=@meal-automation/ui
```

### @meal-automation/extension

Browser extension built with Plasmo framework.

```bash
# Development mode
npm run dev --workspace=@meal-automation/extension

# Build for Chrome
npm run build --workspace=@meal-automation/extension

# Build for Firefox
npm run build:firefox --workspace=@meal-automation/extension
```

#### Loading the Extension in Chrome

1. Build the extension: `npm run build --workspace=@meal-automation/extension`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `src/extension/build/chrome-mv3-dev` folder

## Running Tests

### Unit Tests

```bash
# Run all tests once
npm run test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage

# With Vitest UI
npm run test:ui
```

### End-to-End Tests

```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see the browser)
npm run test:e2e:headed
```

## Common Issues and Solutions

### "Module not found" Errors

Build all packages from the root:

```bash
npm run build
```

Or clean and reinstall:

```bash
rm -rf node_modules
rm -rf src/*/node_modules
rm -rf src/*/dist
npm install
npm run build
```

### TypeScript Path Resolution Issues

Ensure shared packages are built first:

```bash
npm run build --workspace=@meal-automation/shared
```

### Port Already in Use

Check what's using the port:

```bash
# Check port 3000
lsof -i :3000

# Check port 3001
lsof -i :3001

# Kill a process
kill -9 <PID>
```

### Database Connection Issues

1. Verify PostgreSQL is running:
   ```bash
   pg_isready -h localhost -p 5432
   ```

2. Check your connection string in `src/api/.env`

3. Ensure the database exists:
   ```bash
   psql -U postgres -c "SELECT datname FROM pg_database WHERE datname = 'meal_automation';"
   ```

### Extension Not Loading

1. Check the build output exists: `ls src/extension/build/`
2. Ensure you're loading the correct folder (`chrome-mv3-dev` for development)
3. Check Chrome's extension errors page for details

## VS Code Configuration

### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "vitest.explorer"
  ]
}
```

### Debug Configuration

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
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
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

## Next Steps

Now that you have the project running:

1. **Read the Architecture Overview**: [/docs/architecture/overview.md](../architecture/overview.md)
2. **Review the Contributing Guidelines**: [/CONTRIBUTING.md](/CONTRIBUTING.md)
3. **Check the API Documentation**: [/docs/api/overview.md](../api/overview.md)
4. **Look at the PRD**: [/docs/PRD.md](../PRD.md)

## Getting Help

- Check the [FAQ](../guides/faq.md)
- Search existing GitHub issues
- Ask in GitHub Discussions
- Contact the maintainers

---

Happy coding! If you run into any issues not covered here, please open an issue so we can improve this guide.
