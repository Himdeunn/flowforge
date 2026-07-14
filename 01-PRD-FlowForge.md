# Product Requirements Document (PRD)
## FlowForge — Real-Time Multi-Tenant Workflow Orchestration Engine

| | |
|---|---|
| **Dokumen** | PRD Implementasi (Assessment Project) — v2.0 (Extended) |
| **Konteks** | Technical Assessment — Fullstack Engineer Internship |
| **Deadline Submission** | 18 Juli 2026, 23:59 WIB |
| **Durasi Pengerjaan** | 4 hari (14–18 Juli 2026) |
| **Sumber** | Software_Engineer_v2.pdf — "Build a Real-Time Multi-Tenant Workflow Orchestration Engine" |
| **Dokumen Terkait** | `02-INSTALL-GUIDE.md`, `03-AGENT-EXECUTION-GUIDE.md` |
| **Status** | Draft v2.0 |

> **Catatan tentang versi ini:** Dokumen ini adalah versi diperluas dari PRD v1.0. Penambahan utama: spesifikasi API endpoint per-route, skema database lengkap (kolom, tipe, constraint), kontrak event WebSocket, formula retry/backoff eksplisit, struktur folder proyek, daftar environment variable, strategi testing per layer, spesifikasi prompt AI, dan appendix contoh payload. Dokumen ini dirancang agar bisa dieksekusi langsung oleh AI coding agent (lihat `03-AGENT-EXECUTION-GUIDE.md`) tanpa perlu interpretasi tambahan.

---

## Daftar Isi

1. Ringkasan & Konteks
2. Problem Statement
3. Goals
4. Non-Goals
5. Keputusan Teknis (Tech Decisions)
6. Arsitektur Sistem
7. Struktur Folder Proyek
8. User Personas & Role
9. Requirements Detail (A–G)
10. Spesifikasi API Endpoint
11. Skema Database Lengkap
12. Kontrak Real-Time (WebSocket Events)
13. Spesifikasi Fitur AI (Prompt Engineering)
14. Environment Variables
15. Strategi Testing
16. Keamanan (Security Considerations)
17. Rencana Fase 4 Hari
18. Open Questions
19. Risiko & Mitigasi
20. Definition of Done
21. Appendix

---

## 1. Ringkasan & Konteks

FlowForge adalah proyek assessment yang mensimulasikan peran *founding engineer* di startup yang membangun platform otomasi workflow — kombinasi sederhana dari model eksekusi Zapier dan GitHub Actions. Assessment ini dievaluasi dari 7 dimensi kompetensi teknis (Core Programming, Networking & Security, System Design, Database, DevOps, Software Engineering Practices, dan Emerging Tech/AI).

PRD ini disusun dengan dua tujuan:
1. **Sebagai kontrak scope** — memastikan setiap requirement dari dokumen assessment terpetakan ke deliverable konkret yang bisa diverifikasi.
2. **Sebagai spesifikasi yang bisa dieksekusi AI agent** — cukup detail (skema, kontrak API, kontrak event) sehingga AI coding agent (mis. di Antigravity IDE) dapat membangun sistem tanpa perlu menebak keputusan desain yang belum diputuskan manusia.

---

## 2. Problem Statement

Evaluator ingin menilai apakah kandidat mampu:
1. Merancang dan mengimplementasikan sistem backend non-trivial (DAG execution engine) dari nol.
2. Membangun API multi-tenant yang aman dan scalable.
3. Membuat dashboard real-time yang mengonsumsi data live dari backend.
4. Mengambil keputusan data-layer yang masuk akal dan menjustifikasinya.
5. Berpikir operasional (deployment, CI/CD, observability).
6. Menulis kode dan proses kerja yang mencerminkan praktik tim engineering sungguhan.
7. Mengintegrasikan AI secara bertanggung jawab.

Risiko utama: waktu habis di satu bagian sehingga bagian lain tidak sempat dikerjakan — rubrik menilai **breadth** di 7 dimensi, bukan hanya kedalaman di satu area.

---

## 3. Goals

