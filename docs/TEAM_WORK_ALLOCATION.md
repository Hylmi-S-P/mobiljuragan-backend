# Pembagian Kerja Team & Personal Milestone MobilJuragan

> Dokumen resmi penugasan anggota tim dan rincian **Personal Milestone** per PIC.  
> **Prinsip Utama:** Setiap *General Milestone* (M1–M16) pada roadmap merupakan gabungan dari target personal yang harus diselesaikan oleh PIC terkait. Sebuah General Milestone baru dinyatakan tercapai (*Done*) apabila seluruh Personal Milestone dari PIC yang terlibat telah diverifikasi dengan bukti teknis (*evidence*).

---

## 1. Profil Tim & Pembagian Role

| Role | Nama Anggota | Fokus Utama | Stack / Tooling Utama | Output Utama |
|---|---|---|---|---|
| **PIC A - Mobile Engineer** | **Harun** | Customer Mobile App | Flutter, Dart, Riverpod, go_router, Dio | Screen & user flow pelanggan (390×844) |
| **PIC B - Web Engineer** | **Dehan** | Admin Web Dashboard | Next.js 16, TypeScript, Tailwind CSS 4, TanStack Query | Screen & workflow staf admin (1440×900) |
| **PIC C - Backend Engineer** | **Hylmi** | Core API & Database | Express.js, TypeScript (ESM), Prisma 7, PostgreSQL 18 | REST API `/api/v1`, DB schema, auth, business logic |
| **PIC D - Integration, QA & Release** | **Halimah** | Quality Gate & Delivery | OpenAPI validator, Design Tokens, Vitest, Logbook Audit | Evidence review, WCAG audit, E2E test, release |

---

## 2. Personal Milestone Track (Jalur Mandiri Tiap Anggota)

Berikut adalah daftar capaian mandiri (*Personal Milestones*) yang wajib diselesaikan dan dilaporkan oleh masing-masing PIC:

### A. Harun (PIC A — Mobile Engineer)
- [x] **PM-A.01 (M1):** Review Information Architecture & flow mobile (9 screen booking + 3 screen bantuan).
- [x] **PM-A.02 (M3):** Setup repository `apps/mobile` (Flutter 3.x skeleton, konfigurasi target Android/Web, `flutter analyze` clean).
- [ ] **PM-A.03 (M6):** Setup HTTP Client Dio, interceptor error standar, dan model entity armada mobil.
- [ ] **PM-A.04 (M7):** Implementasi Mobile Application Shell: Theme data dari token (`docs/design-tokens.json`), routing `go_router`, dan 4 tab navigasi bawah (*Beranda, Pesan, Status, Bantuan*) tanpa overflow pada viewport 390×844.
- [ ] **PM-A.05 (M9):** Implementasi alur utama pemesanan (Home $\to$ Available Vehicles $\to$ Vehicle Detail $\to$ Date & Time $\to$ Rental Options $\to$ Booker Form $\to$ Order Review) terhubung dengan state Riverpod.
- [ ] **PM-A.06 (M10):** Integrasi Phone Verification (input OTP, countdown resend) & Booking Status screen (stepper timeline) untuk persiapan Demo UTS.
- [ ] **PM-A.07 (M14):** Implementasi modul bantuan mobile: Layar FAQ, form Buat Tiket Baru, dan tampilan percakapan chat tiket.
- [ ] **PM-A.08 (M15):** Audit mobile usability: Penanganan keyboard avoid, tap target min 44×44 pt, empty state, dan error banner retry.
- [ ] **PM-A.09 (M16):** Packaging release: Build APK release, pengujian akhir di real device Android, dan finalisasi demo handoff.

