# Agent Execution Guide — FlowForge

> **Untuk siapa dokumen ini:** dokumen ini ditulis untuk dibaca dan diikuti oleh **AI coding agent** (mis. agent di Antigravity IDE, Claude Code, Cursor Agent, atau sejenis) yang bertugas mengimplementasikan proyek FlowForge. Bahasa instruksi dibuat eksplisit dan tidak ambigu agar agent tidak perlu menebak keputusan yang belum diputuskan.
>
> **Urutan baca wajib:** `01-PRD-FlowForge.md` → `02-INSTALL-GUIDE.md` → dokumen ini. Jangan mulai menulis kode sebelum ketiga dokumen ini terbaca penuh.

---

## 0. System Prompt / Role Definition untuk Agent

Jika Antigravity IDE meminta system prompt/instruction awal untuk agent, gunakan teks berikut sebagai dasar (boleh disesuaikan formatnya sesuai UI Antigravity):

```
Kamu adalah senior fullstack engineer yang bertanggung jawab membangun FlowForge,
sebuah workflow orchestration engine multi-tenant, sesuai spesifikasi lengkap di
01-PRD-FlowForge.md. Kamu WAJIB mengikuti 03-AGENT-EXECUTION-GUIDE.md sebagai
protokol kerja: urutan task, definition of done, git convention, dan kapan harus
berhenti untuk bertanya ke manusia.

Prinsip utama:
1. Jangan pernah mengambil keputusan arsitektur yang bertentangan dengan PRD tanpa
   menyebutkan alasan dan meminta konfirmasi eksplisit.
2. Prioritaskan breadth (semua P0 di 7 dimensi) di atas depth (menyempurnakan satu
   bagian) — deadline 4 hari tidak memberi ruang untuk over-engineering satu modul.
3. Setiap task yang selesai harus disertai test yang membuktikan task tersebut benar,
   sesuai strategi testing di PRD Bagian 15.
4. Tulis commit message mengikuti Conventional Commits, satu commit = satu perubahan
   logis yang bisa direview sendiri.
5. Jika instruksi di PRD dan realita implementasi bertentangan (mis. library yang
   disebut ternyata deprecated), catat di CHANGELOG-DECISIONS.md dan lanjutkan
   dengan alternatif terdekat — jangan berhenti total, tapi jangan diam-diam
   menyimpang tanpa dicatat.
```

---

## 1. Prinsip Operasi Agent

1. **PRD adalah sumber kebenaran tunggal (single source of truth).** Jika ada bagian yang tidak jelas, agent boleh membuat asumsi masuk akal — tapi **wajib mendokumentasikan asumsi tersebut** di file `CHANGELOG-DECISIONS.md` (buat baru jika belum ada), bukan diam-diam memutuskan.
2. **Jangan skip langkah verifikasi.** Setiap task dianggap selesai hanya jika kriteria di Bagian 3 (Task Breakdown) terpenuhi, bukan hanya "kode sudah ditulis".
3. **Ikuti urutan task.** Task disusun agar dependency teknis terpenuhi (mis. skema database sebelum API, API sebelum frontend consume API). Jangan lompat ke task frontend sebelum backend endpoint terkait tersedia dan teruji minimal secara manual.
4. **Commit sering, kecil, dan bermakna.** Satu task besar di Bagian 3 boleh menghasilkan beberapa commit kecil — jangan satu commit raksasa berisi seluruh modul.
5. **Berhenti dan tanya user jika:**
   - Ada keputusan yang berdampak biaya nyata (mis. provisioning cloud sungguhan, bukan hanya dokumen desain)
   - Kredensial/API key dibutuhkan dan belum tersedia di `.env`
   - PRD dan permintaan user di chat saling bertentangan secara langsung
   - Waktu tersisa (menurut estimasi task) tidak cukup untuk menyelesaikan seluruh P0 — agent harus melaporkan status dan mengusulkan apa yang dikorbankan (rujuk PRD Bagian 4 Non-Goals & Bagian 19 Risiko)

---

## 2. Urutan Baca & Setup Awal (Wajib Sebelum Task 1)

- [ ] Baca `01-PRD-FlowForge.md` penuh, termasuk seluruh appendix
- [ ] Baca `02-INSTALL-GUIDE.md`, jalankan seluruh langkah verifikasi di Bagian 14 dokumen tersebut
- [ ] Buat struktur folder monorepo sesuai `01-PRD-FlowForge.md` Bagian 7
- [ ] Inisialisasi git repo (`git init`), buat `.gitignore` (Node, Docker, `.env`, `dist/`, `node_modules/`)
- [ ] Commit awal: `chore: initial project scaffold`
- [ ] Buat file `CHANGELOG-DECISIONS.md` kosong dengan header:
  ```markdown
  # Changelog Keputusan Implementasi

  Dokumen ini mencatat setiap keputusan yang menyimpang atau menambah detail
  di luar yang eksplisit tertulis di 01-PRD-FlowForge.md, beserta alasannya.

  | Tanggal | Task Terkait | Keputusan | Alasan |
  |---|---|---|---|
  ```
