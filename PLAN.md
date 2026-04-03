# Sink Board — Architecture & Implementation Plan

## Context

Sink Board is a gamified productivity web app deployed on AWS, optimized for <$1/month (hobby project, dozens of users). Domain: subdomain of stridetwo.com. No paywall, no monetization.

### Full Functionality Breakdown

**The Board:**
- The screen shows a cross-section of the sea — water level near the top, deep dark ocean at the bottom
- Visual style: hand-drawn color pencil naturalist (like encyclopedia illustrations)
- Real-time animation — chests visibly sink as the user watches

**Tasks as Treasure Chests:**
- Users create tasks and assign a size tier: S (1 point), M (2 points), L (4 points), XL (8 points)
- Each task appears as a treasure chest on the board
- Bigger value → bigger, more valuable-looking chest
- Bigger value → sinks faster
- No cap on number of active tasks

**Sinking Rates (business hours only — weekends don't count):**
- XL: 24 hours to reach the bottom
- L: 48 hours
- M: 72 hours
- S: 5 business days (120 hours)

**Keeping Chests Afloat — AI-Scored Updates:**
- Users submit text-only updates on their tasks
- Claude (lowest cost model — Haiku) assesses the update quality using whatever context it can gather from the task title, description, and update text
- Best possible update raises the chest 90% of total depth
- Worst meaningful update raises it 10%
- The AI scores on a 0.0–1.0 scale, linearly mapped to 10%–90% raise

**The Kraken:**
- When a chest sinks near the bottom, the kraken tries to take it
- The kraken ONLY takes points when the user can see it (page must be visible)
- Kraken deducts points equal to the chest's value from the user's score
- After the kraken takes a chest, the chest resets to the surface (task is not deleted)

**Completing Tasks:**
- When a user completes a task, they earn points equal to the chest's value
- Visual: coins animate from the chest to the score counter at the top of the screen with fanfare

**Scoring:**
- Implicit scoring system (no leaderboard)
- Score displayed at top of screen
- Gains: completing tasks (chest value added)
- Losses: kraken takes a chest (chest value deducted)

**Chest Progression:**
- Chests that survive a long time without being taken by the kraken get progressively more jewel-encrusted (visual reward for sustained attention)

**Users & Auth:**
- Solo boards only — no collaboration or shared boards
- Google OAuth sign-in (via Amazon Cognito)
- User registration required

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite | Fast, modern, free |
| Rendering | PixiJS v8 via `@pixi/react` | Sprite compositing for illustration assets, smooth 60fps animation, WebGL with Canvas fallback |
| Backend | AWS Lambda (Node.js/TS) + API Gateway HTTP API | Serverless = $0 at this scale |
| Database | DynamoDB (on-demand, single-table) | Free tier: 25GB + 25 RCU/WCU |
| Auth | Amazon Cognito (Lite) + Google OAuth | Free under 10K MAU. No Amplify — use `amazon-cognito-identity-js` only |
| AI | Claude Haiku 4.5 via Anthropic SDK | ~$0.05-0.50/month for update scoring |
| IaC | AWS CDK (TypeScript) | Same language as app, powerful constructs |
| CI/CD | GitHub Actions | Free for public/private repos |
| Hosting | S3 + CloudFront (free plan) | Static SPA, global CDN |
| DNS/SSL | Route 53 + ACM | $0.50/mo hosted zone, free SSL |

**Estimated monthly cost: ~$0.55-1.00**

---

## Key Architecture Decisions

1. **No WebSockets.** Sink positions are client-calculated from timestamps. React Query fetches task data with 60s stale time; PixiJS ticker interpolates at 60fps.
2. **No Amplify.** Raw `amazon-cognito-identity-js` (31KB) instead of Amplify (~200KB). CDK for infra.
3. **Lambda per route** (not monolith). Tree-shaken by esbuild, ARM64 (20% cheaper).
4. **Shared `business-hours` module** — identical calculation on client and server. All timestamps UTC.
5. **Kraken is client-triggered.** Fires when chest hits 100% depth AND page is visible. Server validates depth >= 95% (clock drift tolerance).
6. **API key in SSM Parameter Store** (free) — not Secrets Manager ($0.40/mo) or env vars (visible in console).

---

## DynamoDB Single-Table Design

**Table:** `SinkBoard` | **PK** (String) | **SK** (String) | **GSI1PK** / **GSI1SK**

| Entity | PK | SK | GSI1 | Key Attributes |
|---|---|---|---|---|
| User | `USER#<id>` | `PROFILE` | `EMAIL#<email>` / `USER` | displayName, score |
| Task | `USER#<id>` | `TASK#<taskId>` | `TASK#<taskId>` / `TASK` | title, description, sizeTier, value, currentDepthPercent, lastRaisedAt, status, jewelLevel |
| Update | `TASK#<taskId>` | `UPDATE#<ts>#<id>` | `USER#<id>` / `UPDATE#<ts>` | content, aiScore, raisePercent |

---

## API Endpoints

| Method | Path | Lambda Handler | Description |
|---|---|---|---|
| GET | `/me` | `get-me.ts` | User profile + score (auto-create on first login) |
| GET | `/tasks` | `get-tasks.ts` | All tasks for authenticated user |
| POST | `/tasks` | `create-task.ts` | Create task (title, description, sizeTier) |
| PUT | `/tasks/:id/complete` | `complete-task.ts` | Complete task, add points to score |
| POST | `/tasks/:id/updates` | `submit-update.ts` | Submit update → AI scores → raise chest |
| POST | `/tasks/:id/kraken` | `kraken-took.ts` | Kraken took chest (server validates depth) |

All endpoints protected by Cognito JWT authorizer.

---

## Sink Mechanics

```
sinkRatePerMs = 100 / (tierSinkHours × 3600 × 1000)
elapsed = businessHoursElapsed(lastRaisedAt, now)  // excludes Sat/Sun
currentDepth = clamp(savedDepth + elapsed × sinkRatePerMs × 3600000, 0, 100)
```

Tier sink hours: XL=24, L=48, M=72, S=120

**Update raise:** `raisePercent = 10 + (aiScore × 80)` → 10% to 90% of total depth  
**Jewel levels:** `floor(totalActiveBusinessHours / 24)` capped at 3

---

## Project Structure

```
sink-board/
├── .github/workflows/
│   ├── deploy-frontend.yml
│   └── deploy-backend.yml
├── frontend/
│   ├── public/assets/          # Sprite sheets, ocean layers
│   └── src/
│       ├── auth/               # AuthProvider, LoginPage, cognito-config
│       ├── api/                # Fetch client, task/user API calls
│       ├── game/               # PixiJS: OceanScene, TreasureChest, Kraken, Coins, Bubbles
│       ├── ui/                 # TaskPanel, CreateTaskModal, UpdateForm, Header
│       ├── hooks/              # useTasks, useSinkPosition, useKrakenTrigger, useVisibility
│       └── utils/              # Re-exports from shared
├── backend/
│   └── src/
│       ├── handlers/           # One per API endpoint
│       ├── services/           # dynamo.ts, ai-assessor.ts, scoring.ts
│       ├── middleware/         # auth.ts, validation.ts
│       └── schemas/            # Zod validation schemas
├── shared/
│   └── src/
│       ├── types.ts            # User, Task, TaskUpdate, SizeTier
│       ├── constants.ts        # Tier values, sink rates, thresholds
│       └── business-hours.ts   # THE canonical calculator
├── infra/
│   ├── bin/app.ts
│   └── lib/
│       ├── dns-stack.ts        # Route 53, ACM cert
│       ├── auth-stack.ts       # Cognito User Pool, Google IdP
│       ├── api-stack.ts        # API Gateway, Lambdas, DynamoDB
│       └── frontend-stack.ts   # S3, CloudFront
├── package.json                # npm workspaces root
└── tsconfig.base.json
```

---

## Implementation Phases

### Phase 0 — Scaffolding
Monorepo with npm workspaces. Shared types/constants/business-hours. CDK infra skeleton (DNS + S3 + CloudFront). Vite dev server showing placeholder.

### Phase 1 — Authentication
Cognito User Pool + Google OAuth. Login page. JWT-protected `GET /me` endpoint. Auth context + token injection in API client.

### Phase 2 — Task CRUD + Ocean Scene (Vertical Slice)
Create/list tasks. PixiJS ocean with parallax layers. Chests positioned by real-time sink calculation. Click chest → detail panel. **This is the MVP milestone.**

### Phase 3 — AI Updates + Chest Raising
`POST /tasks/:id/updates` → Claude Haiku scores quality → chest rises. Loading state with animation. Update history in task panel.

### Phase 4 — Completion + Scoring
Complete task → coin animation → score increments. Score counter HUD.

### Phase 5 — Kraken Mechanic
Page visibility detection. Kraken animation (tentacles grab chest). Point deduction. Chest reset to surface.

### Phase 6 — Visual Polish
Hand-drawn art assets replace placeholders. Jewel-encrusted chest variants. Bubble particles. Depth zone markers. Ambient ocean creatures.

### Phase 7 — CI/CD + Hardening
GitHub Actions workflows. Error handling. Rate limiting on AI endpoint. OIDC role assumption (no stored AWS keys).

---

## Verification Plan

1. **Auth flow**: Google login → redirect → JWT returned → `GET /me` returns user
2. **Task lifecycle**: Create task → appears at surface → sinks over time → submit update → chest rises → complete → coins animate → score increments
3. **Kraken**: Let a small task sink to bottom while watching → kraken animation → points deducted → chest resets
4. **Business hours**: Create task Friday evening → verify no sinking over weekend → resumes Monday
5. **AI scoring**: Submit vague update ("did stuff") → low raise. Submit detailed update ("Completed API integration with error handling and tests") → high raise
6. **Deploy**: Push to main → GitHub Actions → CDK deploy + S3 sync → live at subdomain