### B. Dehan (PIC B — Web Engineer)
- [x] **PM-B.01 (M1):** Review Information Architecture & alur kerja admin dashboard (7 screen utama + modal flows).
- [x] **PM-B.02 (M3):** Setup repository `apps/dashboard` (Next.js 16 App Router, TypeScript, Tailwind CSS 4, build clean).
- [x] **PM-B.03 (M5):** Implementasi Admin Auth Client: Halaman login admin, form handling dengan validasi Zod, penyimpanan session JWT aman, dan route protection client.
- [ ] **PM-B.04 (M11):** Implementasi Dashboard Shell: Layout responsive target 1440×900, collapsible sidebar navigasi, topbar profil staf, dan integrasi design token web.
- [ ] **PM-B.05 (M12):** Implementasi Operasional Booking Admin: Tabel Incoming Bookings dengan filter & pagination, modal rincian pesanan, dan modal update status booking + catatan internal staf.
- [ ] **PM-B.06 (M13):** Implementasi Manajemen Armada Web: Tampilan visual Fleet Calendar (jadwal sewa armada) dan manajemen status 9 armada resmi Merauke.
- [ ] **PM-B.07 (M14):** Implementasi Workspace Customer Care: Antrean tiket masuk, split view chat pesan, aksi *Ambil Alih Chat* dari bot, dan state komposer terkunci/terbuka.
- [ ] **PM-B.08 (M15):** Audit web accessibility: Pengecekan keyboard navigation, kontras rasio warna dashboard, loading skeleton, dan error boundary.
- [ ] **PM-B.09 (M16):** Deployment web dashboard ke staging (Vercel / Staging Server) dan dokumentasi petunjuk operasional admin.

### C. Hylmi (PIC C — Backend Engineer)
- [x] **PM-C.01 (M1):** Perumusan spesifikasi data model relasional (8 entitas) dan penegasan batasan integritas 9 armada resmi.
- [x] **PM-C.02 (M2):** Penyusunan keputusan arsitektur tech stack, single source of truth REST API, dan roadmap teknis.
- [x] **PM-C.03 (M3):** Setup workspace backend `services/api` (Express.js ESM, TypeScript, healthcheck endpoint, logging Pino).
- [x] **PM-C.04 (M4):** Implementasi Database Foundation: Skema Prisma 7, migrasi PostgreSQL 18, singleton db client, dan skrip seed idempoten 9 armada resmi Merauke.
- [x] **PM-C.05 (M5):** Implementasi API Contract & Auth: Standarisasi format respons (`sendSuccess`/`sendError`), customer OTP auth (HMAC SHA-256), admin login (bcrypt + JWT), role middleware, dan penyusunan `docs/api/openapi.yaml`.
- [ ] **PM-C.06 (M6):** Implementasi Vehicle & Availability API: Endpoint `GET /api/v1/vehicles`, detail unit armada, logika query ketersediaan tanggal, dan automated test pencegah bentrok jadwal sewa.
- [ ] **PM-C.07 (M8):** Implementasi Booking Domain Backend: Endpoint `POST /api/v1/bookings` dalam transaksi atomic database, pencatatan otomatis ke `booking_status_histories`, query detail booking, dan tracking status.
- [ ] **PM-C.08 (M12):** Implementasi Admin Booking API: Endpoint `GET /api/v1/admin/bookings`, `PATCH /api/v1/admin/bookings/:id/status`, pencatatan `audit_logs` staf, dan payload intent WhatsApp konfirmasi.
- [ ] **PM-C.09 (M13):** Implementasi Fleet Operations API: Endpoint `GET /api/v1/admin/fleet/calendar` dan endpoint pembaruan status fisik kendaraan.
- [ ] **PM-C.10 (M14):** Implementasi Help & Customer Care API: Endpoint tiket customer, thread pesan chat, admin takeover/return-to-bot sesuai arsitektur handoff.
- [ ] **PM-C.11 (M15):** Backend Hardening: Implementasi rate limiting, security headers (Helmet), audit query performance, dan sanitasi log.
- [ ] **PM-C.12 (M16):** Staging deployment backend pada laptop server via systemd / Tailscale dan finalisasi dokumentasi API runbook.

