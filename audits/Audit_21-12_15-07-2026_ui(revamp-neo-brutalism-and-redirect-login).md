# Laporan Audit UI - 15 Juli 2026, 21:12 WIB

## 📌 Detail Audit
- **Waktu Audit**: 15 Juli 2026, 21:12 WIB
- **Tipe Perubahan**: `ui` (Refaktor Tampilan & Penyesuaian Alur Navigasi)
- **Target Perbaikan**:
  - Penambahan pustaka TailwindCSS di frontend.
  - Implementasi tema **Neo-Brutalism Clean (Awwwards Design Style)** dengan palet warna kustom.
  - Perbaikan navigasi redirect URL yang tertahan di `/login` setelah autentikasi sukses.

---

## 🎨 Detail Desain Neo-Brutalism Clean (Awwwards Style)
Tampilan antarmuka FlowForge telah dirombak total menggunakan palet warna dan karakteristik desain minimalis editorial neo-brutalism:
- **Background Utama (Bone White)**: `#F5F5F3`
- **Text & Struktural (Ink Black)**: `#0B0B0C`
- **Aksen Primer (Pastel Coral)**: `#FF8E7A` (digunakan untuk tombol utama/primary, badge, dan hover accent)
- **Aksen Sekunder (Muted Lavender)**: `#D6C7E8` (digunakan untuk tombol sekunder, sidebar active, header tabel, dan border highlight)
- **Karakteristik Visual**:
  - Border hitam tebal (`border-2 border-[#0B0B0C]` atau `border-2 solid var(--color-border)`).
  - Tanpa rounded corners (`rounded-none` / border-radius 0px) untuk menonjolkan estetika kotak tajam neo-brutalist.
  - Shadow datar/solid tebal tanpa blur (`shadow-[4px_4px_0px_0px_#0B0B0C]`).
  - Efek interaktif hover tombol yang bergeser ke kiri-atas (`transform: translate(-2px, -2px)`) saat disorot dan kembali saat ditekan.

---

## 🛠️ Analisis & Solusi Perbaikan

### 1. Integrasi TailwindCSS
- **Perubahan**:
  - Menginstal `tailwindcss`, `postcss`, dan `autoprefixer` di subfolder `apps/web`.
  - Membuat berkas konfigurasi [tailwind.config.js](file:///c:/laragon/www/sevima_assessment/apps/web/tailwind.config.js) dan [postcss.config.js](file:///c:/laragon/www/sevima_assessment/apps/web/postcss.config.js).
  - Mengintegrasikan direktif Tailwind (`@tailwind base;` dsb.) ke dalam [index.css](file:///c:/laragon/www/sevima_assessment/apps/web/src/index.css).
- **Hasil**: Eksekusi build bundler Vite berhasil mengompilasi CSS gabungan dengan ukuran ringkas (18.79 kB).

### 2. Perbaikan Stuck Redirect `/login`
- **Masalah**: Pengguna berhasil masuk menggunakan kredensial yang valid, namun rute URL di address bar browser tetap tertahan di `http://localhost:5173/login`. Hal ini membingungkan karena tidak ada sinkronisasi path URL saat status autentikasi berubah.
- **Penyebab**: Navigasi aplikasi diatur secara dinamis melalui state lokal di `App.tsx` tanpa menggunakan router berbasis path lengkap (seperti react-router yang merubah path). Ketika state `isAuthenticated` berubah menjadi `true`, halaman dashboard dimuat di layar tetapi URL browser tetap `/login`.
- **Perbaikan**:
  - Menambahkan efek `useEffect` di [App.tsx](file:///c:/laragon/www/sevima_assessment/apps/web/src/App.tsx) yang mendeteksi perubahan state `isAuthenticated`.
  - Jika pengguna sudah terautentikasi dan URL masih mengandung `/login`, sistem secara dinamis memicu perubahan rute URL ke `/` menggunakan HTML5 History API: `window.history.pushState({}, '', '/')`.
  - URL di address bar browser sekarang berubah secara real-time dan mulus ke root `/` sesaat setelah login berhasil.

### 3. Pemolesan Komponen UI ke Gaya Neo-Brutalism
- **Sidebar**: Diubah menjadi berlatar putih bersih dengan garis pembatas tebal dan active tab berwarna Muted Lavender yang memiliki bayangan solid.
- **Cards & Stats**: Menggunakan kontras tinggi Bone White dan Ink Black dengan shadow tebal, menghapus gradien rounded sebelumnya.
- **ReactFlow Canvas Nodes**: Node visualisasi step diubah menjadi kotak putih tajam dengan border hitam tebal dan bayangan solid, sehingga menyatu dengan tema editorial secara keseluruhan.
- **Buttons**: Tombol primer menggunakan Pastel Coral sedangkan tombol sekunder menggunakan Muted Lavender dengan bayangan solid dan interaksi hover translate.

---

## 📁 Struktur Berkas Audit Baru
Penamaan berkas laporan audit ini telah disesuaikan dengan instruksi baru menggunakan format:
`Audit_<waktu>_<tanggal>_<prefix-git>(keterangan_singkat).md`
- **Berkas Ini**: `Audit_21-12_15-07-2026_ui(revamp-neo-brutalism-and-redirect-login).md`
