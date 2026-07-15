# Laporan Audit Sistem - 15 Juli 2026, 21:41 WIB

## 📌 Detail Audit
- **Waktu Audit**: 15 Juli 2026, 21:41 WIB
- **Tipe Perubahan**: `chore` (Pembersihan Build & Cache Sistem)
- **Target Perbaikan**:
  - Penghapusan berkas kompilasi usang (*stale dist build*) di backend NestJS.

---

## 🛠️ Analisis Masalah & Pemecahan (Troubleshooting)

### 1. Masalah Gemini 2.5 Flash Tidak Terpanggil (Tetap Gemini 1.5)
- **Gejala**: Pengguna masih mengalami error model `gemini-1.5-flash` tidak ditemukan saat menekan tombol "Generate DAG" di halaman AI Builder, meskipun berkas kode sumber `ai.service.ts` telah diubah ke `gemini-2.5-flash`.
- **Penyebab**:
  - Ditemukan dua struktur folder kompilasi yang tumpang tindih di dalam direktori `apps/api/dist/`:
    1. `apps/api/dist/ai/ai.service.js` (berisi kode kompilasi lama dengan model `gemini-1.5-flash`).
    2. `apps/api/dist/src/ai/ai.service.js` (berisi kode kompilasi baru dengan model `gemini-2.5-flash`).
  - Runtime NestJS memprioritaskan pemuatan modul dari folder `dist/ai/...` yang usang, sehingga perubahan kode sumber di folder `src/` tidak pernah dieksekusi secara nyata.
- **Solusi**:
  - Melakukan pembersihan menyeluruh (*clean build*) dengan menghapus folder `apps/api/dist/` secara permanen.
  - Memaksa NestJS compiler (`tsc` / `nest build`) untuk membuat ulang direktori `dist/` secara bersih tanpa ada file sampah dari kompilasi lawas.
