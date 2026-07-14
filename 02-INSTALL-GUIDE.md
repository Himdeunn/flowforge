# Panduan Instalasi — FlowForge Core Tech Stack

| | |
|---|---|
| **Dokumen** | Installation Guide |
| **Terkait** | `01-PRD-FlowForge.md` (Bagian 5 — Keputusan Teknis) |
| **Target OS** | Windows 10/11 (WSL2), macOS, atau Linux |
| **Estimasi waktu setup** | 30–60 menit (tergantung kecepatan unduh) |

---

## Daftar Isi

1. Prasyarat Umum
2. Node.js & Package Manager
3. Git
4. Docker & Docker Compose
5. PostgreSQL (via Docker — direkomendasikan)
6. Redis (via Docker)
7. MongoDB (via Docker)
8. NestJS CLI
9. Prisma CLI
10. React + Vite Project Bootstrap
11. TailwindCSS
12. Google Gemini API Key
13. GitHub Actions (tidak perlu instalasi lokal)
14. Verifikasi Instalasi Menyeluruh
15. Troubleshooting Umum

---

## 1. Prasyarat Umum

Sebelum mulai, pastikan:
- Koneksi internet stabil (banyak unduhan image Docker & package npm)
- Minimal 8 GB RAM tersedia (Postgres + MongoDB + Redis + Node berjalan bersamaan)
- Minimal 10 GB ruang disk kosong
- Terminal/shell (bash/zsh di macOS/Linux, atau **WSL2** di Windows — sangat disarankan agar semua perintah di bawah identik dengan Linux)

> **Windows user:** instal WSL2 terlebih dahulu jika belum ada:
> ```powershell
> wsl --install
> ```
> Restart komputer, lalu jalankan seluruh perintah di panduan ini **di dalam WSL2 (Ubuntu)**, bukan di PowerShell/CMD native, agar kompatibel dengan Docker dan tooling Node.js berbasis Unix.

---

## 2. Node.js & Package Manager

**Versi target:** Node.js **20.x LTS** (dibutuhkan NestJS 10+ dan Vite 5+)

### Instalasi via nvm (direkomendasikan — memudahkan ganti versi)

```bash
# Instal nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Muat ulang shell
source ~/.bashrc   # atau ~/.zshrc jika pakai zsh

# Instal Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verifikasi
node -v     # harus menunjukkan v20.x.x
npm -v      # harus menunjukkan 10.x.x
```

### Aktifkan pnpm (opsional, lebih cepat dari npm untuk monorepo)

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm -v
```

> Jika memilih pnpm, semua contoh perintah `npm install` di dokumen ini bisa diganti `pnpm install`. PRD tidak mewajibkan package manager tertentu — pilih salah satu dan konsisten di seluruh proyek.

---

## 3. Git

```bash
# Cek apakah sudah terpasang
git --version

# Jika belum ada (Ubuntu/WSL2/Debian)
sudo apt update && sudo apt install -y git

# macOS (via Homebrew)
brew install git

# Konfigurasi identitas (wajib untuk commit history yang bermakna sesuai requirement F)
git config --global user.name "Nama Kamu"
git config --global user.email "email@kamu.com"
```

---

## 4. Docker & Docker Compose

Docker dibutuhkan untuk menjalankan seluruh stack (`docker-compose up`) sesuai requirement Bagian E di PRD.

### Windows (via WSL2)
1. Unduh **Docker Desktop**: https://www.docker.com/products/docker-desktop
2. Saat instalasi, centang **"Use WSL 2 based engine"**
3. Setelah instal, buka Docker Desktop → Settings → Resources → WSL Integration → aktifkan integrasi untuk distro Ubuntu kamu

### macOS
```bash
brew install --cask docker
```
Lalu buka aplikasi Docker Desktop sekali agar daemon aktif.

### Linux (Ubuntu/Debian)
```bash
# Uninstall versi lama jika ada
sudo apt remove docker docker-engine docker.io containerd runc

# Instal Docker Engine resmi
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Tambahkan user ke group docker (agar tidak perlu sudo tiap perintah)
sudo usermod -aG docker $USER
newgrp docker
```

### Verifikasi

```bash
docker --version          # Docker version 24.x atau lebih baru
docker compose version    # Docker Compose version v2.x
docker run hello-world    # harus berhasil tanpa error
```

> **Catatan:** panduan ini menggunakan `docker compose` (tanpa tanda hubung — plugin v2 bawaan Docker Desktop terbaru), bukan `docker-compose` versi lama. Sesuaikan `docker-compose.yml` di root proyek agar kompatibel dengan versi yang terpasang.

---

## 5. PostgreSQL (via Docker — direkomendasikan)

Untuk development, **tidak perlu instal PostgreSQL native** di OS kamu — cukup jalankan via Docker agar konsisten dengan environment production dan `docker-compose.yml` proyek.

```bash
docker run --name flowforge-postgres \
  -e POSTGRES_USER=flowforge \
  -e POSTGRES_PASSWORD=flowforge \
  -e POSTGRES_DB=flowforge \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Verifikasi koneksi:
```bash
docker exec -it flowforge-postgres psql -U flowforge -d flowforge -c "SELECT version();"
```

> Jika ingin GUI, instal **DBeaver** (gratis, cross-platform) atau **TablePlus** untuk inspeksi tabel secara visual: https://dbeaver.io/

---

## 6. Redis (via Docker)

Dibutuhkan untuk BullMQ (job queue) dan rate limiting.

```bash
docker run --name flowforge-redis -p 6379:6379 -d redis:7-alpine
```

Verifikasi:
```bash
docker exec -it flowforge-redis redis-cli PING
# harus menjawab: PONG
```