- [ ] Buat file `todo.md` di root dengan seluruh task Bagian 3 di bawah, format checkbox — agent **wajib mencentang** setiap task selesai dan commit perubahan `todo.md` bersamaan dengan task terkait

---

## 3. Task Breakdown (Eksekusi Berurutan)

> Setiap task mencantumkan: **Referensi PRD**, **Output**, **Definition of Done**, **Test wajib**. Agent tidak boleh menandai task selesai tanpa memenuhi seluruh Definition of Done.

### FASE 1 — Fondasi (target: Hari 1)

**Task 1.1 — Setup Backend Skeleton**
- Referensi: PRD §5, §7
- Output: `apps/api` ter-inisialisasi NestJS, struktur folder module sesuai §7
- DoD: `npm run start:dev` di `apps/api` berjalan tanpa error, endpoint health-check (`GET /api/v1/health`) return `200`
- Test: -

**Task 1.2 — Skema Database & Migration Awal**
- Referensi: PRD §11
- Output: `prisma/schema.prisma` berisi seluruh model (`tenants`, `users`, `workflow_definitions`, `workflow_versions`, `workflow_runs`, `step_runs`) sesuai kolom & tipe di §11
- DoD: `npx prisma migrate dev` berhasil, tabel muncul di Postgres (`docker exec -it flowforge-postgres psql -U flowforge -d flowforge -c "\dt"`)
- Test: -

**Task 1.3 — DAG Parser & Validator**
- Referensi: PRD §9.A
- Output: modul `apps/api/src/execution/dag-parser.ts` (atau setara) yang bisa: parse JSON DAG, deteksi cycle, deteksi node orphan/tipe tak dikenal
- DoD: fungsi melempar error spesifik untuk tiap kasus invalid, dan mengembalikan struktur graph valid untuk kasus valid
- Test wajib (unit, Jest): minimal 4 kasus — DAG valid, DAG dengan cycle, DAG dengan node orphan, DAG dengan tipe step tidak dikenal

