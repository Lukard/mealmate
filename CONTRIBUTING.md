# Contributing to MealMate

Thank you for your interest in contributing to MealMate! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming Conventions](#branch-naming-conventions)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Coding Standards](#coding-standards)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- Git 2.x or higher
- PostgreSQL (for API development)

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/meal-automation.git
   cd meal-automation
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL/meal-automation.git
   ```

4. **Run the setup script**:
   ```bash
   bash scripts/setup.sh
   ```

5. **Verify your setup**:
   ```bash
   npm run test
   npm run lint
   ```

## Development Workflow

### 1. Sync with Upstream

Before starting new work, sync your fork:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes

- Write clean, well-documented code
- Add tests for new functionality
- Update documentation as needed

### 4. Test Your Changes

```bash
# Run all tests
npm run test

# Run linting
npm run lint

# Type check
npm run typecheck

# Build to verify
npm run build
```

### 5. Commit Your Changes

Follow our [commit message format](#commit-message-format).

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Branch Naming Conventions

Use descriptive branch names with the following prefixes:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feature/` | New features | `feature/add-lidl-scraper` |
| `fix/` | Bug fixes | `fix/cart-automation-timeout` |
| `docs/` | Documentation only | `docs/update-api-reference` |
| `refactor/` | Code refactoring | `refactor/meal-planner-service` |
| `test/` | Adding or updating tests | `test/product-matcher-edge-cases` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

### Examples

```bash
git checkout -b feature/mercadona-price-comparison
git checkout -b fix/questionnaire-validation-error
git checkout -b docs/browser-extension-guide
git checkout -b refactor/scraper-base-class
```

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring (no feature or bug changes) |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks (deps, configs, etc.) |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |

### Scopes

Use the workspace or component name:

- `shared` - Shared types package
- `core` - Core business logic
- `scraper` - Scraper engine
- `api` - REST API
- `ui` - Web frontend
- `extension` - Browser extension
- `docs` - Documentation
- `deps` - Dependencies

### Examples

```bash
# Feature
feat(scraper): add Carrefour product scraper

# Bug fix
fix(extension): resolve cart timeout on large lists

# Documentation
docs(api): add authentication examples

# Refactor
refactor(core): extract meal plan validation logic

# With body
feat(ui): add weekly meal calendar view

Implements a new calendar component for displaying
weekly meal plans with drag-and-drop meal swapping.

Closes #123
```

## Pull Request Process

### Before Submitting

Ensure your PR meets these requirements:

- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventions
- [ ] No merge conflicts with main

### PR Title Format

Use the same format as commit messages:

```
feat(ui): add weekly meal calendar view
fix(scraper): handle Mercadona API rate limiting
docs(api): update authentication guide
```

### PR Description Template

```markdown
## Summary

Brief description of what this PR does.

## Changes

- Change 1
- Change 2
- Change 3

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing

Describe how you tested your changes:

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Screenshots (if applicable)

Add screenshots for UI changes.

## Related Issues

Closes #issue_number
```

## Code Review Guidelines

### For Reviewers

- Review promptly (within 24-48 hours)
- Be constructive and specific in feedback
- Approve when requirements are met
- Use "Request changes" only for blocking issues
- Use "Comment" for suggestions and questions

### Review Checklist

- [ ] Code is readable and well-organized
- [ ] Logic is correct and handles edge cases
- [ ] Tests adequately cover the changes
- [ ] No security vulnerabilities introduced
- [ ] Performance is acceptable
- [ ] Documentation is clear and accurate
- [ ] No unnecessary complexity added

### For Authors

- Respond to all comments
- Make requested changes promptly
- Ask for clarification if feedback is unclear
- Don't take feedback personally

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide explicit types (avoid `any`)
- Use interfaces for object shapes
- Document public APIs with JSDoc

```typescript
/**
 * Generates a personalized meal plan based on user preferences.
 * @param preferences - User's dietary and household preferences
 * @returns A complete weekly meal plan
 * @throws {ValidationError} If preferences are invalid
 */
export function generateMealPlan(
  preferences: UserPreferences
): Promise<MealPlan> {
  // Implementation
}
```

### Code Style

We use ESLint and Prettier. Key rules:

- 2 space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline
- Max line length: 100 characters

```bash
# Format code
npm run format

# Check linting
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Testing

- Write tests for new features
- Maintain existing test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

```typescript
describe('MealPlanner', () => {
  describe('generateMealPlan', () => {
    it('should generate a 7-day plan with 3 meals per day', async () => {
      // Arrange
      const preferences = createMockPreferences();

      // Act
      const plan = await generateMealPlan(preferences);

      // Assert
      expect(plan.days).toHaveLength(7);
      for (const day of plan.days) {
        expect(day.breakfast).toBeDefined();
        expect(day.lunch).toBeDefined();
        expect(day.dinner).toBeDefined();
      }
    });
  });
});
```

### File Organization

```
src/workspace/
├── index.ts           # Public exports
├── types.ts           # Type definitions
├── feature/
│   ├── index.ts       # Feature exports
│   ├── feature.ts     # Main implementation
│   ├── utils.ts       # Helper functions
│   └── feature.test.ts # Tests
└── another-feature/
```

## Getting Help

- Check existing documentation in `/docs`
- Search closed issues and PRs
- Ask questions in GitHub Discussions
- Contact maintainers for urgent issues

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for significant contributions
- Annual contributor acknowledgments

---

Thank you for contributing to MealMate! Your efforts help Spanish families simplify their meal planning and grocery shopping.
