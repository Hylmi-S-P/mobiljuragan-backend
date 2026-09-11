---
tanggal: 04/09/26
milestone: M4 Database Foundation
fitur: Seeding 9 armada resmi Merauke dan inisialisasi singleton database client
pic: Hylmi (PIC C - Backend Engineer)
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi
status: done
model_ai: Antigravity / Gemini 3.8 Flash
provider_ai: Google
versi_model: Flash
cakupan_ai: code, docs
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M4 tetap done sebagai fondasi M5 (database singleton + seed dipakai endpoint auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
prompt_disimpan: false
---

## 1. Ringkasan

Menyelesaikan Milestone M4 sesuai target pada `docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`.
Membuat skrip seed resmi di Prisma (`services/api/prisma/seed.ts`) untuk memasukkan 9 armada
resmi CV. Mobil Juragan Express Transport (Merauke) ke database PostgreSQL 18 lokal.
Membuat singleton database client (`services/api/src/db.ts`) dengan adapter `@prisma/adapter-pg`
agar siap dikonsumsi oleh endpoint API pada milestone M5/M6.
Seluruh data armada mematuhi Hard Gate integritas data (tidak ada rekaan harga, rating, atau data fiktif).

## 2. Fitur atau scope

- Pembuatan `services/api/prisma/seed.ts` berisi daftar 9 armada resmi:
  1. AVANZA G PUTIH (PS1692B)
  2. FORTUNER VRZ TRD HITAM (B8833AKU)
  3. HILUX G HITAM (PA8593GZ)
  4. INNOVA REBORN G HITAM (PA1504G)
  5. PICKUP SUZUKI CARRY HITAM (B9762BAY)
  6. RUSH G ALL NEW COKLAT (PA1696GG)
  7. TERIOS X HIJAU MATIC (B2534KRB)
  8. VELOZ MERAH (PS1693B)
  9. XPANDER EXCEED HITAM (PS1691B)
- Implementasi operasi `upsert` pada skrip seed agar idempoten dan aman dieksekusi berulang.
- Pembuatan instance singleton database client pada `services/api/src/db.ts`.
- Pendaftaran konfigurasi seed pada `services/api/prisma.config.ts` (bagian `migrations.seed`)
  dan penambahan script `prisma:seed` pada `services/api/package.json`.

## 3. File yang berubah

| Path | Aksi | Catatan |
|---|---|---|
| services/api/prisma/seed.ts | tambah | Skrip seed 9 kendaraan resmi Merauke |
| services/api/src/db.ts | tambah | Singleton PrismaClient dengan PrismaPg adapter |
| services/api/prisma.config.ts | ubah | Menambahkan konfigurasi `seed: 'tsx prisma/seed.ts'` pada migrations |
| services/api/package.json | ubah | Menambahkan script `prisma:seed` |
| docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md | tambah | Logbook evidence pengerjaan M4 |

## 4. Proses dan perintah

```bash
# 1. Menjalankan typecheck
pnpm --filter @mobiljuragan/api typecheck

# 2. Menjalankan proses seeding ke database PostgreSQL
pnpm --filter @mobiljuragan/api run prisma:seed

# 3. Verifikasi build monorepo
pnpm build
```

## 5. Hasil dan evidence

Output eksekusi seeding:
```text
$ prisma db seed
Loaded Prisma config from prisma.config.ts.

Running seed command `tsx prisma/seed.ts` ...
Memulai seeding 9 armada resmi MobilJuragan...
  Tersimpan: AVANZA G PUTIH (PS1692B)
  Tersimpan: FORTUNER VRZ TRD HITAM (B8833AKU)
  Tersimpan: HILUX G HITAM (PA8593GZ)
  Tersimpan: INNOVA REBORN G HITAM (PA1504G)
  Tersimpan: PICKUP SUZUKI CARRY HITAM (B9762BAY)
  Tersimpan: RUSH G ALL NEW COKLAT (PA1696GG)
  Tersimpan: TERIOS X HIJAU MATIC (B2534KRB)
  Tersimpan: VELOZ MERAH (PS1693B)
  Tersimpan: XPANDER EXCEED HITAM (PS1691B)

Seeding selesai! Total kendaraan di database: 9
The seed command has been executed.
```

- Typecheck monorepo (`pnpm typecheck`): 2 successful (@mobiljuragan/api, @mobiljuragan/dashboard).
- Build monorepo (`pnpm build`): 2 successful.
- Data integrity: tepat 9 kendaraan terdaftar dengan status awal `AVAILABLE` tanpa ada hardcode harga angka.
- `psql -U mobiljuragan -d mobiljuragan -c "\dt"`: 9 tabel (8 domain + `_prisma_migrations`).
- Commit hash pendek: `045ae9b`

## 6. Kontribusi AI pada entry ini

- Model AI membantu menyusun skrip `seed.ts` berdasarkan dataset resmi pada `docs/design-tokens.json`.
- AI mengidentifikasi konfigurasi `migrations.seed` pada spesifikasi Prisma 7.
- Seluruh eksekusi dan verifikasi terminal dijalankan secara langsung dengan hasil lolos 100%.

## 7. Catatan dan blocker

- Milestone M4 telah selesai sepenuhnya (status `done`).
- Siap melanjutkan ke Milestone M5 (API contract, error format standar, dan auth) serta M6 (Vehicle & availability API).

## 8. Checklist reviewer

- [x] Tepat 9 kendaraan resmi yang di-seed (tidak ada armada di luar daftar resmi).
- [x] Tidak ada harga fiktif atau data rekaan yang melanggar batasan data integrity.
- [x] Typecheck dan build lolos tanpa error.
- [x] Singleton `db.ts` siap digunakan untuk endpoint backend berikutnya.
