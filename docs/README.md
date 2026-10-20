# Dokumentasi API MobilJuragan Backend

Dokumentasi referensi endpoint REST API backend MobilJuragan untuk integrasi aplikasi Customer Mobile (Flutter) dan Admin Web Dashboard (Next.js).

---

## 1. Konfigurasi Dasar

- **Base URL:** `http://localhost:4000/api/v1`
- **Health Check:** `GET http://localhost:4000/health`
- **Header Standar:** `Content-Type: application/json`
- **Header Autentikasi:** `Authorization: Bearer <TOKEN_JWT>`
- **Format Amplop Respons:**
  - **Berhasil (200 / 201):**
    ```json
    { "status": "ok", "data": { ... } }
    ```
  - **Gagal (4xx / 5xx):**
    ```json
    { "error": { "code": "KODE_ERROR", "message": "Pesan deskriptif", "details": {} } }
    ```

---

## 2. Katalog Armada Kendaraan (`/vehicles`)

Endpoint publik untuk menampilkan unit armada di aplikasi mobile maupun portal admin.

| Method | Endpoint | Akses | Query / Parameter | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/vehicles` | Publik | `category`, `transmission`, `search`, `operationalStatus` *(default: `AVAILABLE`, `ALL` untuk semua)*, `startDate`, `endDate` | - | Daftar armada mobil beserta spesifikasi dan status operasionalnya. |
| `GET` | `/api/v1/vehicles/categories` | Publik | - | - | Daftar unik kategori kendaraan aktif (contoh: `["MPV", "SUV", "PICKUP", "COMMERCIAL"]`). |
| `GET` | `/api/v1/vehicles/:id` | Publik | `:id` (UUID atau `externalId`, mis. `avanza-g-putih-ps1692b`) | - | Detail lengkap satu unit armada kendaraan. |

---

## 3. Autentikasi Pelanggan Mobile (`/auth`)

Autentikasi pelanggan berbasis nomor ponsel dan kode verifikasi OTP (One-Time Password).

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/otp/request` | Publik | - | `phoneNumber` (string), `fullName` (string) | Mengirim kode OTP (masa aktif 5 menit). Pada mode dev mengembalikan `devMockOtp` di dalam payload respons. |
| `POST` | `/api/v1/auth/otp/verify` | Publik | - | `phoneNumber` (string), `otp` (string) | Memverifikasi OTP. Mengembalikan token JWT (`Bearer`) dan profil objek `user` (`role: CUSTOMER`). |

*Catatan: Endpoint `GET /api/v1/auth/me` dan `POST /api/v1/auth/logout` saat ini belum diimplementasikan di kode backend.*

---

## 4. Autentikasi Admin & Staf Web (`/admin/auth`)

Autentikasi pengelola dashboard operasional berbasis nomor telepon dan kata sandi.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Publik | - | `phoneNumber` (string), `password` (string) | Autentikasi staf/admin. Mengembalikan token JWT (`Bearer`) dan objek `user` (`role: ADMIN` atau `STAFF`). |
| `GET` | `/api/v1/admin/auth/me` | Admin / Staff | - | - | Mengambil data profil staf atau admin yang sedang login. |

---

## 5. Pemesanan Sewa Pelanggan (`/bookings`)

Pengelolaan pesanan sewa mobil dari sisi pemesan (membutuhkan token pelanggan).

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `POST` | `/api/v1/bookings` | Customer | - | `vehicleId` (UUID / externalId), `startDateTime` (ISO), `endDateTime` (ISO), `rentalType` (`WITH_DRIVER` / `WITHOUT_DRIVER`), `pickupLocation`?, `customerRequest`?, `numberGuests`? | Membuat pesanan baru secara atomik. Status awal: `CREATED`, `tariffStatus`: `PENDING_TEAM_CONFIRMATION`, `quotedAmount`: `null`. |
| `GET` | `/api/v1/bookings` | Customer | - | - | Daftar seluruh riwayat pemesanan milik pelanggan yang sedang login. |
| `GET` | `/api/v1/bookings/:id` | Customer | `:id` (UUID booking atau `bookingCode`) | - | Detail lengkap pemesanan, spesifikasi armada, dan status tarif. |
| `GET` | `/api/v1/bookings/:id/status` | Customer | `:id` (UUID booking atau `bookingCode`) | - | Status terkini dan riwayat status (`statusHistory`) untuk tampilan stepper di aplikasi mobile. |

