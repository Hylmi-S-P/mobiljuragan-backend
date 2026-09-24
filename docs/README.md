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
  *(Catatan dev: Nilai `devMockOtp` disediakan langsung di response JSON selama development agar testing login cepat tanpa gateway SMS/WA berbayar).*

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

### C. Profil Customer yang Sedang Login
- **Method:** `GET`
- **Endpoint:** `/api/v1/auth/me`
- **Header:** `Authorization: Bearer <TOKEN>`
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "id": "1826a286-2c48-4027-91fd-da3ad9a7ad61",
      "phoneNumber": "081234567888",
      "fullName": "Budi Santoso",
      "role": "CUSTOMER"
    }
  }
  ```

### D. Logout Customer
- **Method:** `POST`
- **Endpoint:** `/api/v1/auth/logout`
- **Header:** `Authorization: Bearer <TOKEN>`
- **Contoh Respons:**
  ```json
  {
    "status": "ok",
    "data": {
      "message": "Berhasil logout."
    }
  }
  ```

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
  *(Catatan: `vehicleId` dapat berupa UUID database atau `externalId` armada).*
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
- **Fungsi:** Mengambil daftar seluruh riwayat booking milik customer yang sedang login (untuk tab *Status / Pesanan* di mobile).
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

## 7. Daftar Kode Error Umum

| HTTP Code | Error Code | Keterangan |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Format body atau query parameter tidak sesuai validasi Zod. |
| 400 | `OTP_INVALID` | Kode OTP salah atau belum pernah diminta. |
| 400 | `OTP_EXPIRED` | Kode OTP telah kedaluwarsa (lebih dari 5 menit). |
| 400 | `OTP_ALREADY_USED` | Kode OTP sudah pernah digunakan sebelumnya. |
| 401 | `UNAUTHORIZED` | Header token tidak ditemukan atau token tidak valid. |
| 401 | `INVALID_CREDENTIALS` | Password admin atau nomor telepon admin salah. |
| 403 | `FORBIDDEN` | Pengguna tidak memiliki hak akses (role tidak mencukupi). |
| 404 | `VEHICLE_NOT_FOUND` | Armada mobil dengan ID tersebut tidak ada di sistem. |
| 404 | `BOOKING_NOT_FOUND` | Data pesanan sewa dengan ID atau booking code tersebut tidak ditemukan. |
| 409 | `BOOKING_VEHICLE_UNAVAILABLE` | Armada sedang tidak tersedia atau jadwal sewa bentrok dengan pesanan aktif lain. |
| 500 | `INTERNAL_SERVER_ERROR` | Kesalahan tidak terduga pada server database. |

