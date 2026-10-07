# Dokumentasi API MobilJuragan Backend

Dokumentasi ringkas endpoint REST API backend MobilJuragan untuk integrasi aplikasi Customer Mobile (Flutter) dan Admin Web Dashboard (Next.js).

---

## 1. Konfigurasi Dasar

- **Base URL:** `http://localhost:4000/api/v1`
- **Health Check:** `http://localhost:4000/health`
- **Format Header:**
  ```http
  Content-Type: application/json
  ```
- **Autentikasi Header (Endpoint Terproteksi):**
  ```http
  Authorization: Bearer <TOKEN_JWT>
  ```

---

## 2. Standar Format Respons

### Respons Berhasil (HTTP 200 / 201)

```json
{
  "status": "ok",
  "data": { ... }
}
```

### Respons Gagal (HTTP 400 / 401 / 403 / 404 / 500)

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

## 3. Katalog Armada Kendaraan (`/vehicles`)

Endpoint ini siap dipakai untuk halaman katalog di Mobile maupun manajemen armada di Web.

### A. Ambil Semua Armada

- **Method:** `GET`
- **Endpoint:** `/api/v1/vehicles`
- **Query Parameter (Opsional):**
  - `category` (string): Filter jenis mobil (`MPV`, `SUV`, `PICKUP`, `COMMERCIAL`).
  - `transmission` (string): Filter transmisi (`MANUAL`, `AUTOMATIC`).
  - `search` (string): Pencarian nama mobil, plat nomor, atau model.
  - `operationalStatus` (string): Default `AVAILABLE`. Gunakan `ALL` untuk melihat semua.
  - `startDate` & `endDate` (ISO 8601): Filter ketersediaan jadwal sewa, contoh: `2026-10-01T08:00:00Z`.
- **Contoh Request:**
  ```http
  GET /api/v1/vehicles?category=MPV
  ```
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": [
      {
        "id": "7a304f5e-9988-4665-ba4c-cc0b5220c812",
        "externalId": "avanza-g-putih-ps1692b",
        "name": "AVANZA G PUTIH",
        "licensePlate": "PS1692B",
        "brand": "Toyota",
        "model": "Avanza G",
        "seatingCapacity": 7,
        "transmission": "MANUAL",
        "category": "MPV",
        "imageUrl": null,
        "operationalStatus": "AVAILABLE"
      }
    ]
  }
  ```

### B. Ambil Daftar Kategori

- **Method:** `GET`
- **Endpoint:** `/api/v1/vehicles/categories`
- **Fungsi:** Menyediakan daftar kategori aktif untuk tab filter tombol di mobile/web.
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": ["MPV", "SUV", "PICKUP", "COMMERCIAL"]
  }
  ```

### C. Ambil Detail Satu Armada

- **Method:** `GET`
- **Endpoint:** `/api/v1/vehicles/:id`
- **Keterangan:** `:id` bisa berupa UUID database atau `externalId` (contoh: `avanza-g-putih-ps1692b`).
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "7a304f5e-9988-4665-ba4c-cc0b5220c812",
      "externalId": "avanza-g-putih-ps1692b",
      "name": "AVANZA G PUTIH",
      "licensePlate": "PS1692B",
      "brand": "Toyota",
      "model": "Avanza G",
      "seatingCapacity": 7,
      "transmission": "MANUAL",
      "category": "MPV",
      "imageUrl": null,
      "operationalStatus": "AVAILABLE"
    }
  }
  ```

---

## 4. Autentikasi Pelanggan (`/auth`)

Digunakan pada aplikasi Customer Mobile Flutter (Harun).

### A. Minta Kode OTP

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/otp/request`
- **Request Body:**
  ```json
  {
    "phoneNumber": "081234567888",
    "fullName": "Budi Santoso"
  }
  ```
- **Contoh Respons (Mode Dev):**
  ```json
  {
    "status": "ok",
    "data": {
      "message": "Kode verifikasi OTP telah dikirim.",
      "phoneNumber": "081234567888",
      "expiresInSeconds": 300,
      "devMockOtp": "101279"
    }
  }
  ```
  _(Catatan dev: Nilai `devMockOtp` disediakan langsung di response JSON selama development agar testing login cepat tanpa gateway SMS/WA berbayar)._

