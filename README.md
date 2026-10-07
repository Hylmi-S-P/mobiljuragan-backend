# MobilJuragan Backend API

Layanan REST API untuk sistem operasional dan pemesanan rental mobil **CV. Mobil Juragan Express Transport** di Merauke, Papua Selatan. Layanan ini mengelola transaksi pemesanan armada, manajemen data kendaraan, dan autentikasi pengguna.

---

## 1. Arsitektur Sistem

Layanan backend dibangun menggunakan arsitektur modular berlapis (*layered architecture*). Tanggung jawab tiap lapisan dipisah tegas:

- **Routing** (src/routes/) hanya memetakan URL dan middleware ke sebuah fungsi controller. Tidak ada logika bisnis maupun query di lapisan ini.
- **Controller** (src/controller/) membaca request, menjalankan aturan bisnis, memanggil model, lalu mengirim respons. Setiap kegagalan diteruskan lewat `next(error)` sehingga ditangani satu kali oleh errorHandler global.
- **Model** (src/model/) adalah **satu-satunya** lapisan yang menulis query database. Tidak ada berkas di luar src/model/ yang mengimpor db.
- **Validator** (src/validators/) menyimpan skema Zod yang dipakai bersama oleh router dan controller.

Alur lengkapnya:

```text
┌─────────────────────────┐         ┌─────────────────────────┐
│   Customer Mobile App   │         │  Admin Web Dashboard    │
│    (Flutter Client)     │         │      (Next.js Web)      │
└────────────┬────────────┘         └────────────┬────────────┘
             │                                   │
             │        HTTP REST API (/api/v1)    │
             └─────────────────┬─────────────────┘
                               │
                  ┌────────────┴────────────┐
                  │    Express.js API       │
                  │    (Port: 4000)         │
                  └────────────┬────────────┘
                               │ Prisma 7 ORM
                  ┌────────────┴────────────┐
                  │    MariaDB Database     │
                  │   (9 Model Relasional)  │
                  └─────────────────────────┘
```

### Karakteristik & Tech Stack:
- **Runtime & Bahasa**: Node.js ($\ge$ 20) + TypeScript (ESM).
- **Web Framework**: Express.js 4.
- **Basis Data & ORM**: MariaDB/MySQL + Prisma 7 ORM dengan driver adapter `@prisma/adapter-mariadb`.
- **Validasi Data**: Zod schema validation pada setiap request payload.
- **Autentikasi**:
  - **Pelanggan**: Verifikasi nomor ponsel berbasis OTP (One-Time Password) dengan hashing SHA-256 dan pembatasan percobaan (*rate-limiting*).
  - **Admin / Staf**: JSON Web Token (JWT) berbasis peran (*Role-Based Access Control*) dan enkripsi kata sandi Bcrypt.
- **Logging**: Pino structured logger untuk pelacakan transaksi server.
- **SQL Backup**: `database.sql` berisi struktur tabel dan data awal resmi.

---

## 2. Struktur Direktori Kunci

Berikut adalah file dan direktori utama yang mengelola logika sistem:

