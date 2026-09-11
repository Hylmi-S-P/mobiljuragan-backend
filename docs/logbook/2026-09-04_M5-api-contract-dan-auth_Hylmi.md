---
tanggal: 04/09/26
milestone: M5 API Contract dan Authentication
fitur: Format response standar, Customer OTP, Admin Login, Role Middleware, dan OpenAPI spec
pic: Hylmi (PIC C - Backend Engineer)
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi
status: done
model_ai: Antigravity / Gemini 3.8 Flash
provider_ai: Google
versi_model: Flash
cakupan_ai: code, docs
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M5 adalah milestone backend terakhir yang aktif (single source of truth API + auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
prompt_disimpan: false
---

## 1. Ringkasan

Menyelesaikan Milestone M5 sesuai panduan `docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`.
Membangun kontrak REST API `/api/v1` dan sistem autentikasi backend (`@mobiljuragan/api`)
sebagai sumber kebenaran tunggal untuk client Customer Mobile (Flutter) dan Admin Dashboard (Next.js).
Menyediakan format respons sukses dan error yang terstandarisasi, validasi schema Zod, alur OTP customer
(hash crypto SHA-256 + salt, batas 5 kali percobaan, masa berlaku 5 menit), login staf/admin dengan sandi bcrypt
dan pencatatan audit log, serta middleware proteksi role berbasis JWT.

## 2. Fitur atau scope

- **Format Response & Error Standar:**
  - Sukses: `{ "status": "ok", "data": { ... } }`
  - Error: `{ "error": { "code": string, "message": string, "details": object } }`
- **Customer Auth (`/api/v1/auth/*`):**
  - `POST /api/v1/auth/otp/request`: Validasi nomor telepon Indonesia, generate OTP 6-digit, simpan hash ke `otp_verifications` (plaintext tidak pernah disimpan).
  - `POST /api/v1/auth/otp/verify`: Cek attempt limit (maks 5), cek expiry, verifikasi hash timing-safe, tandai consumed, dan terbitkan JWT token.
- **Admin Auth (`/api/v1/admin/auth/*`):**
  - `POST /api/v1/admin/auth/login`: Login staf/admin via bcrypt, pencatatan otomatis ke tabel `audit_logs`, dan penerbitan JWT admin.
  - `GET /api/v1/admin/auth/me`: Endpoint terproteksi untuk mengambil data profil staf/admin yang aktif.
- **Middleware:**
  - `validateBody`, `validateQuery`, `validateParams` berbasis Zod.
  - `requireAuth`: Verifikasi Bearer token JWT dan status keaktifan user di database.
  - `requireRole`: Pembatasan akses berbasis role (`CUSTOMER`, `STAFF`, `ADMIN`).
  - `errorHandler`: Global error handling terpusat.
- **Kontrak Dokumentasi:**
  - Pembuatan file spesifikasi `docs/api/openapi.yaml` (OpenAPI 3.0.3).

## 3. File yang berubah

| Path | Aksi | Catatan |
|---|---|---|
| services/api/package.json | ubah | Tambah dependencies bcryptjs, cors, jsonwebtoken; tambah script test |
| services/api/src/utils/response.ts | tambah | Helper format respons sendSuccess, sendError, AppError |
| services/api/src/utils/auth.ts | tambah | Helper hashing OTP, bcrypt, JWT sign & verify |
| services/api/src/middleware/errorHandler.ts | tambah | Global error handler Express terstandarisasi |
| services/api/src/middleware/validate.ts | tambah | Middleware validasi input Zod |
| services/api/src/middleware/auth.ts | tambah | Middleware requireAuth dan requireRole |
| services/api/src/routes/v1/auth.ts | tambah | Controller OTP request dan verify untuk customer |
| services/api/src/routes/v1/adminAuth.ts | tambah | Controller admin login dan profil /me |
| services/api/src/routes/v1/index.ts | tambah | Router agregator /api/v1 |
| services/api/src/app.ts | ubah | Pendaftaran CORS, v1Router, dan errorHandler |
| services/api/prisma/seed.ts | ubah | Seeding akun admin dan staf awal ber-hash |
| services/api/src/test-auth.ts | tambah | Test suite otomatis 9 skenario pengujian auth |
| docs/api/openapi.yaml | tambah | Spesifikasi OpenAPI 3.0.3 resmi |
| docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md | tambah | Logbook evidence pengerjaan M5 |

## 4. Proses dan perintah

```bash
# 1. Seeding data staf & admin ke database PostgreSQL
pnpm --filter @mobiljuragan/api run prisma:seed

# 2. Menjalankan test suite otomatis auth
pnpm --filter @mobiljuragan/api test

# 3. Menjalankan typecheck & build monorepo
pnpm typecheck
pnpm build
```

## 5. Hasil dan evidence

Output eksekusi test suite otomatis (`pnpm --filter @mobiljuragan/api test`):
```text
Memulai pengujian otomatis endpoint Auth M5...

1. Health Check: PASSED
2. Request OTP Customer: PASSED (OTP dibuat & hash tersimpan)
3. Verify OTP Salah (harus 400): PASSED
4. Verify OTP Benar (harus 200 & return token): PASSED
5. Replay OTP Consumed (harus ditolak 400): PASSED
6. Admin Login Salah (harus 401): PASSED
7. Admin Login Berhasil (harus 200 & return token): PASSED
8. Customer Akses Admin /me (harus 403 FORBIDDEN): PASSED
9. Admin Akses Admin /me (harus 200 & user role ADMIN): PASSED

SEMUA 9 PENGUJIAN OTOMATIS AUTH M5 LOLOS 100%!
```

- Typecheck monorepo (`pnpm typecheck`): 2 successful (@mobiljuragan/api, @mobiljuragan/dashboard).
- Build monorepo (`pnpm build`): 2 successful.
- Keamanan: Plaintext OTP tidak disimpan di database; sandi admin memakai hash bcrypt; endpoint staf/admin mencatat record ke `audit_logs`.

### 5.1 Sample response `POST /api/v1/auth/otp/request`

```json
{"status":"ok","data":{"phoneHash":"<redacted>","expiresIn":300,"attemptLimit":5}}
```

- Commit hash pendek: `045ae9b`

## 6. Kontribusi AI pada entry ini

- Model AI membantu menyusun struktur arsitektur modular router `/api/v1` dan middleware.
- AI menyusun test suite otomatis untuk memvalidasi alur auth secara end-to-end tanpa manual clicking.
- AI menyusun dokumentasi kontrak `docs/api/openapi.yaml`.

## 7. Catatan dan blocker

- Milestone M5 selesai dengan status `done`.
- Per pivot tim 10/09/26, M6+ (Vehicle & availability API: `GET /api/v1/vehicles` dan detail armada) DITUNDA sampai hi-fi flow final disetujui. Selama freeze, PIC C tidak menambah endpoint baru. Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.

## 8. Checklist reviewer

- [x] Plaintext OTP tidak disimpan di database (hanya hash crypto).
- [x] Pembatasan attempt count dan kedaluwarsa OTP terbukti berfungsi.
- [x] Otorisasi role bekerja di backend (customer diblokir 403 saat mengakses rute admin).
- [x] Spesifikasi OpenAPI telah dibuat di `docs/api/openapi.yaml`.
- [x] Seluruh 9 pengujian otomatis lolos dan build monorepo hijau.