### B. Verifikasi Kode OTP (Login / Masuk)

- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/otp/verify`
- **Request Body:**
  ```json
  {
    "phoneNumber": "081234567888",
    "otp": "101279"
  }
  ```
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": "1826a286-2c48-4027-91fd-da3ad9a7ad61",
        "phoneNumber": "081234567888",
        "fullName": "Budi Santoso",
        "role": "CUSTOMER"
      }
    }
  }
  ```

### C. Profil Customer dan Logout (belum tersedia)

Dua endpoint berikut masih direncanakan dan **belum ada di kode**, jadi belum bisa dipanggil:

- `GET /api/v1/auth/me` untuk profil pelanggan yang sedang masuk.
- `POST /api/v1/auth/logout` untuk mengakhiri sesi pelanggan.

Keduanya sengaja tidak didaftarkan sebagai endpoint supaya tidak dianggap tersedia. Sampai
dibangun, sisi aplikasi cukup membuang token tersimpan saat pengguna keluar, dan memakai data
profil yang didapat dari respons verifikasi OTP.

---

## 5. Autentikasi Admin & Staf (`/admin/auth`)

Digunakan pada aplikasi Admin Web Dashboard Next.js (Dehan).

### A. Login Admin

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/auth/login`
- **Akun Default Database (Seeded):**
  - No. Telepon: `081234567890`
  - Password: `Admin123!`
- **Request Body:**
  ```json
  {
    "phoneNumber": "081234567890",
    "password": "Admin123!"
  }
  ```
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id": "0ff68b1f-1260-46af-97a7-baebcf449cd6",
        "phoneNumber": "081234567890",
        "fullName": "Admin MobilJuragan",
        "role": "ADMIN"
      }
    }
  }
  ```

### B. Profil Admin yang Sedang Login

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/auth/me`
- **Header:** `Authorization: Bearer <ADMIN_TOKEN>`
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "0ff68b1f-1260-46af-97a7-baebcf449cd6",
      "phoneNumber": "081234567890",
      "fullName": "Admin MobilJuragan",
      "role": "ADMIN"
    }
  }
  ```

---

## 6. Pemesanan Sewa Mobil (`/bookings`)

Seluruh endpoint di bawah mewajibkan header `Authorization: Bearer <TOKEN>`.

### A. Buat Pemesanan Baru (Transaksi Atomik)

- **Method:** `POST`
- **Endpoint:** `/api/v1/bookings`
- **Request Body:**
  ```json
  {
    "vehicleId": "avanza-g-putih-ps1692b",
    "startDateTime": "2026-11-01T08:00:00Z",
    "endDateTime": "2026-11-03T18:00:00Z",
    "rentalType": "WITHOUT_DRIVER",
    "pickupLocation": "Bandara Mopah Merauke",
    "customerRequest": "Unit bersih dan AC dingin",
    "numberGuests": 4
  }
  ```
  _(Catatan: `vehicleId` dapat berupa UUID database atau `externalId` armada)._