```text
mobiljuragan-backend/
├── database.sql             # Struktur tabel + data awal, bisa diimpor ke database kosong
├── .env.example             # Contoh konfigurasi environment (salin jadi .env)
├── docs/
│   └── README.md            # Dokumentasi lengkap seluruh endpoint & payload REST API
├── prisma/
│   ├── schema.prisma        # Definisi model relasional database MariaDB
│   ├── seed.ts              # Seeding 9 armada resmi Merauke & akun admin/staf default
│   └── migrations/          # Catatan migrasi skema database terkelola
├── src/
│   ├── app.ts               # Inisialisasi Express, middleware global, & CORS
│   ├── server.ts            # Entrypoint utama server HTTP (port default: 4000)
│   ├── db.ts                # Inisialisasi singleton Prisma Client & adapter DB
│   ├── logger.ts            # Konfigurasi structured logger Pino
│   ├── middleware/
│   │   ├── auth.ts          # Middleware validasi JWT & otorisasi role pengguna
│   │   ├── errorHandler.ts  # Global error handler dengan format respons konsisten
│   │   └── validate.ts      # Middleware validasi skema request berbasis Zod
│   ├── routes/v1/           # HANYA memetakan URL + middleware ke controller
│   │   ├── index.ts         # Router induk API v1
│   │   ├── auth.ts          # Endpoint OTP & autentikasi pelanggan
│   │   ├── adminAuth.ts     # Endpoint login & profil staf/admin
│   │   ├── vehicles.ts      # Endpoint katalog & ketersediaan armada
│   │   ├── bookings.ts      # Endpoint pemesanan sewa & pelacakan status pelanggan
│   │   ├── adminBookings.ts # Endpoint antrean sewa & konfirmasi tarif admin
│   │   ├── adminFleet.ts    # Endpoint kalender timeline armada admin
│   │   ├── adminVehicles.ts # Endpoint update status fisik armada & audit log
│   │   ├── adminDrivers.ts  # Endpoint roster supir, kesiapan, & penugasan
│   │   ├── adminUsers.ts    # Endpoint manajemen akun staf & admin
│   │   └── adminTickets.ts  # Endpoint tiket customer care
│   ├── controller/          # Membaca request, aturan bisnis, kirim response
│   │   ├── authController.ts
│   │   ├── adminAuthController.ts
│   │   ├── vehicleController.ts
│   │   ├── adminVehicleController.ts
│   │   ├── bookingController.ts
│   │   ├── adminBookingController.ts
│   │   ├── adminFleetController.ts
│   │   ├── adminDriverController.ts
│   │   ├── adminUserController.ts
│   │   └── ticketController.ts
│   ├── model/               # SATU-SATUNYA lapisan yang menulis query database
│   │   ├── authModel.ts
│   │   ├── userModel.ts
│   │   ├── vehicleModel.ts
│   │   ├── bookingModel.ts
│   │   ├── driverModel.ts
│   │   ├── fleetModel.ts
│   │   └── ticketModel.ts
│   ├── validators/          # Skema Zod yang dipakai bersama router & controller
│   │   ├── driverSchemas.ts
│   │   └── bookingSchemas.ts
│   └── utils/
│       ├── auth.ts          # Helper token JWT, hashing OTP SHA-256, & verifikasi
│       └── response.ts      # Standard response envelope (status ok & error)
├── prisma.config.ts         # Konfigurasi koneksi migrasi Prisma 7
└── tsconfig.json            # Konfigurasi compiler TypeScript (NodeNext)
```

Suite E2E disimpan di folder `.verify/e2e/` pada root workspace, di luar repo ini, supaya berkas uji
dan laporan hasilnya tidak ikut ter-commit. Perintah `npm test` tetap bisa dijalankan dari folder
ini. Kalau folder tersebut tidak tersedia, backend tetap bisa dijalankan dan diperiksa manual lewat
endpoint pada tabel di bagian 5.

---

## 3. Prasyarat Sistem

- **Node.js**: Versi $\ge$ 20.x LTS
- **npm**: Versi $\ge$ 10.x
- **MariaDB / MySQL**: Aktif di port 3306 (misalnya via FlyEnv, XAMPP, atau instalasi MariaDB lokal).

---

## 4. Panduan Menjalankan & Inisialisasi Database (MariaDB)

Ikuti langkah-langkah berikut secara berurutan untuk menyiapkan database dan menjalankan server:

### Langkah 1: Install Dependencies
```bash
npm install
```

### Langkah 2: Konfigurasi File `.env`
Salin template konfigurasi `.env.example` ke file `.env`:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

Buka file `.env` dan pastikan konfigurasi `DATABASE_URL` sesuai dengan instance MariaDB lokal Anda:
```env
DATABASE_URL="mysql://root:root@localhost:3306/mobiljuragan"
PORT=4000
APP_VERSION=dev
LOG_LEVEL=info
JWT_SECRET="mobiljuragan-dev-jwt-secret-key"
OTP_SALT="mobiljuragan-dev-otp-salt-key"
SESSION_SECRET="CHANGE_ME_random_long_string"
```

### Langkah 3: Menyiapkan MariaDB Lokal
Pastikan service database MariaDB telah berjalan:
- Jika menggunakan **FlyEnv**: pastikan modul MariaDB berstatus *Running* di port `3306`.
- Buat basis data `mobiljuragan` jika belum ada:
  ```sql
  CREATE DATABASE IF NOT EXISTS mobiljuragan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```
- Atau impor langsung struktur tabel beserta data awal dari file `database.sql`:
  ```bash
  mariadb -u root -proot mobiljuragan < database.sql
  ```

### Langkah 4: Generate Prisma Client
Kompilasi Prisma Client untuk menghasilkan tipe TypeScript dari skema:
```bash
npm run prisma:generate
```

