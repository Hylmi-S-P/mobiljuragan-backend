# Peran pengguna: apa yang benar-benar ada di server

Dokumen ini menjawab pertanyaan S5 pada `plan.md`: layar admin menampilkan peran
"Super Admin", sedangkan enum `UserRole` di server hanya tiga nilai. Apakah perlu
menambah `SUPER_ADMIN`, atau cukup menyelaraskan label?

## Keadaan sebenarnya

`prisma/schema.prisma`:

```prisma
enum UserRole {
  CUSTOMER
  STAFF
  ADMIN
}
```

Tidak ada peran keempat. Semua yang bisa dilakukan "Super Admin" di layar
dikerjakan oleh `ADMIN` di server, dan middleware memang sudah menegakkannya:

| Router                     | ADMIN | STAFF |
| -------------------------- | :---: | :---: |
| `/admin/users` (akun staf) |  ya   | tidak |
| `/admin/customers/:id/name`|  ya   | tidak |
| `/admin/fleet/tariff-settings` (PATCH) | ya | tidak |
| `/admin/refunds/:id` (PATCH)|  ya   | tidak |
| `/admin/bookings`, `/admin/drivers`, `/admin/vehicles`, `/admin/faqs`, `/admin/tickets` | ya | ya |
| `/admin/customers/*` operasional (buka kunci, cabut sesi, aktif/nonaktif) | ya | ya |

Jadi pembedaan ADMIN vs STAFF **sudah nyata** di backend dan diuji pada
`test/e2e/api-e2e.ts` kasus `T5.8`.

## Keputusan: jangan tambah `SUPER_ADMIN`

Alasan:

1. **Tidak ada kemampuan yang tertinggal.** Setiap tindakan yang di layar
   terlihat "khusus Super Admin" sudah dijaga oleh `requireRole(ADMIN)`. Menambah
   peran keempat berarti membuat tingkat wewenang yang belum punya isi.
2. **Migrasi enum MySQL adalah perubahan destruktif bila salah.** `ALTER TABLE`
   pada kolom enum menulis ulang tabel; untuk peran yang belum dibutuhkan,
   risikonya tidak sebanding.
3. **Nama peran adalah janji.** Selama server hanya membedakan dua tingkat,
   layar harus menyebut dua tingkat. Label "Super Admin" membuat orang mengira
   ada peran yang bisa dicabut/diberikan terpisah, padahal tidak.

## Yang dilakukan

- Label UI diselaraskan: `ADMIN` → **"Admin"**, `STAFF` → **"Staf"**
  (`mobiljuragan-dashboard/lib/labels.ts`, `ADMIN_ROLE`). Nilai internal
  `super_admin` / `staf_operasional` di `lib/types.ts` **tidak diubah** supaya
  pemetaan `mapApiUser` tetap satu arah dan tidak menyentuh data tersimpan.
- Bila kelak benar-benar dibutuhkan tingkat wewenang ketiga, jalannya adalah
  **kolom boolean** `User.isSuperAdmin` (migrasi aditif, tanpa menyentuh enum),
  bukan nilai enum baru. Itu bisa ditambahkan tanpa menulis ulang tabel.
