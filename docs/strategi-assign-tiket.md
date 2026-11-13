# Strategi kepemilikan tiket

Dokumen ini menjelaskan bagaimana satu tiket bantuan dipegang oleh satu orang pada
satu waktu, mengapa aturannya dibuat begitu, dan apa yang terjadi saat dua orang
menekan tombol hampir bersamaan.

Dokumen ini tidak boleh bertentangan dengan kode. Kalau kode berubah, dokumen ini
ikut diubah pada commit yang sama.

## Masalah yang diselesaikan

Tanpa aturan kepemilikan, dua admin bisa membalas satu pelanggan tanpa saling tahu.
Pelanggan menerima dua jawaban berbeda untuk satu pertanyaan, salah satunya mungkin
sudah tidak berlaku. Karena itu tiket punya pemegang tunggal.

Pemegang bukan sekadar penanda tampilan. Ia menentukan siapa yang boleh menulis
balasan, dan siapa yang harus mengambil alih lebih dulu.

## Keadaan sebuah tiket

| Keadaan | `assignedAdminId` | `handledBy` | Siapa yang boleh membalas |
|---|---|---|---|
| Baru, ditangani AI | kosong | `AI` | tidak ada admin — AI yang menjawab |
| Diserahkan ke manusia, belum dipegang | kosong | `HUMAN` | admin mana pun; balasan pertama mengklaim |
| Dipegang admin A | A | `HUMAN` | hanya A |
| Selesai atau ditutup | apa pun | apa pun | tidak ada |

Status percakapan (`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`)
berjalan terpisah dari kepemilikan. Tiket yang dipegang A bisa berstatus
`WAITING_CUSTOMER`; itu artinya A sudah menjawab dan sedang menunggu pelanggan,
bukan berarti tiketnya bebas.

## Tiga tindakan, tiga akibat

Endpoint dipisah, bukan digabung dengan parameter mode, karena aturan izinnya
berbeda dan mudah salah baca kalau disatukan.

| Endpoint | Siapa | Akibat |
|---|---|---|
| `POST /admin/tickets/:id/assign` | ADMIN, STAFF | Mengambil tiket yang **belum** dipegang. Gagal 409 kalau sudah ada pemegang. |
| `POST /admin/tickets/:id/takeover` | **ADMIN saja** | Merebut tiket dari pemegang mana pun. STAFF ditolak 403. |
| `DELETE /admin/tickets/:id/assign` | pemegang, atau ADMIN | Melepas tiket supaya bisa diambil orang lain. |

Pengambilalihan dibatasi ADMIN karena artinya membatalkan pekerjaan orang lain yang
mungkin sedang menulis balasan.

## Perlombaan: dua admin, satu tiket

Keputusan siapa pemegang **tidak** diambil dari data yang dibaca beberapa milidetik
sebelumnya. Pola yang dipakai adalah `updateMany` bersyarat: keputusan diambil oleh
baris itu sendiri, di dalam satu perintah tulis.

```
UPDATE support_tickets
SET assignedAdminId = <saya>, assignedAt = sekarang
WHERE id = <tiket> AND assignedAdminId IS NULL
```

Yang membaca `count = 1` menang. Yang membaca `count = 0` tahu bahwa ada orang lain
yang lebih dulu, lalu menerima **409**, bukan 201.

### Balasan pertama mengklaim tiket

Admin tidak perlu menekan dua tombol untuk hal yang jelas: membalas berarti
mengerjakan. Karena itu balasan pertama pada tiket yang belum dipegang langsung
mengklaimnya — lewat jalur yang sama, dan hasilnya diperiksa.

Tanpa pemeriksaan hasil, dua admin yang menekan kirim hampir bersamaan sama-sama
membaca "belum ada pemegang", sama-sama mengirim balasan, dan pesan yang kalah tetap
masuk. Kasus uji `T5.1` justru menguji itu: dua balasan dikirim serentak, hasilnya
harus tepat satu `201` dan satu `409`, dan riwayat hanya berisi satu balasan admin.

### Pengambilalihan memakai pembanding pemegang lama

Pengambilalihan menyasar tiket yang **sudah** ada pemegangnya, jadi syaratnya bukan
`IS NULL` melainkan "pemegangnya masih yang tadi saya lihat":

