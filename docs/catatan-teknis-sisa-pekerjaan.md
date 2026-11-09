# Catatan Teknis: Sisa Pekerjaan & Temuan Terbuka

**Tanggal:** 9 November 2026
**Cakupan:** `mobiljuragan-mobile`, `mobiljuragan-dashboard`, `mobiljuragan-backend`

Dokumen ini menampung hal-hal yang **belum** dikerjakan atau sengaja ditunda,
beserta alasan dan cara memverifikasinya. Bedanya dengan
`analisis-akun-tertimpa-otp.md`: dokumen itu mencatat insiden dan rencana
perbaikannya, sedangkan dokumen ini mencatat **utang teknis** yang tersisa
setelah Fase 0–3 selesai.

Urutan di dalam setiap bagian: dari yang paling berdampak ke yang paling ringan.

---

## 1. Cache pesanan tidak dibersihkan saat pemiliknya hilang dari server

**Ditemukan:** 9 November 2026, saat pengujian instalasi bersih.
**Tingkat:** sedang — tidak merusak data, tetapi menampilkan hal yang tidak ada.

### Gejala

Setelah database dikosongkan (akun pelanggan dihapus), aplikasi di emulator
**masih menampilkan satu reservasi lama**:

```
HILUX G HITAM · MJ-20261108-2GR3 · AKTIF
```

Padahal di server:

```
booking di database : 0
pelanggan           : 0
```

Dan di cache perangkat (Drift):

```
booking di cache lokal: 1
  ('MJ-20261108-2GR3', 'permintaanDiterima', 'cf6199bc-5b11-41de-87a7-28f8633884cd')
```

`user_id` `cf6199bc…` adalah akun yang sudah tidak ada di server.

### Penyebab

`BookingRepository._ownedRows()` menyaring baris Drift berdasarkan **pemilik
cache yang tersimpan di perangkat**, bukan berdasarkan keberadaan akun di server:

```dart
List<Booking> _ownedRows(List<Booking> rows) {
  final owner = _userId;
  if (owner == null) return rows;          // tamu: tampilkan semua baris
  return rows.where((row) => row.userId == owner).toList();
}
```

Kalau `_userId` bernilai **null** (mode tamu), seluruh baris dikembalikan —
termasuk baris milik akun yang sudah dihapus. Pembersihan hanya terjadi saat
**logout** atau **ganti akun**, bukan saat akun hilang di sisi server.

### Mengapa ini bisa terjadi

1. Akun pelanggan dihapus lewat skrip reset (`db:reset:pelanggan`).
2. Di perangkat, sesi sudah tidak sah karena token merujuk akun yang hilang —
   `restoreSession()` mengembalikan `null`, jadi `_userId = null`.
3. Karena `_userId == null`, filter kepemilikan dilewati dan baris lama tampil
   sebagai riwayat mode tamu.

### Rencana perbaikan

| # | Tindakan |
|---|---|
| 1 | Saat `syncAllBookingsFromRemote` berjalan dan server membalas kosong, hapus baris Drift yang `user_id`-nya tidak sama dengan pemilik aktif |
| 2 | Saat `restoreSession()` gagal karena akun tidak dikenal server, panggil `bookingRepo.clearLocalBookings()` sebelum masuk mode tamu |
| 3 | Tambah kolom/penanda `synced_at` per baris; baris yang tidak muncul di sinkronisasi terakhir dihapus |
| 4 | Untuk mode tamu, jangan tampilkan baris yang punya `user_id` — hanya baris tanpa pemilik (data kurasi) |

**Cara memverifikasi perbaikan:** hapus akun pelanggan di server, buka aplikasi
tanpa logout, pastikan riwayat kosong dan aplikasi masuk mode tamu.

### Catatan tambahan

`flutter clean` **tidak** menyelesaikan ini — cache ada di perangkat, bukan di
direktori build. Yang bekerja: logout, atau `adb shell pm clear
id.mobiljuragan.mobiljuragan_mobile`.

---

## 2. Keputusan izin staf pada rute akun pelanggan

**Ditemukan:** 8 November 2026, saat memeriksa hasil Fase 3.
**Tingkat:** sedang — menyangkut kewenangan, bukan kerusakan data.

### Keadaan sekarang

`/api/v1/admin/customers/*` terbuka untuk **ADMIN dan STAFF**. Akibatnya staf
dapat **mengoreksi nama pelanggan** — tindakan yang menyentuh kontrak dan
dokumen legal (e-KTP, form kesanggupan).

Komentar di kepala berkas rute menyatakan staf *tidak* boleh mengganti nomor
atau kata sandi — itu benar, tetapi **tidak menyebut** bahwa nama justru bisa
diubah. Komentar itu menjanjikan lebih dari yang ditegakkan kode.

### Bukti

Dengan token STAFF sungguhan:

```
STAFF  GET   /admin/customers            → 200
STAFF  POST  /admin/customers/:id/unlock → 200
STAFF  PATCH /admin/customers/:id/name   → 200   ← ini yang perlu diputuskan
STAFF  GET   /admin/users                → 403   (tetap terlindungi)
```

Jejak audit pun mencatat pelakunya sebagai `ADMIN`, karena `actorType` hanya
punya tiga nilai: `SELF`, `ADMIN`, `SYSTEM` — tidak ada `STAFF`.

