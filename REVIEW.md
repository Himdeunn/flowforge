# REVIEW.md — Code Review: Flawed Code Analysis

> Format ini mengikuti komentar PR sungguhan: setiap temuan mencantumkan lokasi file, baris kode yang bermasalah, analisis bug/antipattern, dan saran perbaikan yang konkret.

---

## File: `sample-flawed-code/workflow-runner.js`
*(File ini disimulasikan untuk kebutuhan assessment — contoh kode cacat yang perlu direview)*

---

### 🔴 Bug #1 — SQL Injection via String Interpolation

```js
// ❌ CACAT: Line 12
const result = await db.query(`SELECT * FROM workflows WHERE tenant_id = '${tenantId}'`);
```

**Masalah:** `tenantId` langsung diinterpolasi ke dalam query SQL tanpa sanitasi atau parameterisasi. Jika `tenantId` berasal dari input user yang tidak tervalidasi, ini membuka celah SQL injection klasik.

**Contoh exploit:**
```
tenantId = "' OR '1'='1"
→ SELECT * FROM workflows WHERE tenant_id = '' OR '1'='1'
→ Mengembalikan semua workflow dari semua tenant
```

**Saran Perbaikan:**
```js
// ✅ Gunakan parameterized query
const result = await db.query('SELECT * FROM workflows WHERE tenant_id = $1', [tenantId]);
// Atau gunakan Prisma ORM yang menggunakan parameterized query by design:
const workflows = await prisma.workflowDefinition.findMany({ where: { tenantId } });
```

---

### 🔴 Bug #2 — Password Disimpan Plain Text

```js
// ❌ CACAT: Line 34
await db.query(`INSERT INTO users (email, password) VALUES ($1, $2)`, [email, password]);
```

**Masalah:** Password disimpan tanpa hashing. Jika database bocor (dump), semua password user langsung terbaca. Ini melanggar prinsip "defence in depth" dan OWASP A02:2021 (Cryptographic Failures).

**Saran Perbaikan:**
```js
// ✅ Hash dengan bcrypt sebelum menyimpan
import * as bcrypt from 'bcrypt';
const passwordHash = await bcrypt.hash(password, 10); // cost factor 10+
await db.query(`INSERT INTO users (email, password_hash) VALUES ($1, $2)`, [email, passwordHash]);
```

---

### 🟠 Bug #3 — Race Condition pada Versioning (Missing Transaction)

```js
// ❌ CACAT: Lines 67–82
const currentMax = await db.query('SELECT MAX(version_number) FROM workflow_versions WHERE workflow_id = $1', [workflowId]);
const nextVersion = currentMax.rows[0].max + 1;
await db.query('INSERT INTO workflow_versions (workflow_id, version_number, ...) VALUES ($1, $2, ...)', [workflowId, nextVersion]);
```

**Masalah:** Operasi `SELECT MAX` → `INSERT` dilakukan dalam dua query terpisah tanpa transaction. Jika dua request concurrent keduanya membaca `MAX = 5`, keduanya akan mencoba INSERT dengan `version_number = 6` → Unique constraint violation atau data duplikat.

**Saran Perbaikan:**
```js
// ✅ Gunakan database transaction + SELECT FOR UPDATE, atau gunakan SEQUENCE
await prisma.$transaction(async (tx) => {
  const versions = await tx.workflowVersion.findMany({
    where: { workflowId },
    orderBy: { versionNumber: 'desc' },
    take: 1,
    // Prisma tidak langsung support FOR UPDATE tapi transaction + single read sudah aman
  });
  const nextVersion = (versions[0]?.versionNumber ?? 0) + 1;
  await tx.workflowVersion.create({ data: { workflowId, versionNumber: nextVersion, ... } });
});
```

---

### 🟠 Bug #4 — Unhandled Promise Rejection dalam Loop

```js
// ❌ CACAT: Lines 95–105
steps.forEach(async (step) => {
  const result = await executeStep(step);
  await saveResult(result);
});
// kode berlanjut ke baris berikutnya tanpa menunggu semua step selesai
```

