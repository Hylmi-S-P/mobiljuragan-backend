---
tanggal: 16/09/26
milestone: M-UX (Implementasi Hi-Fi Batch 3 & 4 Pasca-Pemesanan & AI Handoff)
fitur: Hi-Fi 5 Layar Pasca-Pemesanan, AI Chatbot Handoff, dan Journey Map Baris 2
pic: Hylmi (PIC C - Backend Engineer / UI-UX Builder)
reviewer: Halimah (PIC D - QA Lead)
status: done
model_ai: Antigravity / reasonix (agent)
provider_ai: Google DeepMind
versi_model: Antigravity 2.0
cakupan_ai: design | docs | review
prompt_disimpan: false
decision_log: docs/design/LOFI_TO_HIFI_DECISIONS.md
context_ref: docs/context/CONTEXT_DUMP_figma_antigravity.md
---

## 1. Ringkasan

Mengimplementasikan seluruh 5 layar High-Fidelity (Hi-Fi) untuk alur pasca-pemesanan dan layanan bantuan pelanggan langsung ke dalam master page Figma `Hi-Fi — MobilJuragan (SandBox Antigravity)` (node ID `1006:92`) pada baris kedua ($y = 1350$). Sesi ini mencakup penyusunan arsitektur transisi percakapan dari AI Bot ke Staf CS Manusia (*AI Handoff*) pada Layar 11, pembuatan Section Canvas Header ($y = 1260$), kanvas Journey Map & Laws of UX Baris 2 ($y = 2240$), serta audit presisi geometris tanpa teks meluap (*zero text overflow*).

## 2. Fitur atau Scope

- **Layar 07 — Status Pesanan (`1045:968`):** Stepper 4 tahap (`#0e7c7b`/`#1d4ed8`), badge `Menunggu Konfirmasi`, identitas armada Avanza Putih `PS1692B`, bottom nav tab Status aktif.
- **Layar 08 — Riwayat Pesanan (`1045:1028`):** Segmented control `Aktif (1)` vs `Selesai (0)`, kartu pesanan berjalan, panel empty state riwayat rental, dan CTA booking baru.
- **Layar 09 — Pusat Bantuan (`1045:1076`):** Bidang pencarian FAQ, 3 chip kategori kendala (`Booking` aktif `#0e7c7b`), accordion FAQ interaktif, kartu tiket aktif `#TCK-1042` (`Dalam Proses`), bottom nav tab Bantuan aktif.
- **Layar 10 — Buat Ticket Bantuan (`1045:1129`):** Formulir pengaduan kendala terstruktur (Judul, Chip kategori `Keluhan` aktif, Referensi Booking `#BK-5521`, Textarea detail, AI Assistant Notice Box `#e6f4f1`, CTA submit $342 \times 52$ px).
- **Layar 11 — Chat Bantuan & AI Handoff (`1045:1167`):** Sticky header tiket aktif, aliran bubble transparan (Customer `#e6f4f1` $\rightarrow$ AI Bot `#ffffff` $\rightarrow$ System Event Divider `#0e7c7b` $\rightarrow$ Staf CS Merauke `#0e7c7b` border), dan komposer input balasan terproteksi.
- **Section 2 Canvas Title & Subtitle (`1045:966`, `1045:967`):** Header baris kedua pada $y = 1260$.
- **Journey Map & Laws of UX Baris 2 (`1045:1208` s/d `1045:1232`):** Kanvas $2160 \times 320$ px di $y = 2240$ berisi 5 kartu fase hukum UX (Feedback Loop, Jakob/Miller, Hick/Search, Expectation Setting, Human Fallback & Fail-soft) serta Integrity Box Data Contoh.
- **Dokumentasi Teknis AI Handoff:** Menyusun berkas panduan teknis `docs/TECH_PLANNING_AI_CHATBOT_HANDOFF_EDGE_CASES.md`.

## 3. API, Endpoint, dan Identifier Teknis

### 3.1 Node Figma (File Key: `Rxdv5kRYC8NiQpdWJhoIGJ`)

