# Planning Tech Stack dan Roadmap MobilJuragan

> Dokumen kerja tim untuk menyepakati arah teknis, membagi pekerjaan, dan mencatat proses pengembangan secara jujur.  
> **Status dokumen:** planning baseline. Setiap Milestone General (M1–M16) merupakan integrasi dari **Personal Milestones** yang dikerjakan oleh masing-masing PIC (Harun, Dehan, Hylmi, Halimah) sebagaimana diatur dalam [`docs/TEAM_WORK_ALLOCATION.md`](docs/TEAM_WORK_ALLOCATION.md).

---

## 1. Ringkasan project

MobilJuragan adalah produk digital rental mobil untuk CV. Mobil Juragan Express Transport di Merauke, Papua Selatan. Produk memiliki dua client utama:

1. **Customer Mobile App** untuk mencari kendaraan, mengirim permintaan rental, melihat status booking, dan meminta bantuan.
2. **Admin Dashboard Web** untuk memproses booking, memeriksa armada, memperbarui status, dan menangani Customer Care.

Backend menjadi sumber business logic bersama. Flutter dan Next.js tidak boleh membuat aturan bisnis yang berbeda-beda.

### Scope MVP

```text
Customer:
Home → Vehicles → Vehicle Detail → Date & Time → Rental Options
→ Booker Form → Order Review → Phone Verification → Booking Status

Admin:
Dashboard Overview → Incoming Bookings → Booking Detail
→ Booking Status Update

Operasional:
Fleet Calendar, Vehicle Status, Customer Care

Bantuan:
FAQ → New Ticket → Ticket Chat → Customer Care admin
```

### Batasan yang wajib dijaga

- Tarif belum boleh di-hardcode sebagai angka. Gunakan `Tarif dikonfirmasi tim MobilJuragan` atau `Menunggu konfirmasi tarif`.
- Data simulasi harus diberi label `Data contoh`.
- Hanya sembilan kendaraan resmi pada `docs/design-tokens.json` yang boleh masuk ke seed/demo data.
- OTP, availability, WhatsApp, dan status booking pada prototype belum dianggap terhubung sampai backend benar-benar mengimplementasikannya.
- Fitur seperti rating, review, promo, payment gateway, chatbot AI, dan statistik pendapatan bukan scope MVP kecuali team menyetujui perubahan scope secara tertulis.

---

## 2. Keputusan tech stack yang direkomendasikan

| Layer | Pilihan | Peran |
|---|---|---|
| Customer mobile | Flutter + Dart | Implementasi aplikasi pelanggan (PIC A: Harun) |
| Admin web | Next.js 16 + TypeScript | Implementasi dashboard admin/staf (PIC B: Dehan) |
| Backend API | Express.js + TypeScript (ESM) | REST API dan satu sumber business logic (PIC C: Hylmi) |
| Database | PostgreSQL 18 | Data relational booking, kendaraan, user, dan ticket |
| ORM | Prisma 7 | Schema, migration, query, dan seed |
| API contract | REST JSON + OpenAPI 3.0.3 | Kontrak komunikasi antar-client dan backend |
| Mobile state | Riverpod | Server state dan booking flow state di Flutter |
| Mobile routing | go_router | Routing dan guard pada Flutter |
| Mobile HTTP | Dio | HTTP client, interceptor, dan error handling |
| Web server state | TanStack Query | Fetching, cache, loading, dan error state di Next.js |
| Web styling | Tailwind CSS 4 | Implementasi token dari Figma |
| Validation | Zod di API dan dashboard | Validasi input konsisten |
| Logging | Pino | Structured logging pada backend |
| Security baseline | Helmet, CORS allowlist, rate limit, bcrypt/HMAC | Hardening API dan authentication |
| Quality & Delivery | OpenAPI Validator, Vitest, WCAG | Audit integrasi & evidence gate (PIC D: Halimah) |

### Keputusan database

**PostgreSQL + Prisma** adalah rekomendasi utama.

Alasannya:

- Booking memiliki relasi jelas dengan customer, vehicle, status history, dan ticket.
- Availability membutuhkan query rentang tanggal.
- Pembuatan booking dan pengecekan konflik harus dapat dijalankan dalam transaction.
- Foreign key, unique constraint, index, dan enum membantu menjaga integritas data.
- PostgreSQL cukup kuat untuk MVP tanpa menambah kompleksitas microservices.

