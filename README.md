# Sink Board

> AI-powered task prioritization that surfaces what matters through gamified depth mechanics

## Overview

Sink Board is a task management system where tasks naturally "sink" over time based on age and size, creating urgency through visual depth cues. The system uses business-hours-aware scoring to ensure tasks don't get lost, with jewel levels indicating how long a task has been waiting.

## Architecture

- **Frontend**: React + TypeScript (Vite)
- **Backend**: AWS Lambda + API Gateway + DynamoDB
- **Shared**: Type-safe validation and business logic
- **Infrastructure**: Terraform (AWS)
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured
- Terraform 1.0+
- Docker (for local Lambda testing)

## Quick Start

```bash
# Install dependencies
npm install

# Build shared package first
cd shared && npm run build && cd ..

# Run backend tests
cd backend && npm test

# Run frontend dev server
cd frontend && npm run dev
```

## Project Structure

```
├── .github/workflows/     # CI/CD pipelines
├── backend/              # Lambda handlers and services
│   ├── src/handlers/    # API Gateway Lambda handlers
│   ├── src/services/    # Business logic (scoring, DynamoDB)
│   ├── src/middleware/  # Auth and error handling
│   └── src/schemas/     # Zod validation schemas
├── frontend/            # React application
│   └── src/api/        # API client
├── shared/             # Shared types and business logic
│   └── src/
│       ├── business-hours.ts  # Business time calculations
│       ├── constants.ts       # Tier values, sink rates
│       ├── validation.ts      # Shared validators
│       └── errors.ts          # Error types
├── infrastructure/     # Terraform IaC
│   └── terraform/
└── docs/              # Architecture Decision Records
```

## Core Concepts

### Task Sinking

Tasks "sink" based on:
- **Size Tier** (S/M/L/XL): Larger tasks sink faster
- **Business Hours Alive**: Only weekdays count
- **Depth %**: Visual indicator of urgency (0-100%)

### Jewel Levels

Tasks accumulate jewels over time:
- 1 jewel per 24 business hours alive
- Maximum 5 jewel levels
- Reduced by "kraken" interventions

### Kraken Strikes

Manual prioritization actions that:
- Reset task depth to 0%
- Decrement jewel level by 1
- Track intervention history

## Environment Variables

### Backend

```bash
TABLE_NAME=sink-board-tasks
JWT_SECRET=your-secret-key
AWS_REGION=us-east-1
```

### Frontend

```bash
VITE_API_BASE_URL=https://api.sinkboard.example.com
```

## Development

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
cd backend && npm run build
```

## Deployment

### Staging

Push to `main` branch triggers automatic deployment:
1. Tests run via GitHub Actions
2. Backend builds to Docker image
3. Frontend syncs to S3 staging bucket

### Production

Create a release tag:
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

## API Endpoints

- `GET /tasks` - List all tasks with calculated depths and jewels
- `POST /tasks` - Create new task
- `PATCH /tasks/:id` - Update task (status, assignment)
- `POST /tasks/:id/kraken` - Manual prioritization strike
- `DELETE /tasks/:id` - Delete task

See `docs/API.md` for detailed documentation.

## Contributing

See `CONTRIBUTING.md` for development workflow and coding conventions.

## License

Proprietary - All rights reserved
