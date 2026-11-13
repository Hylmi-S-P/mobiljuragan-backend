# Siklus Hidup Pesanan Sewa

Dokumen ini adalah rujukan tunggal untuk pertanyaan "pesanan ini sekarang di tahap
mana, siapa yang boleh memindahkannya, dan apa yang ikut berubah saat dipindahkan".

Sebelum dokumen ini ada, aturan urutan tersebar di controller, model, dan service,
sehingga setiap kali ada yang bertanya "kenapa pesanan ini bisa loncat", jawabannya
harus dicari ulang dari kode. Bagian **Celah yang diketahui** di bawah sengaja
mencatat lubang yang masih ada, supaya tidak ada yang mengira lubang itu sudah
tertutup.

Berkas acuan kode:

- `src/lib/bookingStage.ts` — tabel transisi, daftar status final, penghitung blocker.
- `src/model/bookingModel.ts` — transaksi perubahan status beserta efek sampingnya.
- `src/model/vehicleModel.ts` — status operasional armada dan aturan pengunciannya.
- `src/services/payment.service.ts` — pembuatan tagihan, unggah bukti, verifikasi.
- `src/services/document.service.ts` — verifikasi dan penolakan dokumen.

---

## 1. Aktor

| Aktor | Bisa apa |
| --- | --- |
| Pelanggan (`CUSTOMER`) | Membuat pesanan, mengunggah dokumen, mengunggah bukti pembayaran, membatalkan pesanan, membuka tiket bantuan. |
| Staf (`STAFF`) | Memverifikasi dokumen, memverifikasi pembayaran, menugaskan supir, menyerahkan armada, menutup tiket. |
| Admin (`ADMIN`) | Semua yang bisa dilakukan staf, ditambah mengubah nama pelanggan, mengelola akun pengelola, mengelola template dokumen, dan mengelola katalog. |
| Sistem | Menutup tiket yang menganggur, menyiapkan template dokumen, dan (rencana) membatalkan pesanan yang melewati tenggat. |

Catatan: backend hanya mengenal tiga peran (`CUSTOMER`, `STAFF`, `ADMIN`). Dashboard
menampilkan `super_admin` sebagai label, tetapi nilai itu dipetakan ke `ADMIN` saat
dikirim ke API.

---

## 2. Status pesanan

`BookingStatus` punya enam nilai. Tiga di antaranya final dan tidak bisa ditinggalkan.

| Status | Arti | Siapa yang memindahkan ke sini | Final |
| --- | --- | --- | --- |
| `CREATED` | Permintaan baru masuk, belum ditinjau. | Pelanggan (saat membuat pesanan). | tidak |
| `PENDING_CONFIRMATION` | Sedang ditinjau: dokumen diperiksa, tarif disiapkan. | Staf/admin. | tidak |
| `CONFIRMED` | Tarif sudah disetujui dan nominalnya terkunci. Menunggu pembayaran. | Staf/admin. | tidak |
| `IN_PROGRESS` | Armada sudah diserahkan, sewa berjalan. | Staf/admin. | tidak |
| `COMPLETED` | Sewa selesai, armada dikembalikan. | Staf/admin (sekarang), sistem (rencana). | ya |
| `REJECTED` | Permintaan ditolak sebelum dikonfirmasi. | Staf/admin. | ya |
| `CANCELLED` | Dibatalkan pelanggan, staf, atau sistem. | Pelanggan, staf/admin, sistem. | ya |

---

## 3. Alur resmi

```
                 (pelanggan)
                     |
                     v
   +-------------+  tinjau   +----------------------+
   |   CREATED   |---------->| PENDING_CONFIRMATION |
   +-------------+           +----------------------+
        |                        |            |
        | batal                  | tolak      | tarif disetujui
        v                        v            v
   +-----------+          +----------+   +-----------+
   | CANCELLED |          | REJECTED |   | CONFIRMED |
   +-----------+          +----------+   +-----------+
                                              |
                                              | armada diserahkan
                                              v
                                        +-------------+
                                        | IN_PROGRESS |
                                        +-------------+
                                              |
                                              | sewa berakhir
                                              v
                                        +-----------+
                                        | COMPLETED |
                                        +-----------+
```

