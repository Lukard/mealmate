# Testing Documentation

This directory contains testing documentation for the Meal Automation project.

## Contents

### Test Plans
- Unit testing strategy
- Integration testing approach
- End-to-end testing plan
- Performance testing plan

### Test Coverage
- Coverage reports
- Coverage goals by module
- Critical path coverage

### Test Results
- Test run summaries
- Bug reports from testing
- Regression test results

## Testing Strategy

### Unit Tests
- Located in `*.test.ts` files alongside source
- Run with: `npm run test`
- Target coverage: 80%+

### Integration Tests
- Located in `src/tests/integration/`
- Test service interactions
- Database and API integration

### E2E Tests
- Located in `src/tests/e2e/`
- Full user journey testing
- Browser extension testing

### Performance Tests
- Load testing with k6 or similar
- Scraper performance benchmarks
- API response time monitoring

## Running Tests

```bash
# All tests
npm run test

# Specific workspace
npm run test --workspace=@meal-automation/core

# Watch mode
npm run test -- --watch

# Coverage report
npm run test -- --coverage
```

## Adding Test Documentation

When documenting test results:

1. Date and version tested
2. Test environment details
3. Pass/fail summary
4. Notable issues found
5. Recommendations
