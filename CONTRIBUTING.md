# Contributing to Sink Board

## Development Workflow

1. **Branch from `main`**: Create feature branches with descriptive names
   ```bash
   git checkout -b feature/jewel-animation
   git checkout -b fix/depth-calculation
   ```

2. **Make changes**: Follow coding conventions below

3. **Test thoroughly**: All tests must pass
   ```bash
   npm test
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "Add jewel level calculation for blocked tasks"
   ```

5. **Push and create PR**: CI will run automatically
   ```bash
   git push origin feature/jewel-animation
   ```

## Coding Conventions

### Naming

- **CONSTANT_CASE** for module-level constants:
  ```typescript
  const TABLE_NAME = process.env.TABLE_NAME!;
  const JEWEL_THRESHOLD_HOURS = 24;
  const MAX_JEWEL_LEVEL = 5;
  const TIER_SINK_RATE_PER_MS = { S: 0.001, M: 0.002 };
  ```

- **camelCase** for functions and variables
- **PascalCase** for types, interfaces, and classes

### File Structure

```typescript
// --------------- Imports ---------------
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import type { Task, User } from './types';

import { calculateJewelLevel } from './scoring.js';
import { docClient } from './db.js';

// --------------- Constants ---------------
const TABLE_NAME = process.env.TABLE_NAME!;
const DEFAULT_SCORE = 0;

// --------------- Types ---------------
interface TaskWithDepth extends Task {
  currentDepth: number;
  jewelLevel: number;
}

// --------------- Implementation ---------------
export function processTask(task: Task): TaskWithDepth {
  // ...
}
```

### Import Organization

1. AWS SDK imports
2. Type imports (`import type`)
3. Relative imports
4. Blank lines between groups

### Section Comments

Use dashed separators for logical sections:
```typescript
// --------------- User operations ---------------
// --------------- Task scoring ---------------
// --------------- Database queries ---------------
```

### Error Handling

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Log to Sentry in production
  console.error('Operation failed:', error);
  throw new ApplicationError('User-friendly message', 500);
}
```

## Testing Guidelines

### Unit Tests

- Test file naming: `*.test.ts`
- Use Jest for all tests
- Mock AWS services with `aws-sdk-client-mock`

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('createTask', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('creates task with correct tier', async () => {
    ddbMock.on(PutCommand).resolves({});
    const task = await createTask({ title: 'Test', sizeTier: 'M' });
    expect(task.sizeTier).toBe('M');
  });
});
```

### Integration Tests

- Test API handlers end-to-end
- Use real AWS SDK calls against LocalStack or test environments

## TypeScript Guidelines

- Enable `strict: true` in tsconfig
- Use `type` for unions and primitives, `interface` for objects
- Avoid `any` — use `unknown` if type is truly unknown
- Export types from shared package when used across boundaries

## Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code restructuring
- `test`: Test additions or changes
- `chore`: Build/tooling changes

**Examples:**
```
feat: add kraken strike animation

fix: correct jewel level calculation for weekend tasks

docs: update API documentation for new endpoint
```

## Pull Request Process

1. **Title**: Clear, concise description
2. **Description**: Explain what and why
3. **Tests**: Include test coverage for new code
4. **CI**: All checks must pass
5. **Review**: At least one approval required

## Package Management

- Use exact versions in `package.json` (no `^` or `~`)
- Update dependencies via `npm update` and test thoroughly
- Shared package must be built before backend/frontend

## Questions?

Open an issue with the `question` label or reach out to the team.