- **Contoh Respons (HTTP 201 Created):**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "beb23c70-71d3-4a05-8f3b-acc7ea7d3bd7",
      "bookingCode": "MJ-20261101-ABCD",
      "customerId": "1826a286-2c48-4027-91fd-da3ad9a7ad61",
      "vehicleId": "a323fe40-aae5-4b7b-87de-fe6ab58946f7",
      "startDateTime": "2026-11-01T08:00:00.000Z",
      "endDateTime": "2026-11-03T18:00:00.000Z",
      "rentalType": "WITHOUT_DRIVER",
      "pickupLocation": "Bandara Mopah Merauke",
      "customerRequest": "Unit bersih dan AC dingin",
      "numberGuests": 4,
      "tariffStatus": "PENDING_TEAM_CONFIRMATION",
      "quotedAmount": null,
      "status": "CREATED",
      "vehicle": {
        "id": "a323fe40-aae5-4b7b-87de-fe6ab58946f7",
        "externalId": "avanza-g-putih-ps1692b",
        "name": "AVANZA G PUTIH",
        "licensePlate": "PS1692B",
        "category": "MPV",
        "seatingCapacity": 7,
        "transmission": "MANUAL"
      }
    }
  }
  ```

### B. Daftar Pesanan Customer

- **Method:** `GET`
- **Endpoint:** `/api/v1/bookings`
- **Fungsi:** Mengambil daftar seluruh riwayat booking milik customer yang sedang login (untuk tab _Status / Pesanan_ di mobile).
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": [
      {
        "id": "beb23c70-71d3-4a05-8f3b-acc7ea7d3bd7",
        "bookingCode": "MJ-20261101-ABCD",
        "status": "CREATED",
        "tariffStatus": "PENDING_TEAM_CONFIRMATION",
        "quotedAmount": null,
        "startDateTime": "2026-11-01T08:00:00.000Z",
        "endDateTime": "2026-11-03T18:00:00.000Z",
        "vehicle": { ... }
      }
    ]
  }
  ```

### C. Detail Pesanan Tertentu

- **Method:** `GET`
- **Endpoint:** `/api/v1/bookings/:id`
- **Keterangan:** `:id` bisa berupa UUID booking atau `bookingCode` (misal: `MJ-20261101-ABCD`).
- **Contoh Respons:** Menampilkan data lengkap pesanan, spesifikasi mobil, data pemesan, dan riwayat status.

### D. Lacak Status & Timeline Pesanan (Stepper View)

