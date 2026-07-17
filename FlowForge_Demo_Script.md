# 📑 Naskah Panduan Presentasi & Demo Aplikasi — FlowForge

Naskah ini dirancang khusus sebagai panduan presentasi (*technical assessment*) Anda di hadapan tim penguji. Panduan ini dibagi menjadi panduan tindakan di layar (Tindakan) dan kalimat yang dapat Anda ucapkan (Ucapan).

---

## 🔑 Langkah 1: Autentikasi & Konsep Keamanan Multi-Tenancy

### 🖥️ Tindakan di Layar:
1. Buka browser pada halaman **`http://localhost:5173/`** (menampilkan halaman Login).
2. Masukkan kredensial berikut:
   * **Organization Slug**: `sevima`
   * **Email**: `admin@sevima.com`
   * **Password**: `password123`
3. Klik tombol **`Sign In`**.
4. Tunjukkan nama tenant **"sevima"** di bagian bawah sidebar samping.

### 🗣️ Ucapan Anda:
> *"Selamat pagi/siang bapak/ibu penguji. Hari ini saya akan mendemonstrasikan sistem FlowForge, sebuah real-time multi-tenant workflow orchestration engine.*
>
> *Langkah pertama yang saya tunjukkan adalah aspek keamanan **Multi-Tenancy**. Saya masuk ke dalam organisasi dengan slug **'sevima'**. Di backend NestJS, sistem kami menggunakan konsep isolated context via `AsyncLocalStorage` dan Prisma middleware.*
>
> *Artinya, semua query database (SELECT, UPDATE, DELETE) disaring secara implisit berdasarkan tenant yang sedang login. Data dari organisasi lain tersimpan dalam database yang sama, namun terisolasi 100% secara logika dan tidak akan pernah bocor ke tenant ini."*

---

## 👥 Langkah 2: Manajemen Pengguna & Delegasi Peran (RBAC)

### 🖥️ Tindakan di Layar:
1. Klik menu **`Users`** di sidebar (menu ini hanya muncul untuk pengguna dengan peran `admin`).
2. Tunjukkan tabel daftar user aktif.
3. Klik tombol **`+ Add User`** di pojok kanan atas.
4. Isi form modal sebagai berikut:
   * **Email**: `editor-demo@sevima.com`
   * **Password**: `password123`
   * **Access Role**: Pilih **`Editor`**
5. Klik **`Create User`**. Tunjukkan user baru berhasil masuk ke tabel.
6. Klik **`Edit`** pada salah satu user, ubah rolenya dari `viewer` ke `editor`, lalu simpan.

### 🗣️ Ucapan Anda:
> *"Selanjutnya adalah manajemen pengguna dan kontrol akses berbasis peran atau **Role-Based Access Control (RBAC)**. Di halaman **Users** ini, admin organisasi dapat melakukan operasi CRUD untuk menambahkan anggota tim baru.*
>
> *FlowForge memiliki tiga tingkatan akses:*
> 1. * **Admin**: Memiliki wewenang penuh termasuk menghapus alur kerja dan melakukan rollback.*
> 2. * **Editor**: Dapat membuat, memodifikasi alur kerja, namun tidak dapat menghapusnya.*
> 3. * **Viewer**: Akses baca-saja (*read-only*) untuk monitoring tanpa tombol aksi.*
>
> *Barusan saya berhasil menambahkan akun baru dengan tingkat otorisasi **Editor** secara dinamis."*

---

## 🤖 Langkah 3: AI-Powered Workflow Generator (Integrasi Gemini)

### 🖥️ Tindakan di Layar:
1. Klik menu **`Workflow Generator`** di sidebar.
2. Di kotak input prompt, ketik kalimat bahasa alami berikut:
   > *"Tunggu 3 detik, kemudian ambil data dari https://jsonplaceholder.typicode.com/users, lalu cek status"*
3. Klik tombol **`Generate DAG`**.
4. Tonton visualisasi node graph di panel kanan yang digambar otomatis oleh AI.
5. Klik tombol **`Save as Workflow`** di bawah visualizer, beri nama **`AI Generated Pipeline`**, isi deskripsi opsional, lalu klik **`Create`**.