| # | Goal | Indikator Keberhasilan |
|---|------|------------------------|
| G1 | Engine dapat mengeksekusi DAG workflow riil dengan dependency, paralelisme, retry, dan timeout | Minimal 1 workflow contoh (≥5 step, ada percabangan) berhasil dieksekusi end-to-end |
| G2 | API multi-tenant aman dan terisolasi | 2 tenant berbeda tidak bisa saling mengakses data via API test otomatis |
| G3 | Dashboard menampilkan status eksekusi real-time | Step "menyala" di UI dalam <2 detik dari perubahan state di backend |
| G4 | Skema data + strategi log terjustifikasi | README/infra doc menjelaskan trade-off eksplisit |
| G5 | Seluruh stack bisa dijalankan lokal dengan 1 perintah | `docker-compose up` menghasilkan sistem berfungsi tanpa setup manual |
| G6 | Kode mencerminkan praktik tim profesional | Git history bermakna, PR ternavigasi, REVIEW.md, test suite jalan di CI |
| G7 | Fitur AI berfungsi dan tahan output cacat | Ada fallback/validasi ketika LLM mengembalikan JSON tidak valid |
| G8 *(baru)* | Sistem observable | Setiap request punya `request_id` yang bisa ditelusuri di log |
| G9 *(baru)* | Dokumentasi API dapat diuji tanpa membaca kode | Tersedia collection Postman/Insomnia atau OpenAPI spec (Swagger UI) |

---

## 4. Non-Goals

| Non-Goal | Alasan |
|---|---|
| Production-grade auto-scaling nyata di cloud | Cukup didokumentasikan di infra design doc |
| Billing, notifikasi email, integrasi pihak ketiga | Tidak diminta rubrik; risiko scope creep |
| GraphQL endpoint | Bonus — dikerjakan hanya jika P0–P1 selesai |
| Desain visual mendalam/mobile-responsive penuh | Fungsional > estetika untuk assessment ini |
| Horizontal scaling nyata (multi-instance worker teruji) | Cukup dirancang stateless, tidak perlu load test |
| Fitur AI kedua/ketiga | Requirement hanya meminta satu fitur AI |
| Custom auth provider/SSO | JWT + RBAC sudah cukup |
| Internationalization (i18n) | Tidak relevan untuk assessment |
| Soft-delete / audit trail penuh di semua tabel | Cukup di tabel kritikal (`workflow_definitions`) |

---

## 5. Keputusan Teknis (Tech Decisions)

| Layer | Pilihan | Justifikasi Singkat |
|---|---|---|
| Bahasa | TypeScript (backend & frontend) | Type-safety lintas layer, mengurangi bug kontrak data |
| Backend Framework | NestJS | Struktur modular (module/controller/service/DTO) mempercepat implementasi RBAC & validation secara rapi |
| Execution Engine | Custom DAG executor (in-process) + job queue via **BullMQ** | Redis sebagai broker ringan untuk async job, delay, dan retry/backoff bawaan |
| Database Relasional | **PostgreSQL** via **Prisma ORM** | Cocok untuk skema tenant/user/workflow/version yang relasional & butuh transaksi ACID |
| Store Log Eksekusi | **MongoDB** (append-only collection) | Volume tinggi, write-heavy, skema fleksibel per step-type, tidak butuh JOIN kompleks |
| Cache & Broker | **Redis** | Dipakai BullMQ untuk queue, juga untuk rate limiting (sliding window counter) |
| Real-time Channel | **Socket.IO** (WebSocket + fallback polling otomatis) | Bi-directional event step-status lebih mudah di-setup dibanding SSE mentah |
| Frontend Framework | **React 18** + **Vite** + TypeScript | Build cepat, HMR baik untuk iterasi 4 hari |
| Styling | **TailwindCSS** | Kecepatan styling tanpa menulis CSS terpisah |
| DAG Visualization | **React Flow** | Library siap pakai untuk render graph node/edge |
| State/Data Fetching FE | **TanStack Query (React Query)** | Caching, optimistic update, refetch otomatis |
| Auth | **JWT** (access token 15 menit + refresh token 7 hari) + RBAC middleware | Sesuai requirement tanpa kompleksitas SSO |
| Validasi Input | **class-validator** + **class-transformer** (DTO) di NestJS, **Zod** di frontend form | Konsisten dengan pattern validasi berlapis |
| AI Feature | Natural Language Workflow Builder via **Google Gemini API** (`gemini-2.5-flash`) | Response cepat, structured output JSON mode, biaya rendah untuk demo |
| Container | Docker multi-stage build + docker-compose | Sesuai requirement Bagian E |
| CI | GitHub Actions | Sesuai requirement Bagian E |
| API Docs | **Swagger/OpenAPI** (auto-generate dari decorator NestJS) | Memenuhi G9 tanpa effort ekstra manual |

---

## 6. Arsitektur Sistem