MongoDB atau Firebase tidak dipilih sebagai database utama karena struktur booking MobilJuragan lebih relational daripada document-first. Redis juga belum masuk MVP; tambahkan hanya jika nanti benar-benar ada kebutuhan cache, queue OTP/WhatsApp, atau background job.

### Arsitektur aplikasi

```text
Flutter Customer App ───────┐
                            ├─-─ REST /api/v1 ─-─ Express API ─-─ Prisma ─-─ PostgreSQL
Next.js Admin Dashboard ────┘                         │
                                                      └─-─ OTP / WhatsApp provider (later)
```

### Struktur repository target

```text
apps/
├── mobile/                 # Flutter customer app (Harun)
└── dashboard/              # Next.js admin dashboard (Dehan)
services/
└── api/                    # Express.js API (Hylmi)
packages/
├── api-contract/           # OpenAPI dan response contract
└── design-tokens/          # Token yang dipakai lintas client
docs/                       # Figma export, IA, flow, logbook, dan planning (Halimah & All)
```

`docs/design-tokens.json` dan `docs/MANIFEST.json` menjadi referensi awal. Token boleh ditransformasikan ke CSS/Flutter, tetapi nilai dan aturan desainnya tidak boleh berubah tanpa keputusan team.

---

## 3. Model data awal

Schema awal diprioritaskan pada model berikut:

```text
User
├── Booking
│   ├── Vehicle
│   └── BookingStatusHistory
├── SupportTicket
│   └── TicketMessage
└── OtpVerification

Admin action ── AuditLog
```

### Entitas minimum

- `users`: customer, staff, admin, nomor telepon, dan credential admin.
- `vehicles`: sembilan kendaraan resmi, plat nomor, status operasional, dan optional image URL.
- `bookings`: customer, vehicle, rental period, rental type, pickup location, request, tariff status, amount nullable, dan booking status.
- `booking_status_history`: status sebelum/sesudah, catatan internal, actor, dan waktu perubahan.
- `otp_verifications`: hash OTP, expiry, attempt count, dan consumed time. OTP plain text tidak disimpan.
- `support_tickets`: title, category, description, dan ticket status.
- `ticket_messages`: pesan customer/admin dan waktu pengiriman.
- `audit_logs`: aktivitas penting admin.

### Business rules minimum

1. `vehicle_id` harus berasal dari sembilan kendaraan resmi.
2. Booking dengan tanggal yang bertabrakan tidak boleh diterima untuk kendaraan yang sama.
3. Pemeriksaan availability dan insert booking harus dilindungi transaction.
4. `quoted_amount` boleh `null` sampai tarif dikonfirmasi tim.
5. Perubahan status booking harus membuat record pada `booking_status_history`.
6. Endpoint admin wajib memeriksa role di backend, bukan hanya menyembunyikan menu di Next.js.
7. Data demo diberi penanda `Data contoh`; jangan mencampurnya dengan klaim data produksi.

---

## 4. Kontrak API awal

Prefix API:

```text
/api/v1
```

### Customer

```text
POST   /auth/otp/request
POST   /auth/otp/verify
GET    /vehicles
GET    /vehicles/:vehicleId
POST   /bookings
GET    /bookings/:bookingId
GET    /bookings/:bookingId/status
POST   /tickets
GET    /tickets
GET    /tickets/:ticketId
POST   /tickets/:ticketId/messages
```

### Admin

```text
POST   /admin/auth/login
GET    /admin/bookings
GET    /admin/bookings/:bookingId
PATCH  /admin/bookings/:bookingId/status
GET    /admin/fleet/calendar
GET    /admin/vehicles/status
GET    /admin/tickets
GET    /admin/tickets/:ticketId
POST   /admin/tickets/:ticketId/messages
```

Response error harus konsisten, misalnya:

```json
{
  "error": {
    "code": "BOOKING_VEHICLE_UNAVAILABLE",
    "message": "Kendaraan belum tersedia untuk tanggal yang dipilih.",
    "details": {}
  }
}
```

---

## 5. Roadmap 16 Milestone Terintegrasi dengan Personal Milestone PIC

