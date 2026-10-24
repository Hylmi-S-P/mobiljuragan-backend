# Catatan Riwayat Migrasi Prisma

Dokumen ini menjelaskan keadaan riwayat migrasi di `backend/prisma/migrations`, apa yang
sudah dirapikan, dan satu selisih yang **tidak bisa dihilangkan**.

## Keadaan sebelum dirapikan

| Hal | Kondisi lama |
|---|---|
| `migration_lock.toml` | menulis `provider = "postgresql"` |
| Isi migrasi | dua berkas SQL PostgreSQL (`CREATE TYPE`, kutip ganda) |
| Database sungguhan | MySQL / MariaDB |
| `_prisma_migrations` | **tidak ada** — `prisma migrate` belum pernah dijalankan |
| Cara skema diterapkan | `prisma db push` |

Akibatnya `prisma migrate dev` dan `prisma migrate status` sama-sama gagal dengan galat
P3019: provider di skema (`mysql`) tidak cocok dengan `migration_lock.toml`
(`postgresql`). Kedua berkas SQL lama itu **tidak pernah dieksekusi** ke database mana
pun; keberadaannya hanya warisan sebelum proyek pindah ke MariaDB.

## Yang dilakukan

1. `migration_lock.toml` diperbaiki menjadi `provider = "mysql"`.
2. Dua migrasi PostgreSQL lama dihapus dari direktori migrasi.
   **Salinan aslinya disimpan** di `.verify/backup-migrasi/migrations-lama/` (di luar repo).
3. Dibuat satu migrasi baseline: `20261024120000_baseline_mysql/migration.sql`.
   Isinya skema lengkap dalam dialek MySQL, dihasilkan dari `schema.prisma`.
4. Baseline ditandai sudah diterapkan dengan `prisma migrate resolve --applied`,
   karena tabelnya memang sudah ada. SQL-nya tidak dijalankan ulang.
5. `prisma.config.ts` diberi `shadowDatabaseUrl` supaya perintah yang membaca direktori
   migrasi bisa bekerja. Database bayangan: `mobiljuragan_shadow`.

## Bukti bahwa baseline-nya benar

Dibangun database kosong `uji_baseline`, lalu `prisma migrate deploy` dijalankan.
Hasilnya dibandingkan kolom per kolom dengan database asli:

- 13 tabel di kedua sisi, tidak ada yang hilang atau berlebih
- seluruh nama kolom, tipe, collation, dan nullability **identik**

Database uji itu sudah dihapus kembali.

## Selisih yang tersisa dan tidak bisa dihilangkan

`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma`
selalu melaporkan satu baris:

```sql
ALTER TABLE `audit_logs` MODIFY `metadata` JSON NULL;
```

Ini **bukan drift dan bukan kesalahan riwayat migrasi**. Sebabnya:

- MariaDB tidak punya tipe `JSON` asli. Kata kunci `JSON` disimpan sebagai
  `LONGTEXT` + `CHECK (json_valid(...))` dengan collation `utf8mb4_bin`.
- Prisma membandingkan hasil introspeksi (`LONGTEXT`) dengan skema (`Json`), melihat
  perbedaan nama tipe, lalu menyarankan `ALTER`.
- Menjalankan `ALTER` itu **tidak mengubah apa pun** — sudah diuji, tipenya tetap
  `longtext` dan collation tetap `utf8mb4_bin`. Jadi perintahnya berulang tanpa akhir.

Karena itu migrasi baseline sengaja **tetap menulis `JSON NULL`** (bentuk yang Prisma
hasilkan sendiri), bukan `LONGTEXT`. Kalau ditulis `LONGTEXT`, Prisma justru menyarankan
arah sebaliknya dan hasilnya sama saja. `prisma migrate status` tetap melaporkan
**"Database schema is up to date!"** — itulah yang penting untuk alur kerja sehari-hari.

## Cara pakai sehari-hari

```bash
cd backend

# melihat status
npx prisma migrate status

# setelah mengubah schema.prisma, buat migrasi baru
npx prisma migrate dev --name nama_perubahan

# menerapkan migrasi yang sudah ada (tanpa membuat baru)
npx prisma migrate deploy
```

`prisma db push` **tidak dipakai lagi** untuk perubahan skema, karena akan melewati
riwayat migrasi dan mengembalikan masalah yang baru saja dirapikan. `db push` masih
berguna hanya untuk eksperimen lokal yang akan dibuang.

## Prasyarat di mesin lain

Database bayangan harus ada lebih dulu, sekali saja:

```sql
CREATE DATABASE `mobiljuragan_shadow`;
```

Tanpa itu, perintah yang membaca direktori migrasi gagal dengan galat
"must set `datasource.shadowDatabaseUrl`". Nama database bayangan diatur di
`prisma.config.ts` dan selalu diturunkan dari `DATABASE_URL`, jadi tidak perlu diisi
manual.