```
                                   ┌─────────────────────┐
                                   │   React Dashboard    │
                                   │ (Vite + TailwindCSS) │
                                   └──────────┬───────────┘
                                              │ REST + WebSocket
                                              ▼
                          ┌───────────────────────────────────┐
                          │        NestJS API Gateway          │
                          │  - Auth (JWT) & RBAC middleware    │
                          │  - Tenant isolation guard           │
                          │  - Rate limiting (Redis)            │
                          │  - REST controllers (CRUD, trigger) │
                          │  - WebSocket gateway (Socket.IO)    │
                          └───────┬──────────────┬─────────────┘
                                  │              │
                     ┌────────────▼───┐   ┌──────▼─────────────┐
                     │  PostgreSQL     │   │   BullMQ (Redis)    │
                     │  (Prisma ORM)   │   │   Job Queue          │
                     │  tenants, users,│   │   - workflow-exec     │
                     │  workflows,     │   │   - retry/backoff      │
                     │  versions, runs │   └──────┬──────────────┘
                     └─────────────────┘          │
                                                   ▼
                                      ┌─────────────────────────┐
                                      │  DAG Execution Worker     │
                                      │  - Parse & topo-sort DAG  │
                                      │  - Execute step by type    │
                                      │    (http/script/delay/cond)│
                                      │  - Emit WS event per step  │
                                      └───────┬───────────┬───────┘
                                              │           │
                                 ┌────────────▼──┐   ┌────▼─────────────┐
                                 │   MongoDB      │   │  External calls   │
                                 │ (execution     │   │  (HTTP step target,│
                                 │  logs, append-  │   │   Gemini API)      │
                                 │  only)          │   └────────────────────┘
                                 └─────────────────┘
```

**Alur trigger workflow (ringkas):**
1. Client (manual/cron/webhook) → `POST /workflows/:id/trigger`
2. API membuat `workflow_run` (status `queued`) di Postgres → push job ke BullMQ
3. Worker mengambil job → parse DAG dari `workflow_definitions` versi terkait → topological sort
4. Worker eksekusi step sesuai urutan/paralelisme → tiap perubahan status step: (a) tulis log ke MongoDB, (b) update `step_runs` di Postgres, (c) emit event WebSocket ke room `tenant:{tenantId}:run:{runId}`
5. Dashboard yang subscribe ke room tersebut menerima event dan merender ulang node DAG secara real-time

---

## 7. Struktur Folder Proyek

```
flowforge/
├── apps/
│   ├── api/                      # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/              # JWT strategy, guards, RBAC decorator
│   │   │   ├── tenants/
│   │   │   ├── users/
│   │   │   ├── workflows/         # CRUD + versioning
│   │   │   ├── runs/              # trigger, status, history
│   │   │   ├── execution/         # DAG parser, topo-sort, executor core
│   │   │   ├── queue/             # BullMQ producer/consumer setup
│   │   │   ├── websocket/         # Socket.IO gateway
│   │   │   ├── ai/                # NL workflow builder module
│   │   │   ├── common/            # pipes, filters, interceptors, guards
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/                  # unit + integration tests
│   │   └── Dockerfile
│   └── web/                      # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── dag-canvas/    # React Flow wrapper
│       │   │   ├── run-history/
│       │   │   └── health-panel/
│       │   ├── pages/
│       │   ├── hooks/             # useWorkflowSocket, useAuth, dll.
│       │   ├── lib/               # api client, socket client
│       │   └── main.tsx
│       ├── e2e/                   # Playwright/Cypress E2E test
│       └── Dockerfile
├── .github/
│   └── workflows/
│       └── ci.yml
├── docker-compose.yml
├── REVIEW.md
├── README.md
├── 01-PRD-FlowForge.md
├── 02-INSTALL-GUIDE.md
├── 03-AGENT-EXECUTION-GUIDE.md
└── docs/
    └── infra-design.md
```

---

## 8. User Personas & Role

| Role | Deskripsi | Akses |
|---|---|---|
| **Admin** | Pemilik/pengelola tenant | Full CRUD workflow, kelola user & role, lihat semua run |
| **Editor** | Anggota tim yang membangun workflow | CRUD workflow miliknya, trigger run, tidak bisa kelola user |
| **Viewer** | Stakeholder yang hanya memantau | Read-only: workflow, run history, dashboard |