> **Koreksi Terhadap Milestone General:**  
> Milestone di bawah ini tidak lagi bersifat umum dan anonim. Setiap milestone general dipecah menjadi target capaian personal (*Personal Milestones*) milik **Harun (PIC A)**, **Dehan (PIC B)**, **Hylmi (PIC C)**, dan **Halimah (PIC D)**.  
> Sebuah milestone general dinyatakan `done` hanya jika seluruh personal milestone di dalamnya telah diselesaikan dan diverifikasi.

### Status yang digunakan

- `planned`: belum dikerjakan.
- `in progress`: sedang dikerjakan, harus memiliki catatan evidence sementara.
- `done`: selesai dan seluruh personal milestone terkait sudah diverifikasi.
- `blocked`: terhambat oleh dependency yang belum tersedia.

| Minggu | Milestone General | Rincian Personal Milestone PIC Penanggung Jawab | Output & Evidence Terverifikasi | Status |
|:---:|---|---|---|:---:|
| **1** | **M1. Project baseline** | • **Harun (PM-A.01):** Review alur & IA 9 screen booking mobile.<br>• **Dehan (PM-B.01):** Review alur & IA 7 screen admin web.<br>• **Hylmi (PM-C.01):** Finalisasi model 8 tabel relasional & 9 armada.<br>• **Halimah (PM-D.01):** Audit sinkronisasi token desain & manifest. | Dokumen baseline, IA, flow, manifest visual, dan token desain disetujui tim. | **Done** |
| **1** | **M2. Tech stack decision** | • **Harun:** Review kecocokan stack Flutter & Riverpod.<br>• **Dehan:** Review kecocokan stack Next.js & Tailwind 4.<br>• **Hylmi (PM-C.02):** Perumusan arsitektur REST API & database.<br>• **Halimah:** Validasi kesepakatan delivery gate bersama. | Dokumen kesepakatan teknis, data model, dan batasan produk tersimpan. | **Done** |
| **2** | **M3. Repository foundation** | • **Harun (PM-A.02):** Inisialisasi mobile skeleton `apps/mobile`.<br>• **Dehan (PM-B.02):** Inisialisasi web skeleton `apps/dashboard`.<br>• **Hylmi (PM-C.03):** Setup root monorepo & Express API `services/api`.<br>• **Halimah (PM-D.02):** Validasi reproduksi build & typecheck monorepo. | Root monorepo `pnpm dev`, `build`, dan `typecheck` berhasil tanpa error. | **Done** |
| **3** | **M4. Database foundation** | • **Hylmi (PM-C.04):** Skema Prisma 7, migrasi PostgreSQL, singleton client, dan seed 9 armada resmi Merauke.<br>• **Halimah (PM-D.03):** Audit integritas tabel DB & verifikasi tidak ada harga fiktif. | Migration berhasil dijalankan; seed 9 kendaraan resmi terisi; DB test passing. | **Done** |
| **4** | **M5. API contract & auth** | • **Hylmi (PM-C.05):** Standard envelope, Zod schema, customer OTP HMAC, admin login bcrypt+JWT, OpenAPI 3.0.3.<br>• **Dehan (PM-B.03):** Setup login admin web guard & session storage.<br>• **Halimah (PM-D.04):** Audit 9 automated test auth & validasi `openapi.yaml`. | 9/9 test backend lolos; OTP aman tanpa plaintext; spec OpenAPI terverifikasi. | **Done** |
| **5** | **M6. Vehicle & availability API** | • **Hylmi (PM-C.06):** Endpoint `GET /vehicles`, detail, query availability rentang tanggal, conflict test.<br>• **Harun (PM-A.03):** Setup Dio client & model entity armada di Flutter.<br>• **Halimah (PM-D.05):** Pengujian integrasi API ketersediaan & skenario bentrok jadwal. | Endpoint kendaraan aktif; filter bekerja; test deteksi bentrok tanggal lulus. | **In Progress** |
| **5** | **M7. Flutter application shell** | • **Harun (PM-A.04):** Theme data Inter/brand, routing `go_router`, 4 tab Bottom Nav (*Beranda, Pesan, Status, Bantuan*).<br>• **Halimah (PM-D.06):** Visual QA kesesuaian tema & viewport 390×844 tanpa overflow. | Shell Flutter berjalan mulus di target Android/Web tanpa horizontal overflow. | **In Progress** |
| **6** | **M8. Booking domain backend** | • **Hylmi (PM-C.07):** Endpoint `POST /bookings` dalam transaksi atomic DB, auto-record status history, query detail booking.<br>• **Halimah:** Validasi aturan bisnis: tarif sewa wajib nullable sampai dikonfirmasi. | Booking tersimpan secara atomic; bentrok jadwal ditolak otomatis oleh DB. | Planned |
| **7** | **M9. Customer booking flow** | • **Harun (PM-A.05):** Layar Home sampai Order Review terintegrasi state Riverpod & API.<br>• **Halimah (PM-D.07):** E2E testing form pemesanan pelanggan & error recovery. | Pengguna dapat memilih mobil, tanggal sewa, mengisi data, dan review order. | Planned |
| **8** | **M10. Checkpoint UTS / Prototype** | • **Harun (PM-A.06):** Integrasi Phone Verification OTP & Booking Status timeline.<br>• **Halimah (PM-D.08):** Lead skenario demo UTS, rekap rekaman video/screenshot.<br>• **Hylmi & Dehan:** Support backend & admin review untuk demo. | Demo customer booking end-to-end berjalan lancar untuk penilaian UTS. | Planned |
| **9** | **M11. Next.js dashboard shell** | • **Dehan (PM-B.04):** Layout dashboard 1440×900, collapsible sidebar, topbar profil, route guard.<br>• **Halimah (PM-D.09):** Visual QA dashboard layout & responsivitas desktop. | Dashboard web berjalan rapi; layout 1440×900 tidak overlap; akses non-admin ditolak. | Planned |
| **10** | **M12. Admin booking operations** | • **Dehan (PM-B.05):** Tabel Incoming Bookings, filter/pagination, modal detail & update status.<br>• **Hylmi (PM-C.08):** API update status, catatan internal staf, dan pencatatan audit log.<br>• **Halimah (PM-D.10):** Audit verifikasi catatan riwayat status pesanan. | Admin dapat memperbarui status pesanan; history tercatat lengkap dengan aktor staf. | Planned |
| **11** | **M13. Fleet operations** | • **Dehan (PM-B.06):** Visual Fleet Calendar & dashboard status 9 armada.<br>• **Hylmi (PM-C.09):** API calendar & ketersediaan armada terintegrasi.<br>• **Halimah:** Verifikasi sinkronisasi jadwal fisik dengan status booking. | Kalender operasional menampilkan rentang tanggal sewa 9 mobil secara akurat. | Planned |
| **12** | **M14. Help & Customer Care** | • **Harun (PM-A.07):** Layar bantuan FAQ, form buat tiket, dan chat bantuan mobile.<br>• **Dehan (PM-B.07):** Workspace tiket admin, split view chat, dan tombol takeover bot.<br>• **Hylmi (PM-C.10):** API tiket, pesan chat, dan state machine handoff AI-ke-manusia.<br>• **Halimah (PM-D.11):** E2E testing alur chat antara customer dan staf admin. | Percakapan tiket dua arah berfungsi; staf admin dapat membalas pesan pelanggan. | Planned |
| **13** | **M15. Quality, A11y, & Security audit** | • **Halimah (PM-D.12):** Lead audit aksesibilitas WCAG AA (kontras warna, focus keyboard).<br>• **Harun (PM-A.08):** Audit usability mobile (tap target, keyboard avoid, empty state).<br>• **Dehan (PM-B.08):** Audit web accessibility, loading skeleton, dan error boundary.<br>• **Hylmi (PM-C.11):** Backend hardening (rate limiting, security headers Helmet, sanitasi log). | Laporan audit menyeluruh; seluruh defect kategori kritikal dan mayor terselesaikan. | Planned |
| **14** | **M16. Release candidate & UAS handoff** | • **Halimah (PM-D.13):** Review kelengkapan logbook seluruh PIC & verifikasi checklist release.<br>• **Harun (PM-A.09):** Build APK release customer app.<br>• **Dehan (PM-B.09):** Deploy staging admin dashboard.<br>• **Hylmi (PM-C.12):** Deploy staging backend API & finalisasi runbook setup. | Seluruh sistem live di staging; APK siap diuji; presentasi UAS siap dipaparkan. | Planned |