### Langkah 5: Migrasi Skema ke Database
Eksekusi migrasi tabel relasional (`users`, `vehicles`, `bookings`, `booking_status_history`, `audit_logs`, dll.) ke MariaDB:
```bash
npm run prisma:migrate
```
*(Perintah ini menjalankan `prisma migrate dev`, yang secara otomatis menerapkan seluruh file migrasi di folder `prisma/migrations/`).*

### Langkah 6: Seeding Data Awal (9 Armada & Akun Default)
Isi database dengan data operasional awal:
```bash
npm run prisma:seed
```
Setelah proses seeding selesai, database akan memiliki:
1. **9 Unit Armada Resmi Merauke:**
   - *MPV*: Toyota Avanza G Putih (`PS1692B`), Toyota Avanza G Hitam (`PS1701B`), Daihatsu Xenia R Silver (`PS1822B`), Toyota Innova Reborn Diesel Abu-abu (`PS1933B`).
   - *SUV*: Toyota Fortuner 2.8 VRZ Hitam (`PS2044B`), Mitsubishi Pajero Sport Dakar Putih (`PS2155B`).
   - *PICKUP*: Toyota Hilux Double Cabin 4x4 Putih (`PS2266B`), Mitsubishi Triton Ultimate 4x4 Hitam (`PS2377B`).
   - *COMMERCIAL*: Daihatsu Gran Max Blind Van Putih (`PS2488B`).
2. **Akun Staf & Admin Default:**
   - **Admin Utama:** No. HP `081234567890` (alias `admin`) | Password: `Admin123!`
   - **Staf Operasional:** No. HP `081234567899` (alias `staf`) | Password: `Staf123!`

### Langkah 7: Jalankan Pengujian Otomatis
Verifikasi seluruh fungsionalitas backend mulai dari autentikasi, transaksi booking, antrean operasional admin, sampai modul supir:
```bash
npm test
```
*(Harus menampilkan 52/52 pemeriksaan lolos. Suite ini berjalan lewat HTTP sungguhan di port 4999,
ikut menguji jalur gagal seperti 401, 403, dan 409, lalu menulis laporan ke `.verify/e2e/report.md`
dan `.verify/e2e/last-run.json` di root workspace. Kalau ada satu saja pemeriksaan yang gagal,
perintahnya keluar dengan kode bukan nol sehingga bisa dipakai di alur otomatis.)*

Typecheck khusus berkas uji dijalankan terpisah karena `tsconfig.json` sengaja hanya mengompilasi `src/`:
```bash
npm run typecheck:e2e
```

### Langkah 8: Jalankan Server Development
```bash
npm run dev
```
Server akan aktif di `http://localhost:4000`. Cek kesehatan endpoint pada browser atau terminal:
```bash
curl http://localhost:4000/health
```

### Langkah 9 (Opsional): Eksplorasi Data via Prisma Studio
Untuk melihat dan mengelola isi tabel secara visual melalui peramban web:
```bash
npm run prisma:studio
```

---

## 5. Ringkasan Endpoint API Terimplementasi

