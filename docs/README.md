# MobilJuragan Grand Project - Documentation Archive

Folder ini menyimpan dokumentasi penting untuk grand project UI/UX, mobile,
web framework, dan AI MobilJuragan. **Termasuk hasil ekstraksi prototype
Figma** untuk menjadi acuan implementasi frontend tanpa harus membuka
Figma saat coding.

## Status ekstraksi Figma (3 Sep 2026)

| Folder | Konten |
|---|---|
| `figma-raw/mobile/`        | 14 screenshot screen mobile (390x844) |
| `figma-raw/dashboard/`   | 9 screenshot screen dashboard (1440x900) |
| `figma-raw/design-system/` | 9 screenshot komponen (Foundations, Button, Input, Badge, Status Chip, Vehicle Card, Booking Card, Stepper, Modal) |
| `MANIFEST.json`            | Peta lengkap: node id → path screenshot + flow map |
| `design-tokens.json`       | Color, typography, spacing, radius, elevation, data integrity |
| `PLANNING_TECH_STACK_DAN_ROADMAP.md` | Keputusan tech stack, scope MVP, 16 milestone dalam 14 minggu, dan format logbook |
| `TEAM_WORK_ALLOCATION.md`           | Pembagian 4 PIC, tanggung jawab, dan rotasi reviewer |
| `TEAM_POLICY_AI-ASSISTED_DEVELOPMENT.md` | Aturan kontribusi AI, privasi data, dan quality gate |
| `LOGBOOK_AI_ASSISTED_TEMPLATE.md`   | Template entry logbook per fitur/milestone dengan field AI |
| `logbook/`                          | Folder entry logbook (entry `YYYY-MM-DD_<milestone>_<fitur>_<inisial>.md`) |

**Total:** 32 PNG dimensi asli + 2 file indeks (MANIFEST + tokens).

**Limitasi:**
- `get_design_context` Figma MCP butuh layer yang sedang dipilih di Figma
  desktop → kode referensi HTML/JSX per screen tidak bisa diekstrak
  otomatis. Developer membangun komponen dari screenshot + tokens +
  DESIGN.md.
- `CONTEXT_DUMP_semut_copilot_vscode.md` lama sudah outdated untuk
  Dashboard (5 screen tambahan). Gunakan `MANIFEST.json` ini.

## Struktur folder lengkap

```
docs/
├── README.md                    # File ini
├── MANIFEST.json                # Peta node id → screenshot
├── design-tokens.json           # Tokens (warna, tipografi, spacing, dll)
├── PLANNING_TECH_STACK_DAN_ROADMAP.md  # Tech stack, MVP scope, dan roadmap tim
├── TECH_PLANNING_AI_CHATBOT_HANDOFF_EDGE_CASES.md  # Perencanaan arsitektur & edge cases AI chat handoff
├── TEAM_WORK_ALLOCATION.md            # Pembagian kerja 4 PIC dan rotasi reviewer
├── TEAM_POLICY_AI-ASSISTED_DEVELOPMENT.md  # Aturan kontribusi AI untuk tim
├── LOGBOOK_AI_ASSISTED_TEMPLATE.md    # Template entry logbook (wajib dipakai team)
├── logbook/                           # Entry logbook per fitur/milestone (dibuat saat eksekusi)
├── figma-raw/
│   ├── mobile/                  # 14 PNG screen mobile (390x844)
│   ├── dashboard/               # 9 PNG screen dashboard (1440x900)
│   └── design-system/           # 9 PNG komponen DS
├── context/                     # context dump iterasi minggu kedua + versi terbaru
├── design/                      # aturan design, DESIGN.md, antislop
├── course/                      # materi kuliah
├── research/                    # analisis UX, riset, rekomendasi
├── ia/                          # Information Architecture, user flow, diagram .drawio
└── delivery/                    # dokumen hasil/delivery
```

## Prioritas membaca

1. `MANIFEST.json` + `figma-raw/` (visual reference untuk frontend)
2. `design-tokens.json` (warna, tipografi, spacing - sudah dikonsolidasikan)
3. `design/DESIGN.md` (arah desain otoritatif)
4. `design/LOFI_TO_HIFI_DECISIONS.md` (decision log Lo-Fi, status `needed to be validated by team`)
5. `context/CONTEXT_DUMP_semut_copilot_vscode_latest.md`
6. `PLANNING_TECH_STACK_DAN_ROADMAP.md` (tech stack, scope MVP, dan roadmap tim)
7. `TEAM_WORK_ALLOCATION.md` (pembagian kerja 4 PIC)
8. `TEAM_POLICY_AI-ASSISTED_DEVELOPMENT.md` (aturan kontribusi AI)
9. `LOGBOOK_AI_ASSISTED_TEMPLATE.md` (template entry logbook)
10. `ia/MobilJuragan_IA_dan_User_Flow.docx`
11. `ia/Penjelasan_Naratif_IA_dan_User_Flow_MobilJuragan.docx`
12. Folder `ia/IA/` dan `ia/user-flow/`

## Status Lo-Fi Wireframe (10/09/26)

| Batch | Layar | Status |
|---|---|---|
| Batch 1 (07/09/26) | Beranda, Pilih Kendaraan, Tinjau Pesanan | `needed to be validated by team` |
| Batch 2 (09/09/26) | Detail Kendaraan, Tanggal & Waktu, Opsi Rental | `needed to be validated by team` |
| Batch 3 (direncanakan) | Data Pemesan, Verifikasi OTP, Status Booking | belum dijalankan |
| Batch 4 (direncanakan) | Bantuan, Buat Ticket, Chat Bantuan | belum dijalankan |

Detail lengkap keputusan UX dan alasan dibawa/tidak ke Hi-Fi ada di `docs/design/LOFI_TO_HIFI_DECISIONS.md`. Sampai status berubah menjadi `reviewed-approved`, `design-tokens.json`, `MANIFEST.json` untuk Hi-Fi, dan screenshot Hi-Fi pada `docs/figma-raw/` TIDAK diubah.

## Catatan

- Semua file disalin, bukan dipindahkan. Source asli tetap berada di folder `uiux`.
- Context dump versi `latest` menjadi acuan utama. Versi minggu kedua dipertahankan sebagai referensi historis.
- File Figma prototype bukan source runtime aplikasi. API key dan secret tidak disalin ke archive ini.
- Untuk komponen DS, label English (mis. `Vehicle Card`, `Status Chip`), sesuai konvensi tim; microcopy UI tetap Bahasa Indonesia.
