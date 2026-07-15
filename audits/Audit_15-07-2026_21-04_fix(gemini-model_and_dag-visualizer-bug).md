# Audit Fix - 15 Juli 2026 (Model Gemini & Visualisasi DAG)

## 📌 Detail Audit
- **Waktu Audit**: 15 Juli 2026, 21:04 WIB
- **Target Perbaikan**: 
  - Masalah pemanggilan model Gemini (Gemini AI Builder)
  - Visualisasi DAG run history kosong (ReactFlow Canvas)
  - Penyederhanaan pengisian DAG JSON di form Workflow baru

---

## 🛠️ Analisis Masalah & Pemecahan (Troubleshooting)

### 1. Masalah Model Gemini (AI Builder)
- **Error**: `[GoogleGenerativeAI Error]: models/gemini-1.5-flash is not found for API version v1beta`
- **Penyebab**: API Google Gemini v1beta di SDK Node.js memblokir pemanggilan model `gemini-1.5-flash` jika menggunakan key / endpoint tertentu.
- **Perbaikan**: Mengubah target model menjadi **`gemini-2.5-flash`** pada `apps/api/src/ai/ai.service.ts` sesuai saran user. Fitur AI DAG generator sekarang dapat memproses deskripsi natural language dengan lancar.

### 2. Visualisasi Run History Kosong
- **Masalah**: Ketika user memilih suatu baris riwayat eksekusi di menu **Run History**, grafik DAG pada canvas di sebelah kanan berwarna abu-abu gelap tanpa status warna (hijau/kuning/merah) di masing-masing step.
- **Penyebab**: Komponen `DagCanvas.tsx` di frontend hanya mendengarkan update real-time via WebSocket. Saat memuat riwayat run masa lalu (yang sudah selesai), data status langkah (`stepRuns`) tidak pernah di-fetch dari API database.
- **Perbaikan**: 
  - Mengimpor `runsApi` ke dalam `DagCanvas.tsx`.
  - Menambahkan query `useQuery` untuk mengambil detail run terbaru `/api/v1/runs/:id`.
  - Menambahkan efek `useEffect` untuk memetakan status `stepRuns` langsung ke status visual node ReactFlow (`stepStatuses`) saat data pertama kali dimuat.

### 3. Kompleksitas Pengisian Form DAG Manual
- **Masalah**: Pengguna kesulitan dan merasa rumit jika harus mengetik definisi struktur DAG dalam format JSON mentah dari awal saat membuat workflow baru.
- **Perbaikan**: Menambahkan fitur **"-- Load Template --"** berupa dropdown pemilih template pada modal pembuatan workflow di halaman **Workflows**. User dapat memilih template instan (Simple Delayed, Order Fulfillment, atau API Chaining) yang otomatis mengisi area JSON.

---

## 📈 Cara Menguji Demonstrasi (Demo Guide)

### Langkah 1: Jalankan Database Seed (Opsional)
Pastikan database PostgreSQL bersih dan memiliki data awal dengan menjalankan:
```powershell
npx prisma db seed
```
*(Dari folder `apps/api`)*

### Langkah 2: Login Organisasi
1. Buka [http://localhost:5173/login](http://localhost:5173/login)
2. Masukkan input berikut:
   - **Organization Slug**: `sevima`
   - **Email**: `admin@sevima.com`
   - **Password**: `password123`

### Langkah 3: Uji Fitur AI Builder
1. Buka menu **AI Builder** di sidebar.
2. Klik tombol **Generate DAG** untuk prompt default, atau ketik deskripsi Anda sendiri.
3. Struktur workflow kini berhasil dibuat otomatis menggunakan **Gemini 2.5 Flash**.

### Langkah 4: Uji Visualisasi Riwayat Run
1. Buka menu **Run History**.
2. Klik salah satu eksekusi di dalam tabel (contoh: baris pertama dengan ID `4c871186...`).
3. Anda akan langsung melihat visualisasi status setiap step run (hijau jika sukses, merah jika gagal) digambar dengan benar di dalam canvas.