- **Method:** `GET`
- **Endpoint:** `/api/v1/bookings/:id/status`
- **Fungsi:** Menyediakan status terkini dan timeline lengkap (`statusHistory`) yang cocok dipasangkan langsung ke komponen stepper status di aplikasi mobile.
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "beb23c70-71d3-4a05-8f3b-acc7ea7d3bd7",
      "bookingCode": "MJ-20261101-ABCD",
      "status": "CREATED",
      "tariffStatus": "PENDING_TEAM_CONFIRMATION",
      "quotedAmount": null,
      "startDateTime": "2026-11-01T08:00:00.000Z",
      "endDateTime": "2026-11-03T18:00:00.000Z",
      "statusHistory": [
        {
          "id": "f512...",
          "fromStatus": null,
          "toStatus": "CREATED",
          "actor": "CUSTOMER",
          "note": "Pemesanan sewa dibuat oleh pelanggan. Menunggu konfirmasi tarif dan armada oleh tim.",
          "changedAt": "2026-11-01T08:05:00.000Z"
        }
      ]
    }
  }
  ```

---

## 7. Operasional Booking Admin (`/admin/bookings`)

Seluruh endpoint di bawah mewajibkan header `Authorization: Bearer <ADMIN_TOKEN>` (role `ADMIN` atau `STAFF`).

### A. Antrean Booking Masuk (Tabel & Pagination)

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/bookings`
- **Query Parameter (Opsional):**
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `status` (`CREATED`, `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `IN_PROGRESS`, `COMPLETED`)
  - `search` (string: pencarian kode booking, nama pemesan, nomor HP, nama mobil, atau plat nomor)
- **Contoh Request:**
  ```http
  GET /api/v1/admin/bookings?page=1&limit=10&status=CREATED
  ```
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "items": [
        {
          "id": "8381b9a9-ff22-40cd-a525-c9d042d1c07c",
          "bookingCode": "MJ-20261101-ABCD",
          "status": "CREATED",
          "tariffStatus": "PENDING_TEAM_CONFIRMATION",
          "quotedAmount": null,
          "startDateTime": "2026-11-01T08:00:00.000Z",
          "endDateTime": "2026-11-03T18:00:00.000Z",
          "customer": {
            "id": "1826a286...",
            "fullName": "Budi Santoso",
            "phoneNumber": "081234567888"
          },
          "vehicle": {
            "name": "AVANZA G PUTIH",
            "licensePlate": "PS1692B"
          }
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "totalItems": 1,
        "totalPages": 1
      }
    }
  }
  ```

### B. Detail Booking & Payload WhatsApp

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/bookings/:id`
- **Keterangan:** Mengembalikan data detail pemesanan, riwayat status, serta properti `whatsappIntent` berupa teks pesan dan URL `https://api.whatsapp.com/send` yang siap diklik staf admin untuk menghubungi customer.

### C. Update Status Pesanan & Konfirmasi Tarif

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/bookings/:id/status`
- **Request Body:**
  ```json
  {
    "status": "CONFIRMED",
    "quotedAmount": 850000,
    "note": "Tarif sewa dikonfirmasi staf operasional MobilJuragan."
  }
  ```
- **Fitur Otomatis Backend:**
  - Status sewa diperbarui ke `CONFIRMED` dan `tariffStatus` menjadi `CONFIRMED`.
  - Otomatis mencatat riwayat perubahan ke tabel `booking_status_histories`.
  - Otomatis mencatat audit log aktivitas staf admin ke tabel `audit_logs`.
  - Mengembalikan `whatsappIntent` konfirmasi untuk dikirimkan langsung ke pelanggan via WA.

---

## 8. Manajemen Armada & Kalender Admin (`/admin/fleet` & `/admin/vehicles`)

Seluruh endpoint di bawah mewajibkan header `Authorization: Bearer <ADMIN_TOKEN>` (role `ADMIN` atau `STAFF`).

### A. Kalender Jadwal Sewa Armada

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/fleet/calendar`
- **Fungsi:** Mengambil matriks jadwal pemesanan sewa 9 armada resmi Merauke untuk tampilan visual timeline / kalender di Web Dashboard.
- **Query Parameter (Opsional):**
  - `startDate` (ISO 8601 string): Awal rentang tanggal (default: hari ini pukul 00:00:00).
  - `endDate` (ISO 8601 string): Akhir rentang tanggal (default: 30 hari dari `startDate`).
  - `category` (string): Filter kategori kendaraan (`MPV`, `SUV`, `PICKUP`, `COMMERCIAL`).
- **Contoh Request:**
  ```http
  GET /api/v1/admin/fleet/calendar?startDate=2026-11-01T00:00:00Z&endDate=2026-11-30T23:59:59Z
  ```
- **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "data": {
      "timeRange": {
        "startDate": "2026-11-01T00:00:00.000Z",
        "endDate": "2026-11-30T23:59:59.000Z"
      },
      "totalVehicles": 9,
      "fleet": [
        {
          "id": "7a304f5e-9988-4665-ba4c-cc0b5220c812",
          "externalId": "avanza-g-putih-ps1692b",
          "name": "AVANZA G PUTIH",
          "licensePlate": "PS1692B",
          "brand": "Toyota",
          "model": "Avanza G",
          "category": "MPV",
          "seatingCapacity": 7,
          "transmission": "MANUAL",
          "operationalStatus": "AVAILABLE",
          "activeBookingsCount": 1,
          "schedules": [
            {
              "bookingId": "beb23c70-71d3-4a05-8f3b-acc7ea7d3bd7",
              "bookingCode": "MJ-20261101-ABCD",
              "customerName": "Budi Santoso",
              "customerPhone": "081234567888",
              "rentalType": "WITHOUT_DRIVER",
              "status": "CONFIRMED",
              "startDateTime": "2026-11-01T08:00:00.000Z",
              "endDateTime": "2026-11-03T18:00:00.000Z",
              "tariffStatus": "CONFIRMED",
              "quotedAmount": 850000
            }
          ]
        }
      ]
    }
  }
  ```

### B. Update Status Operasional Armada

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/vehicles/:id/status`
- **Keterangan:** `:id` bisa berupa UUID database atau `externalId` mobil (contoh: `avanza-g-putih-ps1692b`).
- **Request Body:**
  ```json
  {
    "status": "MAINTENANCE",
    "note": "Perawatan berkala ganti oli dan servis rem di bengkel resmi."
  }
  ```
  _(Pilihan nilai `status`: `AVAILABLE`, `BOOKED`, `MAINTENANCE`, `UNAVAILABLE`)._
