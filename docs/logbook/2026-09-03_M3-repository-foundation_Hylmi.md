---
tanggal: 03/09/26
milestone: M3 Repository Foundation
fitur: setup environment monorepo (pnpm + Turborepo + Flutter + Next + Express/Prisma)
pic: Hylmi (PIC C - Backend Engineer)
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi; Dehan (PIC B - Web) cadangan
status: done
model_ai: reasonix (agent) / model dinamis environment
provider_ai: reasonix
versi_model: n/a
cakupan_ai: code, docs
prompt_disimpan: false
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M3 tetap done karena fondasi dipakai M4 dan M5. Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
---

## 1. Ringkasan

Menyiapkan repository sebagai monorepo (pnpm + Turborepo) sesuai target struktur pada
`docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`. Scaffold tiga area: `apps/mobile` (Flutter),
`apps/dashboard` (Next.js 16 + TS + Tailwind CSS 4), dan `services/api` (Express + TS +
Prisma 7). Database PostgreSQL 18 dibuat di workstation (FlyEnv) dan schema Prisma
telah di-migrate. Entry ini berstatus `done`; backend kemudian di-freeze pada M5 karena
fondasi M3 dipakai oleh M4 dan M5.

## 2. Fitur atau scope

- Root monorepo: `pnpm-workspace.yaml`, root `package.json`, `turbo.json`, `.npmrc`.
- Service API Express + TypeScript (ESM) + health endpoint saja.
- Prisma 7 schema sesuai model data roadmap dan migration `init`.
- App mobile Flutter skeleton (android/ios/web).
- Dashboard Next.js shell (App Router).
- Instruksi menjalankan di `README.md` root.

## 4. File yang berubah

| Path | Aksi | Catatan |
|---|---|---|
| pnpm-workspace.yaml | tambah | glob apps/* services/* packages/*; allowBuilds pnpm 11 |
| package.json, turbo.json, .npmrc | tambah | workspace root |
| apps/mobile/ | tambah | flutter create (platform android/ios/web) |
| apps/dashboard/ | tambah | create-next-app (Next 16.3.4, TS, Tailwind 4) |
| services/api/prisma/schema.prisma | tambah | model User/Vehicle/Booking/... per roadmap |
| services/api/prisma.config.ts | tambah | Prisma 7 config + adapter pg |
| services/api/prisma/migrations/20260903153842_init/ | tambah | migration diterapkan |
| services/api/src/* | tambah | server/app/logger, endpoint /health |
| services/api/.env.example | tambah | template tanpa nilai |
| README.md | ubah | panduan run + status |

## 5. Proses dan perintah

```text
pnpm install
pnpm --filter @mobiljuragan/api exec tsx src/server.ts   # GET /health -> 200
TURBO_TELEMETRY_DISABLED=1 pnpm build                    # api tsc + dashboard next build: 2 success
TURBO_TELEMETRY_DISABLED=1 pnpm typecheck                # api + dashboard: 2 success
cd apps/mobile && flutter analyze                        # No issues found
services/api/. bin/prisma migrate dev --name init         # applied 20260903153842_init
psql -U mobiljuragan -d mobiljuragan -c "\dt"            # 8 tabel domain + _prisma_migrations
```

## 6. Hasil dan evidence

- `pnpm build` dan `pnpm typecheck`: Tasks 2 successful (api + dashboard).
- Migration Prisma `20260903153842_init` terapply di PostgreSQL 18 (FlyEnv) database
  `mobiljuragan`; tabel domain terverifikasi lewat `psql`.
- API health: `GET /health` -> `{"status":"ok","service":"mobiljuragan-api",...}`;
  path lain -> 404 `ROUTE_NOT_FOUND` (belum ada endpoint bisnis).
- `flutter analyze`: No issues found.
- Total file baru sekitar hasil scaffold; belum ada commit-bump fitur.

### 6.1 Bukti struktur tabel

`psql \dt` menampilkan 8 tabel domain + `_prisma_migrations` (9 baris).

### 6.2 Commit hash

`045ae9b`

## 7. Kontribusi AI pada entry ini

- Agent Reasonix membantu menulis scaffold, konfigurasi workspace, schema Prisma, dan
  mengeksekusi/memverifikasi perintah.
- Yang AI kerjakan untuk dipakai group adalah penyiapan environment, bukan keputusan
  bisnis final.
- Beberapa kendala teknis disiasati selama setup (dijelaskan di Keputusan teknis).

## 8. Catatan dan blocker

- `packages/api-contract` dan `packages/design-tokens` BELUM dibuat (ditunda menunggu
  keputusan group, lihat Keputusan teknis). Masih tercantum hanya pada roadmap.
- Belum ada endpoint/business logic selain `/health`.
- Database Prisma memakai local PostgreSQL FlyEnv; alokasi role `mobiljuragan` diberi
  `CREATEDB` agar migrate dev dapat membuat shadow database.
- `.env` lokal (`services/api/.env`) ter-ignore dan tidak ikut push; `.env.example`
  di-commit tanpa nilai rahasia.

## 9. Keputusan teknis

```text
- Memakai pnpm + Turborepo (dec: option pnpm+turbo).
- Prisma versi 7 + @prisma/adapter-pg (dec: Prisma7; schema tidak pakai datasource.url;
  connection dipindah ke prisma.config.ts + dotenv).
- Database: migrasi sungguhan ke PostgreSQL 18 lokal (FlyEnv) pada setup awal ini.
- Shared packages (api-contract & design-tokens) DITUNDA dibuat sampai group memilih
  format (OpenAPI-driven vs TS-schema-first) dan strategi transform design-tokens.
- Build approvals paket (prisma/esbuild/unrs) dicatat sebagai allowBuilds di
  pnpm-workspace.yaml memakai pnpm approve-builds <pkg>.
- apps/mobile skeleton dibuat untuk platform android/ios/web; target produksi (Android
  saja vs Android+iOS) masih keputusan terbuka group.
```

## 10. Checklist reviewer

- [x] Tim menyetujui atau menolak keputusan pada bagian 9.
- [x] Role/PIC (A/B/C/D) diisi dengan nama/inisial.
- [x] Menentukan apakah shared packages dibuat sekarang dan formatnya.
- [ ] Menentukan target platform Flutter produksi.
- [x] Mencatat keputusan final (terima/tolak) pada decision record group.