---

## 6. Operasional Booking Admin (`/admin/bookings`)

Pengelolaan antrean pesanan, konfirmasi tarif, dan penugasan supir oleh tim operasional.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/bookings` | Admin / Staff | `page` *(def: 1)*, `limit` *(def: 10)*, `status`, `search` | - | Antrean pemesanan terpaginasi beserta data pemesan dan mobil. |
| `GET` | `/api/v1/admin/bookings/:id` | Admin / Staff | `:id` (UUID booking atau `bookingCode`) | - | Detail pemesanan, riwayat status, dan properti `whatsappIntent` untuk menghubungi pemesan. |
| `PATCH` | `/api/v1/admin/bookings/:id/status` | Admin / Staff | `:id` (UUID booking) | `status` (`CONFIRMED`, `REJECTED`, `CANCELLED`, `IN_PROGRESS`, `COMPLETED`), `quotedAmount`? (number), `note`? | Memperbarui status pesanan & tarif, mencatat riwayat perubahan status serta entri `audit_logs`. |
| `PATCH` | `/api/v1/admin/bookings/:id/driver` | Admin / Staff | `:id` (UUID booking) | `driverId` (UUID supir / externalId), `note`? | Menugaskan supir ke pesanan `WITH_DRIVER`. Kesiapan supir otomatis berubah menjadi `SEDANG_TUGAS`. |

---

## 7. Kalender & Status Armada Admin (`/admin/fleet` & `/admin/vehicles`)

Pemantauan visual armada dan pembaruan kondisi fisik kendaraan.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/fleet/calendar` | Admin / Staff | `startDate` (ISO), `endDate` (ISO), `category` | - | Matriks jadwal sewa 9 armada untuk timeline kalender Web Dashboard. |
| `PATCH` | `/api/v1/admin/vehicles/:id/status` | Admin / Staff | `:id` (UUID atau externalId kendaraan) | `status` (`AVAILABLE`, `BOOKED`, `MAINTENANCE`, `UNAVAILABLE`), `note`? | Memperbarui status fisik armada sekaligus membuat riwayat di `audit_logs`. |

---

## 8. Manajemen Roster Supir (`/admin/drivers`)

Pengelolaan roster pengemudi resmi, status kesiapan kerja, dan jadwal penugasan.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/drivers` | Admin / Staff | `readiness` (`SIAGA`, `LIBUR`, `SEDANG_TUGAS`), `routeScope` (`DALAM_KOTA`, `LUAR_KOTA`), `search`, `includeInactive` (boolean) | - | Daftar roster supir, status kesiapan, properti `activeAssignment`, dan flag `isLocked`. |
| `POST` | `/api/v1/admin/drivers` | Admin / Staff | - | `fullName` (wajib), `routeScope` (wajib), `phoneNumber`?, `licenseNumber`? | Mendaftarkan supir baru ke roster (kesiapan awal: `SIAGA`). |
| `GET` | `/api/v1/admin/drivers/:id` | Admin / Staff | `:id` (UUID atau externalId supir) | - | Detail profil dan status penugasan seorang supir. |
| `PATCH` | `/api/v1/admin/drivers/:id` | Admin / Staff | `:id` (UUID atau externalId supir) | `fullName`?, `routeScope`?, `phoneNumber`?, `licenseNumber`? | Memperbarui informasi data supir. |
| `PATCH` | `/api/v1/admin/drivers/:id/readiness` | Admin / Staff | `:id` (UUID atau externalId supir) | `readiness` (`SIAGA` atau `LIBUR`), `note`? | Mengubah kesiapan kerja manual. Status `SEDANG_TUGAS` tidak boleh disetel manual. |
| `DELETE` | `/api/v1/admin/drivers/:id` | Admin / Staff | `:id` (UUID atau externalId supir) | - | Menonaktifkan supir secara soft-delete (`isActive: false`). Ditolak jika masih terikat penugasan aktif. |

---

## 9. Manajemen Akun Admin & Staf (`/admin/users`)

Pengelolaan kredensial akun staf dan admin portal operasional.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/users` | Admin / Staff | - | - | Daftar seluruh akun pengelola portal (tanpa hash kata sandi). |
| `POST` | `/api/v1/admin/users` | Admin / Staff | - | `fullName`, `phoneNumber`, `role` (`ADMIN` / `STAFF`), `password` (min. 8 karakter) | Mendaftarkan akun admin atau staf baru. |
| `GET` | `/api/v1/admin/users/:id` | Admin / Staff | `:id` (UUID pengguna) | - | Detail akun staf atau admin tertentu. |
| `PATCH` | `/api/v1/admin/users/:id` | Admin / Staff | `:id` (UUID pengguna) | `fullName`?, `phoneNumber`?, `role`?, `password`?, `isActive`? | Memperbarui profil, peran, kata sandi, atau status aktif akun. |
| `DELETE` | `/api/v1/admin/users/:id` | Admin / Staff | `:id` (UUID pengguna) | - | Menghapus akun. Ditolak jika akun adalah diri sendiri, admin terakhir, atau memiliki relasi transaksi. |

