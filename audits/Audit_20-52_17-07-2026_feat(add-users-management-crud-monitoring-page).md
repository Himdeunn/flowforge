# Laporan Audit Sistem - 17 Juli 2026, 20:52 WIB

## 📌 Detail Audit
- **Waktu Audit**: 17 Juli 2026, 20:52 WIB
- **Tipe Perubahan**: `feat` (Penyediaan Halaman Monitoring & Manajemen User Organisasi)
- **Target Perbaikan**:
  - Penambahan modul API `Users` pada backend NestJS.
  - Penambahan halaman **Users** `/users` pada frontend web React.

---

## 🛠️ Analisis Masalah & Pemecahan (Troubleshooting)

### 1. Ketiadaan Pengelolaan Akun Multi-Role dalam Satu Tenant
- **Gejala**: Saat melakukan pendaftaran baru, pengguna secara otomatis menjadi admin tenant tersebut. Namun, admin tidak memiliki antarmuka atau endpoint API untuk membuat akun ber-role lain (seperti `editor` dan `viewer`) untuk didelegasikan di dalam organisasi mereka sendiri.
- **Solusi**:
  - **Backend**:
    - Membuat folder `apps/api/src/users/` berisi `UsersModule`, `UsersController`, dan `UsersService` baru.
    - Menghubungkan controller dengan `JwtAuthGuard` dan `RolesGuard`, membatasi pemanggilan seluruh endpoint CRUD user hanya untuk pengguna ber-role `'admin'`.
    - Menyediakan fungsionalitas CRUD data User di basis data PostgreSQL menggunakan Prisma, mengisolasi kueri data berdasarkan `tenantId` pengguna aktif.
  - **Frontend**:
    - Menambahkan `usersApi` pada berkas helper `api-helpers.ts`.
    - Membuat berkas halaman **[UsersPage.tsx](file:///c:/laragon/www/sevima_assessment/apps/web/src/pages/UsersPage.tsx)** yang menampilkan tabel data user, form modal pembuatan user baru, penyuntingan email/password/role, serta aksi penghapusan user.
    - Mengintegrasikan router browser URL path `/users` di berkas `App.tsx` dan memunculkan menu navigasi **"Users"** secara dinamis di `Sidebar.tsx` hanya apabila role pengguna aktif adalah `admin`.
- **Hasil**: Admin tenant sekarang dapat memantau seluruh anggota organisasi mereka, membuat akun baru (Admin, Editor, atau Viewer) dengan aman, serta memperbarui/menghapus mereka kapan saja secara instan.