**Masalah:** `Array.forEach` tidak menunggu callback async — semua step dilaunching serentak dan error apapun tidak tertangkap (unhandled promise rejection). `saveResult` mungkin dipanggil setelah workflow sudah dianggap selesai.

**Saran Perbaikan:**
```js
// ✅ Gunakan Promise.all untuk parallelisme dengan proper error handling
try {
  await Promise.all(steps.map(async (step) => {
    const result = await executeStep(step);
    await saveResult(result);
  }));
} catch (err) {
  // centralized error handling
  await markWorkflowFailed(runId, err.message);
}
```

---

### 🟡 Bug #5 — tenantId Diambil dari Request Body (Bukan JWT)

```js
// ❌ CACAT: Line 119
const { tenantId } = req.body;
const workflows = await workflowService.findAll(tenantId);
```

**Masalah:** `tenantId` diambil dari body request yang dikontrol client. Seorang user dari Tenant A dapat memasukkan `tenantId` milik Tenant B dan mengakses data mereka — ini adalah Broken Object Level Authorization (BOLA/IDOR), OWASP A01:2021.

**Saran Perbaikan:**
```js
// ✅ Ambil tenantId HANYA dari JWT claim (server-trusted)
const tenantId = req.user.tenantId; // diisi oleh JWT strategy setelah verifikasi token
const workflows = await workflowService.findAll(tenantId);
```

---

### 🟡 Bug #6 — Retry Loop Tanpa Backoff (Busy-Wait)

```js
// ❌ CACAT: Lines 143–155
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await httpClient.post(url, payload);
  } catch (err) {
    if (attempt === maxRetries - 1) throw err;
    // langsung retry tanpa delay
  }
}
```

**Masalah:** Retry langsung tanpa jeda (busy-wait). Jika service downstream sedang overloaded, ini memperburuk kondisi dengan membanjiri service tersebut dengan request berturut-turut.

**Saran Perbaikan:**
```js
// ✅ Exponential backoff: delay = baseDelayMs * 2^attempt, max cap maxDelayMs
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await httpClient.post(url, payload);
  } catch (err) {
    if (attempt === maxRetries - 1) throw err;
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
```

---

### 🟡 Bug #7 — Secret Hardcoded dalam Source Code

```js
// ❌ CACAT: Line 8
const JWT_SECRET = 'supersecretkey123';
```

**Masalah:** Secret JWT hardcoded di source code. Siapapun yang memiliki akses ke repository (termasuk melalui git history) dapat memalsukan token JWT.

**Saran Perbaikan:**
```js
// ✅ Gunakan environment variable, load via ConfigService
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
if (!JWT_SECRET) throw new Error('JWT_ACCESS_SECRET is not set');
```
Dan pastikan `.env` ada di `.gitignore`.

---

### 📊 Ringkasan Temuan

| # | Severity | Kategori | File:Line | Status |
|---|----------|----------|-----------|--------|
| 1 | 🔴 Critical | Security — SQL Injection | workflow-runner.js:12 | Harus diperbaiki sebelum production |
| 2 | 🔴 Critical | Security — Plaintext Password | workflow-runner.js:34 | Harus diperbaiki sebelum production |
| 3 | 🟠 High | Concurrency — Race Condition | workflow-runner.js:67 | Perbaiki dalam sprint ini |
| 4 | 🟠 High | Correctness — Unhandled Promise | workflow-runner.js:95 | Perbaiki dalam sprint ini |
| 5 | 🟡 Medium | Security — IDOR/BOLA | workflow-runner.js:119 | Perbaiki sebelum beta |
| 6 | 🟡 Medium | Reliability — Busy-wait Retry | workflow-runner.js:143 | Perbaiki sebelum beta |
| 7 | 🟡 Medium | Security — Hardcoded Secret | workflow-runner.js:8 | Perbaiki segera, rotate secret |