---

## 10. Customer Care / Tiket Bantuan (`/admin/tickets`)

Pengelolaan percakapan bantuan dan penanganan keluhan pelanggan.

| Method | Endpoint | Akses | Parameter / URL | Request Body | Keterangan & Respons Utama |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/tickets` | Admin / Staff | `status`? (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`) | - | Daftar tiket keluhan/bantuan beserta jumlah pesan. |
| `POST` | `/api/v1/admin/tickets` | Admin / Staff | - | `title` (wajib), `description` (wajib), `category`? (`GENERAL`, `PAYMENT_CONFIRMATION`, dll.), `customerId`? | Membuat tiket bantuan baru. |
| `GET` | `/api/v1/admin/tickets/:id` | Admin / Staff | `:id` (UUID tiket) | - | Detail tiket beserta seluruh riwayat percakapan (`messages`). |
| `PATCH` | `/api/v1/admin/tickets/:id/status` | Admin / Staff | `:id` (UUID tiket) | `status` (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`) | Memperbarui status penanganan tiket bantuan. |
| `POST` | `/api/v1/admin/tickets/:id/messages` | Admin / Staff | `:id` (UUID tiket) | `body` (string) | Mengirimkan balasan tim ke tiket. Status otomatis beralih ke `WAITING_CUSTOMER`. |

---

## 11. Ringkasan Kode Error Penting

| HTTP Status | Error Code | Keterangan Utama |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Format body atau query parameter tidak valid (gagal validasi Zod). |
| `400` | `OTP_INVALID` / `OTP_EXPIRED` / `OTP_ALREADY_USED` | Masalah pada kode verifikasi OTP pelanggan. |
| `400` | `CANNOT_DELETE_SELF` | Akun staf/admin yang sedang login tidak boleh menghapus dirinya sendiri. |
| `400` | `DRIVER_READINESS_MANUAL_INVALID` | Status `SEDANG_TUGAS` dilarang diatur secara manual lewat endpoint kesiapan. |
| `401` | `UNAUTHORIZED` / `INVALID_CREDENTIALS` | Token tidak ada/kedaluwarsa, atau kredensial login salah. |
| `403` | `FORBIDDEN` | Peran pengguna (*role*) tidak mencukupi untuk mengakses rute. |
| `404` | `VEHICLE_NOT_FOUND` / `BOOKING_NOT_FOUND` / `DRIVER_NOT_FOUND` / `USER_NOT_FOUND` / `TICKET_NOT_FOUND` | Data dengan identifier terkait tidak ditemukan di database. |
| `409` | `BOOKING_VEHICLE_UNAVAILABLE` / `BOOKING_CONFLICT` | Jadwal pemesanan armada bertabrakan dengan pesanan aktif lain. |
| `409` | `DRIVER_DUPLICATE` / `PHONE_NUMBER_EXISTS` | Nama/nomor kontak supir atau nomor telepon pengguna sudah terdaftar. |
| `409` | `DRIVER_ON_DUTY` / `DRIVER_ASSIGNED` / `DRIVER_REQUIRED` | Konflik status tugas supir atau pesanan bertipe supir belum memilih pengemudi. |
| `409` | `LAST_ADMIN_PROTECTED` / `USER_HAS_REFERENCES` | Admin aktif terakhir tidak boleh dihapus, atau akun masih terikat data transaksi. |
| `500` | `INTERNAL_SERVER_ERROR` | Terjadi kegagalan proses di sisi database atau server backend. |
