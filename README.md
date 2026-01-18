# MealMate - Spanish Meal Automation Platform

Automate your weekly meal planning and grocery shopping for Spanish supermarkets.

## Features

- **Meal Planning Questionnaire** - Personalized weekly meal plans based on your household size, dietary preferences, budget, and cooking skill level
- **Supermarket Integration** - DIA, Mercadona, Carrefour, and more Spanish supermarkets
- **Smart Product Matching** - 100+ Spanish ingredients mapped to supermarket products with intelligent matching
- **Browser Extension** - One-click cart automation to fill your supermarket cart
- **Mobile-First UI** - Works on any device with a responsive Next.js interface

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- Git 2.x or higher
- PostgreSQL (for API development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd meal-automation

# Install all dependencies (uses npm workspaces)
npm install

# Set up environment files
cp src/api/.env.example src/api/.env
# Edit src/api/.env with your database credentials

# Build all packages
npm run build
```

### Running Development Servers

```bash
# Start API server (port 3001)
npm run dev:api

# Start UI server (port 3000)
npm run dev:ui

# Or use the dev script to run both
bash scripts/dev.sh
```

### Browser Extension

```bash
# Build the extension
npm run build --workspace=@meal-automation/extension

# In Chrome:
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select src/extension/build/chrome-mv3-dev
```

## Project Structure

```
meal-automation/
├── docs/                     # Documentation
│   ├── guides/              # User guides
│   ├── api/                 # API documentation
│   ├── architecture/        # System architecture
│   ├── development/         # Developer guides
│   └── PRD.md              # Product requirements
├── src/
│   ├── shared/             # Shared TypeScript types and utilities
│   │   └── types/          # Core type definitions
│   ├── core/               # Business logic
│   │   └── services/       # Meal planning, product matching
│   ├── scraper/            # Supermarket scraping engine
│   │   └── scrapers/       # DIA, Mercadona, Carrefour scrapers
│   ├── api/                # REST API (Hono + Drizzle)
│   │   └── src/            # Routes, middleware, database
│   ├── ui/                 # Next.js frontend
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   └── lib/            # Utilities and store
│   ├── extension/          # Chrome/Firefox extension (Plasmo)
│   │   └── src/            # Popup, content scripts, background
│   └── tests/              # Test suites
│       ├── unit/           # Unit tests
│       ├── e2e/            # End-to-end tests
│       └── fixtures/       # Test data
├── scripts/                 # Setup and development scripts
├── package.json            # Root package with workspaces
├── vitest.config.ts        # Test configuration
├── playwright.config.ts    # E2E test configuration
└── CLAUDE.md               # AI assistant configuration
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand |
| **Backend** | Hono (Node.js), Drizzle ORM, PostgreSQL |
| **Extension** | Plasmo Framework, Chrome Extension Manifest V3 |
| **Scraping** | Cheerio, Undici (HTTP client) |
| **Testing** | Vitest, Playwright, MSW (Mock Service Worker) |
| **Build** | TypeScript, npm workspaces |

## Workspaces

| Package | Description |
|---------|-------------|
| `@meal-automation/shared` | Shared types, interfaces, and utilities |
| `@meal-automation/core` | Business logic for meal planning and optimization |
| `@meal-automation/scraper` | Supermarket product scraping engine |
| `@meal-automation/api` | REST API with authentication and data persistence |
| `@meal-automation/ui` | Next.js web application |
| `@meal-automation/extension` | Browser extension for cart automation |

## Development

### Running Tests

```bash
# Run all unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Code Quality

```bash
# Lint all files
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type check
npm run typecheck
```

### Database Commands

```bash
# Generate migrations
npm run db:generate --workspace=@meal-automation/api

# Run migrations
npm run db:migrate --workspace=@meal-automation/api

# Open Drizzle Studio
npm run db:studio --workspace=@meal-automation/api
```

## Supported Supermarkets

| Supermarket | Scraping | Cart Automation | Priority |
|-------------|----------|-----------------|----------|
| Mercadona | Available | Available | High |
| DIA | Available | Available | Medium |
| Carrefour | Available | Available | High |
| Lidl | Planned | Planned | High |
| Alcampo | Planned | Planned | Medium |
| El Corte Ingles | Planned | Planned | Low |
| Eroski | Planned | Planned | Low |
| Consum | Planned | Planned | Low |

## Documentation

- [Getting Started Guide](./docs/guides/getting-started.md) - For end users
- [Development Setup](./docs/development/setup.md) - For developers
- [Architecture Overview](./docs/architecture/overview.md) - System design
- [API Documentation](./docs/api/overview.md) - REST API reference
- [Contributing Guidelines](./docs/development/contributing.md) - How to contribute
- [Product Requirements](./docs/PRD.md) - Full product specification

## Environment Variables

### API (`src/api/.env`)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/meal_automation

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development
```

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](./docs/development/contributing.md) for details on:

- Code style and conventions
- Branch naming and commit messages
- Pull request process
- Testing requirements

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

Built with love for Spanish households who want to simplify meal planning and grocery shopping.