---

## 6. Format Catatan Logbook Setiap Milestone

Gunakan satu entry per milestone, bukan hanya kalimat singkat. Format mengacu pada [`docs/LOGBOOK_AI_ASSISTED_TEMPLATE.md`](docs/LOGBOOK_AI_ASSISTED_TEMPLATE.md):

```text
Tanggal: YYYY-MM-DD
Minggu / Milestone: M<nomor> / PM-<PIC>.<nomor>
PIC: Harun / Dehan / Hylmi / Halimah
Tujuan sesi: ...
Pekerjaan yang benar-benar dilakukan: ...
Keputusan teknis/desain: ...
Kendala: ...
Solusi atau tindak lanjut: ...
Output/evidence (commit hash, screenshot path, API response): ...
Status: planned | in progress | done | blocked
Reviewer: Halimah / Hylmi / Dehan / Harun
```

---

## 7. Pembagian Tanggung Jawab Tim (Resmi)

| Area Tanggung Jawab | PIC Utama | Nama Anggota | Anggota Kolaborator / Reviewer |
|---|---|---|---|
| Customer Mobile App (Flutter) | **PIC A** | **Harun** | Halimah (QA), Hylmi (API) |
| Admin Web Dashboard (Next.js) | **PIC B** | **Dehan** | Halimah (QA), Hylmi (API) |
| Core API, Database & Auth | **PIC C** | **Hylmi** | Halimah (QA), Dehan (Web) |
| Quality Gate, Integration & Release | **PIC D** | **Halimah** | Hylmi (Backend), Harun (Mobile) |