| Modul | Method | Endpoint | Akses | Keterangan |
|---|---|---|---|---|
| **Health** | `GET` | `/health` | Publik | Status server & uptime |
| **Katalog** | `GET` | `/api/v1/vehicles` | Publik | Daftar 9 armada dengan filter kategori & tanggal |
| **Katalog** | `GET` | `/api/v1/vehicles/categories` | Publik | Daftar kategori armada aktif |
| **Katalog** | `GET` | `/api/v1/vehicles/:id` | Publik | Detail satu armada (via UUID atau externalId) |
| **Auth Customer** | `POST` | `/api/v1/auth/otp/request` | Publik | Permintaan kode verifikasi OTP |
| **Auth Customer** | `POST` | `/api/v1/auth/otp/verify` | Publik | Verifikasi OTP & terbitkan token JWT |
| **Auth Admin** | `POST` | `/api/v1/admin/auth/login` | Publik | Login staf/admin via no. HP & password |
| **Auth Admin** | `GET` | `/api/v1/admin/auth/me` | Admin/Staff | Profil staf/admin login |
| **Booking Customer**| `POST` | `/api/v1/bookings` | Customer | Buat booking sewa (transaksi atomik Prisma) |
| **Booking Customer**| `GET` | `/api/v1/bookings` | Customer | Daftar riwayat pesanan milik pemesan |
| **Booking Customer**| `GET` | `/api/v1/bookings/:id` | Customer | Detail pesanan sewa |
| **Booking Customer**| `GET` | `/api/v1/bookings/:id/status` | Customer | Status terkini & timeline stepper pesanan |
| **Operasional Admin**| `GET` | `/api/v1/admin/bookings` | Admin/Staff | Antrean pesanan masuk, filter & paginasi |
| **Operasional Admin**| `GET` | `/api/v1/admin/bookings/:id` | Admin/Staff | Detail booking admin & link intent WhatsApp |
| **Operasional Admin**| `PATCH`| `/api/v1/admin/bookings/:id/status`| Admin/Staff | Konfirmasi tarif & update status booking |
| **Operasional Admin**| `PATCH`| `/api/v1/admin/bookings/:id/driver`| Admin/Staff | Tugaskan supir ke pesanan dengan supir |
| **Armada Admin** | `GET` | `/api/v1/admin/fleet/calendar` | Admin/Staff | Matriks kalender timeline 9 armada |
| **Armada Admin** | `PATCH`| `/api/v1/admin/vehicles/:id/status`| Admin/Staff | Update status fisik armada & audit log |
| **Supir Admin** | `GET` | `/api/v1/admin/drivers` | Admin/Staff | Roster supir beserta penugasan aktifnya |
| **Supir Admin** | `POST` | `/api/v1/admin/drivers` | Admin/Staff | Tambah supir baru ke roster |
| **Supir Admin** | `GET` | `/api/v1/admin/drivers/:id` | Admin/Staff | Detail satu supir |
| **Supir Admin** | `PATCH`| `/api/v1/admin/drivers/:id` | Admin/Staff | Ubah data supir |
| **Supir Admin** | `PATCH`| `/api/v1/admin/drivers/:id/readiness` | Admin/Staff | Sakelar kesiapan SIAGA atau LIBUR |
| **Supir Admin** | `DELETE`| `/api/v1/admin/drivers/:id` | Admin/Staff | Nonaktifkan supir dari roster |
| **Akun Admin** | `GET` | `/api/v1/admin/users` | Admin/Staff | Daftar akun staf & admin pengelola portal |
| **Akun Admin** | `POST` | `/api/v1/admin/users` | Admin/Staff | Daftarkan akun staf/admin baru |
| **Akun Admin** | `GET` | `/api/v1/admin/users/:id` | Admin/Staff | Detail satu akun staf/admin |
| **Akun Admin** | `PATCH`| `/api/v1/admin/users/:id` | Admin/Staff | Ubah data, peran, status, atau sandi akun |
| **Akun Admin** | `DELETE`| `/api/v1/admin/users/:id` | Admin/Staff | Hapus akun, ditolak bila masih terikat transaksi |
| **Customer Care** | `GET` | `/api/v1/admin/tickets` | Admin/Staff | Daftar tiket bantuan pelanggan |
| **Customer Care** | `POST` | `/api/v1/admin/tickets` | Admin/Staff | Buat tiket bantuan baru |
| **Customer Care** | `GET` | `/api/v1/admin/tickets/:id` | Admin/Staff | Detail tiket beserta percakapan |
| **Customer Care** | `PATCH`| `/api/v1/admin/tickets/:id/status` | Admin/Staff | Ubah status penanganan tiket |
| **Customer Care** | `POST` | `/api/v1/admin/tickets/:id/messages` | Admin/Staff | Kirim balasan tim pada tiket |

**Catatan:** `GET /api/v1/auth/me` dan `POST /api/v1/auth/logout` belum ada di kode, sehingga tidak
dicantumkan di tabel ini. Keduanya masih berupa rencana untuk modul profil pelanggan.

---

## 6. Standar Format Respons API

Seluruh endpoint REST API menggunakan format respons terstandarisasi yang konsisten:

### Respons Berhasil (HTTP 200 / 201)
```json
{
  "status": "ok",
  "data": { ... }
}
```

### Respons Gagal (HTTP 400 / 401 / 403 / 404 / 409 / 500)
```json
{
  "error": {
    "code": "KODE_ERROR",
    "message": "Pesan deskriptif penyebab error.",
    "details": {}
  }
}
```

---

## 7. Dokumentasi Lengkap
Untuk panduan detail mengenai format payload JSON, query parameter, dan contoh respons tiap endpoint, silakan buka dokumen:
👉 **[`docs/README.md`](docs/README.md)**
