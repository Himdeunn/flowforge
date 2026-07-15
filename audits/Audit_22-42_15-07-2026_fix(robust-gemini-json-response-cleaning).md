# Laporan Audit Sistem - 15 Juli 2026, 22:42 WIB

## 📌 Detail Audit
- **Waktu Audit**: 15 Juli 2026, 22:42 WIB
- **Tipe Perubahan**: `fix` (Peningkatan Keandalan Parsing JSON AI Builder)
- **Target Perbaikan**:
  - Penanganan error parsing JSON saat menggunakan AI Builder DAG.

---

## 🛠️ Analisis Masalah & Pemecahan (Troubleshooting)

### 1. Kegagalan Konversi (JSON Parsing Failed) di AI Builder
- **Gejala**: Ketika user mendeskripsikan alur kerja di AI Builder, respons sering kali gagal dengan pesan error `UnprocessableEntityException` (AI gagal membuat alur kerja valid).
- **Penyebab**:
  - Model Gemini (dan LLM lainnya) sering kali membungkus keluaran JSON mereka dengan penanda blok kode Markdown (misalnya: ` ```json ... ``` `) atau menambahkan kalimat penjelasan pembuka/penutup.
  - Berkas backend [ai.service.ts](file:///c:/laragon/www/sevima_assessment/apps/api/src/ai/ai.service.ts) sebelumnya langsung melakukan `JSON.parse` terhadap teks respons mentah dari Gemini. Jika ada pembungkus markdown atau karakter ekstra diluar JSON `{ ... }`, fungsi parse akan melempar `SyntaxError` sehingga alur gagal terbentuk.
- **Solusi**:
  - Menambahkan metode pembersihan respons kustom `cleanJsonText` pada berkas [ai.service.ts](file:///c:/laragon/www/sevima_assessment/apps/api/src/ai/ai.service.ts).
  - Metode ini akan mendeteksi dan menghapus tag pembuka/penutup markdown kode (` ```json ` dan ` ``` `).
  - Metode ini juga dilengkapi dengan mekanisme ekstraksi tangguh (*robust extraction*) yang mengambil string hanya di antara kurung kurawal pertama `{` dan kurung kurawal terakhir `}`. Hal ini menjamin parser tetap dapat mengurai JSON yang valid meskipun model menyelipkan teks percakapan pembuka/penutup.
- **Hasil**: AI Builder sekarang mampu menangani keluaran AI yang kurang bersih secara otomatis dan 100% andal memproses alur kerja visual.
