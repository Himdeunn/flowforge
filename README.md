# FlowForge

**Real-Time Multi-Tenant Workflow Orchestration Engine**

> Technical Assessment — Fullstack Engineer Internship | Sevima

[![CI](https://github.com/Himdeunn/flowforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Himdeunn/flowforge/actions/workflows/ci.yml)

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- MongoDB 7
- Redis 7 (or use Laragon's bundled Redis)

### 1. Clone & Install

```bash
git clone https://github.com/Himdeunn/flowforge.git
cd flowforge/apps/api
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your local values
```

Key variables:
```bash
DATABASE_URL=postgresql://flowforge:flowforge@localhost:5432/flowforge
MONGODB_URI=mongodb://localhost:27017/flowforge_logs
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=changeme-access-secret
JWT_REFRESH_SECRET=changeme-refresh-secret
GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Run Migrations

```bash
npx prisma migrate dev
```

### 4. Start Development Server

```bash
npm run start:dev
```

API available at: `http://localhost:3000/api/v1`  
Swagger docs at: `http://localhost:3000/api/docs`

---

## 🐳 Docker Compose (Full Stack)

```bash
# From repository root
docker-compose up --build
```

Services started:
| Service | Port | Description |
|---------|------|-------------|
| API | `3000` | NestJS REST + WebSocket |
| Web | `5173` | React Dashboard |
| PostgreSQL | `5432` | Relational DB |
| MongoDB | `27017` | Execution log store |
| Redis | `6379` | Queue + Rate limiting |

---

## 🏗️ Architecture Overview

```
React Dashboard (Vite)
        │ REST + WebSocket (Socket.IO)
        ▼
NestJS API Gateway
  ├── Auth (JWT + RBAC)
  ├── TenantGuard (Prisma middleware)
  ├── Rate Limiting (Redis sliding window)
  ├── REST Controllers (Workflows, Runs, AI)
  └── WebSocket Gateway (/ws/runs)
        │
  ┌─────┼──────────────────┐
  │     │                  │
  ▼     ▼                  ▼
PostgreSQL  BullMQ (Redis)  MongoDB
(Prisma)    Job Queue       (Execution Logs)
                │
                ▼
         DAG Execution Worker
         (parse → topo-sort → execute steps)
```

### Key Design Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Backend | NestJS + TypeScript | Modular architecture with built-in DI, great for RBAC/validation |
| Execution | Custom DAG executor + BullMQ | Redis-backed queue for async, retry/backoff built-in |
| Database | PostgreSQL via Prisma | ACID transactions for CRUD + versioning |
| Log Store | MongoDB (append-only) | Write-heavy, schema-flexible per step type |
| Real-time | Socket.IO | Bidirectional, room-per-run subscription model |
| AI Feature | Gemini 2.5 Flash | Structured JSON output mode, fast, low-cost |

---

## 📋 API Documentation

Interactive Swagger UI: `http://localhost:3000/api/docs`

### Auth Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new tenant + admin user |
| POST | `/api/v1/auth/login` | Login → access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate refresh token |

### Workflow Endpoints
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/v1/workflows` | All roles |
| POST | `/api/v1/workflows` | Admin, Editor |
| GET | `/api/v1/workflows/:id` | All roles |
| PUT | `/api/v1/workflows/:id` | Admin, Editor |
| DELETE | `/api/v1/workflows/:id` | Admin |
| POST | `/api/v1/workflows/:id/trigger` | Admin, Editor |
| POST | `/api/v1/workflows/:id/versions/:vId/rollback` | Admin, Editor |
| POST | `/api/v1/webhooks/:webhookToken/trigger` | Public (token-verified) |

### AI Endpoint
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/generate-workflow` | Generate DAG from natural language |

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests (requires running Postgres, MongoDB, Redis)
npm run test:e2e

# Coverage
npm run test:cov
```

### Test Coverage Summary

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Jest | DAG parser, topo-sort, execution engine (retry/timeout), AI service, WebSocket gateway |
| Integration | Jest + Supertest | Auth flow, CRUD workflows, tenant isolation (2-tenant), rate limiting, pagination |
| E2E | Jest + Supertest | Create workflow → trigger → poll status → assert completed |

---

## 🔐 Security

- **Tenant Isolation**: `tenantId` always from JWT claim, never from request body — enforced by `TenantGuard` + Prisma middleware
- **Passwords**: bcrypt hashed (cost 10), never returned in API responses
- **JWT**: Access token 15min, refresh token 7d stored in Redis (invalidatable)
- **Webhook**: 32-byte random token per workflow
- **Rate Limiting**: Redis sliding window 100 req/min per tenant
- **Input Validation**: `class-validator` with `forbidNonWhitelisted: true`
- **Script Sandbox**: `vm` module with timeout for `script` step type

---

## ⚖️ Trade-offs & Future Improvements

| Trade-off | Current Decision | Future Improvement |
|-----------|-----------------|-------------------|
| MongoDB vs PostgreSQL for logs | MongoDB for schema flexibility + append-only writes | Consider TimescaleDB for full SQL analytics |
| In-process worker vs separate service | Single process in dev, `DISABLE_WORKER=true` to separate | Deploy as separate ECS Fargate service in production |
| Rate limiting with Redis | Simple sliding window per tenant | Add per-IP limiting for public endpoints (webhook, login) |
| WebSocket auth | Simple room join — no JWT validation on WS | Add JWT verification on `subscribe:run` event |
| Script sandbox | Node.js `vm` module | Replace with `isolated-vm` for full V8 isolation |

---

## 📁 Project Structure

```
flowforge/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # JWT strategy, guards, RBAC
│   │   │   ├── ai/             # Gemini-powered NL workflow builder
│   │   │   ├── common/         # Rate limiter guard, interceptors
│   │   │   ├── execution/      # DAG parser, topo-sort, execution engine
│   │   │   ├── queue/          # BullMQ producer + consumer
│   │   │   ├── runs/           # Run CRUD + health panel
│   │   │   ├── websocket/      # Socket.IO gateway
│   │   │   └── workflows/      # Workflow CRUD + versioning
│   │   ├── prisma/             # Schema + migrations
│   │   └── test/               # E2E integration tests
│   └── web/                    # React frontend (Vite + TailwindCSS)
├── docs/
│   └── infra-design.md         # AWS infrastructure design
├── .github/
│   └── workflows/ci.yml        # GitHub Actions CI pipeline
├── docker-compose.yml
├── REVIEW.md                   # Code review findings
└── README.md
```

---

## 📄 License

MIT — Assessment project for Sevima Engineering Internship