### D. Halimah (PIC D — Integration, QA & Release Owner)
- [x] **PM-D.01 (M1):** Audit keselarasan IA, alur navigasi, dan integritas token desain (`docs/design-tokens.json` & `docs/MANIFEST.json`).
- [x] **PM-D.02 (M3):** Verifikasi kebersihan build monorepo (`pnpm build`, `pnpm typecheck`, `pnpm lint`) pada setup awal.
- [x] **PM-D.03 (M4):** Verifikasi integritas data seed database (memastikan tidak ada harga fiktif atau kendaraan di luar 9 armada resmi).
- [x] **PM-D.04 (M5):** Review spesifikasi OpenAPI 3.0.3 dan verifikasi hasil eksekusi 9 automated test suite modul autentikasi backend.
- [ ] **PM-D.05 (M6):** Pengujian integrasi Vehicle API: Verifikasi kesesuaian response payload dengan spesifikasi dan validasi edge case bentrok tanggal.
- [ ] **PM-D.06 (M7):** Visual QA Mobile Shell: Pengecekan implementasi tema Harun di Flutter terhadap acuan `docs/design/DESIGN.md` (warna, font, padding).
- [ ] **PM-D.07 (M9):** Integrasi & End-to-End Booking Flow: Pengujian alur pengisian form pemesanan pelanggan, loading indicator, dan penanganan error network.
- [ ] **PM-D.08 (M10):** Koordinasi Demo UTS: Pembuatan skenario demo pemesanan customer end-to-end, pencatatan bukti video/screenshot, dan verifikasi batas mock OTP.
- [ ] **PM-D.09 (M11):** Visual QA Dashboard Shell: Pengecekan layout Dehan di Next.js pada resolusi 1440×900 (memastikan tidak ada sidebar patah atau teks terpotong).
- [ ] **PM-D.10 (M12):** Audit Transaksi Admin: Memverifikasi perubahan status booking oleh admin benar-benar menghasilkan status history dan audit log di backend.
- [ ] **PM-D.11 (M14):** E2E Testing Customer Care: Validasi pengiriman tiket dari aplikasi Harun dan penerimaan balasan di dashboard Dehan.
- [ ] **PM-D.12 (M15):** Lead Quality, Accessibility & Security Audit: Audit kontras warna (WCAG AA), navigasi keyboard, responsivitas multi-device, dan rekap daftar defect.
- [ ] **PM-D.13 (M16):** Release Gatekeeper & Final Handoff: Memeriksa kelengkapan logbook seluruh PIC, menyusun changelog release, dan memimpin persiapan handoff UAS.

---

## 3. Matriks Milestone General (M1–M16) & Rincian Personal Milestone PIC

Tabel di bawah menjelaskan bagaimana setiap **Milestone General** dipecah menjadi tanggung jawab spesifik per individu. Milestone General hanya berstatus `Done` jika seluruh Personal Milestone di baris tersebut telah selesai.

