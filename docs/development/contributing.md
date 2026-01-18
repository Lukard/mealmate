# Contributing Guidelines

Thank you for your interest in contributing to Meal Automation! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

1. Read the [Development Setup Guide](./setup.md)
2. Familiarize yourself with the [Architecture Overview](../architecture/overview.md)
3. Check existing issues and pull requests before starting work

## How to Contribute

### Reporting Bugs

When reporting bugs, please include:

1. **Summary**: Clear, concise description
2. **Steps to reproduce**: Numbered list of actions
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**: OS, browser, Node version
6. **Screenshots**: If applicable
7. **Logs**: Console errors, if any

Use the bug report template when creating issues.

### Suggesting Features

For feature requests:

1. Check if already suggested in issues
2. Describe the problem it solves
3. Explain your proposed solution
4. Consider alternatives
5. Note any breaking changes

Use the feature request template.

### Submitting Code

#### 1. Fork and Clone

```bash
# Fork the repository on GitHub
git clone https://github.com/YOUR-USERNAME/meal-automation
cd meal-automation
git remote add upstream https://github.com/ORIGINAL/meal-automation
```

#### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring
- `test/` - Adding tests

#### 3. Make Changes

Follow our coding standards (below) and commit regularly.

#### 4. Test Your Changes

```bash
# Run all tests
npm run test

# Run linting
npm run lint

# Build to check for errors
npm run build
```

#### 5. Commit Your Changes

Follow conventional commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, no code change
- `refactor`: Refactoring code
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(meal-planner): add recipe swapping functionality
fix(scraper): handle timeout in Mercadona adapter
docs(api): update authentication examples
```

#### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide explicit types (avoid `any`)
- Use interfaces for object shapes
- Document public APIs with JSDoc

```typescript
/**
 * Generates a meal plan based on user preferences
 * @param preferences - User's dietary and household preferences
 * @returns A complete weekly meal plan
 */
export function generateMealPlan(
  preferences: UserPreferences
): MealPlan {
  // Implementation
}
```

### Code Style

We use ESLint and Prettier. Configuration is in the repository.

```bash
# Format code
npm run format

# Check linting
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

Key rules:
- 2 space indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline
- Max line length: 100

### File Organization

```
src/workspace/
├── index.ts          # Public exports
├── types.ts          # Type definitions
├── feature/
│   ├── index.ts      # Feature exports
│   ├── feature.ts    # Main implementation
│   ├── utils.ts      # Helper functions
│   └── feature.test.ts  # Tests
└── another-feature/
```

### Testing

- Write tests for new features
- Maintain existing test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

```typescript
describe('MealPlanner', () => {
  describe('generateMealPlan', () => {
    it('should generate a 7-day plan with 3 meals per day', () => {
      // Arrange
      const preferences = createMockPreferences();

      // Act
      const plan = generateMealPlan(preferences);

      // Assert
      expect(plan.meals).toHaveLength(7);
      plan.meals.forEach(day => {
        expect(day.breakfast).toBeDefined();
        expect(day.lunch).toBeDefined();
        expect(day.dinner).toBeDefined();
      });
    });
  });
});
```

### Documentation

- Update docs when changing functionality
- Document all public APIs
- Include examples in documentation
- Keep README files current

## Pull Request Process

### PR Requirements

Before submitting:
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] New code has tests
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Conventional commit messages

### PR Template

Use this template when creating PRs:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe testing approach

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
```

### Review Process

1. Automated checks must pass
2. At least one maintainer review
3. Address feedback promptly
4. Squash commits if requested
5. Maintainer merges when approved

## Development Workflow

### Issue Workflow

1. **Open**: New issue, needs triage
2. **Triaged**: Confirmed, needs assignment
3. **In Progress**: Being worked on
4. **Review**: PR submitted
5. **Done**: Merged and closed

### Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `feature` | New feature request |
| `docs` | Documentation improvement |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority: high` | Should be addressed soon |
| `priority: low` | Nice to have |

## Workspace-Specific Guidelines

### Core Package

- Keep business logic framework-agnostic
- Maximize test coverage
- Document algorithms thoroughly

### Scraper Package

- Respect rate limits
- Handle errors gracefully
- Consider anti-bot measures
- Keep adapters isolated

### API Package

- Follow REST conventions
- Document all endpoints
- Include request validation
- Handle errors consistently

### UI Package

- Follow React best practices
- Keep components small
- Use TypeScript strictly
- Write meaningful tests

### Extension Package

- Follow Manifest V3 guidelines
- Minimize permissions
- Handle failures gracefully
- Test across browser versions

## Questions?

- Check existing documentation
- Search closed issues
- Ask in discussions
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Meal Automation!