- **Contoh Respons (HTTP 200 OK):**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "7a304f5e-9988-4665-ba4c-cc0b5220c812",
      "externalId": "avanza-g-putih-ps1692b",
      "name": "AVANZA G PUTIH",
      "licensePlate": "PS1692B",
      "brand": "Toyota",
      "model": "Avanza G",
      "category": "MPV",
      "operationalStatus": "MAINTENANCE",
      "updatedAt": "2026-09-25T00:10:00.000Z"
    }
  }
  ```
- **Fitur Otomatis Backend:**
  - Status armada langsung diperbarui di basis data.
  - Otomatis mencatat audit log aktivitas staf ke tabel `audit_logs` dengan aksi `UPDATE_VEHICLE_STATUS`, memuat data status lama (`fromStatus`), status baru (`toStatus`), dan catatan (`note`).

---

## 9. Roster Supir (`/admin/drivers`)

Menopang layar Manajemen Supir, modal tambah dan hapus supir, serta pemilihan supir di Detail
Pemesanan pada dashboard. Aturan penolakan yang dijaga: nama atau nomor kontak supir aktif tidak
boleh kembar, supir yang masih terikat pesanan aktif tidak boleh dinonaktifkan, dan kesiapan tidak
bisa diubah saat supir sedang bertugas.

### A. Daftar Roster Supir

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/drivers`
- **Query Parameter (Opsional):** `readiness` (`SIAGA`, `LIBUR`, `SEDANG_TUGAS`), `routeScope`
  (`DALAM_KOTA`, `LUAR_KOTA`), `search` (nama, `externalId`, atau nomor kontak), dan
  `includeInactive` (isi `true` untuk ikut menampilkan supir nonaktif).
- Setiap supir memuat `activeAssignment` berisi pesanan yang sedang mengikatnya atau `null`,
  dan `isLocked` yang menandakan kesiapannya terkunci karena sedang bertugas.

```json
{
  "status": "ok",
  "data": [
    {
      "id": "0f3c1f7a-1c2b-4a5d-9e6f-7a8b9c0d1e2f",
      "externalId": "markus-gebze",
      "fullName": "Markus Gebze",
      "phoneNumber": null,
      "licenseNumber": null,
      "routeScope": "DALAM_KOTA",
      "readiness": "SIAGA",
      "isActive": true,
      "activeAssignment": null,
      "isLocked": false
    }
  ]
}
```

Nomor kontak dan nomor SIM sengaja bernilai `null` selama datanya belum diverifikasi tim.

### B. Tambah Supir

- **Method:** `POST` · **Endpoint:** `/api/v1/admin/drivers`
- **Request Body:** `fullName` (wajib, 3 sampai 80 karakter), `routeScope` (wajib),
  `phoneNumber` dan `licenseNumber` (opsional, boleh `null`).
- Status awal selalu `SIAGA`. Nama atau nomor kontak yang sudah dipakai supir aktif ditolak
  dengan `409 DRIVER_DUPLICATE`.

### C. Ubah Data Supir

- **Method:** `PATCH` · **Endpoint:** `/api/v1/admin/drivers/:id`
- Body sama seperti penambahan, tetapi seluruh field opsional. Kesiapan tidak diubah di sini.

### D. Sakelar Kesiapan

- **Method:** `PATCH` · **Endpoint:** `/api/v1/admin/drivers/:id/readiness`
- **Request Body:** `readiness` bernilai `SIAGA` atau `LIBUR`, ditambah `note` opsional.
- Nilai `SEDANG_TUGAS` ditolak `400 DRIVER_READINESS_MANUAL_INVALID`, karena status itu hanya
  lahir dari penugasan pesanan. Supir yang sedang bertugas ditolak `409 DRIVER_ON_DUTY`.
- Bila statusnya sama dengan sebelumnya, respons memuat `unchanged: true`.

### E. Nonaktifkan Supir

- **Method:** `DELETE` · **Endpoint:** `/api/v1/admin/drivers/:id`
- Penonaktifan bersifat lunak: `isActive` menjadi `false` supaya jejak audit tetap utuh, dan
  supir itu hilang dari daftar default.
- Ditolak `409 DRIVER_ASSIGNED` bila supir masih terikat pesanan yang belum selesai.

