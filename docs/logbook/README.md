# Logbook MobilJuragan

Folder ini berisi entry logbook AI-assisted development. Satu file `.md` mewakili satu kontribusi fitur atau milestone.

## Cara membuat entry

1. Salin isi `docs/LOGBOOK_AI_ASSISTED_TEMPLATE.md`.
2. Simpan dengan nama `YYYY-MM-DD_<milestone>_<fitur>_<inisial>.md`.
3. Isi frontmatter: tanggal dd/mm/yy, pic, status, model_ai, provider_ai.
4. Lampirkan bukti (commit hash, screenshot, test output, atau response API) pada bagian `Hasil dan evidence`.
5. Minta reviewer mengubah status menjadi `done` setelah verifikasi.

## Aturan penamaan

```text
YYYY-MM-DD      : tanggal mulai kontribusi (ISO).
M# atau M##     : milestone dari docs/PLANNING_TECH_STACK_DAN_ROADMAP.md.
fitur           : nama fitur atau scope singkat (slug-style).
inisial         : inisial atau nama anggota (lihat TEAM_WORK_ALLOCATION.md).
```

Nama anggota di filename boleh ditulis sebagai inisial (mis. `_H`), nama lengkap (mis.
`_Hylmi`), atau kombinasi keduanya. Yang penting konsisten per PIC dan sesuai rotasi
reviewer yang tercantum pada `docs/TEAM_WORK_ALLOCATION.md` section 5. Untuk konsistensi
otomatis di review tim, lihat juga contoh berikut.

Contoh:

```text
2026-09-10_M6_vehicle-api_PIC-C.md
2026-09-12_M9_customer-booking_PIC-A.md
```

## Hal yang tidak boleh dilakukan

- Menulis entry tanpa bukti.
- Menggabungkan beberapa fitur dalam satu entry.
- Memasukkan API key, password, token, atau PII.
- Memasukkan data customer, harga, atau rating fiktif tanpa label `Data contoh`.
- Menggunakan em dash pada teks publik.
- Klaim `done` sebelum reviewer menandatangani checklist.