**User Stories inti:**
- Sebagai **Admin**, saya ingin mengatur role anggota tim agar kontrol akses sesuai tanggung jawab.
- Sebagai **Editor**, saya ingin mendefinisikan workflow sebagai DAG dan menjalankannya manual/terjadwal/webhook.
- Sebagai **Editor**, saya ingin rollback ke versi workflow sebelumnya jika versi baru gagal.
- Sebagai **Viewer**, saya ingin melihat status eksekusi real-time tanpa akses teknis.
- Sebagai **Editor**, saya ingin retry otomatis dengan backoff saat step gagal sementara.
- Sebagai pengguna non-teknis, saya ingin mendeskripsikan workflow dalam bahasa natural dan sistem menghasilkan draf DAG.
- Sebagai **Admin**, saya ingin melihat health panel agregat 24 jam terakhir untuk memantau kesehatan sistem.
- Sebagai **Editor**, saya ingin webhook trigger memverifikasi signature/token agar tidak sembarang pihak bisa memicu workflow saya.

---

## 9. Requirements Detail (A–G)

### A. Workflow Definition & Execution Engine — P0

- [ ] Skema definisi workflow JSON: node bertipe `http`, `script`, `delay`, `condition`; edge = dependency antar step
- [ ] Parser + validator DAG: deteksi cycle (DFS 3-warna), node orphan, tipe step tidak dikenal → error sebelum eksekusi dimulai
- [ ] Topological sort (Kahn's algorithm) untuk urutan eksekusi
- [ ] Executor: step tanpa dependensi silang berjalan paralel (`Promise.all` per "layer" topological), step berdependensi sequential
- [ ] Retry per-step: exponential backoff — formula `delay = baseDelayMs * 2^attempt`, dibatasi `maxDelayMs`; `maxRetries` dikonfigurasi per step (default 3)
- [ ] Global workflow timeout: default 15 menit, dikonfigurasi per workflow; saat timeout tercapai, step yang masih `running` ditandai `timed_out`, workflow ditandai `timed_out`
- [ ] Step type `condition`: mengevaluasi ekspresi sederhana (mis. `{{steps.stepA.output.status}} == 200`) untuk menentukan branch mana yang dilanjutkan

**Acceptance Criteria:**
- Given DAG A→B, A→C, B&C→D, When dijalankan, Then B & C berjalan paralel, D menunggu keduanya.
- Given step `maxRetries: 3`, When gagal terus, Then dicoba 3x dengan delay meningkat, lalu `failed`.
- Given workflow dengan cycle A→B→A, When divalidasi, Then request ditolak `400` sebelum eksekusi dibuat.

### B. Multi-Tenant API Layer — P0

- [ ] REST CRUD workflow + versioning (setiap update → row baru di `workflow_versions`, `workflow_definitions.current_version_id` diupdate)
- [ ] Trigger: manual (`POST /trigger`), cron (disimpan sebagai cron expression, dieksekusi oleh scheduler terpisah — BullMQ repeatable job), webhook (`POST /webhooks/:webhookToken/trigger`, diverifikasi via token + optional HMAC signature header)
- [ ] Pagination cursor-based (`?cursor=...&limit=20`), filtering (`?status=failed&createdAfter=...`), rate limiting (default 100 req/menit per tenant, header `X-RateLimit-*`)
- [ ] Tenant isolation: `tenantId` **selalu** diambil dari JWT claim, tidak pernah dari body/query — di-enforce via NestJS Guard global (`TenantGuard`) + Prisma middleware yang otomatis menyuntikkan filter `tenantId` ke setiap query
- [ ] JWT auth (access + refresh) + RBAC decorator `@Roles('admin','editor')` per route
- [ ] Validasi & sanitasi: DTO class-validator di setiap endpoint, Prisma parameterized query (anti SQL injection by design)

### C. Real-Time Monitoring Dashboard — P0/P1

- [ ] (P0) Live status via WebSocket, room per run: `tenant:{tenantId}:run:{runId}`
- [ ] (P0) Visual DAG rendering (React Flow) dari `workflow_definitions.definition_json`
- [ ] (P0) Run history: list run + drill-down log per step (fetch dari MongoDB via API)
- [ ] (P1) Global health panel: active runs, success/failure rate, avg duration 24 jam (query agregat, di-cache 30 detik)
- [ ] (P1) Client-side caching (React Query, `staleTime` 10 detik) + optimistic update saat create/update workflow

### D. Data Layer — P0

- [ ] Skema relasional lengkap (lihat Bagian 11)
- [ ] Store log eksekusi terpisah: **MongoDB**, koleksi `execution_logs`, append-only, index pada `{runId, stepId, timestamp}`
- [ ] Query optimization: index composite `(tenant_id, created_at DESC)` pada `workflow_runs` untuk mempercepat run history; dibuktikan dengan `EXPLAIN ANALYZE` sebelum/sesudah index (lihat Appendix)
- [ ] Migration: contoh migrasi aman menambah kolom `webhook_token` ke `workflow_definitions` dengan `DEFAULT NULL` lalu backfill via script, baru diubah `NOT NULL` di migrasi berikutnya (expand-contract pattern)

### E. Infrastructure & Deployment — P0

- [ ] Dockerfile multi-stage backend: stage `builder` (install + compile TypeScript) → stage `runner` (copy `dist/` + `node_modules` production only, image based `node:20-alpine`)
- [ ] `docker-compose.yml`: services `api`, `worker` (proses terpisah untuk BullMQ consumer), `web`, `postgres`, `mongodb`, `redis`
- [ ] CI (`.github/workflows/ci.yml`): job `lint` → `test` (unit+integration) → `build` → `docker-build-push` (artifact, tag `:sha`)
- [ ] `docs/infra-design.md`: diagram AWS (ALB → ECS Fargate untuk `api` & `worker` terpisah, RDS Postgres Multi-AZ, ElastiCache Redis, DocumentDB/MongoDB Atlas, S3+CloudFront untuk frontend static, auto-scaling policy berbasis CPU & queue depth (custom CloudWatch metric dari BullMQ))

### F. Code Quality & Engineering Practices — P0

- [ ] Git history atomik (`feat:`, `fix:`, `test:`, `docs:` prefix — Conventional Commits), minimal 1 feature branch + PR self-authored dengan deskripsi
- [ ] Unit test: DAG parser (cycle detection, topo-sort), execution engine (retry/backoff logic, timeout)
- [ ] Integration test: API (auth flow, CRUD, isolasi tenant — test 2 tenant tidak saling bocor)
- [ ] E2E test: 1 skenario penuh — create workflow → trigger → poll/subscribe status → assert `completed`
- [ ] `REVIEW.md`: review kode cacat yang disediakan terpisah, format seperti komentar PR sungguhan (baris kode + kritik + saran perbaikan)
- [ ] `README.md`: setup instructions, architecture overview, trade-off & rencana perbaikan

### G. AI-Powered Enhancement — P0

**Dipilih: Natural Language Workflow Builder** — lihat spesifikasi detail di Bagian 13.

---

## 10. Spesifikasi API Endpoint

> Semua endpoint di-prefix `/api/v1`. Autentikasi via header `Authorization: Bearer <accessToken>` kecuali disebutkan publik.

### Auth
| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| POST | `/auth/register` | Publik | Registrasi tenant baru + user Admin pertama |
| POST | `/auth/login` | Publik | Login, return access + refresh token |
| POST | `/auth/refresh` | Publik (butuh refresh token valid) | Perbarui access token |
| POST | `/auth/logout` | Semua role | Invalidasi refresh token |

### Users
| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| GET | `/users` | Admin | List user dalam tenant (paginated) |
| POST | `/users/invite` | Admin | Undang user baru dengan role tertentu |
| PATCH | `/users/:id/role` | Admin | Ubah role user |
| DELETE | `/users/:id` | Admin | Hapus/nonaktifkan user |

### Workflows
| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| GET | `/workflows` | Semua role | List workflow (paginated, filter `?status=`) |
| POST | `/workflows` | Admin, Editor | Buat workflow baru (definisi DAG) |
| GET | `/workflows/:id` | Semua role | Detail workflow + versi aktif |
| PUT | `/workflows/:id` | Admin, Editor | Update workflow → buat versi baru |
| DELETE | `/workflows/:id` | Admin | Hapus workflow (soft-delete) |
| GET | `/workflows/:id/versions` | Semua role | List riwayat versi |
| POST | `/workflows/:id/versions/:versionId/rollback` | Admin, Editor | Rollback ke versi tertentu |
| POST | `/workflows/:id/trigger` | Admin, Editor | Trigger manual |
| POST | `/webhooks/:webhookToken/trigger` | Publik (token-verified) | Trigger via webhook |

### Runs
| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| GET | `/runs` | Semua role | List run (paginated, filter status/tanggal) |
| GET | `/runs/:id` | Semua role | Detail run + status per step |
| GET | `/runs/:id/logs` | Semua role | Log eksekusi per step (dari MongoDB) |
| GET | `/runs/health-summary` | Semua role | Agregat 24 jam: active, success rate, avg duration |

### AI
| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| POST | `/ai/generate-workflow` | Admin, Editor | Input: deskripsi natural language → Output: draf DAG JSON |

---

## 11. Skema Database Lengkap

### PostgreSQL (relasional — via Prisma)

```
tenants
├── id            uuid PK
├── name          varchar(255) not null
├── slug          varchar(100) unique not null
└── created_at    timestamptz default now()

users
├── id            uuid PK
├── tenant_id     uuid FK -> tenants.id
├── email         varchar(255) not null
├── password_hash varchar(255) not null
├── role          enum('admin','editor','viewer') not null
├── created_at    timestamptz default now()
└── UNIQUE(tenant_id, email)

workflow_definitions
├── id                 uuid PK
├── tenant_id          uuid FK -> tenants.id
├── name               varchar(255) not null
├── description        text
├── current_version_id uuid FK -> workflow_versions.id (nullable)
├── webhook_token       varchar(64) unique nullable
├── cron_expression     varchar(100) nullable
├── is_active           boolean default true
├── created_by          uuid FK -> users.id
├── created_at          timestamptz default now()
└── updated_at          timestamptz default now()

workflow_versions
├── id              uuid PK
├── workflow_id     uuid FK -> workflow_definitions.id
├── version_number  integer not null
├── definition_json jsonb not null      -- DAG: nodes[] + edges[]
├── created_by      uuid FK -> users.id
├── created_at      timestamptz default now()
└── UNIQUE(workflow_id, version_number)

workflow_runs
├── id            uuid PK
├── tenant_id     uuid FK -> tenants.id
├── workflow_id   uuid FK -> workflow_definitions.id
├── version_id    uuid FK -> workflow_versions.id
├── trigger_type  enum('manual','cron','webhook') not null
├── status        enum('queued','running','completed','failed','timed_out') not null
├── started_at    timestamptz nullable
├── completed_at  timestamptz nullable
├── created_at    timestamptz default now()
└── INDEX (tenant_id, created_at DESC)   -- query optimization target

step_runs
├── id            uuid PK
├── run_id        uuid FK -> workflow_runs.id
├── step_key      varchar(100) not null   -- id node di definition_json
├── status        enum('pending','running','success','failed','skipped','timed_out') not null
├── attempt       integer default 0
├── started_at    timestamptz nullable
├── completed_at  timestamptz nullable
└── INDEX (run_id, step_key)
```

### MongoDB (log eksekusi — append-only)

```
execution_logs (collection)
{
  _id: ObjectId,
  tenantId: string,
  runId: string,
  stepKey: string,
  attempt: number,
  level: "info" | "warn" | "error",
  message: string,
  payload: object,      // request/response step http, atau output script
  timestamp: ISODate
}
// Index: { runId: 1, stepKey: 1, timestamp: 1 }
// Index: { tenantId: 1, timestamp: -1 }
```

**Justifikasi pemisahan store:** `execution_logs` bervolume tinggi (bisa ribuan entri per run), bersifat write-once/append-only, skema `payload` bervariasi tergantung tipe step (tidak seragam seperti tabel relasional), dan query utamanya adalah "ambil semua log untuk 1 run" (tidak butuh JOIN lintas tabel). Menyimpannya di Postgres akan membengkakkan tabel transaksional utama dan memperlambat query OLTP (CRUD workflow, trigger run).

---

## 12. Kontrak Real-Time (WebSocket Events)

**Namespace:** `/ws/runs`
**Room:** client join room `tenant:{tenantId}:run:{runId}` setelah autentikasi socket dengan JWT.

| Event (server → client) | Payload | Kapan Dikirim |
|---|---|---|
| `run:started` | `{ runId, workflowId, startedAt }` | Saat worker mulai proses run |
| `step:status_changed` | `{ runId, stepKey, status, attempt, timestamp }` | Setiap kali status step berubah |
| `run:completed` | `{ runId, status, completedAt, durationMs }` | Saat seluruh DAG selesai (`completed`/`failed`/`timed_out`) |
| `run:error` | `{ runId, message }` | Error tak terduga di level worker |

| Event (client → server) | Payload | Deskripsi |
|---|---|---|
| `subscribe:run` | `{ runId }` | Join room untuk memantau run tertentu |
| `unsubscribe:run` | `{ runId }` | Leave room |

---

## 13. Spesifikasi Fitur AI (Prompt Engineering)

**Fitur:** Natural Language Workflow Builder
**Model:** Gemini 2.5 Flash, mode structured output (`responseMimeType: application/json` + `responseSchema`)

**System prompt (ringkasan strategi, bukan verbatim):**
- Definisikan peran model sebagai "asisten yang menerjemahkan deskripsi proses menjadi definisi DAG JSON yang valid sesuai skema FlowForge"
- Sertakan skema JSON target (nodes: id, type, config; edges: from, to) langsung di prompt sebagai constraint, bukan hanya contoh
- Sertakan 2–3 contoh few-shot: deskripsi singkat → output DAG JSON yang valid, mencakup tipe step berbeda (http, delay, condition)
- Instruksikan model untuk **hanya** mengeluarkan JSON, tanpa teks tambahan

**Penanganan token limit:**
- Deskripsi user dibatasi maksimal ~500 token sebelum dikirim (truncate dengan peringatan ke user jika melebihi)
- Riwayat/histori tidak disertakan (fitur ini stateless per-request) untuk menghindari akumulasi token

**Guard terhadap output cacat:**
1. Response LLM di-parse sebagai JSON — jika gagal parse → retry 1x dengan prompt korektif ("Output sebelumnya bukan JSON valid, perbaiki")
2. Jika berhasil parse, divalidasi terhadap JSON Schema (Zod/Ajv) yang sama dengan validator DAG di Bagian 9.A
3. Jika lolos schema tapi mengandung cycle → dijalankan lewat validator DAG yang sama seperti workflow manual (reuse kode, bukan reimplementasi)
4. Jika setelah 1x retry masih gagal → response ke user: `422` dengan pesan jelas ("AI tidak dapat menghasilkan workflow valid dari deskripsi ini, coba lebih spesifik") — **tidak** silent-fail atau menyimpan draf rusak
5. Draf yang lolos validasi **tidak langsung disimpan sebagai workflow aktif** — dikembalikan ke user sebagai preview untuk direview/diedit sebelum `POST /workflows` dipanggil manual oleh user

---

## 14. Environment Variables

```bash
# --- API (.env di apps/api) ---
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://flowforge:flowforge@localhost:5432/flowforge
MONGODB_URI=mongodb://localhost:27017/flowforge_logs
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=changeme-access-secret
JWT_REFRESH_SECRET=changeme-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GEMINI_API_KEY=your-gemini-api-key
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# --- Web (.env di apps/web) ---
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000/ws/runs
```

---

## 15. Strategi Testing

| Layer | Tool | Cakupan Minimum |
|---|---|---|
| Unit | Jest | DAG parser (cycle detection, topo-sort), retry/backoff calculator, RBAC guard logic |
| Integration | Jest + Supertest | Auth flow, CRUD workflow, tenant isolation (2 tenant test), rate limiting |
| E2E | Playwright (atau supertest end-to-end di backend jika waktu terbatas) | Create → trigger → subscribe WS → assert run `completed` |
| CI Gate | GitHub Actions | `lint` dan `test` harus lulus sebelum `build` job jalan |

---

## 16. Keamanan (Security Considerations)

- **Tenant isolation**: `tenantId` hanya dari JWT claim (server-trusted), tidak pernah dari input klien — dicegah lewat Prisma middleware global.
- **Password**: hash dengan bcrypt (cost factor 10+), tidak pernah dikembalikan di response API manapun.
- **Webhook**: token acak 32-byte per workflow + opsional HMAC-SHA256 signature di header untuk verifikasi payload.
- **Rate limiting**: sliding window counter di Redis per `tenantId` + per IP untuk endpoint publik (webhook, login).
- **Input validation**: DTO whitelist (`forbidNonWhitelisted: true` di ValidationPipe NestJS) — field tak dikenal ditolak, bukan diabaikan.
- **Script step**: dijalankan dalam sandbox terbatas (mis. `vm2`/isolated child process dengan timeout) — **tidak** `eval` langsung di process utama.
- **Secrets**: seluruh secret via environment variable, tidak pernah hardcode atau ter-commit ke git (`.env` masuk `.gitignore`).
- **CORS**: whitelist origin frontend eksplisit, bukan `*`.

---

## 17. Rencana Fase 4 Hari

| Hari | Fokus | Output Konkret |
|---|---|---|
| **Hari 1 (14 Jul)** | Setup monorepo, Prisma schema + migration awal, DAG parser & topo-sort, unit test dasar | Repo terstruktur, engine bisa parse & urutkan DAG |
| **Hari 2 (15 Jul)** | Execution engine (paralel, retry, timeout) + REST API inti (auth, CRUD, RBAC, tenant isolation, rate limiting) | Workflow bisa dieksekusi via API, isolasi tenant teruji |
| **Hari 3 (16 Jul)** | WebSocket real-time, dashboard (DAG view, run history, health panel), Docker & docker-compose, CI pipeline | Sistem jalan penuh via `docker-compose up`, dashboard live update |
| **Hari 4 (17–18 Jul)** | Fitur AI, integration/E2E test, REVIEW.md, README, infra design doc, Swagger docs, buffer & polish | Submission lengkap sebelum 18 Juli 23:59 |

**Prinsip time-boxing:** jika akhir Hari 3 bagian P0 A–F belum selesai, fitur AI (G) dan item P1/P2 dikorbankan lebih dulu.

---

## 18. Open Questions

| Pertanyaan | Kategori | Blocking? |
|---|---|---|
| Apakah GraphQL endpoint benar-benar diharapkan, atau cukup disebut "tidak dikerjakan karena bonus"? | Scope | Tidak |
| Apakah file kode "flawed" untuk `REVIEW.md` sudah diberikan terpisah? | Proses | Ya — konfirmasi ke pemberi assessment |
| Batas biaya/API key LLM disediakan atau kandidat menyediakan sendiri? | Teknis | Ya |
| Format submission: repo Git publik, zip, atau platform tertentu? | Administratif | Ya |

---

## 19. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Waktu 4 hari terlalu sempit | Submission tidak lengkap | Ikuti timeline Bagian 17 ketat; breadth P0 dulu |
| WebSocket + DAG viz memakan waktu lebih dari estimasi | Dashboard C tidak selesai | Fallback polling HTTP jika WebSocket bermasalah |
| LLM output tidak konsisten | Fitur AI gagal demo | Structured output + JSON schema validation + retry korektif |
| Scope creep | Waktu habis di hal tidak dinilai | Rujuk kembali ke Bagian 4 (Non-Goals) |
| Sandbox script step under-engineered karena waktu sempit | Risiko keamanan/RCE | Batasi step `script` ke whitelist operasi sederhana (mis. transformasi data JSON) jika sandbox penuh tak sempat dibangun |

---

## 20. Definition of Done (Submission Checklist)

- [ ] Semua item P0 di Bagian 9 (A–G) selesai dan bisa didemokan
- [ ] `docker-compose up` menjalankan seluruh stack tanpa error dari fresh clone
- [ ] CI pipeline hijau di commit terakhir
- [ ] `README.md`, `REVIEW.md`, `docs/infra-design.md` ada di root repo
- [ ] Minimal 1 PR self-authored dengan deskripsi, di-merge ke branch utama
- [ ] Unit, integration, dan minimal 1 E2E test lulus
- [ ] Swagger/OpenAPI docs dapat diakses di `/api/docs`
- [ ] Fitur AI terhubung end-to-end dan tahan output cacat
- [ ] Submission dikirim sebelum 18 Juli 2026, 23:59 WIB

---

## 21. Appendix

### A. Contoh Definisi Workflow (DAG JSON)

```json
{
  "nodes": [
    { "id": "fetchData", "type": "http", "config": { "method": "GET", "url": "https://api.example.com/data" } },
    { "id": "wait", "type": "delay", "config": { "durationMs": 2000 } },
    { "id": "checkStatus", "type": "condition", "config": { "expression": "{{steps.fetchData.output.status}} == 200" } },
    { "id": "processData", "type": "script", "config": { "script": "transform.js" } }
  ],
  "edges": [
    { "from": "fetchData", "to": "wait" },
    { "from": "wait", "to": "checkStatus" },
    { "from": "checkStatus", "to": "processData" }
  ]
}
```

### B. Contoh EXPLAIN ANALYZE (Query Optimization Target)

```sql
-- Sebelum index
EXPLAIN ANALYZE
SELECT * FROM workflow_runs
WHERE tenant_id = '...' ORDER BY created_at DESC LIMIT 20;
-- Seq Scan on workflow_runs (cost tinggi jika baris banyak)

-- Setelah index
CREATE INDEX idx_runs_tenant_created ON workflow_runs (tenant_id, created_at DESC);

EXPLAIN ANALYZE
SELECT * FROM workflow_runs
WHERE tenant_id = '...' ORDER BY created_at DESC LIMIT 20;
-- Index Scan using idx_runs_tenant_created (cost jauh lebih rendah)
```

### C. Glosarium

| Istilah | Arti |
|---|---|
| DAG | Directed Acyclic Graph — graf berarah tanpa siklus, merepresentasikan urutan step workflow |
| Topological sort | Algoritma mengurutkan node graf sesuai dependensi |
| Backoff | Strategi menunda retry secara bertahap semakin lama |
| RBAC | Role-Based Access Control |
| Tenant | Satu organisasi/pelanggan yang datanya terisolasi dari tenant lain |

---

*Dokumen ini adalah PRD implementasi teknis, dirancang agar cukup detail untuk dieksekusi langsung oleh AI coding agent tanpa keputusan desain yang menggantung. Lihat `03-AGENT-EXECUTION-GUIDE.md` untuk instruksi eksekusi step-by-step.*
