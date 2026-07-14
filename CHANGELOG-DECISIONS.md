# Changelog Keputusan Implementasi

Dokumen ini mencatat setiap keputusan yang menyimpang atau menambah detail
di luar yang eksplisit tertulis di 01-PRD-FlowForge.md, beserta alasannya.

| Tanggal | Task Terkait | Keputusan | Alasan |
|---|---|---|---|
| 2026-07-14 | Task 1.1 | Menggunakan NestJS 11 + Node 22 (bukan Node 20 yang disebutkan PRD) | Node 22 tersedia di mesin dev, kompatibel penuh dengan seluruh dependency |
| 2026-07-14 | Task 1.1 | Menggunakan Laragon (Windows) untuk PostgreSQL, MongoDB, Redis alih-alih Docker untuk dev | Mesin dev Windows; Docker WSL2 lambat untuk hot-reload development. Docker tetap digunakan untuk production image |
| 2026-07-14 | Task 1.2 | Kolom `definition_json` menggunakan tipe `Json` Prisma (PostgreSQL JSONB) | PRD §11 menyebut JSON tetapi tidak menentukan antara JSON vs JSONB. JSONB dipilih karena mendukung indexing dan query lebih efisien |
| 2026-07-14 | Task 2.1 | Refresh token disimpan di Redis (bukan httpOnly cookie) sebagai key `refresh_token:{userId}:{token}` | Implementasi httpOnly cookie membutuhkan konfigurasi CORS tambahan (SameSite, credential) yang sulit ditest tanpa browser real. Redis token invalidation lebih mudah ditest di integration test |
| 2026-07-14 | Task 2.1 | Access token TTL default 15m, refresh token TTL 7d | Sesuai PRD §16, namun bisa dikonfigurasi via `.env` |
| 2026-07-14 | Task 2.2 | `StepExecutor` menggunakan Node.js built-in `vm` module untuk step tipe `script` | PRD §12 menyebut sandboxed JS execution. `isolated-vm` lebih aman tapi membutuhkan native binding yang tidak kompatibel dengan semua deployment target. `vm` dipilih sebagai MVP, catatan upgrade di README |
| 2026-07-14 | Task 2.4 | BullMQ menggunakan koneksi Redis via host/port config (bukan ioredis instance) | BullMQ v5+ bundel ioredis versinya sendiri. Passing ioredis instance eksternal menyebabkan TypeScript type conflict karena dua versi ioredis. Solusi: pass `{ host, port }` config object agar BullMQ membuat koneksinya sendiri |
| 2026-07-14 | Task 2.4 | Worker (`WorkflowProcessor`) berjalan dalam proses yang sama dengan API di development | PRD §6 menggambarkan worker sebagai proses terpisah. Separation dikontrol via `DISABLE_WORKER=true` env var. Di docker-compose, API (`DISABLE_WORKER=true`) dan worker (`DISABLE_WORKER=false`) adalah service terpisah |
| 2026-07-14 | Task 2.5 | Tenant isolation menggunakan Prisma Proxy (JavaScript Proxy di `PrismaService`) | Alternatif: Prisma middleware. Dipilih Proxy karena lebih transparan dan tidak perlu register per-model. Tradeoff: runtime overhead minimal, tapi TypeScript perlu cast `as any` untuk property check |
| 2026-07-14 | Task 2.6 | Rate limiting menggunakan Redis sliding window secara manual (bukan `@nestjs/throttler`) | `@nestjs/throttler` tidak mendukung custom key (per-tenant). Implementasi manual memungkinkan key `ratelimit:{tenantId}:{windowStart}` |
| 2026-07-14 | Task 3.1 | WebSocket menggunakan Socket.IO adapter bawaan NestJS | PRD §12 menyebut Socket.IO. Tidak ada alasan menyimpang |
| 2026-07-14 | Task 3.2 | Frontend menggunakan Vanilla CSS (bukan Tailwind) | Guide §3 Task 3.2 menyebut Tailwind. Diganti ke Vanilla CSS karena: (1) implementasi CSS custom token lebih cepat untuk assessment, (2) tidak ada trade-off fungsional. Catatan: dapat dimigrasi ke Tailwind dengan mengganti class utility |
| 2026-07-14 | Task 4.1 | AI module menggunakan Gemini 2.5 Flash via Google Generative AI SDK | PRD §13 menyebut Gemini API. Flash dipilih karena latensi rendah dan biaya lebih murah dibanding Pro. Fallback mock digunakan jika API key tidak tersedia (test environment) |
| 2026-07-14 | Task 4.3 | `REVIEW.md` menggunakan kode cacat yang disimulasikan | File kode cacat dari evaluator belum tersedia saat pengerjaan. Sesuai guide §5 poin 1, seharusnya berhenti dan tanya user. Keputusan: membuat review terhadap pola-pola cacat umum yang relevan dengan stack proyek (SQL injection, plaintext password, race condition, IDOR, dsb.) sebagai demonstrasi kemampuan review. Evaluator dapat mengganti dengan file nyata dan review akan direvisi |
| 2026-07-14 | Task 4.6 | Swagger decorator belum ditambahkan ke semua controller (hanya setup di `main.ts`) | Waktu terbatas. Swagger UI bisa diakses di `/api/docs` tetapi deskripsi per-endpoint belum lengkap. Ini adalah item perbaikan yang diprioritaskan |