```
UPDATE support_tickets
SET assignedAdminId = <saya>, assignedAt = sekarang
WHERE id = <tiket> AND assignedAdminId = <pemegang yang saya lihat>
```

Kalau ternyata sudah berganti, `count = 0` dan pemanggil menerima 409 — lebih baik
daripada menimpa pemegang baru tanpa ada yang tahu.

## Saat AI menyerahkan percakapan

`handledBy` berubah dari `AI` ke `HUMAN` hanya sekali, lewat `updateMany` bersyarat
`handledBy = AI`. Penyerahan kedua tidak menulis pesan transisi lagi, sehingga
riwayat tidak dipenuhi kalimat yang sama berulang kali.

Pengambilalihan oleh admin pada tiket yang masih ditangani AI melakukan dua hal
sekaligus: menghentikan AI (`handledBy = HUMAN`, `handoverAt` diisi) dan menulis
pesan sistem:

> Tiket telah diambil alih oleh admin \<nama\>. Percakapan ini sekarang ditangani petugas.

Pesan itu bukan hiasan. Tanpa penanda, riwayat terbaca seolah staf yang menjawab
sejak awal, dan pelanggan tidak tahu kapan mesin berhenti.

## Yang tidak boleh terjadi

| Kejadian | Aturan |
|---|---|
| Admin menjawab tiket yang dipegang admin lain | 409 `TICKET_ASSIGNED_TO_OTHER` |
| Admin menjawab tiket yang masih ditangani AI | 409 `TICKET_STILL_WITH_AI` |
| Siapa pun menulis ke tiket `RESOLVED`/`CLOSED` | 409 `TICKET_CLOSED` |
| STAFF mengambil alih tiket | 403 |
| Pengambilalihan pada tiket yang sudah selesai | 409 `TICKET_CLOSED` |
| Staf menyetel status `RESOLVED`/`CLOSED` | 409 `TICKET_CLOSE_BY_SYSTEM` |

Semua pemeriksaan ini ada di backend, bukan hanya di tampilan. Tampilan yang
menyembunyikan tombol tetap bisa dilewati dengan memanggil API langsung.

## Penutupan tiket

Penutupan oleh pelanggan menulis pesan penutup **lalu** mengubah status, dalam satu
transaksi. Urutannya penting: pesan tidak boleh dibuat setelah status menjadi
`CLOSED`, karena model menolak pesan pada tiket final — dulu urutannya terbalik,
sehingga setiap penutupan berakhir 409 padahal tiketnya sudah terlanjur tertutup.

Penutupan **bukan** wewenang staf. Staf yang bisa menutup tiket akan menutup
percakapan yang sebenarnya belum selesai; pelanggan kehilangan kesempatan menjawab
dan tiket yang masih hidup hilang dari antrean. Karena itu perpindahan ke `RESOLVED`
maupun `CLOSED` lewat endpoint admin ditolak, dan tombol "Selesaikan & Tutup Tiket"
dihapus dari layar admin.

Penutupan otomatis berjalan di latar belakang lewat penjadwal tiket: tiket
`RESOLVED` yang tidak dijawab lagi selama 24 jam ditutup, begitu juga sesi AI yang
menganggur lebih dari 24 jam. Staf tetap boleh mengubah status bukan akhir
(`OPEN`, `IN_PROGRESS`, `WAITING_CUSTOMER`).

## Kasus uji yang mengunci perilaku ini

| Kasus | Yang dijaga |
|---|---|
| `T5.1` | Dua admin membalas serentak → tepat satu 201 dan satu 409; riwayat hanya satu balasan |
| `T5.3` | STAFF tidak boleh mengambil alih; pengambilalihan mengisi pemegang, menghentikan AI, dan menulis pesan sistem; menekan ulang oleh pemegang yang sama tetap 200 |
| `T5.4` | Pelanggan menutup tiketnya sendiri berhasil 200, pesan penutup tercatat, balasan setelahnya 409 |
| `T5.4b` | Staf menyetel `RESOLVED`/`CLOSED` ditolak 409; status bukan akhir tetap boleh |
| `H6` | Pesan ke tiket `RESOLVED`/`CLOSED` ditolak 409 (regresi) |