Tahap yang dijaga: **dokumen -> konfirmasi tarif -> pembayaran -> serah armada ->
selesai**. Pesanan tidak boleh meloncat dari `CREATED` langsung ke pembayaran.

---

## 4. Tabel transisi yang diizinkan

Sumber: `ALLOWED_TRANSITIONS` di `src/lib/bookingStage.ts:23-39`.

| Dari | Boleh ke |
| --- | --- |
| `CREATED` | `PENDING_CONFIRMATION`, `CANCELLED` |
| `PENDING_CONFIRMATION` | `CONFIRMED`, `REJECTED`, `CANCELLED` |
| `CONFIRMED` | `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `IN_PROGRESS` | `COMPLETED` |
| `COMPLETED` | — |
| `REJECTED` | — |
| `CANCELLED` | — |

Transisi ke status yang sama selalu ditolak dengan `BOOKING_STATUS_UNCHANGED` (409).
Transisi di luar tabel ditolak dengan `INVALID_BOOKING_TRANSITION` (409).

---

## 5. Prasyarat per transisi

Diperiksa di dalam transaksi `updateStatusWithHistoryAndAudit`
(`src/model/bookingModel.ts:319-547`), bukan di controller, supaya tidak ada jalur
yang melewatinya.

| Transisi | Prasyarat | Kode galat |
| --- | --- | --- |
| apa pun -> `CONFIRMED` | `quotedAmount > 0` | `TARIFF_REQUIRED` |
| apa pun -> `CONFIRMED` | Tidak ada pesanan aktif lain di armada yang sama dengan jadwal bertumpuk | `BOOKING_CONFLICT` |
| apa pun -> `CONFIRMED` | Pesanan bersupir wajib sudah punya `driverId` | `DRIVER_REQUIRED` |
| apa pun -> `CONFIRMED` | Pesanan lepas kunci wajib punya dokumen `VERIFIED` | `DOCUMENTS_UNVERIFIED` |
| apa pun -> `IN_PROGRESS` | `Payment.status === PAID` | `PAYMENT_NOT_VERIFIED` |
| transisi selain `CONFIRMED` | Tidak boleh membawa `quotedAmount` | `TARIFF_REQUIRES_CONFIRMATION` |

Pembuatan tagihan (`src/services/payment.service.ts`) juga menolak pesanan yang
`quotedAmount`-nya kosong, dan untuk pesanan lepas kunci menolak bila dokumen belum
`VERIFIED`.

---

## 6. Efek samping per transisi

Semua terjadi di transaksi yang sama dengan perubahan status, sehingga tidak ada
keadaan setengah jadi.

| Transisi | Efek samping |
| --- | --- |
| Semua | Satu baris `BookingStatusHistory` (`fromStatus`, `toStatus`, aktor, catatan). |
| Semua | Satu baris `AuditLog` dengan aksi `UPDATE_BOOKING_STATUS`. |
| -> `CONFIRMED` | `quotedAmount` disimpan, `tariffStatus = CONFIRMED`, `routeScope` disimpan bila dikirim. |
| -> `IN_PROGRESS` | `Vehicle.operationalStatus = BOOKED`. |
| -> `COMPLETED` | Armada menjadi `IN_SERVICE` dengan `serviceStartedAt = sekarang` dan `serviceExpectedDoneAt = sekarang + 24 jam`. Kalau masih ada pesanan aktif lain yang mulai sebelum masa pemeriksaan berakhir, armada tetap `BOOKED` dan kedua stempel waktu dikosongkan. |
| -> `COMPLETED` / `CANCELLED` / `REJECTED` | Supir dilepas ke `SIAGA`, tetapi hanya bila tidak ada pesanan aktif lain yang masih memegangnya. |
| -> `CANCELLED` / `REJECTED` | Armada kembali `AVAILABLE`, kecuali sedang `MAINTENANCE`, dan hanya bila tidak ada pesanan aktif lain. |

---

## 7. Status pendamping

Pesanan punya empat status lain yang bergerak sendiri-sendiri. Mencampur keempatnya
dengan `BookingStatus` adalah sumber kebingungan yang paling sering muncul.

| Status | Nilai | Arti |
| --- | --- | --- |
| `TariffStatus` | `PENDING`, `CONFIRMED` | Apakah nominal tarif sudah disetujui tim. |
| `DocumentStatus` | `PENDING`, `VERIFIED`, `REJECTED` | Hasil pemeriksaan dokumen. |
| `PaymentStatus` | `UNPAID`, `PENDING_VERIFICATION`, `PAID`, `FAILED`, `REFUNDED` | Keadaan tagihan. |
| `OperationalStatus` | `AVAILABLE`, `BOOKED`, `IN_SERVICE`, `MAINTENANCE`, `UNAVAILABLE` | Keadaan unit armada. |
| `DriverReadiness` | `SIAGA`, `SEDANG_TUGAS`, `LIBUR` | Kesiapan supir. |

`BOOKED` dan `IN_SERVICE` dikelola sistem dan tidak boleh diubah manual dari
dashboard (`SYSTEM_MANAGED_STATUS` di `src/model/vehicleModel.ts:68-90`).

---

## 8. Blocker

`computeBookingBlockers` (`src/lib/bookingStage.ts:112-159`) menghasilkan daftar
alasan pesanan belum bisa lanjut. Daftar ini dikirim apa adanya ke dashboard dan
mobile supaya tombol bisa dinonaktifkan dengan alasan yang jelas.

| Kode | Muncul saat |
| --- | --- |
| `DOKUMEN_BELUM_TERVERIFIKASI` | Pesanan lepas kunci di tahap awal, dokumen belum `VERIFIED`. |
| `DOKUMEN_DITOLAK` | Dokumen berstatus `REJECTED`. |
| `TARIF_BELUM_DIKONFIRMASI` | `tariffStatus` belum `CONFIRMED` atau `quotedAmount` kosong. |
| `PEMBAYARAN_BELUM_DIVERIFIKASI` | Pesanan `CONFIRMED` tetapi pembayaran belum `PAID`. |
| `ARMADA_IN_SERVICE` | Unit sedang dalam masa pemeriksaan. |

---

## 9. Celah yang diketahui

Bagian ini mencatat lubang pada kode. Butir yang sudah ditutup tetap dicantumkan
beserta commit penutupnya, supaya alasan aturan itu ada tidak hilang.

### 9.1 Sudah ditutup

| # | Celah | Ditutup oleh |
| --- | --- | --- |
| 2 | Tidak ada pembatalan otomatis untuk pesanan yang dokumennya tidak diunggah | `ee73746` — tenggat 2 jam, dijeda saat menunggu pemeriksaan, 12 jam setelah ditolak |
| 3 | Tidak ada penyelesaian otomatis saat `endDateTime` lewat | `e055a8b` — sapuan `IN_PROGRESS` yang lewat jadwal |
| 4 | Tenggat pembayaran hanya ditegakkan di klien | `9e38790` — sapuan tagihan `UNPAID` yang lewat `expiresAt` |
| 5 | Dua definisi "mengunci" yang berbeda antara katalog dan pemeriksaan bentrok | `ea5e908` — satu daftar `BOOKING_BLOCKING_STATUSES` |
| 6 | `IN_SERVICE` bisa dilepas manual dan stempel waktunya tertinggal | `14441c5` — semua perubahan manual ditolak 409 selama `IN_SERVICE` |
| 7 | Pesanan `CANCELLED` masih bisa ditagih | `f8776ae` — `BOOKING_NOT_PAYABLE` 409 |
| 10 | Pembayaran tunai (COD) melewati gerbang pembayaran | `3115ac8` (backend) dan `b80e44b` (mobile) |
| 12 | Tidak ada tenggat dokumen | `ee73746` |
| 13 | Mengunggah ulang sebagian berkas menghapus berkas lain yang sudah benar | `0d67eae` — kolom yang tidak dikirim memakai berkas lama |
| 14 | Tarif bisa diketik staf dan tidak berasal dari katalog | `8d9d4ec` — `quotedAmount` dihitung server dari `pricePerDay` + `driverDailyRate` |
| 15 | Rute perjalanan tidak wajib saat tarif dikonfirmasi | `0d67eae` — `CONFIRMED` tanpa `routeScope` ditolak 400 |

### 9.2 Masih ada

1. **`CONFIRMED` boleh langsung ke `COMPLETED`.** Tabel transisi mengizinkan
   `CONFIRMED -> COMPLETED` (`src/lib/bookingStage.ts:30-34`), sehingga sewa bisa
   ditandai selesai tanpa pernah berstatus `IN_PROGRESS`. Akibatnya armada tidak
   pernah tercatat `BOOKED` dan tidak ada jejak serah terima.

2. **Penolakan pembayaran tidak membatalkan pesanan.** `src/services/payment.service.ts`
   kini punya dua bentuk penolakan: `REJECT` biasa (pesanan tetap `CONFIRMED`, pelanggan
   boleh unggah ulang) dan `REJECT` dengan `cancelBooking: true` (pesanan `CANCELLED`,
   supir dan armada dilepas). Transisi palsu `fromStatus == toStatus` sudah tidak ditulis
   lagi. Sisa celah: tidak ada tenggat unggah ulang setelah penolakan biasa.

3. **Refund tidak tercatat di server.** Sudah ditutup: `booking_refunds` dibuat di dalam
   transaksi perubahan status, `Payment.status` menjadi `REFUNDED`, dan dashboard punya
   antrean `/refunds`. Nominal dihitung server (potongan Rp 50.000 untuk pembatalan
   pelanggan, penuh untuk admin/sistem).

4. **Tidak ada stempel serah terima.** `startDateTime` dan `endDateTime` diisi
   pelanggan saat membuat pesanan dan tidak pernah diubah saat armada diserahkan.
   Tidak ada `handedOverAt`, sehingga "jam sewa mulai" hanya berarti jam yang
   diminta pelanggan, bukan jam unit benar-benar keluar.

5. **Penutupan tiket oleh pelanggan selalu gagal.** `src/controllers/ticketController.ts:698`
   menutup tiket lalu memanggil `createMessage` pada baris berikutnya, dan
   `src/model/ticketModel.ts:153-159` menolak pesan pada tiket `CLOSED`. Setiap
   permintaan tutup tiket dari pelanggan berakhir 409.

6. **Pengingat tenggat admin belum ada.** Pesanan di `PENDING_CONFIRMATION` sudah
   punya `adminDeadlineAt` (24 jam) dan dibatalkan otomatis saat lewat, tetapi belum
   ada pemberitahuan pada jam ke-12 karena kanal notifikasi belum dibangun.

---

## 10. Aturan yang akan ditambahkan

Bagian ini adalah rencana, bukan keadaan sekarang. Rujukannya `RENCANA-EKSEKUSI.md`
di akar workspace.

| Aturan | Gelombang |
| --- | --- |
| `CONFIRMED -> COMPLETED` ditutup; selesai hanya lewat `IN_PROGRESS`. | 2 |
| Refund dicatat di server: 100% bila dibatalkan admin/sistem, potongan tetap Rp 50.000 bila pelanggan membatalkan setelah bayar. | 2 |
| `handedOverAt` dicatat saat serah terima. | 2 |
| Penolakan pembayaran membatalkan pesanan, bukan hanya menandai tagihan gagal. | 2 |
| Pengingat tenggat admin pada jam ke-12. | 6 |

