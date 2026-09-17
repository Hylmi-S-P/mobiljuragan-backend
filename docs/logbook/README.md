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

---

## Daftar Entri Logbook Terverifikasi

| Tanggal | Berkas Logbook | Milestone & Cakupan Fitur | PIC | Status |
|---|---|---|:---:|:---:|
| 03/09/26 | [`2026-09-03_M3-repository-foundation_Hylmi.md`](2026-09-03_M3-repository-foundation_Hylmi.md) | M3: Repository foundation, monorepo Express API | Hylmi | `done` |
| 04/09/26 | [`2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md`](2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md) | M4: Database foundation, Prisma 7, seed 9 armada | Hylmi | `done` |
| 04/09/26 | [`2026-09-04_M5-api-contract-dan-auth_Hylmi.md`](2026-09-04_M5-api-contract-dan-auth_Hylmi.md) | M5: API contract, Customer OTP HMAC, Admin JWT, 9 test | Hylmi | `done` |
| 07/09/26 | [`2026-09-07_M-ux_lofi-wireframe_Hylmi.md`](2026-09-07_M-ux_lofi-wireframe_Hylmi.md) | M-UX: Lo-Fi wireframe 6 layar + anotasi Laws of UX | Hylmi | `done` |
| 10/09/26 | [`2026-09-10_M-freeze-backend-at-M5_Hylmi.md`](2026-09-10_M-freeze-backend-at-M5_Hylmi.md) | M-Freeze: Usulan pivot tim & freeze backend di M5 | Hylmi | `done` |
| 16/09/26 | [`2026-09-16_M-ux_hifi-batch3-batch4-ai-handoff_Hylmi.md`](2026-09-16_M-ux_hifi-batch3-batch4-ai-handoff_Hylmi.md) | M-UX: Hi-Fi Layar 07–11, AI Handoff, Journey Map Row 2 | Hylmi | `done` |
| 17/09/26 | [`2026-09-17_M-ux_hifi-auth-profile-ai-architecture_Hylmi.md`](2026-09-17_M-ux_hifi-auth-profile-ai-architecture_Hylmi.md) | M-UX: Hi-Fi Row 3 (12 & 13), Redesign 01c, Arsitektur Profil & RFC AI | Hylmi | `done` |