| Milestone | Fokus Milestone | Harun (PIC A) | Dehan (PIC B) | Hylmi (PIC C) | Halimah (PIC D) | Status |
|:---:|---|---|---|---|---|:---:|
| **M1** | **Project Baseline** | PM-A.01: Review IA mobile | PM-B.01: Review IA admin | PM-C.01: Model data 8 tabel & 9 armada | PM-D.01: Audit token & manifest | **Done** |
| **M2** | **Tech Stack Decision** | Review stack mobile (Flutter) | Review stack web (Next.js) | PM-C.02: Rumuskan stack & arsitektur | Validasi kesepakatan tim | **Done** |
| **M3** | **Repository Foundation** | PM-A.02: Setup Flutter shell | PM-B.02: Setup Next.js shell | PM-C.03: Setup Express API & monorepo | PM-D.02: Verifikasi build monorepo | **Done** |
| **M4** | **Database Foundation** | - | - | PM-C.04: Prisma schema, migrasi & seed 9 armada | PM-D.03: Audit integritas data armada | **Done** |
| **M5** | **API Contract & Auth** | Review kontrak auth customer | PM-B.03: Setup admin auth guard web | PM-C.05: Endpoint OTP, login admin & OpenAPI | PM-D.04: Review OpenAPI & test suite | **Done** |
| **M6** | **Vehicle & Availability API** | PM-A.03: Setup Dio & entity mobil | Review format data armada | PM-C.06: Endpoint armada & query availability | PM-D.05: Uji integrasi & conflict check | **In Progress** |
| **M7** | **Flutter App Shell** | PM-A.04: Build shell, token & 4 tab nav | - | Support mock data jika dibutuhkan | PM-D.06: Visual QA tema & viewport 390×844 | **In Progress** |
| **M8** | **Booking Domain Backend** | Persiapan payload booking | - | PM-C.07: Endpoint booking atomic & status | Validasi transaction rule | Planned |
| **M9** | **Customer Booking Flow** | PM-A.05: Screen booking 1 s.d. 7 | - | Support debugging booking API | PM-D.07: E2E booking form & error state | Planned |
| **M10** | **Checkpoint UTS (Demo)** | PM-A.06: Integrasi OTP & Status screen | - | Monitoring service API demo UTS | PM-D.08: Lead koordinasi demo & evidence UTS | Planned |
| **M11** | **Next.js Dashboard Shell** | - | PM-B.04: Layout admin 1440×900 & sidebar | - | PM-D.09: Visual QA viewport 1440×900 | Planned |
| **M12** | **Admin Booking Operations** | - | PM-B.05: Antrean booking & update status | PM-C.08: API admin booking & audit log | PM-D.10: Audit integritas riwayat status | Planned |
| **M13** | **Fleet Operations** | - | PM-B.06: Fleet calendar & status mobil | PM-C.09: API calendar & kondisi armada | Verifikasi sinkronisasi 9 armada | Planned |
| **M14** | **Help & Customer Care** | PM-A.07: Screen tiket & chat mobile | PM-B.07: Workspace chat & takeover bot | PM-C.10: API tiket & state machine handoff | PM-D.11: E2E pengujian pesan chat | Planned |
| **M15** | **Quality, A11y & Security** | PM-A.08: Usability & tap target audit | PM-B.08: Web accessibility audit | PM-C.11: Rate limiting & security headers | PM-D.12: Lead audit WCAG, kontras & defect list | Planned |
| **M16** | **Release & UAS Handoff** | PM-A.09: Build APK release | PM-B.09: Deploy staging web | PM-C.12: Deploy staging backend | PM-D.13: Final checklist, logbook audit & demo UAS | Planned |

---

## 4. Aturan Logbook & Pelaporan Kontribusi

1. **Satu Entry Per Fitur/Milestone:** Setiap anggota menulis entry terpisah menggunakan template [`docs/LOGBOOK_AI_ASSISTED_TEMPLATE.md`](docs/LOGBOOK_AI_ASSISTED_TEMPLATE.md).
2. **Format Penamaan File Logbook:**
   ```text
   docs/logbook/YYYY-MM-DD_<milestone>_<fitur>_<nama-pic>.md
   ```
   Contoh:
   - `docs/logbook/2026-09-12_M6_vehicle-api_Hylmi.md`
   - `docs/logbook/2026-09-14_M7_flutter-shell_Harun.md`
   - `docs/logbook/2026-09-18_M11_dashboard-shell_Dehan.md`
   - `docs/logbook/2026-09-20_M6_qa-vehicle-conflict_Halimah.md`
3. **Klaim Done:** Status `done` hanya boleh disematkan pada logbook setelah reviewer yang ditugaskan memeriksa bukti nyata (*commit*, *screenshot*, *output test*, atau *curl response*).

---

## 5. Rotasi Reviewer Tim

Agar proses review berjalan objektif dan adil:

| Pemilik Tugas | Reviewer Utama | Reviewer Cadangan |
|---|---|---|
| **Harun (Mobile)** | Halimah (QA) | Hylmi (Backend) |
| **Dehan (Web)** | Halimah (QA) | Harun (Mobile) |
| **Hylmi (Backend)** | Halimah (QA) | Dehan (Web) |
| **Halimah (QA/Release)** | Hylmi (Backend) | Harun / Dehan |