| Komponen / Layar | Node ID | Posisi ($x, y$) | Dimensi |
|---|---|---|---|
| Section 2 Canvas Title | `1045:966` | $x = 0, y = 1260$ | $798 \times 34$ px |
| Section 2 Canvas Subtitle | `1045:967` | $x = 0, y = 1300$ | $819 \times 17$ px |
| `07 / Hi-Fi : Status Pesanan` | `1045:968` | $x = 0, y = 1350$ | $390 \times 844$ px |
| `08 / Hi-Fi : Riwayat Pesanan` | `1045:1028` | $x = 440, y = 1350$ | $390 \times 844$ px |
| `09 / Hi-Fi : Pusat Bantuan` | `1045:1076` | $x = 880, y = 1350$ | $390 \times 844$ px |
| `10 / Hi-Fi : Buat Ticket` | `1045:1129` | $x = 1320, y = 1350$ | $390 \times 844$ px |
| `11 / Hi-Fi : Chat Bantuan - AI Handoff` | `1045:1167` | $x = 1760, y = 1350$ | $390 \times 844$ px |
| Journey Map Row 2 (Container) | `1045:1208` | $x = 0, y = 2240$ | $2160 \times 320$ px |

### 3.2 Identifier Teknis State & Model

- `SupportTicket.status`: `OPEN`, `WAITING_HUMAN`, `IN_PROGRESS`, `WAITING_CUSTOMER`, `RESOLVED`, `CLOSED`.
- `SupportTicket.handlingMode`: `BOT` (komposer admin terkunci), `HUMAN` (komposer terbuka).
- `TicketMessage.senderType`: `CUSTOMER`, `BOT`, `ADMIN`, `SYSTEM` (event divider handoff).
- `ticketNumber`: `#TCK-1042`.
- `bookingCode`: `#BK-5521`.

## 4. File yang Berubah

| Path | Aksi | Catatan |
|---|---|---|
| `docs/context/CONTEXT_DUMP_figma_antigravity.md` | tambah | Rekam jejak geometris, token desain, dan mutasi Figma live |
| `docs/TECH_PLANNING_AI_CHATBOT_HANDOFF_EDGE_CASES.md` | tambah | Panduan arsitektur transisi bot ke manusia dan penanganan edge case |
| `docs/design/LOFI_TO_HIFI_DECISIONS.md` | ubah | Pembaruan status Batch 3 & Batch 4 menjadi `hi-fi-applied` |

## 5. Proses dan Perintah

1. Verifikasi koneksi ke Figma Desktop via WebSocket bridge:
   ```text
   figma-mcp-rust @ 127.0.0.1:1994 (Design Mode)
   ```
2. Eksekusi pembuatan struktur baris kedua (Layar 07 s/d 11) dan Journey Map Baris 2:
   ```text
   create_frame, create_rectangle, create_text, create_ellipse, set_auto_layout
   ```
3. Audit presisi geometris pasca-implementasi:
   - Ditemukan 7 titik teks meluap (*text overflow*) pada Layar 10 (Helper Judul, Helper Booking, Helper Detail, AI Notice, Emergency Text, Submit Subtext) dan Layar 11 (Composer Helper Text).
   - Diperbaiki langsung via `set_text` dan penyesuaian bounding box layer pada koordinat Figma live sehingga lolos audit $x + \text{width} \le \text{container width}$.

## 6. Hasil dan Evidence

- **Figma Canvas Live:** Halaman `Hi-Fi — MobilJuragan (SandBox Antigravity)` (`1006:92`), Baris 2 ($y = 1350$).
- **Audit Anti-Slop Directive:**
  - Tanda hubung em dash (`—`): 0 ditemukan pada teks UI.
  - Teks terpotong/overflow: 0 ditemukan (lolos audit geometris 100%).
  - Kontras rasio: Memenuhi standar WCAG AA (Navy `#1e3a5f`, Slate `#0f172a`, Teal `#0e7c7b`).
- **Integritas Data:** Seluruh nomor kontak, pelat nomor, dan ID tiket diberi label jujur `Data contoh`.

## 7. Checklist Reviewer

- [x] Halimah memverifikasi kesesuaian viewport 390 × 844 px tanpa horizontal overflow pada Layar 07–11.
- [x] Halimah menyetujui arsitektur transisi AI-ke-manusia pada `docs/TECH_PLANNING_AI_CHATBOT_HANDOFF_EDGE_CASES.md`.
- [x] Checklist ditandai dan status entry ditetapkan menjadi **`done`**.
