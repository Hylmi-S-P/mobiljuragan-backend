# ADR: peristiwa tiket lewat WebSocket

Status: **diterima** (14 November 2026). Menggantikan saluran SSE yang dipasang
13 November 2026.

## Konteks

Chat bantuan punya dua fase yang berbeda sifatnya:

1. **Fase asisten AI.** Balasan dihasilkan oleh proses yang sama dengan
   permintaan HTTP-nya. Tidak ada yang perlu didorong: klien mendapat jawaban
   dari respons POST yang ia kirim sendiri.
2. **Fase petugas.** Balasan datang dari orang lain, di waktu yang tidak bisa
   ditebak klien. Di sinilah dorongan dari server dibutuhkan.

`plan.md` H12 sudah memutuskan transport untuk fase kedua: **WebSocket**, dengan
DoD "chat AI + chat admin berjalan; reconnect tidak duplikasi pesan (pakai
`sequence`)". Implementasi pertama memakai SSE karena arahnya waktu itu hanya
satu. Keputusan itu menyimpang dari rencana dan diperbaiki di sini.

## Keputusan

Peristiwa tiket dikirim lewat **WebSocket** di `/api/v1/ws/tickets`, satu port
dengan API.

Alasannya bukan "WebSocket lebih modern", melainkan tiga hal terukur:

1. **Biaya kueri tidak tumbuh sebanding penonton.** SSE memeriksa database tiap
   dua detik per sambungan. Dua ratus pelanggan membuka tiket berarti sekitar
   seratus kueri per detik hanya untuk menjawab "ada yang baru?". Di sini
   peristiwa disiarkan saat `createMessage` selesai menulis, jadi tidak ada
   polling sama sekali.
2. **Kanal dua arah tersedia saat dibutuhkan.** Indikator mengetik dan tanda
   sudah dibaca tidak bisa dibangun di atas SSE tanpa POST tambahan. Kontraknya
   sudah disiapkan (`aksi: detak`), jadi penambahannya tidak memerlukan
   perubahan transport lagi.
3. **Satu soket bisa memantau beberapa tiket.** Dashboard customer care nanti
   bisa mengikuti beberapa percakapan sekaligus tanpa membuka satu sambungan
   per tiket.

## Bentuk protokol

Klien membuka `ws(s)://<host>/api/v1/ws/tickets?token=<jwt>`. Token juga diterima
lewat header `Authorization` bila klien bisa menyetelnya saat handshake.

| Arah | Isi | Arti |
|---|---|---|
| klien → server | `{"aksi":"langganan","ticketId":"..."}` | minta peristiwa satu tiket |
| klien → server | `{"aksi":"lepas","ticketId":"..."}` | berhenti mengikuti tiket itu |
| klien → server | `{"aksi":"detak"}` | penanda masih hidup |
| server → klien | `{"jenis":"siap","ticketId":"..."}` | langganan diterima |
| server → klien | `{"jenis":"pesan","sequence":N,...}` | ada pesan baru |
| server → klien | `{"jenis":"status","status":"..."}` | status tiket berubah |
| server → klien | `{"jenis":"handover",...}` | tiket diserahkan ke petugas |
| server → klien | `{"jenis":"galat","kode":"...","pesan":"..."}` | permintaan ditolak |

Bentuk peristiwanya sengaja dipertahankan sama dengan saluran lama supaya layar
tidak perlu memetakan ulang arti setiap peristiwa.

## Keamanan

Soket tidak melewati middleware Express, jadi pemeriksaannya dilakukan sendiri di
`src/ws/ticketSocket.ts`:

- tanda tangan JWT diverifikasi dengan fungsi yang sama (`verifyAuthToken`);
- akun harus ada dan aktif;
- `tokenVersion` dibandingkan, sehingga mengganti kata sandi memutus soket yang
  sudah terbuka — bukan hanya permintaan HTTP berikutnya;
- pelanggan hanya boleh mengikuti tiket miliknya sendiri; staf dan admin boleh
  semua. Penolakan dikirim sebagai peristiwa `galat`, bukan dibiarkan senyap.

Soket tanpa token ditutup dengan kode `4401`.

## Konsekuensi

**Yang harus benar saat deploy.** Proxy wajib meneruskan header `Upgrade` dan
`Connection`. nginx perlu `proxy_set_header Upgrade $http_upgrade` dan
`proxy_set_header Connection "upgrade"` pada lokasi `/api/v1/ws/`. Cloudflare
Tunnel mendukung WebSocket tanpa pengaturan tambahan. Bila nanti backend berjalan
lebih dari satu instans, siaran dalam proses (`EventEmitter`) tidak lagi cukup —
perlu Redis pub/sub; ini dicatat sebagai syarat, bukan dikerjakan sekarang.

**Detak dua lapis.** Protokol WebSocket sudah punya ping/pong (server mengirim
ping tiap 30 detik dan memutus soket yang tidak menjawab), dan klien mengirim
`{"aksi":"detak"}` tiap 25 detik untuk menjaga jalur tetap terbuka melewati
proxy yang memutus koneksi diam.

**Deduplikasi.** Klien membuang peristiwa `pesan` dengan `sequence` yang sama
atau lebih kecil dari yang terakhir diterima. Tanpa ini, sambung ulang bisa
memunculkan pesan yang sama dua kali. Nomor urut sudah unik per tiket di
database (`TicketMessage.sequence`).

**Sambung ulang.** Jeda 2 detik, berlipat dua sampai 30 detik, maksimal lima
tingkat. Tiket final tidak lagi didorong; server melepas langganannya tetapi
soket tetap terbuka untuk tiket lain.

## Yang dihapus

- `src/controller/ticketEventController.ts` (seluruh saluran SSE)
- rute `GET /api/v1/tickets/:id/events`
- `lib/data/remote/ticket_event_stream.dart` di aplikasi pelanggan

Diganti oleh `src/lib/ticketEvents.ts` (siaran dalam proses),
`src/ws/ticketSocket.ts` (server), dan `lib/data/remote/ticket_socket.dart`
(klien).

## Pengujian

- `test/e2e/api-e2e.ts` kasus **T8.1**: soket menolak tanpa token (4401),
  menerima langganan, menerima peristiwa `pesan` setelah admin membalas, dan
  menolak tiket milik pelanggan lain dengan `TICKET_NOT_FOUND`.
- `test/data/ticket_socket_test.dart`: klien mengirim langganan, meneruskan
  peristiwa, membuang `sequence` ganda, dan melaporkan galat saat token kosong.
