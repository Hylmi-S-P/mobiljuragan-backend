# Harness E2E API

Harness ini menguji API lewat HTTP terhadap server sungguhan dan database
terpisah. Letaknya di dalam repo supaya `npm test` dan `npm run typecheck:e2e`
tidak lagi menunjuk folder di luar repo.

## Prasyarat

- MariaDB 11 berjalan di Docker (`mj-mariadb`) dan dapat dihubungi di
  `127.0.0.1:3306` dengan user `root` tanpa kata sandi.
- `.env` backend berisi `DATABASE_URL`. Harness mengganti nama database menjadi
  `mobiljuragan_test`; database dev `mobiljuragan` tidak pernah dipakai.
- Dependency sudah terpasang (`npm install`).

## Cara menjalankan

```bash
npm run test:e2e          # seluruh kasus
npm test                  # sama dengan test:e2e
npm run test:e2e -- --only=smoke,C3
npm run typecheck:e2e     # cek tipe file test saja
```

Argumen `--only=<id>` menerima satu atau beberapa id dipisahkan koma.

## Yang dilakukan harness

1. Membuat database `mobiljuragan_test` bila belum ada.
2. Menjalankan `prisma migrate deploy` ke database uji.
3. Mengosongkan seluruh tabel (foreign key dimatikan sementara), kecuali
   `_prisma_migrations` agar catatan migrasi tidak hilang.
4. Menjalankan seed admin uji (`081234567890` / `Admin123!`).
5. Menjalankan server di `http://127.0.0.1:4100` dengan
   `ALLOW_DEV_OTP_BYPASS=true`, lalu menunggu `/health` siap.
6. Menjalankan kasus berurutan, mencetak tabel hasil, dan mematikan server.

Keluaran server ditulis ke `test/e2e/.server.log` (mode append), bukan pipe,
supaya proses tidak menggantung dan kegagalan bisa diperiksa setelah run.

Setiap kasus memakai nomor HP pelanggan unik dan armada baru, sehingga run
berulang tetap bersih meski tanpa menghapus data secara manual.

## Menambah kasus

Tambahkan objek ke array `kasus` di `api-e2e.ts`:

```ts
{
  id: 'X1',
  nama: 'Deskripsi singkat perilaku yang diuji',
  async fn({ adminToken }) {
    const pelanggan = await loginCustomer();
    // ... siapkan data lewat helper di fixtures.ts
    // Gunakan harapan()/pastikanDitolak() agar kegagalan memuat status + body.
  },
}
```

Aturan singkat:

- Jangan memakai database dev dan jangan menambah dependency.
- Data harus unik per kasus atau dibersihkan sendiri.
- Tulis asersi terhadap perilaku yang benar. Kalau kode belum memenuhinya,
  biarkan kasus gagal; jangan melemahkan asersi agar hijau.
- Helper HTTP dan pembuat berkas ada di `fixtures.ts`; orkestrasi database dan
  server ada di `harness.ts`.