### Pilihan yang tersedia

| # | Perubahan | Dampak |
|---|---|---|
| A | `PATCH /:id/name` → ADMIN saja | Koreksi identitas hanya oleh admin; staf tetap bisa membuka kunci & mencabut sesi |
| B | Tambah `actorType = 'STAFF'` + batasi koreksi nama ke ADMIN | Sama seperti A, jejak audit lebih akurat (perlu migrasi kecil) |
| C | Biarkan, cukup perbaiki komentar & `actorType` | Koreksi nama oleh staf diperbolehkan |

**Rekomendasi:** A + B. Alasannya, dokumen legal di repo ini sudah ADMIN-only
(`documentTemplateRoutes`), jadi koreksi identitas seharusnya punya bobot setara.

---

## 3. Jasa supir belum masuk perkiraan tarif

**Tingkat:** ringan — hanya memengaruhi tampilan perkiraan.

`Vehicle.pricePerDay` adalah harga **unit** saja. Untuk mode "Dengan Sopir",
panel dashboard menampilkan perkiraan dari harga unit tanpa menambahkan jasa
pengemudi (Rp 150.000/hari menurut FAQ).

Akibatnya admin melihat angka lebih rendah daripada yang seharusnya ditagihkan,
lalu harus menambahkan sendiri secara manual.

### Rencana

Tampilkan rincian terpisah di panel: **sewa unit + jasa pengemudi = subtotal**,
mengambil tarif supir dari konfigurasi (bukan konstanta di kode). Perlu keputusan
produk: tarif supir tetap per hari, atau bervariasi menurut rute dalam/luar kota?

---

## 4. Saklar debug build

**Status:** ditunda atas permintaan, sudah dirancang di
`analisis-akun-tertimpa-otp.md` §7a.

Ringkas: `--dart-define` + `main_dev.dart`/`main_prod.dart` supaya tombol
bantu pengujian (isi OTP otomatis, ganti `API_BASE_URL`, reset DB lokal) tidak
ikut ke APK rilis. Ditambah `/dev/*` di backend yang menjawab **404** bila
`NODE_ENV=production`.

---

## 5. Temuan kecil lain

| # | Hal | Catatan |
|---|---|---|
| 5.1 | `Booking.pricePerDay` hanya dipakai di dashboard | Mobile menghitung sendiri dari `vehicle.pricePerDay` di model, jadi kedua sisi bisa berbeda bila katalog berubah di antara pemesanan dan konfirmasi |
| 5.2 | `isFuture` tidak terpakai di `BookingTimelineBar` | Warning ESLint lama, bukan dari perubahan Fase 0–3 |
| 5.3 | 2 error `any` di `BookingCardGrid` & `lib/operations.ts` | Sudah ada sebelum merge; bukan regresi |
| 5.4 | `perlu_alokasi_sopir` hanya muncul setelah `CONFIRMED` | Perilaku disengaja: supir ditugaskan setelah tarif disepakati. Dokumentasikan agar tidak dianggap bug |
| 5.5 | Nomor telepon tidak bisa diubah dari dashboard | Disengaja: mengganti nomor = mengganti identitas, butuh verifikasi OTP ke nomor baru |
| 5.6 | Akun "Yahya" (`081248002910`) belum dipulihkan | Nama asli perlu dicocokkan dengan e-KTP pada booking `MJ-20261027-UOBB`; alatnya sudah tersedia di `/customers` |

---

## 6. Ringkasan prioritas

| Prioritas | Item | Alasan |
|---|---|---|
| Tinggi | §1 cache pesanan | Menampilkan data yang sudah tidak ada di server; membingungkan saat demo |
| Sedang | §2 izin staf | Menyangkut kewenangan atas identitas pelanggan |
| Sedang | §5.6 pemulihan akun Yahya | Data pelanggan nyata yang masih salah |
| Rendah | §3 jasa supir, §4 saklar debug, §5.x | Kosmetik/operasional, tidak memengaruhi kebenaran data |

---

## 7. Cara memeriksa ulang

```bash
# 1. Cache lokal perangkat vs database server
adb exec-out run-as id.mobiljuragan.mobiljuragan_mobile \
  cat app_flutter/mobiljuragan_local_db.sqlite > /tmp/local.sqlite
sqlite3 /tmp/local.sqlite "select id, status, user_id from bookings;"

# 2. Bandingkan dengan server
cd mobiljuragan-backend && npx tsx -e "
  import { db } from './src/db.js';
  console.log(await db.booking.findMany({ select: { bookingCode: true } }));
  await db.\$disconnect();
"

# 3. Izin staf
#    (butuh token STAFF; lihat §2)
curl -s -o /dev/null -w "%{http_code}\n" \
  -X PATCH http://127.0.0.1:4000/api/v1/admin/customers/<id>/name \
  -H "Authorization: Bearer <token-staff>" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Uji","reason":"uji izin staf untuk memastikan"}'
```

---

## 8. Kesimpulan

Fase 0–3 menutup jalur **pengambilalihan akun** dan **identitas karangan**, serta
menyediakan alat audit dan pemulihan. Yang tersisa di dokumen ini bukan kelanjutan
dari insiden itu, melainkan utang teknis yang terungkap selama pengerjaannya —
terutama §1, yang justru ditemukan karena pengujian instalasi bersih.
