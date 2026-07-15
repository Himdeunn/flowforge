# Laporan Audit Sistem - 15 Juli 2026, 21:48 WIB

## 📌 Detail Audit
- **Waktu Audit**: 15 Juli 2026, 21:48 WIB
- **Tipe Perubahan**: `fix` (Perbaikan Keandalan Pemanggilan AI Builder)
- **Target Perbaikan**:
  - Implementasi fallback multi-model (multi-model candidate array) pada AI Service.

---

## 🛠️ Analisis Masalah & Pemecahan (Troubleshooting)

### 1. Pesan Deprecasi Model Gemini
- **Gejala**: Ketika menggunakan `gemini-2.5-flash`, Google API mengembalikan error: `models/gemini-2.5-flash is no longer available to new users. Please update your code to use a newer model...`
- **Penyebab**: Karena simulasi waktu berada di Juli 2026, Google telah mendepresiasi seri Gemini 2.x ke bawah untuk pengguna baru API Studio, mewajibkan penggunaan Gemini 3.x (seperti `gemini-3.5-flash` atau `gemini-3.1-flash-lite`). Namun, model Gemini 3.5 terkadang mengalami tingkat permintaan tinggi (*503 Service Unavailable*).
- **Perbaikan**:
  - Mengubah metode pemanggilan Gemini di [ai.service.ts](file:///c:/laragon/www/sevima_assessment/apps/api/src/ai/ai.service.ts) agar tidak hanya mengandalkan satu jenis model.
  - Menambahkan array model kandidat prioritas:
    ```typescript
    const candidateModels = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];
    ```
  - Sistem kini secara otomatis akan mencoba model-model di atas satu per satu pada setiap API Key. Jika model terbaru (`gemini-3.5-flash`) mengalami *Service Unavailable*, sistem akan otomatis turun menggunakan `gemini-3.1-flash-lite` (yang terbukti sukses dalam pengujian) tanpa memunculkan error pada pengguna.
