# MobilJuragan Grand Project - Documentation Archive

Folder ini menyimpan dokumentasi penting untuk grand project UI/UX, mobile,
web framework, dan AI MobilJuragan. **Termasuk hasil ekstraksi prototype
Figma** untuk menjadi acuan implementasi frontend tanpa harus membuka
Figma saat coding.

## Status ekstraksi Figma (17 Sep 2026 - Hi-Fi Approved)

| Folder | Konten |
|---|---|
| `figma-raw/mobile/`        | 13 screenshot screen mobile Hi-Fi (780x1688 @2x) + 3 reference/modal states |
| `figma-raw/`               | 13 screenshot screen Hi-Fi kanonik + 3 Journey Map baris 1-3 |
| `figma-raw/dashboard/`     | 9 screenshot screen dashboard (1440x900) |
| `figma-raw/design-system/` | 9 screenshot komponen (Foundations, Button, Input, Badge, Status Chip, Vehicle Card, Booking Card, Stepper, Modal) |
| `MANIFEST.json`            | Peta lengkap: node id Hi-Fi → path screenshot + flow map 13 layar |
| `design-tokens.json`       | Color, typography, spacing, radius, elevation, data integrity |
| `PLANNING_TECH_STACK_DAN_ROADMAP.md` | Keputusan tech stack, scope MVP, 16 milestone dalam 14 minggu, dan format logbook |
| `TEAM_WORK_ALLOCATION.md`           | Pembagian 4 PIC, tanggung jawab, dan rotasi reviewer |
| `TEAM_POLICY_AI-ASSISTED_DEVELOPMENT.md` | Aturan kontribusi AI, privasi data, dan quality gate |
| `LOGBOOK_AI_ASSISTED_TEMPLATE.md`   | Template entry logbook per fitur/milestone dengan field AI |
| `logbook/`                          | Folder entry logbook (entry `YYYY-MM-DD_<milestone>_<fitur>_<inisial>.md`) |

**Total:** 48+ PNG resolusi tinggi + file indeks lengkap (`MANIFEST.json` + `design-tokens.json`).

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
├── TECH_PLANNING_CUSTOMER_PROFILE_ARCHITECTURE.md  # Desain arsitektur profil user pelanggan, customerCode, verifikasi SIM/KTP, & REST API
├── TECH_PLANNING_AI_VEHICLE_RECOMMENDATION_ENGINE.md # RFC/Proposal arsitektur AI prediction & recommendation armada (Screen 01)
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

## Status Lo-Fi Wireframe & Hi-Fi Implementation (17/09/26)

| Batch / Baris | Layar | Status Lo-Fi | Status Hi-Fi |
|---|---|---|---|
| Batch 1 | Beranda (1080:581), Pilih Kendaraan, Tinjau Pesanan | `reviewed-approved` | `hi-fi-applied` (Page `1006:92` Row 1) |
| Batch 2 | Detail Kendaraan, Tanggal & Waktu, Opsi Rental | `reviewed-approved` | `hi-fi-applied` (Page `1006:92` Row 1) |
| Batch 3 | Status Pesanan, Riwayat Pesanan | `reviewed-approved` | `hi-fi-applied` (Page `1006:92` Row 2) |
| Batch 4 | Pusat Bantuan, Buat Ticket, Chat AI Handoff | `reviewed-approved` | `hi-fi-applied` (Page `1006:92` Row 2) |
| Row 3 | Masuk / Login, Profil Pengguna (SIM/KTP) | `reviewed-approved` | `hi-fi-applied` (Page `1006:92` Row 3) |

Detail lengkap keputusan UX dan dokumentasi arsitektur ada di `docs/design/LOFI_TO_HIFI_DECISIONS.md`. Seluruh screenshot Hi-Fi pada `docs/figma-raw/` dan `docs/figma-raw/mobile/` beserta `MANIFEST.json` telah diperbarui dengan resolusi tinggi (2.0x scale, 780x1688 px) sesuai versi kanonik yang disetujui.

## Catatan

- Semua file disalin, bukan dipindahkan. Source asli tetap berada di folder `uiux`.
- Context dump versi `latest` menjadi acuan utama. Versi minggu kedua dipertahankan sebagai referensi historis.
- File Figma prototype bukan source runtime aplikasi. API key dan secret tidak disalin ke archive ini.
- Untuk komponen DS, label English (mis. `Vehicle Card`, `Status Chip`), sesuai konvensi tim; microcopy UI tetap Bahasa Indonesia.
