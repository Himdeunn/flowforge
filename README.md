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
cd flowforge
# Install API deps
cd apps/api
npm install
# Install Web deps
cd ../web
npm install
```

### 2. Configure Environment

Create a `.env` file inside `apps/api/` based on the `.env.example` template:

```bash
cp apps/api/.env.example apps/api/.env
```

> [!IMPORTANT]
> To use the AI generation features, make sure `GEMINI_API_KEY` in the `.env` file is set to a valid API key. The application is pre-configured with 5 rotated API keys for Gemini to handle rate limits, but you can also supply your own key in `.env`.

### 3. Run Migrations

```bash
cd apps/api
npx prisma migrate dev
```

### 4. Start Development Servers

Run the backend API:
```bash
cd apps/api
npm run start:dev
```
API available at: `http://localhost:3000/api/v1`  
Swagger docs at: `http://localhost:3000/api/docs`

Run the frontend dashboard:
```bash
cd apps/web
npm run dev
```
Dashboard available at: `http://localhost:5173`

---

## 🐳 Docker Compose (Production Build)

```bash
# From repository root
docker-compose up --build
```

Services started:
- **API** (NestJS): `http://localhost:3000/api/v1`
- **Web** (React + Nginx): `http://localhost:5173`
- **PostgreSQL**: port `5432`
- **MongoDB**: port `27017`
- **Redis**: port `6379`

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

- **Backend Architecture**: Built using NestJS with strict modular architecture (Auth, Workflows, Runs, Execution, Webhooks, Queue, AI, WebSockets).
- **Tenant Isolation**: Handled via custom Prisma client proxy interceptor that automatically appends `tenant_id` filters to all database queries based on the verified JWT claims.
- **Asynchronous Execution**: Powered by BullMQ and Redis to separate API request handling from long-running workflow executions.
- **Real-Time Updates**: Bidirectional event streaming using Socket.IO to notify the dashboard when steps change status (pending → running → success/failed).
- **Execution Log Store**: Append-only log entries stored in MongoDB to keep log volume out of the relational database.

---

## 📋 API Documentation

Interactive Swagger UI: `http://localhost:3000/api/docs`

### Key Endpoints
- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- **Workflows**: `GET /workflows`, `POST /workflows`, `PUT /workflows/:id`, `DELETE /workflows/:id`, `POST /workflows/:id/trigger`, `POST /workflows/:id/versions/:versionId/rollback`
- **Runs**: `GET /runs`, `GET /runs/:id`, `GET /runs/:id/logs`, `GET /runs/health-summary`
- **AI**: `POST /ai/generate-workflow`
- **Webhooks**: `POST /webhooks/:webhookToken/trigger` (Public trigger endpoint)

---

## 🧪 Testing

```bash
# Unit & Integration tests
cd apps/api
npm run test

# E2E integration tests (requires local PostgreSQL, MongoDB, Redis running)
npm run test:e2e
```

---

## 💻 Manual Testing Guide (Browser Walkthrough)

To manually test the application and see the real-time Multi-Tenant DAG execution in action, follow these steps:

### Step 1: Account Creation & Tenant Registration
1. Open your browser and navigate to `http://localhost:5173`.
2. Select the **Create Account** tab.
3. Fill out the fields:
   - **Organization Name**: e.g., `Acme Corp`
   - **Slug (unique ID)**: e.g., `acme-corp`
   - **Email**: `admin@acme.com`
   - **Password**: `StrongPassword123!`
4. Click **Create Account**. You will be registered, logged in, and redirected to the **Dashboard** page.

### Step 2: System Health Dashboard
1. The dashboard displays 4 stats cards: **Active Runs**, **Success Rate**, **Avg Duration**, and **Total Runs (24h)**. These aggregate all workflow runs within the tenant slug.
2. The **Recent Runs** list at the bottom will initially be empty.

### Step 3: Natural Language AI Workflow Builder
1. Click **AI Builder** in the sidebar.
2. Under **Describe Your Workflow**, type a prompt in natural language, for example:
   > *"Wait 3 seconds, then fetch orders from https://httpbin.org/get, and then use a script to check if the status is 200"*
3. Click the **✨ Generate DAG** button.
4. The backend will query Gemini, rotate keys if needed, validate the generated DAG structure (ensuring no cycles exist), and display the result.
5. In the right panel, you will see the generated steps. You can review and edit the raw DAG JSON.
6. Click **💾 Save as Workflow**, enter a name (e.g., `Order Fulfillment Process`), and click **Confirm Save**.

### Step 4: Manage & Trigger Workflows
1. Go to the **Workflows** page in the sidebar.
2. You will see your newly created workflow card displaying its name, active version (`v1`), step count, and cron schedules if any.
3. Click the **▶ Trigger** button on the card. This immediately dispatches an execution request, queues the run in BullMQ, and initiates the background worker.

### Step 5: Real-Time DAG Visualizer & History
1. Click **Run History** in the sidebar.
2. Select the latest run ID from the left list.
3. In the center panel, a visual graph representation of your DAG will render using **ReactFlow**.
4. Watch the step nodes change border colors in real-time as they run:
   - Border turns **Amber/Yellow** when the step is `running`.
   - Border turns **Green** when the step completes with `success`.
   - Border turns **Red** if the step fails.
5. At the bottom, the **Execution Logs** card streams log statements in real-time straight from MongoDB, detailing timeouts, retries, and errors.

---

## ⚖️ Trade-offs & Future Improvements

- **Script Sandboxing**: Currently runs JS script steps inside Node's native `vm` module. While lightweight, for production it should be moved to `isolated-vm` to prevent sandbox breakout vulnerabilities.
- **WebSocket Auth**: Current Socket.IO gateway joins rooms directly based on query parameter `runId`. In production, this must validate the bearer token in the connection handshake to prevent unauthorized room listening.
- **Tailwind CSS**: The frontend UI is styled with optimized Vanilla CSS custom tokens to guarantee extremely fast load times. It can be easily ported to Tailwind class names if required.