---

## 7. MongoDB (via Docker)

Dibutuhkan sebagai store terpisah untuk `execution_logs` (lihat PRD Bagian 11).

```bash
docker run --name flowforge-mongo \
  -p 27017:27017 \
  -d mongo:7
```

Verifikasi:
```bash
docker exec -it flowforge-mongo mongosh --eval "db.runCommand({ ping: 1 })"
```

> Alternatif: gunakan **MongoDB Atlas** (free tier cloud) jika tidak ingin menjalankan container lokal — tinggal ganti `MONGODB_URI` di `.env`.

---

## 8. NestJS CLI

```bash
npm install -g @nestjs/cli

# Verifikasi
nest --version   # 10.x atau lebih baru
```

Membuat project backend baru (jika belum ada boilerplate dari AI agent):
```bash
nest new apps/api --package-manager npm
cd apps/api

# Package tambahan sesuai stack PRD
npm install @nestjs/jwt @nestjs/passport passport passport-jwt \
  @nestjs/config @nestjs/swagger \
  class-validator class-transformer \
  bullmq ioredis socket.io @nestjs/websockets @nestjs/platform-socket.io \
  bcrypt

npm install -D @types/bcrypt @types/passport-jwt
```

---

## 9. Prisma CLI

```bash
cd apps/api
npm install prisma --save-dev
npm install @prisma/client

# Inisialisasi Prisma (membuat folder prisma/ + .env)
npx prisma init --datasource-provider postgresql
```

Isi `DATABASE_URL` di `apps/api/.env` sesuai kredensial PostgreSQL dari Langkah 5:
```
DATABASE_URL="postgresql://flowforge:flowforge@localhost:5432/flowforge"
```

Setelah skema Prisma ditulis sesuai PRD Bagian 11:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 10. React + Vite Project Bootstrap

```bash
cd apps
npm create vite@latest web -- --template react-ts
cd web
npm install

# Package tambahan sesuai stack PRD
npm install @tanstack/react-query axios socket.io-client reactflow zustand
```

---

## 11. TailwindCSS

```bash
cd apps/web
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Edit `tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

Tambahkan directive di `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 12. Google Gemini API Key

Dibutuhkan untuk fitur AI (Natural Language Workflow Builder).

1. Buka https://aistudio.google.com/apikey
2. Login dengan akun Google
3. Klik **"Create API Key"**
4. Salin key, simpan ke `apps/api/.env`:
   ```
   GEMINI_API_KEY=AIza...
   ```
5. **Jangan pernah commit file `.env` ke git** — pastikan `.env` sudah ada di `.gitignore`

Instal SDK resmi:
```bash
cd apps/api
npm install @google/generative-ai
```

---

## 13. GitHub Actions

Tidak butuh instalasi lokal — cukup pastikan repo sudah di-push ke GitHub, lalu buat file `.github/workflows/ci.yml` di root repo (isi pipeline dijelaskan di `03-AGENT-EXECUTION-GUIDE.md`). GitHub Actions otomatis berjalan setiap push/PR tanpa setup tambahan di sisi developer.

Opsional — untuk mencoba CI secara lokal sebelum push, instal **act**:
```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Jalankan workflow secara lokal
act -j test
```

---

## 14. Verifikasi Instalasi Menyeluruh

Jalankan checklist ini sebelum mulai coding untuk memastikan semua tool siap:

```bash
node -v              # v20.x.x
npm -v                # 10.x.x
git --version          # git version 2.x
docker --version       # Docker version 24.x+
docker compose version # v2.x
nest --version          # 10.x
npx prisma --version     # prisma 5.x

docker ps -a | grep flowforge-postgres  # container ada
docker ps -a | grep flowforge-redis     # container ada
docker ps -a | grep flowforge-mongo     # container ada
```

Jika seluruh perintah di atas berjalan tanpa error, environment sudah siap untuk implementasi sesuai `01-PRD-FlowForge.md`.

---

## 15. Troubleshooting Umum

| Masalah | Penyebab Umum | Solusi |
|---|---|---|
| `docker: permission denied` | User belum masuk group `docker` (Linux) | `sudo usermod -aG docker $USER` lalu logout/login ulang |
| Port `5432`/`6379`/`27017` sudah dipakai | Ada instance Postgres/Redis/Mongo lain berjalan di host | Hentikan service lama (`sudo service postgresql stop`) atau ganti port mapping di `docker run`/`docker-compose.yml` |
| `nest: command not found` setelah install global | PATH npm global belum ter-load | Jalankan `npm config get prefix`, pastikan folder `bin`-nya ada di `$PATH` shell kamu |
| Prisma `Can't reach database server` | Container Postgres belum running / `DATABASE_URL` salah | Cek `docker ps`, cocokkan host/port/user/password dengan `.env` |
| WSL2 lambat mengakses file Windows (`/mnt/c/...`) | Proyek disimpan di filesystem Windows, diakses dari WSL2 | Simpan project di filesystem Linux WSL2 (`~/projects/flowforge`), bukan di `/mnt/c/...` |
| Gemini API `403`/`API key not valid` | Key salah copy atau API belum diaktifkan di project Google Cloud | Generate ulang key di AI Studio, pastikan tidak ada spasi tersalin |
| `EADDRINUSE` saat `npm run dev` | Port 3000/5173 sudah dipakai proses lain | `lsof -i :3000` (macOS/Linux) untuk cari proses, matikan, atau ubah port di `.env`/`vite.config.ts` |

---

*Setelah seluruh langkah di atas selesai, lanjutkan ke `03-AGENT-EXECUTION-GUIDE.md` untuk instruksi eksekusi pembangunan proyek sesuai PRD.*