### 🗣️ Ucapan Anda:
> *"Sekarang kita beralih ke fitur **Workflow Generator** berbasis kecerdasan buatan. Untuk mempermudah pengguna awam dalam membuat struktur graf DAG (Directed Acyclic Graph) yang rumit, kami mengintegrasikan Google Gemini.*
>
> *Pengguna cukup menulis instruksi dalam bahasa sehari-hari. Prompt engine kami akan menginstruksikan LLM untuk merancang dependensi tugas dalam format JSON terstruktur.*
>
> *Di backend, kami juga menambahkan modul **string cleaning** yang tangguh untuk memotong format pembungkus markdown code block dari AI, serta algoritma deteksi siklus untuk memastikan grafik alur kerja yang dihasilkan tidak berputar tanpa ujung (*no infinite loops*). Alur tersebut baru saja berhasil saya simpan sebagai workflow aktif."*

---

## ⚡ Langkah 4: Eksekusi Alur Kerja & Pemantauan Real-Time (Live Monitoring)

### 🖥️ Tindakan di Layar:
1. Buka menu **`Workflows`**.
2. Pilih alur kerja yang baru saja dibuat atau template **`Super Overpowered Pipeline`** pada daftar.
3. Klik tombol **`▶ Trigger`**. Muncul pop-up *"Run started!"*.
4. **Segera** klik menu **`Run History`** di sidebar.
5. Pilih baris eksekusi paling atas (berstatus *running* atau *completed*).
6. **Perlihatkan visualisasi**: Tunjukkan bagaimana node-node grafik ReactFlow berubah warna secara live (Kuning = Sedang jalan, Hijau = Sukses).
7. Scroll ke bawah dan tunjukkan kotak **Execution Logs** berwarna hitam berisi detail logs eksekusi dari MongoDB yang muncul baris demi baris secara instan.

### 🗣️ Ucapan Anda:
> *"Langkah keempat adalah pembuktian kinerja eksekusi asinkronus dan live monitoring. Ketika alur kerja dipicu, backend memisahkan tugas dari thread utama dan memasukkannya ke antrean **BullMQ** yang dikelola oleh **Redis**.*
>
> *Secara bersamaan, backend Worker mengeksekusi setiap langkah alur kerja secara paralel atau berurutan sesuai urutan dependensi graf DAG. Perubahan status eksekusi dikirim secara live ke frontend menggunakan **WebSocket (Socket.io)**.*
>
> *Seperti yang dapat kita lihat di layar, warna kotak berubah secara real-time dari kuning menjadi hijau seiring selesainya tugas tanpa perlu melakukan refresh halaman. Dan di bagian bawah, seluruh log detail tersimpan dengan aman di database NoSQL **MongoDB** untuk kebutuhan analisis pasca-eksekusi."*

---

## 🔄 Langkah 5: Pelacakan Versi & Rollback Alur Kerja

### 🖥️ Tindakan di Layar:
1. Buka menu **`Workflows`**.
2. Klik tombol **`Edit`** pada salah satu alur kerja yang ada.
3. Ubah deskripsinya sedikit (misal: tambah kata *"Updated"*), lalu klik **`Save Changes`**.
4. Tunjukkan bahwa nomor versi alur kerja tersebut otomatis naik dari `v1` menjadi `v2`.
5. Klik tombol **`Versions`** pada alur kerja tersebut.
6. Modal history akan muncul. Klik tombol **`Rollback`** di sebelah **Version #1**.
7. Klik **`Close`** setelah ada alert sukses. Tunjukkan nomor versi aktif di kartu alur kerja kembali ke `v1`.

### 🗣️ Ucapan Anda:
> *"Fitur terakhir yang sangat penting bagi ketangguhan sistem di tingkat perusahaan adalah **Version Control dan Rollback**.*
>
> *Ketika alur kerja diperbarui oleh Editor atau Admin, sistem database kami secara otomatis mengarsipkan konfigurasi lama sebagai versi cadangan dan meningkatkan nomor versi aktif menjadi `v2`.*
>
> *Apabila versi baru ini mengalami masalah operasional, Admin dapat membuka riwayat versi, melihat daftar arsip versi sebelumnya, dan melakukan **Rollback** kembali ke konfigurasi versi awal hanya dengan sekali klik. Sistem kami menjamin kelancaran operasional alur kerja meskipun ada perubahan konfigurasi."*

---

## 🏁 Penutup Presentasi

### 🗣️ Ucapan Anda:
> *"Demikian presentasi demonstrasi sistem FlowForge. Sistem ini membuktikan integrasi yang matang antara keandalan sistem asinkronus, isolasi keamanan multi-tenant, observable logging, kemudahan antarmuka berbasis AI, serta pengelolaan siklus hidup alur kerja yang aman.*
>
> *Terima kasih atas perhatiannya, saya silakan kepada bapak/ibu penguji apabila ada pertanyaan."*