### F. Penugasan Supir ke Pesanan

- **Method:** `PATCH` · **Endpoint:** `/api/v1/admin/bookings/:id/driver`
- **Request Body:** `driverId` (uuid atau `externalId` seperti `markus-gebze`) dan `note` opsional.
- Hanya berlaku untuk pesanan bertipe `WITH_DRIVER`. Dalam satu transaksi: supir diikat ke
  pesanan, kesiapannya menjadi `SEDANG_TUGAS`, riwayat status dan audit log ditulis.
- Pesanan bertipe `WITH_DRIVER` tidak bisa dikonfirmasi sebelum supirnya dipilih, dan ditolak
  `409 DRIVER_REQUIRED`.
- Saat pesanan selesai, dibatalkan, atau ditolak, supirnya otomatis kembali `SIAGA`.

**Definisi terikat:** sebuah pesanan mengikat supir sejak penugasan, bukan sejak konfirmasi.
Karena itu pemeriksaan bentrok jadwal dan penolakan penonaktifan ikut menghitung pesanan yang
masih menunggu konfirmasi.

---

## 10. Manajemen Akun Staf & Admin (`/admin/users`)

Menopang layar Manajemen Admin pada dashboard. Seluruh endpoint di sini butuh sesi
`ADMIN` atau `STAFF`, dan `passwordHash` tidak pernah ikut dikirim ke klien.

Aturan yang dijaga saat menghapus akun:

- Akun yang sedang dipakai untuk masuk tidak bisa dihapus sendiri.
- Admin aktif terakhir tidak bisa dihapus, supaya portal tidak terkunci.
- Akun yang masih terikat pemesanan, tiket, atau pesan tidak bisa dihapus; nonaktifkan
  sebagai gantinya.

### A. Daftar Akun

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/users`

```json
{
  "status": "ok",
  "data": [
    {
      "id": "8b1d2c34-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
      "fullName": "Admin MobilJuragan",
      "phoneNumber": "081234567890",
      "role": "ADMIN",
      "isActive": true
    }
  ]
}
```

### B. Detail Akun

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/users/:id`

### C. Tambah Akun

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/users`
- **Body:** `fullName`, `phoneNumber`, `role` (`ADMIN` atau `STAFF`), `password`
  (minimal 8 karakter).
- **Respons:** `201` bila berhasil. Nomor telepon yang sudah dipakai dibalas `409`
  `PHONE_NUMBER_EXISTS`.

### D. Ubah Akun

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/users/:id`
- **Body:** semua field opsional — `fullName`, `phoneNumber`, `role`, `password`, `isActive`.

### E. Hapus Akun

- **Method:** `DELETE`
- **Endpoint:** `/api/v1/admin/users/:id`
- **Respons:** `200` dengan nama akun yang dihapus.

---

## 11. Customer Care / Tiket Bantuan (`/admin/tickets`)

Menopang layar Customer Care pada dashboard: daftar tiket, ruang percakapan, dan balasan tim.

### A. Daftar Tiket

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/tickets`

### B. Buat Tiket

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/tickets`
- **Body:** `subject` dan `description` wajib diisi; keduanya dibalas `400`
  `VALIDATION_ERROR` bila kosong.

### C. Detail Tiket

- **Method:** `GET`
- **Endpoint:** `/api/v1/admin/tickets/:id`
- Memuat percakapan lengkap tiket.

### D. Ubah Status Tiket

- **Method:** `PATCH`
- **Endpoint:** `/api/v1/admin/tickets/:id/status`

### E. Kirim Balasan

- **Method:** `POST`
- **Endpoint:** `/api/v1/admin/tickets/:id/messages`
- **Body:** `body` wajib diisi; dibalas `400` `VALIDATION_ERROR` bila kosong.

---

## 12. Daftar Kode Error Umum

