<div align="center">

# ⚡ FlowForge

### Real-Time Multi-Tenant Workflow Orchestration Engine

*Technical Assessment — Fullstack Engineer Internship · Sevima*

[![CI](https://github.com/Himdeunn/flowforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Himdeunn/flowforge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-red)](LICENSE)

</div>

---

## 📖 Daftar Isi

1. [Tentang Proyek](#-tentang-proyek)
2. [Arsitektur Sistem](#-arsitektur-sistem)
3. [Tech Stack](#-tech-stack)
4. [Struktur Folder](#-struktur-folder)
5. [Prasyarat & Instalasi](#-prasyarat--instalasi)
6. [Konfigurasi Environment](#-konfigurasi-environment)
7. [Menjalankan Secara Lokal](#-menjalankan-secara-lokal)
8. [Docker Compose (Production)](#-docker-compose-production)
9. [Dokumentasi API](#-dokumentasi-api)
10. [Panduan Testing Manual (Browser)](#-panduan-testing-manual-browser)
11. [CI/CD Pipeline](#-cicd-pipeline)
12. [Database Design](#-database-design)
13. [Fitur AI — Natural Language Builder](#-fitur-ai--natural-language-builder)
14. [WebSocket Real-Time Events](#-websocket-real-time-events)
15. [Trade-offs & Rencana Perbaikan](#-trade-offs--rencana-perbaikan)
16. [Keputusan Implementasi](#-keputusan-implementasi)

---

## 🎯 Tentang Proyek

**FlowForge** adalah workflow orchestration engine multi-tenant real-time yang dibangun sebagai technical assessment untuk posisi Fullstack Engineer Internship di Sevima. Proyek ini mensimulasikan peran *founding engineer* yang membangun platform otomasi workflow — kombinasi eksekusi model Zapier dan GitHub Actions.

### Fitur Utama

| Fitur | Deskripsi | Status |
|---|---|---|
| **DAG Execution Engine** | Parse, validasi, dan eksekusi workflow berbasis Directed Acyclic Graph dengan topological sort (Kahn's algorithm) | ✅ |
| **Multi-Tenant Isolation** | Setiap tenant terisolasi penuh via Prisma Proxy yang menyuntikkan `tenantId` otomatis ke semua query | ✅ |
| **Workflow Versioning** | Setiap update workflow membuat versi baru; rollback ke versi manapun | ✅ |
| **Async Queue Execution** | BullMQ + Redis untuk job queue dengan retry exponential backoff & timeout | ✅ |
| **Real-Time Dashboard** | Socket.IO WebSocket untuk notifikasi perubahan status step secara live | ✅ |
| **DAG Visualizer** | React Flow untuk render graph interaktif dengan color-coded status node | ✅ |
| **AI Workflow Builder** | Natural Language → DAG JSON via Google Gemini API dengan validasi & retry korektif | ✅ |
| **Rate Limiting** | Redis sliding window per-tenant (default 100 req/mnt) | ✅ |
| **Webhook Trigger** | Trigger workflow via URL token publik | ✅ |
| **JWT Auth + RBAC** | Access token (15m) + Refresh token (7d) + role Admin/Editor/Viewer | ✅ |
| **Swagger UI** | Dokumentasi API interaktif auto-generated | ✅ |
| **Docker Compose** | Full stack siap pakai dengan satu perintah | ✅ |

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────┐
│       React Dashboard (Vite)        │
│  (Auth · Workflows · Runs · AI)     │
└───────────────┬─────────────────────┘
                │  REST + WebSocket (Socket.IO)
                ▼
┌───────────────────────────────────────────────────────────┐
│                   NestJS API Gateway                       │
│                                                            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Auth   │ │ Workflows│ │  Runs    │ │      AI      │  │
│  │JWT+RBAC │ │ CRUD+Ver │ │ History  │ │ NL Builder   │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│                                                            │
│  ┌─────────────────┐  ┌──────────────────────────────┐    │
│  │  TenantGuard    │  │  Rate Limiter (Redis window) │    │
│  │ (Prisma Proxy)  │  │  Webhook Controller           │    │
│  └─────────────────┘  └──────────────────────────────┘    │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            WebSocket Gateway (Socket.IO)             │   │
│  │   room: tenant:{tenantId}:run:{runId}                │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────┬──────────────────────┬──────────────────────┘
               │                      │
     ┌─────────▼────────┐    ┌────────▼────────────┐
     │   PostgreSQL 16   │    │  BullMQ (Redis 7)   │
     │   (Prisma ORM)    │    │  Job Queue          │
     │ tenants, users,   │    │  retry/backoff      │
     │ workflows, runs   │    └────────┬────────────┘
     └───────────────────┘            │
                                      ▼
                         ┌────────────────────────────┐
                         │    DAG Execution Worker     │
                         │  1. Parse definition_json   │
                         │  2. Topological sort (Kahn) │
                         │  3. Execute layer by layer  │
                         │     (parallel per layer)    │
                         │  4. Retry w/ exp. backoff   │
                         │  5. Emit WebSocket events   │
                         └──────────┬───────────┬──────┘
                                    │           │
                         ┌──────────▼──┐  ┌─────▼──────────┐
                         │  MongoDB 7   │  │  External APIs  │
                         │ (exec logs,  │  │ (HTTP step,     │
                         │  append-only)│  │  Gemini API)    │
                         └─────────────┘  └────────────────-┘
```

### Alur Eksekusi Workflow

```
Client → POST /workflows/:id/trigger
    ↓
API: buat workflow_run (status: queued) → push job BullMQ
    ↓
Worker: dequeue job → parse DAG → topological sort
    ↓  
Worker: eksekusi step per layer (step dalam layer = paralel)
    ↓  (per step)
Worker: catat log → MongoDB
Worker: update step_run → PostgreSQL
Worker: emit event → WebSocket room
    ↓
Dashboard: terima event → update node color → re-render
```

---

## 🛠 Tech Stack

| Layer | Teknologi | Versi | Alasan |
|---|---|---|---|
| **Runtime** | Node.js | 22.x | LTS terbaru, performa terbaik, ESM native |
| **Backend Framework** | NestJS | 11.x | Modular, DI, built-in validation |
| **Language** | TypeScript | 5.7 | Type-safety lintas layer |
| **ORM** | Prisma | 5.22 | Type-safe queries, migration otomatis |
| **Database Relasional** | PostgreSQL | 16 | ACID, JSONB, relasi workflow/tenant |
| **Log Store** | MongoDB | 7 | Write-heavy, skema fleksibel |
| **Cache & Queue Broker** | Redis | 7 | BullMQ + rate limiting |
| **Job Queue** | BullMQ | 5.x | Retry, backoff, delay built-in |
| **Real-Time** | Socket.IO | 4.x | WebSocket + polling fallback |
| **Auth** | JWT + Passport | - | Access 15m + Refresh 7d |
| **Frontend** | React + Vite | 18 / 5 | Fast HMR, React Flow, TanStack Query |
| **Styling** | Vanilla CSS | - | Custom token system, performa optimal |
| **DAG Visualizer** | React Flow | - | Render graph interaktif |
| **State/Fetch** | TanStack Query | - | Cache, optimistic update |
| **AI** | Google Gemini 2.5 Flash | - | Structured output JSON, latensi rendah |
| **API Docs** | Swagger/OpenAPI | - | Auto-generate dari NestJS decorator |
| **CI/CD** | GitHub Actions | - | Lint → Test → Build → Docker |
| **Container** | Docker multi-stage | - | Builder + Runner stage |

---

## 📁 Struktur Folder

```
flowforge/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/                 # JWT strategy, guards, RBAC decorator
│   │   │   ├── tenants/              # Tenant module
│   │   │   ├── users/                # User management
│   │   │   ├── workflows/            # CRUD + versioning + webhook
│   │   │   ├── runs/                 # Trigger, status, history, health
│   │   │   ├── execution/            # DAG parser, topo-sort, executor core
│   │   │   │   ├── dag-parser.ts     # Validasi DAG (cycle, orphan, type)
│   │   │   │   ├── topo-sort.ts      # Kahn's algorithm
│   │   │   │   └── step-executor.ts  # HTTP, script, delay, condition
│   │   │   ├── queue/                # BullMQ producer/consumer
│   │   │   ├── websocket/            # Socket.IO gateway
│   │   │   ├── ai/                   # Natural language workflow builder
│   │   │   ├── common/               # Pipes, filters, interceptors, guards
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Skema lengkap (6 model)
│   │   │   └── migrations/           # Riwayat migrasi otomatis
│   │   ├── test/                     # Integration & E2E tests
│   │   │   ├── auth.e2e-spec.ts
│   │   │   ├── workflows.e2e-spec.ts
│   │   │   ├── tenant-isolation.e2e-spec.ts
│   │   │   ├── trigger.e2e-spec.ts
│   │   │   └── rate-limit.e2e-spec.ts
│   │   ├── .env.example              # Template variabel environment
│   │   └── Dockerfile                # Multi-stage build
│   └── web/                          # React Frontend
│       ├── src/
│       │   ├── components/           # DAG canvas, run history, health panel
│       │   ├── pages/                # Login, Dashboard, Workflows, Runs, AI
│       │   ├── hooks/                # useWorkflowSocket, useAuth
│       │   └── lib/                  # API client, Socket client
│       └── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI Pipeline
├── docs/
│   └── infra-design.md               # Desain infrastruktur AWS
├── docker-compose.yml                # Full stack (6 services)
├── REVIEW.md                         # Code review assessment
├── CHANGELOG-DECISIONS.md            # Log keputusan implementasi
├── 01-PRD-FlowForge.md               # Product Requirements Document
├── 02-INSTALL-GUIDE.md               # Panduan instalasi lengkap
└── 03-AGENT-EXECUTION-GUIDE.md       # Panduan eksekusi agent
```

---

## ✅ Prasyarat & Instalasi

> 📖 Panduan instalasi lebih lengkap tersedia di [`02-INSTALL-GUIDE.md`](./02-INSTALL-GUIDE.md)

<details>
<summary><strong>🔧 Prasyarat Sistem (klik untuk expand)</strong></summary>

| Tool | Versi Minimum | Keterangan |
|---|---|---|
| Node.js | 22.x | Digunakan untuk API & frontend |
| npm | 11.x | Bundled dengan Node 22 |
| Git | 2.x | Version control |
| PostgreSQL | 16 | Database relasional utama |
| MongoDB | 7 | Store log eksekusi |
| Redis | 7 | Queue & rate limiting |
| Docker | 24.x *(opsional)* | Untuk mode production |
| Docker Compose | v2.x *(opsional)* | Full stack dengan satu perintah |

> **Windows:** Direkomendasikan menggunakan [Laragon](https://laragon.org/) yang sudah membundel PostgreSQL, MongoDB, dan Redis. Atau gunakan WSL2 + Docker Desktop.

</details>

<details>
<summary><strong>📥 Langkah 1: Clone Repository</strong></summary>

```bash
git clone https://github.com/Himdeunn/flowforge.git
cd flowforge
```

</details>

<details>
<summary><strong>📦 Langkah 2: Install Dependensi</strong></summary>

**Backend (NestJS API):**
```bash
cd apps/api
npm install
```

**Frontend (React + Vite):**
```bash
cd apps/web
npm install
```

</details>

<details>
<summary><strong>🗄️ Langkah 3: Setup Database (Prisma Migration)</strong></summary>

Pastikan PostgreSQL berjalan dan file `.env` sudah dikonfigurasi (lihat bagian [Konfigurasi Environment](#-konfigurasi-environment)), lalu jalankan:

```bash
cd apps/api

# Jalankan migrasi database
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

Verifikasi tabel berhasil dibuat:
```bash
# PostgreSQL (via Laragon atau Docker)
psql -U flowforge -d flowforge -c "\dt"
# Output yang diharapkan: tenants, users, workflow_definitions, workflow_versions, workflow_runs, step_runs
```

</details>

---

## ⚙️ Konfigurasi Environment

Buat file `.env` di dalam `apps/api/` berdasarkan template yang tersedia:

```bash
cp apps/api/.env.example apps/api/.env
```

<details>
<summary><strong>📋 Daftar Lengkap Variabel Environment (klik untuk expand)</strong></summary>

Edit `apps/api/.env` dan isi nilai yang sesuai:

```dotenv
# ─── Database (PostgreSQL via Prisma) ─────────────────────────────────────────
DATABASE_URL="postgresql://flowforge:flowforge@localhost:5432/flowforge"

# ─── MongoDB (Execution Log Store) ────────────────────────────────────────────
MONGODB_URI="mongodb://localhost:27017/flowforge"

# ─── Redis (BullMQ Queue + Rate Limiting) ─────────────────────────────────────
REDIS_HOST="localhost"
REDIS_PORT=6379

# ─── JWT Authentication ────────────────────────────────────────────────────────
JWT_ACCESS_SECRET="ganti-dengan-secret-panjang-dan-acak"
JWT_REFRESH_SECRET="ganti-dengan-secret-lain-yang-berbeda"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ─── Google Gemini AI ─────────────────────────────────────────────────────────
# Wajib diisi untuk menggunakan fitur AI Natural Language Builder
# Dukung rotasi hingga 5 key untuk menghindari rate limit
GEMINI_API_KEY="masukkan-api-key-anda-disini"
GEMINI_API_KEY_2="api-key-cadangan-2-opsional"
GEMINI_API_KEY_3="api-key-cadangan-3-opsional"
GEMINI_API_KEY_4="api-key-cadangan-4-opsional"
GEMINI_API_KEY_5="api-key-cadangan-5-opsional"

# ─── Aplikasi ─────────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV="development"

# ─── Worker Control ───────────────────────────────────────────────────────────
# Set true untuk menonaktifkan BullMQ worker (berguna di environment test)
# Di docker-compose: service 'api' → DISABLE_WORKER=true, service 'worker' → DISABLE_WORKER=false
DISABLE_WORKER="false"
```

> ⚠️ **PENTING:** Jangan pernah commit file `.env` ke Git. File ini sudah terdaftar di `.gitignore`.

</details>

<details>
<summary><strong>🔑 Cara Mendapatkan Gemini API Key</strong></summary>

1. Buka [Google AI Studio](https://aistudio.google.com/apikey)
2. Login dengan akun Google
3. Klik **"Create API Key"**
4. Pilih project Google Cloud yang sudah ada atau buat baru
5. Salin API key dan tempelkan ke variabel `GEMINI_API_KEY` di file `.env`

Untuk menghindari rate limit, bisa menyediakan hingga **5 API key** dari akun berbeda. Sistem akan melakukan rotasi otomatis saat satu key terkena limit.

</details>

---

## 🚀 Menjalankan Secara Lokal

<details>
<summary><strong>▶️ Langkah 1: Jalankan Backend API (NestJS)</strong></summary>

```bash
cd apps/api
npm run start:dev
```

Server akan berjalan di: **`http://localhost:3000`**

Endpoint yang tersedia setelah server berjalan:
- **API Base URL:** `http://localhost:3000/api/v1`
- **Swagger UI:** `http://localhost:3000/api/docs`
- **Health Check:** `http://localhost:3000/api/v1/health`

</details>

<details>
<summary><strong>▶️ Langkah 2: Jalankan Frontend Dashboard (React + Vite)</strong></summary>

Buka terminal baru, lalu:

```bash
cd apps/web
npm run dev
```

Dashboard akan berjalan di: **`http://localhost:5173`**

</details>

<details>
<summary><strong>🔴 Pastikan Service Pendukung Berjalan</strong></summary>

Sebelum menjalankan API, pastikan ketiga service ini aktif:

**PostgreSQL** (Laragon atau Docker):
```bash
# Via Docker
docker run --name flowforge-postgres \
  -e POSTGRES_USER=flowforge \
  -e POSTGRES_PASSWORD=flowforge \
  -e POSTGRES_DB=flowforge \
  -p 5432:5432 -d postgres:16-alpine
```

**Redis** (Laragon atau Docker):
```bash
# Via Docker
docker run --name flowforge-redis -p 6379:6379 -d redis:7-alpine
```

**MongoDB** (Laragon atau Docker):
```bash
# Via Docker
docker run --name flowforge-mongo -p 27017:27017 -d mongo:7
```

> Jika menggunakan Laragon di Windows, cukup klik **Start All** di Laragon Panel dan pastikan PostgreSQL, MongoDB, dan Redis sudah aktif.

</details>

---

## 🐳 Docker Compose (Production)

Untuk menjalankan seluruh stack (API + Worker + Frontend + Database) dengan **satu perintah**:

```bash
# Dari root repository
docker compose up --build
```

<details>
<summary><strong>📋 Detail Service Docker Compose (klik untuk expand)</strong></summary>

| Service | Image | Port | Deskripsi |
|---|---|---|---|
| `api` | `flowforge/api` (multi-stage) | 3000 | NestJS API (DISABLE_WORKER=true) |
| `worker` | `flowforge/api` (multi-stage) | — | BullMQ Worker (DISABLE_WORKER=false) |
| `web` | `flowforge/web` (Nginx) | 5173 | React frontend |
| `postgres` | `postgres:16-alpine` | 5432 | Database relasional |
| `mongodb` | `mongo:7` | 27017 | Store log eksekusi |
| `redis` | `redis:7-alpine` | 6379 | Queue & rate limiting |

</details>

<details>
<summary><strong>🔍 Verifikasi Docker Compose Berjalan</strong></summary>

```bash
# Cek semua container berjalan
docker compose ps

# Cek health status
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# Cek log API
docker compose logs api -f

# Test endpoint health
curl http://localhost:3000/api/v1/health
```

</details>

<details>
<summary><strong>🛑 Menghentikan & Membersihkan</strong></summary>

```bash
# Hentikan semua container
docker compose down

# Hentikan dan hapus volume (DATA AKAN HILANG)
docker compose down -v

# Rebuild image
docker compose up --build --force-recreate
```

</details>

---

## 📋 Dokumentasi API

**Swagger UI Interaktif:** [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs)

<details>
<summary><strong>🔐 Auth Endpoints</strong></summary>

| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Publik | Registrasi tenant baru + user Admin |
| `POST` | `/api/v1/auth/login` | Publik | Login, return `accessToken` + `refreshToken` |
| `POST` | `/api/v1/auth/refresh` | Publik (refresh token) | Perbarui access token |
| `POST` | `/api/v1/auth/logout` | Semua role | Invalidasi refresh token |

**Contoh Register:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Corp",
    "tenantSlug": "acme-corp",
    "email": "admin@acme.com",
    "password": "Password123!"
  }'
```

**Contoh Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "Password123!"}'
# Response: { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
```

</details>

<details>
<summary><strong>📑 Workflow Endpoints</strong></summary>

| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/workflows` | Semua | List workflow (cursor pagination) |
| `POST` | `/api/v1/workflows` | Admin, Editor | Buat workflow baru dengan definisi DAG |
| `GET` | `/api/v1/workflows/:id` | Semua | Detail workflow + versi aktif |
| `PUT` | `/api/v1/workflows/:id` | Admin, Editor | Update → membuat versi baru otomatis |
| `DELETE` | `/api/v1/workflows/:id` | Admin | Hapus workflow (soft-delete) |
| `GET` | `/api/v1/workflows/:id/versions` | Semua | Riwayat semua versi |
| `POST` | `/api/v1/workflows/:id/versions/:vId/rollback` | Admin, Editor | Rollback ke versi tertentu |
| `POST` | `/api/v1/workflows/:id/trigger` | Admin, Editor | Trigger manual eksekusi |
| `POST` | `/api/v1/webhooks/:token/trigger` | Publik (token) | Trigger via webhook URL |

**Contoh Create Workflow:**
```bash
curl -X POST http://localhost:3000/api/v1/workflows \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Order Processing Pipeline",
    "description": "Validate → Process → Notify",
    "definitionJson": {
      "nodes": [
        { "id": "validate", "type": "http", "config": { "url": "https://api.example.com/validate", "method": "POST" } },
        { "id": "process",  "type": "delay", "config": { "durationMs": 2000 } },
        { "id": "notify",   "type": "script", "config": { "script": "output.message = \"Order processed: \" + steps.validate.output.orderId;" } }
      ],
      "edges": [
        { "from": "validate", "to": "process" },
        { "from": "process",  "to": "notify" }
      ]
    }
  }'
```

</details>

<details>
<summary><strong>🏃 Run Endpoints</strong></summary>

| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| `GET` | `/api/v1/runs` | Semua | List run (filter: `?status=failed&createdAfter=...`) |
| `GET` | `/api/v1/runs/:id` | Semua | Detail run + status setiap step |
| `GET` | `/api/v1/runs/:id/logs` | Semua | Log eksekusi per step dari MongoDB |
| `GET` | `/api/v1/runs/health-summary` | Semua | Agregat 24 jam (active, success rate, avg duration) |

</details>

<details>
<summary><strong>🤖 AI Endpoint</strong></summary>

| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/ai/generate-workflow` | Admin, Editor | Deskripsi natural language → DAG JSON |

**Contoh Request:**
```bash
curl -X POST http://localhost:3000/api/v1/ai/generate-workflow \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Tunggu 3 detik, kemudian ambil data dari https://httpbin.org/get, lalu cek apakah status responsenya 200"}'
```

**Contoh Response:**
```json
{
  "nodes": [
    { "id": "wait", "type": "delay", "config": { "durationMs": 3000 } },
    { "id": "fetch", "type": "http", "config": { "url": "https://httpbin.org/get", "method": "GET" } },
    { "id": "check", "type": "script", "config": { "script": "output.ok = steps.fetch.status === 200;" } }
  ],
  "edges": [
    { "from": "wait", "to": "fetch" },
    { "from": "fetch", "to": "check" }
  ]
}
```

</details>

<details>
<summary><strong>📊 Header Rate Limit</strong></summary>

Setiap response dari endpoint yang terproteksi menyertakan header berikut:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1720000000
```

Jika melebihi limit (100 request/menit per tenant):
```
HTTP 429 Too Many Requests
{"statusCode": 429, "message": "Rate limit exceeded. Try again in X seconds."}
```

</details>

---

## 🧪 Panduan Testing Manual (Browser)

> Panduan ini memandu Anda melalui seluruh fitur FlowForge secara end-to-end melalui browser, tanpa perlu alat tambahan.

<details>
<summary><strong>Tahap 1: Registrasi & Login Akun Tenant</strong></summary>

1. Buka browser dan navigasi ke **`http://localhost:5173`**
2. Pilih tab **"Create Account"** (Register)
3. Isi formulir:
   - **Organization Name:** `Acme Corp`
   - **Slug (ID unik):** `acme-corp`
   - **Email:** `admin@acme.com`
   - **Password:** `Password123!`
4. Klik **"Create Account"**
5. ✅ Berhasil jika: diredirect ke halaman **Dashboard** dan muncul nama tenant di sidebar

</details>

<details>
<summary><strong>Tahap 2: Melihat System Health Dashboard</strong></summary>

1. Setelah login, Anda berada di halaman **Dashboard**
2. Perhatikan 4 kartu statistik agregat 24 jam:
   - **Active Runs** — jumlah run yang sedang berjalan
   - **Success Rate** — persentase run berhasil
   - **Avg Duration** — rata-rata durasi eksekusi (ms)
   - **Total Runs** — total run dalam 24 jam terakhir
3. Di bagian bawah, terdapat daftar **Recent Runs** (awalnya kosong)
4. ✅ Data di-cache selama 30 detik, refresh otomatis setiap 30 detik

</details>

<details>
<summary><strong>Tahap 3: Membuat Workflow via AI Natural Language Builder</strong></summary>

1. Klik **"AI Builder"** di sidebar kiri
2. Di kolom **"Describe Your Workflow"**, ketik prompt dalam bahasa alami:
   > *"Tunggu 2 detik, kemudian ambil data dari https://httpbin.org/get, dan gunakan script untuk mengecek apakah status responsenya 200"*
3. Klik tombol **"✨ Generate DAG"**
4. Tunggu beberapa detik — sistem akan:
   - Mengirim prompt ke Gemini API
   - Menerima DAG JSON terstruktur
   - Memvalidasi DAG (cycle detection, node type check)
   - Menampilkan hasil di panel kanan
5. Review nodes yang dihasilkan di panel kanan
6. Klik **"💾 Save as Workflow"**, masukkan nama: `Order Check Pipeline`
7. ✅ Berhasil jika: muncul notifikasi sukses dan workflow tersimpan

</details>

<details>
<summary><strong>Tahap 4: Mengelola & Men-trigger Workflow</strong></summary>

1. Klik **"Workflows"** di sidebar
2. Anda akan melihat kartu workflow yang baru dibuat dengan info:
   - Nama workflow
   - Versi aktif (`v1`)
   - Jumlah step
3. Klik tombol **"▶ Trigger"** pada kartu workflow
4. ✅ Berhasil jika: muncul notifikasi "Run started!" dan status berubah menjadi `queued`

</details>

<details>
<summary><strong>Tahap 5: Memantau Eksekusi Real-Time</strong></summary>

1. Klik **"Run History"** di sidebar
2. Pilih run terbaru dari daftar di panel kiri
3. Di panel tengah, grafik DAG akan dirender menggunakan **React Flow**
4. Amati perubahan warna node secara real-time (via WebSocket):
   - **Abu-abu** = `pending` (belum berjalan)
   - **Kuning/Amber** = `running` (sedang berjalan)
   - **Hijau** = `success` (berhasil)
   - **Merah** = `failed` (gagal)
5. Di bagian bawah, panel **"Execution Logs"** menampilkan log real-time dari MongoDB:
   - Timestamp setiap event
   - Durasi per step
   - Detail error jika ada
6. ✅ Berhasil jika: node berubah warna tanpa perlu refresh halaman

</details>

<details>
<summary><strong>Tahap 6: Membuat Versi Baru & Rollback</strong></summary>

1. Kembali ke halaman **"Workflows"**
2. Klik **"Edit"** pada workflow Anda
3. Tambahkan step baru atau ubah konfigurasi step yang ada
4. Klik **"Save"** — sistem otomatis membuat **versi baru** (`v2`)
5. Klik **"Versions"** untuk melihat riwayat versi
6. Klik **"Rollback"** pada `v1` untuk kembali ke versi sebelumnya
7. ✅ Berhasil jika: `current_version_id` kembali ke versi 1

</details>

<details>
<summary><strong>Tahap 7: Uji Isolasi Multi-Tenant</strong></summary>

1. Buka tab browser baru / mode incognito
2. Navigasi ke **`http://localhost:5173`** dan buat akun tenant baru:
   - **Organization Name:** `Beta Company`
   - **Slug:** `beta-company`
   - **Email:** `admin@beta.com`
   - **Password:** `Password123!`
3. Login sebagai `admin@beta.com`
4. ✅ Berhasil jika: Anda **tidak melihat** workflow milik `Acme Corp` di daftar workflow tenant Beta — membuktikan isolasi tenant bekerja

</details>

<details>
<summary><strong>Tahap 8: Uji Rate Limiting</strong></summary>

Buka terminal dan jalankan perintah berikut (pastikan `ACCESS_TOKEN` sudah diisi):

```bash
# Kirim 105 request berturut-turut
for i in {1..105}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    http://localhost:3000/api/v1/workflows)
  echo "Request $i: $STATUS"
done
```

✅ Berhasil jika: request ke-101 dan seterusnya mengembalikan `HTTP 429 Too Many Requests`

</details>

---

## 🔄 CI/CD Pipeline

Pipeline CI berjalan otomatis setiap `push` ke branch `master`, `main`, atau `develop`, dan setiap Pull Request ke `master`/`main`.

```
Push / PR
   │
   ▼
┌──────────┐    ┌──────────────────────┐    ┌────────────────┐    ┌──────────────────────┐
│  1. Lint  │───▶│  2. Unit & E2E Tests  │───▶│  3. TS Build   │───▶│  4. Docker Build+Push │
│  ESLint   │    │  Jest + Prisma migrate│    │  nest build    │    │  ghcr.io/api:sha     │
└──────────┘    └──────────────────────┘    └────────────────┘    └──────────────────────┘
                    (PostgreSQL + MongoDB
                     + Redis via Services)
```

<details>
<summary><strong>📄 Detail Setiap Job CI (klik untuk expand)</strong></summary>

**Job 1: Lint**
- Node.js 22, npm ci
- Menjalankan ESLint pada seluruh source TypeScript

**Job 2: Unit & Integration Tests**
- Spin up PostgreSQL 16, MongoDB 7, Redis 7 sebagai GitHub Actions Service
- Jalankan Prisma migrations: `npx prisma migrate deploy`
- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e` (Auth, Workflows, Tenant Isolation, Trigger, Rate Limit)

**Job 3: TypeScript Build**
- `npm run build` → compile TypeScript ke `dist/`
- Memastikan tidak ada type error

**Job 4: Docker Build & Push** *(hanya di master/main)*
- Build multi-stage Docker image
- Push ke GitHub Container Registry: `ghcr.io/himdeunn/flowforge/api:latest` dan `ghcr.io/himdeunn/flowforge/api:{sha}`

</details>

---

## 🗄️ Database Design

<details>
<summary><strong>PostgreSQL Schema — 6 Model Relasional (klik untuk expand)</strong></summary>

```
tenants ───────────────────────────────────────────────────
├── id              uuid (PK)
├── name            varchar(255) NOT NULL
├── slug            varchar(100) UNIQUE NOT NULL
└── created_at      timestamptz DEFAULT now()

users ──────────────────────────────────────────────────────
├── id              uuid (PK)
├── tenant_id       uuid (FK → tenants.id)
├── email           varchar(255) NOT NULL
├── password_hash   varchar(255) NOT NULL
├── role            enum(admin, editor, viewer)
├── created_at      timestamptz DEFAULT now()
└── UNIQUE(tenant_id, email)

workflow_definitions ───────────────────────────────────────
├── id                  uuid (PK)
├── tenant_id           uuid (FK → tenants.id)
├── name                varchar(255) NOT NULL
├── description         text
├── current_version_id  uuid (FK → workflow_versions.id) nullable
├── webhook_token       varchar(64) UNIQUE nullable
├── cron_expression     varchar(100) nullable
├── is_active           boolean DEFAULT true
├── created_by          uuid (FK → users.id)
├── created_at          timestamptz
└── updated_at          timestamptz

workflow_versions ──────────────────────────────────────────
├── id              uuid (PK)
├── workflow_id     uuid (FK → workflow_definitions.id)
├── version_number  integer NOT NULL
├── definition_json jsonb NOT NULL        ← DAG: nodes[] + edges[]
├── created_by      uuid (FK → users.id)
├── created_at      timestamptz
└── UNIQUE(workflow_id, version_number)

workflow_runs ──────────────────────────────────────────────
├── id              uuid (PK)
├── workflow_id     uuid (FK → workflow_definitions.id)
├── version_id      uuid (FK → workflow_versions.id)
├── tenant_id       uuid (FK → tenants.id)
├── status          enum(queued, running, completed, failed, timed_out)
├── triggered_by    enum(manual, cron, webhook)
├── started_at      timestamptz
├── completed_at    timestamptz
└── INDEX(tenant_id, created_at DESC)     ← optimasi run history query

step_runs ──────────────────────────────────────────────────
├── id          uuid (PK)
├── run_id      uuid (FK → workflow_runs.id)
├── step_id     varchar(100) NOT NULL     ← node.id dari DAG
├── status      enum(pending, running, success, failed, timed_out, skipped)
├── attempts    integer DEFAULT 0
├── started_at  timestamptz
└── completed_at timestamptz
```

</details>

<details>
<summary><strong>MongoDB Collection — Execution Logs (klik untuk expand)</strong></summary>

```
Collection: execution_logs
Indexes: { runId: 1, stepId: 1, timestamp: -1 }

Document Schema:
{
  "_id":       ObjectId,
  "runId":     string,      // FK ke workflow_runs.id
  "stepId":    string,      // node.id dari DAG
  "level":     "info" | "warn" | "error",
  "message":   string,
  "data":      object,      // Output/error detail, fleksibel per step type
  "attempt":   number,      // Attempt ke-berapa (untuk retry)
  "timestamp": Date
}
```

**Alasan MongoDB untuk log:** Volume tinggi, write-heavy, skema output per step-type berbeda-beda (HTTP step punya `statusCode`/`headers`, script step punya `output`, delay step punya `durationMs`). Tidak ada JOIN kompleks yang diperlukan. Lebih efisien disimpan sebagai dokumen append-only.

</details>

---

## 🤖 Fitur AI — Natural Language Builder

<details>
<summary><strong>Cara Kerja Internal (klik untuk expand)</strong></summary>

```
User Input (deskripsi teks)
       │
       ▼
POST /api/v1/ai/generate-workflow
       │
       ▼
┌─────────────────────────────────────────┐
│  AI Service                             │
│  1. Format prompt dengan template       │
│     yang menyertakan:                   │
│     - Jenis step yang valid             │
│     - Format JSON yang diharapkan       │
│     - Contoh DAG valid                  │
│  2. Kirim ke Gemini 2.5 Flash           │
│     (dengan key rotation otomatis)      │
│  3. Parse response JSON                 │
│  4. Validasi dengan DAG Parser          │
│     (cycle detection, type check)       │
│  5. Jika invalid → retry hingga 2x      │
│  6. Jika masih invalid → return 422     │
└─────────────────────────────────────────┘
       │
       ▼
Response: DAG JSON valid
```

**Tipe Step yang Didukung:**
| Tipe | Konfigurasi |
|---|---|
| `http` | `url`, `method`, `headers`, `body` |
| `script` | `script` (JavaScript sandboxed) |
| `delay` | `durationMs` |
| `condition` | `expression` (evaluasi `steps.stepId.output.field`) |

**Rotasi API Key Otomatis:**
Sistem mengelola array dari `GEMINI_API_KEY` hingga `GEMINI_API_KEY_5`. Jika satu key terkena rate limit (HTTP 429 dari Gemini API), sistem otomatis beralih ke key berikutnya, tanpa interupsi bagi pengguna.

</details>

---

## 📡 WebSocket Real-Time Events

Koneksi WebSocket menggunakan Socket.IO di endpoint `/ws`.

<details>
<summary><strong>Detail Event & Room Structure (klik untuk expand)</strong></summary>

**Join Room:**
```javascript
// Client join room untuk memantau run tertentu
socket.emit('join:run', { runId: 'uuid-run-id' });
```

**Events yang Dikirim Server:**
| Event | Payload | Keterangan |
|---|---|---|
| `run:started` | `{ runId, workflowId, startedAt }` | Run dimulai, status berubah ke `running` |
| `step:status_changed` | `{ runId, stepId, status, attempt }` | Step berubah status |
| `run:completed` | `{ runId, completedAt, duration }` | Seluruh run berhasil |
| `run:error` | `{ runId, stepId, error, failedAt }` | Run gagal pada step tertentu |

**Room Naming Convention:**
```
tenant:{tenantId}:run:{runId}
```
Contoh: `tenant:550e8400-e29b-41d4-a716-446655440000:run:6ba7b810-9dad-11d1-80b4-00c04fd430c8`

**Contoh Koneksi (JavaScript):**
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'Bearer eyJ...' }
});

socket.emit('join:run', { runId: 'your-run-id' });

socket.on('step:status_changed', (data) => {
  console.log(`Step ${data.stepId} → ${data.status}`);
  // Update node color di React Flow
});
```

</details>

---

## ⚖️ Trade-offs & Rencana Perbaikan

| Area | Keputusan Saat Ini | Trade-off | Rencana Perbaikan |
|---|---|---|---|
| **Script Sandboxing** | Node.js `vm` module | Ringan, tapi tidak mencegah sandbox breakout sepenuhnya | Migrate ke `isolated-vm` untuk production security |
| **WebSocket Auth** | Join room via `runId` query param | Mudah diimplementasikan, kurang aman | Validasi Bearer token di WebSocket handshake |
| **Refresh Token Storage** | Redis (bukan httpOnly cookie) | Lebih mudah di-test, tapi lebih rentan XSS jika client tidak hati-hati | Migrate ke httpOnly cookie + CSRF token |
| **Rate Limiting** | Manual Redis sliding window | Full kontrol per-tenant, tapi lebih banyak kode | Pertimbangkan `@nestjs/throttler` dengan custom storage adapter |
| **Worker Process** | In-process di development | Mudah deploy, tapi tidak bisa scale worker terpisah | Di production: container `worker` terpisah (sudah ada di docker-compose) |
| **Cron Scheduling** | Disimpan sebagai `cron_expression` di DB | Cron hanya trigger jika API/worker berjalan | Pertimbangkan BullMQ repeatable jobs atau dedicated scheduler |
| **Frontend Styling** | Vanilla CSS custom tokens | Performa optimal, tidak perlu build step Tailwind | Dapat dimigrasi ke Tailwind dengan mengganti class utility |

---

## 📝 Keputusan Implementasi

Setiap keputusan yang menyimpang dari PRD atau menambahkan detail implementasi yang tidak eksplisit disebutkan di PRD didokumentasikan di [`CHANGELOG-DECISIONS.md`](./CHANGELOG-DECISIONS.md).

<details>
<summary><strong>Ringkasan Keputusan Utama (klik untuk expand)</strong></summary>

| Task | Keputusan | Alasan Singkat |
|---|---|---|
| Task 1.1 | Node.js 22 (bukan 20 sesuai PRD) | Node 22 tersedia di mesin dev, CI diselaraskan ke versi yang sama |
| Task 1.1 | Laragon untuk DB dev (bukan Docker) | Docker WSL2 lambat untuk hot-reload |
| Task 1.2 | JSONB (bukan JSON biasa) | Mendukung indexing dan query lebih efisien |
| Task 2.1 | Refresh token di Redis | Lebih mudah di-invalidate & di-test dibanding httpOnly cookie |
| Task 2.2 | `vm` module untuk script step | `isolated-vm` butuh native binding yang sulit di semua deployment |
| Task 2.4 | BullMQ via host/port config | Menghindari TypeScript conflict dua versi ioredis |
| Task 2.5 | Prisma Proxy (bukan middleware) | Lebih transparan, tidak perlu register per-model |
| Task 2.6 | Redis sliding window manual | `@nestjs/throttler` tidak support custom key per-tenant |
| Task 3.2 | Vanilla CSS (bukan Tailwind) | Custom token lebih cepat untuk assessment, tidak ada trade-off fungsional |
| Task 3.6 | CI NODE_VERSION dari 20 ke 22 | npm v11 (Node 22) menghasilkan lockfile format berbeda dengan npm v10 (Node 20) |

Lihat [`CHANGELOG-DECISIONS.md`](./CHANGELOG-DECISIONS.md) untuk detail penuh setiap keputusan.

</details>

---

<div align="center">

**FlowForge** — Dibangun dengan ❤️ untuk Technical Assessment Sevima

*NestJS · React · PostgreSQL · MongoDB · Redis · BullMQ · Socket.IO · Gemini AI*

</div>