---

## 8. Delivery Gate Team

Sebelum suatu milestone ditutup dan diklaim `done`:

- [ ] Tidak ada data kendaraan di luar sembilan dataset resmi Merauke.
- [ ] Tidak ada harga, rating, nama pelanggan, statistik, atau waktu respons fiktif tanpa label `Data contoh`.
- [ ] Tarif tetap memakai copy konfirmasi, bukan angka rekaan.
- [ ] Mobile tidak overflow pada resolusi 390×844.
- [ ] Dashboard tidak patah pada resolusi 1440×900.
- [ ] Loading, empty, dan error state memiliki penanganan yang jelas.
- [ ] Semua tombol dan route memiliki fungsi nyata atau pembatasan yang jujur.
- [ ] Kontras warna (WCAG), focus state, dan tap target diperiksa.
- [ ] Autentikasi dan hak akses role diverifikasi ketat di backend.
- [ ] Secret/kredensial tidak pernah di-commit ke repository.
- [ ] Seluruh Personal Milestone dari PIC yang terlibat dalam milestone tersebut memiliki bukti konkret (*evidence*).

---

## 9. Status Keputusan Tim

1. **Provider hosting PostgreSQL dan API:** Diputuskan menggunakan Staging Server Lokal (Laptop Server via systemd/FlyEnv & reverse proxy/Tailscale).
2. **Provider OTP Customer:** Mode Development & MVP menggunakan hash HMAC SHA-256 tersimpan di database lokal dengan skema attempt limit. Integrasi SMS/WA provider ditunda setelah MVP.
3. **Strategi upload foto kendaraan:** Menggunakan aset static resmi 9 armada Merauke dari `docs/figma-raw/` dan public static storage.
4. **Pembagian PIC aktual:** **Final** (PIC A: Harun, PIC B: Dehan, PIC C: Hylmi, PIC D: Halimah).
5. **Target platform mobile pertama:** Android & Web runner.
6. **Per 10/09/26 tim melakukan rollback ke lo-fi wireframe untuk mematangkan prototype
   sebelum lanjut hi-fi.** Backend freeze di M5: M3–M5 tetap dipakai sebagai fondasi, dan
   M6+ ditunda sampai hi-fi flow final disetujui. Detail dan daftar endpoint tersedia
   vs belum tersedia dicatat pada
   `docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md`. PIC C tidak menambah
   endpoint baru selama periode freeze; kontrak `docs/api/openapi.yaml` menjadi acuan
   revisi jika hi-fi mengubah flow.