| HTTP Code | Error Code                        | Keterangan                                                                       |
| --------- | --------------------------------- | -------------------------------------------------------------------------------- |
| 400       | `VALIDATION_ERROR`                | Format body atau query parameter tidak sesuai validasi Zod.                      |
| 400       | `OTP_INVALID`                     | Kode OTP salah atau belum pernah diminta.                                        |
| 400       | `OTP_EXPIRED`                     | Kode OTP telah kedaluwarsa (lebih dari 5 menit).                                 |
| 400       | `OTP_ALREADY_USED`                | Kode OTP sudah pernah digunakan sebelumnya.                                      |
| 401       | `UNAUTHORIZED`                    | Header token tidak ditemukan atau token tidak valid.                             |
| 401       | `INVALID_CREDENTIALS`             | Password admin atau nomor telepon admin salah.                                   |
| 403       | `FORBIDDEN`                       | Pengguna tidak memiliki hak akses (role tidak mencukupi).                        |
| 404       | `VEHICLE_NOT_FOUND`               | Armada mobil dengan ID tersebut tidak ada di sistem.                             |
| 404       | `BOOKING_NOT_FOUND`               | Data pesanan sewa dengan ID atau booking code tersebut tidak ditemukan.          |
| 409       | `BOOKING_VEHICLE_UNAVAILABLE`     | Armada sedang tidak tersedia atau jadwal sewa bentrok dengan pesanan aktif lain. |
| 409       | `BOOKING_CONFLICT`                | Tidak dapat mengonfirmasi pesanan karena terjadi bentrok jadwal sewa aktif lain. |
| 400       | `DRIVER_READINESS_MANUAL_INVALID` | Status `SEDANG_TUGAS` dipaksa lewat sakelar kesiapan.                            |
| 404       | `DRIVER_NOT_FOUND`                | Supir dengan uuid atau `externalId` tersebut tidak ada di roster.                |
| 404       | `USER_NOT_FOUND`                  | Akun staf/admin dengan ID tersebut tidak ditemukan.                              |
| 404       | `TICKET_NOT_FOUND`                | Tiket bantuan dengan ID tersebut tidak ditemukan.                                |
| 409       | `PHONE_NUMBER_EXISTS`             | Nomor telepon sudah dipakai akun staf/admin lain.                                |
| 400       | `CANNOT_DELETE_SELF`              | Akun yang sedang dipakai untuk masuk tidak boleh dihapus sendiri.                |
| 409       | `LAST_ADMIN_PROTECTED`            | Admin aktif terakhir tidak boleh dihapus.                                        |
| 409       | `USER_HAS_REFERENCES`             | Akun masih terikat pemesanan, tiket, atau pesan sehingga tidak bisa dihapus.     |
| 409       | `DRIVER_DUPLICATE`                | Nama atau nomor kontak supir sudah dipakai supir aktif lain.                     |
| 409       | `DRIVER_INACTIVE`                 | Supir sudah nonaktif sehingga tidak bisa diubah atau ditugaskan.                 |
| 409       | `DRIVER_NOT_AVAILABLE`            | Supir berstatus `LIBUR` sehingga belum bisa ditugaskan.                          |
| 409       | `DRIVER_ALREADY_ASSIGNED`         | Supir sudah terikat pesanan lain pada rentang tanggal yang bertabrakan.          |
| 409       | `DRIVER_ON_DUTY`                  | Kesiapan supir yang sedang bertugas tidak bisa diubah.                           |
| 409       | `DRIVER_ASSIGNED`                 | Supir masih terikat pesanan yang belum selesai.                                  |
| 409       | `DRIVER_REQUIRED`                 | Pesanan memakai supir tetapi supirnya belum dipilih saat konfirmasi.             |
| 409       | `BOOKING_NOT_WITH_DRIVER`         | Pesanan bertipe lepas kunci tidak memakai supir.                                 |
| 409       | `BOOKING_NOT_ASSIGNABLE`          | Pesanan sudah selesai, dibatalkan, atau ditolak.                                 |
| 500       | `FETCH_FLEET_CALENDAR_ERROR`      | Terjadi kesalahan saat memuat kalender jadwal armada.                            |
| 500       | `UPDATE_VEHICLE_STATUS_ERROR`     | Terjadi kesalahan saat mengubah status armada.                                   |
| 500       | `INTERNAL_SERVER_ERROR`           | Kesalahan tidak terduga pada server database.                                    |