**Task 1.4 — Topological Sort**
- Referensi: PRD §9.A
- Output: fungsi topological sort (Kahn's algorithm) yang mengembalikan "layer" eksekusi (array of array — step dalam layer sama = bisa paralel)
- DoD: untuk DAG contoh di PRD Appendix A, urutan layer sesuai ekspektasi manual
- Test wajib (unit): DAG linear, DAG dengan percabangan paralel (seperti contoh PRD §9.A Acceptance Criteria)

### FASE 2 — Core Engine & API (target: Hari 2)

**Task 2.1 — Auth Module (JWT + RBAC)**
- Referensi: PRD §10 (Auth endpoints), §16 (Security)
- Output: `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; guard `TenantGuard`, decorator `@Roles()`
- DoD: login mengembalikan access+refresh token valid; endpoint terproteksi menolak request tanpa token (`401`) dan role salah (`403`)
- Test wajib (integration): register→login sukses, akses endpoint terproteksi dengan role salah ditolak

**Task 2.2 — Execution Engine (Executor + Retry + Timeout)**
- Referensi: PRD §9.A
- Output: modul executor yang mengonsumsi hasil topo-sort, menjalankan step per layer, menangani retry exponential backoff, dan global timeout
- DoD: workflow dengan step gagal-lalu-sukses (mock) berhasil retry sesuai `maxRetries`; workflow yang melebihi timeout ditandai `timed_out`
- Test wajib (unit): retry backoff formula, timeout enforcement (gunakan fake timers Jest, jangan `sleep` asli di test)

**Task 2.3 — Workflow CRUD + Versioning API**
- Referensi: PRD §10 (Workflows), §9.B
- Output: seluruh endpoint `/workflows/*` sesuai tabel §10, termasuk versioning dan rollback
- DoD: update workflow membuat row baru di `workflow_versions`, rollback mengubah `current_version_id`
- Test wajib (integration): create→update→cek versi bertambah→rollback→cek `current_version_id` berubah

**Task 2.4 — Trigger & Queue Integration (BullMQ)**
- Referensi: PRD §9.A, §9.B, §6 (arsitektur)
- Output: `POST /workflows/:id/trigger`, `POST /webhooks/:token/trigger`; job masuk ke BullMQ; proses `worker` terpisah mengonsumsi job dan memanggil execution engine
- DoD: trigger manual menghasilkan row `workflow_runs` berstatus `queued` lalu berubah `running`→`completed` tanpa intervensi manual
- Test wajib (integration): trigger via API, poll status run sampai `completed`

**Task 2.5 — Tenant Isolation Enforcement**
- Referensi: PRD §9.B, §16
- Output: Prisma middleware/global guard yang menyuntikkan filter `tenantId` otomatis
- DoD: **Test 2 tenant wajib lulus** — buat 2 tenant, masing-masing punya workflow, tenant A tidak bisa akses/list data tenant B lewat endpoint manapun
- Test wajib (integration): skenario 2-tenant di atas, eksplisit sebagai test case terpisah bernama jelas (mis. `tenant-isolation.spec.ts`)

**Task 2.6 — Rate Limiting & Pagination/Filtering**
- Referensi: PRD §9.B, §10
- Output: middleware rate limit berbasis Redis; query param `cursor`, `limit`, `status`, `createdAfter` di endpoint list
- DoD: request ke-101 dalam 1 menit dari tenant sama menerima `429`
- Test wajib (integration): rate limit terpicu setelah N request

### FASE 3 — Real-Time & Frontend (target: Hari 3)

**Task 3.1 — WebSocket Gateway**
- Referensi: PRD §12
- Output: Socket.IO gateway sesuai kontrak event di §12 (room per run, event `run:started`, `step:status_changed`, `run:completed`, `run:error`)
- DoD: klien testing sederhana (script Node atau Postman) menerima event real-time saat run dipicu
- Test: integration test opsional (WS testing lebih rumit) — minimal manual verification terdokumentasi di `CHANGELOG-DECISIONS.md` jika test otomatis dilewati karena waktu

**Task 3.2 — Frontend Bootstrap & Auth Flow**
- Referensi: PRD §5, §7
- Output: `apps/web` ter-inisialisasi (Vite+React+TS+Tailwind), halaman login, penyimpanan token (memory/context, bukan localStorage untuk access token demi keamanan — refresh token boleh httpOnly cookie jika sempat, atau localStorage sebagai fallback dengan catatan trade-off)
- DoD: user bisa login dari UI dan mendapat token yang tersimpan untuk request selanjutnya
- Test: E2E dasar (Task 3.5) mencakup ini

**Task 3.3 — DAG Visualization (React Flow)**
- Referensi: PRD §9.C
- Output: komponen yang merender `definition_json` sebagai graph node/edge, warna node berubah sesuai `step:status_changed`
- DoD: buka halaman detail run, trigger workflow dari halaman lain di tab berbeda, warna node di dashboard berubah tanpa refresh manual
- Test: manual verification cukup untuk assessment ini; catat di README cara mendemokannya

**Task 3.4 — Run History & Health Panel**
- Referensi: PRD §9.C
- Output: halaman list run + drill-down log; panel agregat 24 jam
- DoD: data yang ditampilkan cocok dengan data di database (verifikasi manual query vs UI)
- Test: -

**Task 3.5 — Docker & Docker Compose**
- Referensi: PRD §9.E, `02-INSTALL-GUIDE.md`
- Output: `Dockerfile` multi-stage untuk `apps/api` dan `apps/web`; `docker-compose.yml` dengan service `api`, `worker`, `web`, `postgres`, `mongodb`, `redis`
- DoD: dari **fresh clone** repo (test di folder kosong berbeda), `docker compose up` menghasilkan sistem berjalan penuh tanpa langkah manual tambahan selain mengisi `.env`
- Test wajib: jalankan `docker compose up` dan verifikasi seluruh container `healthy`/`running`

**Task 3.6 — CI Pipeline**
- Referensi: PRD §9.E
- Output: `.github/workflows/ci.yml` — job `lint` → `test` → `build` → `docker-build`
- DoD: push ke branch feature memicu pipeline, seluruh job hijau
- Test: -

### FASE 4 — AI, Testing, Dokumentasi (target: Hari 4)

**Task 4.1 — AI Natural Language Workflow Builder**
- Referensi: PRD §13
- Output: `POST /ai/generate-workflow`, integrasi Gemini API, validasi schema + retry korektif sesuai §13
- DoD: input deskripsi natural bahasa Indonesia/Inggris sederhana menghasilkan DAG JSON valid yang lolos validator yang sama dengan Task 1.3; input yang menghasilkan output cacat 2x berturut-turut mengembalikan error `422` yang jelas, bukan crash
- Test wajib (integration, mock LLM response): kasus sukses, kasus LLM return JSON invalid → retry → sukses, kasus retry tetap gagal → `422`

**Task 4.2 — E2E Test Penuh**
- Referensi: PRD §9.F, §15
- Output: 1 skenario E2E — create workflow → trigger → subscribe WS/poll → assert `completed`
- DoD: test berjalan hijau di CI (bukan hanya lokal)
- Test: ini sendiri adalah deliverable test

**Task 4.3 — REVIEW.md**
- Referensi: PRD §9.F
- Output: review kode cacat yang diberikan terpisah oleh evaluator, ditulis selayaknya komentar PR sungguhan
- DoD: setiap isu diberi: kutipan baris kode, penjelasan masalah (bug/security/performance/readability), saran perbaikan konkret
- Test: -
- **Catatan:** jika file kode cacat belum tersedia saat task ini dimulai, agent **wajib berhenti dan bertanya ke user** (lihat Bagian 1 poin 5), bukan mengarang skenario review.

**Task 4.4 — README.md**
- Referensi: PRD §9.F
- Output: setup instructions (ringkas, merujuk ke `02-INSTALL-GUIDE.md` untuk detail), architecture overview (boleh salin diagram PRD §6), bagian trade-off & rencana perbaikan
- DoD: seseorang yang belum pernah lihat proyek bisa clone→setup→jalankan hanya dengan membaca README

**Task 4.5 — Infra Design Doc**
- Referensi: PRD §9.E
- Output: `docs/infra-design.md` — diagram arsitektur AWS + penjelasan pilihan (load balancing, auto-scaling, managed services)
- DoD: setiap komponen di diagram punya 1-2 kalimat justifikasi

**Task 4.6 — Swagger/OpenAPI Docs**
- Referensi: PRD §5, §20
- Output: decorator Swagger di seluruh controller, endpoint `/api/docs` menampilkan dokumentasi interaktif
- DoD: seluruh endpoint di PRD §10 muncul di Swagger UI dengan contoh request/response

**Task 4.7 — Final Review & Submission Checklist**
- Referensi: PRD §20 (Definition of Done)
- Output: jalankan seluruh checklist PRD §20 satu per satu
- DoD: seluruh item tercentang; jika ada yang tidak tercapai, dokumentasikan di README bagian "Trade-offs & What I'd Improve" dengan alasan jujur (evaluator menghargai kejujuran tentang scope yang dikorbankan dibanding klaim palsu)

---

## 4. Konvensi Kode

- **Commit message:** Conventional Commits — `feat(execution): add cycle detection to DAG parser`, `fix(auth): correct refresh token expiry check`, `test(workflows): add tenant isolation integration test`
- **Branch:** `feature/<nama-singkat>` untuk pekerjaan yang menghasilkan PR self-authored (requirement F)
- **Penamaan file:** `kebab-case.ts` untuk file, `PascalCase` untuk class/component React, `camelCase` untuk fungsi/variabel
- **Error handling backend:** selalu gunakan NestJS exception filter terpusat, jangan `try/catch` yang menelan error secara diam-diam
- **Tidak ada `any` implisit** di TypeScript kecuali dijustifikasi komentar
- **Setiap modul baru wajib disertai test file** di direktori yang sama/parallel `test/` sebelum task ditandai selesai

---

## 5. Kondisi Berhenti & Eskalasi ke User

Agent **wajib berhenti mengeksekusi dan menyampaikan status ke user** (bukan menebak lalu lanjut) jika salah satu terjadi:

1. File kode "flawed" untuk `REVIEW.md` (Task 4.3) belum tersedia
2. `GEMINI_API_KEY` atau kredensial lain di `02-INSTALL-GUIDE.md` §12 belum diisi user dan Task 4.1 sudah harus dimulai
3. Perkiraan sisa waktu tidak cukup menyelesaikan seluruh task P0 di Bagian 3 — laporkan progress checklist `todo.md` dan usulkan task mana yang dikorbankan sesuai PRD §4 (Non-Goals) dan §19 (Risiko)
4. Ditemukan requirement di PRD yang secara teknis tidak mungkin dipenuhi dalam stack yang dipilih — laporkan beserta alternatif yang diusulkan, jangan diam-diam mengganti tanpa mencatat di `CHANGELOG-DECISIONS.md`

---

## 6. Checklist Akhir Sebelum Melaporkan "Selesai" ke User

- [ ] Semua task Bagian 3 tercentang di `todo.md`
- [ ] `CHANGELOG-DECISIONS.md` terisi untuk setiap penyimpangan dari PRD
- [ ] PRD §20 (Definition of Done) sudah dicek satu per satu
- [ ] `docker compose up` dari fresh clone berhasil (uji ulang, jangan asumsikan dari test sebelumnya)
- [ ] CI hijau di commit terakhir branch utama
- [ ] Tidak ada `.env`, secret, atau API key yang ter-commit ke git (`git log -p | grep -i "api_key\|secret\|password"` kosong)

---

*Dokumen ini adalah protokol eksekusi untuk AI agent. Jika Antigravity IDE menyediakan mekanisme "context file" atau "project rules", muat ketiga dokumen (`01-PRD-FlowForge.md`, `02-INSTALL-GUIDE.md`, `03-AGENT-EXECUTION-GUIDE.md`) sebagai context permanen di awal setiap sesi kerja agar agent tidak kehilangan acuan di tengah proses.*
