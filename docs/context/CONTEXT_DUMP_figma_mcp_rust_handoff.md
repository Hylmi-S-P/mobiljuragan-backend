# Figma MCP Rust Session Handoff

> Dokumentasi handoff untuk sesi berikutnya.
> Diperbarui: 17 September 2026.
> Workspace: `D:\tugas kuliah\semester 3\grand-project-uiux-mobile-webframework-ai`

## 1. Ringkasan

Sesi ini berhasil menghubungkan dan menggunakan MCP `figma-mcp-rust` untuk membaca serta menulis file Figma secara langsung melalui plugin Figma Desktop.

Figma file:

- Name: `MobilJuragan MVP — UI UX Case Study`
- File key: `Rxdv5kRYC8NiQpdWJhoIGJ`
- Original Hi-Fi page: `Hi-Fi — Booking Flow (dari LoFi)` (`890:2`)
- Master Hi-Fi Aktif: `EKSPERIMENTAL HIFI MOBILE` (`1058:321`)
- Master Lo-Fi Aktif: `EKSPERIMENTAL LOFI MOBILE` (`1058:320`)

Hasil utama:

- Dibuat page master eksperimental baru: `EKSPERIMENTAL HIFI MOBILE` (`1058:321`).
- Mengimplementasikan ekosistem penuh 11 layar mobile dengan sistem token **Traveloka Trust Blue (`#0194F3`)**.
- Dilakukan verifikasi tangkapan layar beresolusi tinggi $2\times$ via tool `save_screenshots` untuk seluruh 11 layar tanpa error.

## 2. Kondisi MCP dan plugin

MCP server Reasonix:

```text
figma-mcp-rust
command: npx -y @alvinindra/figma-mcp-rust@0.2.0
transport: stdio
```

Plugin counterpart di Figma Desktop:

- Name: `Figma MCP Rust`
- Imported dari `D:\tools\figma-plugins\figma-mcp-rust\plugin\manifest.json`
- WebSocket default: `127.0.0.1:1994`
- Plugin harus di-run dari Figma Desktop melalui `Plugins → Development → Figma MCP Rust`.
- Screenshot plugin dengan badge hijau `Connected` berarti UI plugin tersambung ke port lokal. MCP server Reasonix juga harus aktif agar request dapat diproses.

Catatan mode Figma:

- Dev Mode membuat Plugin API bersifat read-only. Untuk operasi write gunakan Design Mode.
- Tidak ada toggle Read-only/Write di UI plugin `Figma MCP Rust` yang di-import.
- Jika plugin UI terlihat `Connected` tetapi tool menjawab `plugin not connected`, restart bersih yang terbukti membantu adalah: tutup Figma, tutup Reasonix, tunggu beberapa detik, buka kembali keduanya, buka file target, lalu run plugin lagi.

## 3. Total pages yang diverifikasi

Setelah penambahan halaman eksperimental baru, `get_metadata` dan `get_pages` mengembalikan `pageCount: 15`.

Page master aktif:

```text
1058:320  EKSPERIMENTAL LOFI MOBILE
1058:321  EKSPERIMENTAL HIFI MOBILE (11 Layar Lengkap — Traveloka Trust Blue)
```

Page sandbox historis:

```text
992:92   Hi-Fi — Booking Flow (Sandbox)
1006:92  Hi-Fi — MobilJuragan (SandBox Antigravity)
```

Original tetap:

```text
890:2   Hi-Fi — Booking Flow (dari LoFi)
890:3   Hi-Fi — Booking Flow
```

## 4. Cara memanggil tools melalui Reasonix

Gunakan capability ID berikut:

```text
mcp-tool:figma-mcp-rust/get_metadata
mcp-tool:figma-mcp-rust/get_pages
mcp-tool:figma-mcp-rust/get_node
mcp-tool:figma-mcp-rust/get_design_context
mcp-tool:figma-mcp-rust/scan_text_nodes
mcp-tool:figma-mcp-rust/get_screenshot
mcp-tool:figma-mcp-rust/add_page
mcp-tool:figma-mcp-rust/clone_node
mcp-tool:figma-mcp-rust/create_frame
mcp-tool:figma-mcp-rust/create_text
mcp-tool:figma-mcp-rust/create_rectangle
mcp-tool:figma-mcp-rust/rename_node
mcp-tool:figma-mcp-rust/resize_nodes
mcp-tool:figma-mcp-rust/reparent_nodes
mcp-tool:figma-mcp-rust/set_fills
mcp-tool:figma-mcp-rust/set_strokes
mcp-tool:figma-mcp-rust/delete_nodes
```

Pola umum:

1. `inspect` capability untuk mendapatkan schema terbaru.
2. `call` capability dengan `arguments` yang sesuai schema.
3. Baca kembali node hasil mutasi memakai `get_node` atau `get_design_context`.
4. Jangan menganggap write sukses hanya karena tool tidak error; selalu verifikasi node live.

Contoh read:

```json
{
  "action": "call",
  "capability_id": "mcp-tool:figma-mcp-rust/get_node",
  "arguments": {
    "nodeId": "992:93"
  }
}
```

Contoh create page:

```json
{
  "action": "call",
  "capability_id": "mcp-tool:figma-mcp-rust/add_page",
  "arguments": {
    "name": "Hi-Fi — Booking Flow (Sandbox)"
  }
}
```

Contoh clone root ke page:

```json
{
  "action": "call",
  "capability_id": "mcp-tool:figma-mcp-rust/clone_node",
  "arguments": {
    "nodeId": "890:3",
    "parentId": "992:92"
  }
}
```

Contoh create text yang reliable:

```json
{
  "action": "call",
  "capability_id": "mcp-tool:figma-mcp-rust/create_text",
  "arguments": {
    "text": "Memuat daftar mobil...",
    "parentId": "995:496",
    "fillColor": "#0E7C7B",
    "fontFamily": "Inter",
    "fontSize": 14,
    "fontStyle": "Medium",
    "x": 131,
    "y": 360
  }
}
```

## 5. Workaround parameter serialization

Wrapper `use_capability` kadang sensitif terhadap tipe JSON. Gunakan aturan berikut:

### Numbers

Kirim native JSON number, bukan string:

```json
{"width": 390, "height": 844, "x": 24, "y": 300}
```

Hindari:

```json
{"width": "390", "height": "844"}
```

Beberapa retry sebelumnya gagal karena number terkirim sebagai string.

### Arrays

Kirim native array langsung:

```json
{"nodeIds": ["999:504", "999:505", "999:506"]}
```

Hindari bentuk object pseudo-array:

```json
{"nodeIds": {"item": ["999:504"]}}
```

Bentuk native array terbukti berhasil untuk `delete_nodes`, `resize_nodes`, dan read screenshot pada percobaan berikutnya.

### Create tools

Untuk `create_frame`, `create_text`, dan `create_rectangle`, jika call dengan banyak parameter gagal, lakukan retry serial dengan native numbers. Jangan paralelkan banyak write yang saling terkait.

Pola paling aman:

1. Create minimal.
2. Ambil ID hasil.
3. Set fill/stroke/rename/resize secara serial.
4. Inspect hasil.

Contoh create text minimal yang pernah berhasil:

```json
{"text": "Memuat daftar mobil..."}
```

Namun untuk hasil yang langsung ditempatkan, gunakan `parentId`, `x`, dan `y` dengan native number.

## 6. Workaround positioning

`move_nodes` dan `set_corner_radius` beberapa kali gagal karena wrapper tidak meneruskan array/number dengan konsisten, walaupun schema capability menyatakan format tersebut valid.

Workaround yang berhasil:

- Buat node baru langsung dengan `x` dan `y` native saat `create_text`, `create_rectangle`, atau `create_frame`.
- Setelah versi positioned berhasil, hapus versi lama memakai `delete_nodes` dengan native array.
- Untuk layout baru, lebih reliable membuat ulang node daripada membuat node di `(0,0)` lalu memindahkannya.

Contoh prinsip:

```text
create old node at default position
create replacement node with explicit x/y
verify replacement
delete old node
```

## 7. Struktur sandbox saat ini

Root sandbox `992:93` berisi clone enam screen dan Journey Map, ditambah tiga frame eksperimen sebagai sibling:

| Frame | Node ID | Isi |
|---|---:|---|
| `01 / Hi-Fi — Beranda` | `992:94` | Clone screen original |
| `02 / Hi-Fi — Pilih Kendaraan` | `992:121` | Clone screen original |
| `03 / Hi-Fi — Detail Kendaraan` | `992:176` | Clone screen original |
| `04 / Hi-Fi — Tanggal & Waktu` | `992:218` | Clone screen original |
| `05 / Hi-Fi — Opsi Rental` | `992:284` | Clone screen original |
| `06 / Hi-Fi — Tinjau Pesanan` | `992:316` | Clone screen original |
| `Journey Map & Laws of UX` | `992:356` | Clone dokumentasi |
| `Pilih Kendaraan — Loading` | `995:496` | Loading state experiment |
| `Pilih Kendaraan — Error` | `999:503` | Error state experiment |
| `Booking Status — Stepper` | `999:509` | Stepper experiment |

Root sandbox diperlebar menjadi `7800 × 1035` karena horizontal auto-layout menempatkan sibling baru pada x sekitar `5892`, `6378`, dan `6864`. Sebelum diperlebar, frame tambahan berada di luar export bounds sehingga sandbox terlihat sama dengan original.

## 8. Isi experiment frame

### Loading `995:496`

- Size: 390 × 844.
- Fill: `#F5F7FA`.
- Text:
  - `998:502` — `Memuat daftar mobil...`, teal, 14 Medium, x=131, y=360.
  - `999:519` — `Memuat daftar mobil dan jadwal tersedia.`, text-main, 12 Regular, x=78, y=392.
  - `999:520` — `Loading state — DESIGN.md §11`, slate, 12 Medium, x=104, y=416.

### Error `999:503`

- Size: 390 × 844.
- Fill: white.
- Panel `999:521`: 342 × 180, x=24, y=300, white with navy stroke and radius 8.
- Retry button `999:522`: 342 × 52, x=24, y=520, navy with radius 12.
- Heading `999:523`: `Gagal memuat daftar mobil`.
- Body `999:524`: `Periksa koneksi Anda, lalu coba lagi. Data contoh tidak hilang.`.
- Caption `999:525`: `Error state — DESIGN.md §11`.
- Button label `999:526`: `Coba lagi`.

### Booking Status Stepper `999:509`

- Size: 390 × 844.
- Heading `999:527`: `Status Booking`, 24 Bold, x=24, y=24.
- Explanation `999:528`: `Pesananmu kami terima. Tim sedang memverifikasi ketersediaan.`, x=24, y=60.
- Status chip `1000:530`: gold soft, x=24, y=92.
- Status label `1000:531`: `Menunggu Konfirmasi`, x=36, y=98.
- Booking card `1000:532`: 342 × 236, x=24, y=144, white with `#E2E8F0` stroke.
- Stage 1 `1000:533`: 342 × 48, x=24, y=412, teal-soft active fill.
- Stage 2 `1001:534`: x=24, y=468, white with border.
- Stage 3 `1001:535`: x=24, y=524, white with border.
- Stage 4 `1001:537`: x=24, y=580, white with border.
- Stage labels:
  - `1001:538` — `1. Permintaan diterima`.
  - `1001:539` — `2. Cek kendaraan`.
  - `1001:540` — `3. Konfirmasi tarif`.
  - `1001:541` — `4. Siap`.
- CTA `1001:542` + label `1001:543`: `Selesai`, x=24, y=664.

## 9. Design rules yang harus dijaga

Sebelum melanjutkan perubahan, baca:

- `docs/design/DESIGN.md`
- `docs/design-tokens.json`
- `docs/design/LOFI_TO_HIFI_DECISIONS.md`
- `docs/context/CONTEXT_DUMP_hifi_booking_flow.md`
- `docs/context/CONTEXT_DUMP_semut_copilot_vscode_latest.md`

Rules penting:

- Palette: navy `#1E3A5F`, teal `#0E7C7B`, gold `#D4A017`, neutral background `#F5F7FA`, line `#E2E8F0`, text `#0F172A`.
- Gold hanya untuk momen attention, misalnya `Menunggu Konfirmasi` atau tarif belum final.
- Font Inter.
- Mobile frame 390 × 844.
- Grid spacing kelipatan 8.
- Radius: 4 untuk chip/badge, 8 untuk card, 12 untuk primary CTA.
- Jangan membuat harga, rating, review, testimonial, customer name, response time, atau availability live palsu.
- Tarif harus berupa copy konfirmasi, bukan angka.
- Data contoh harus diberi label `Data contoh`.
- Kendaraan yang diperbolehkan hanya sembilan dataset resmi di `docs/design-tokens.json`.
- Jangan menyentuh original Hi-Fi untuk eksperimen sandbox.

## 10. Screenshot/export

`get_screenshot` dapat dipanggil dengan `nodeIds` native array:

```json
{
  "nodeIds": ["995:496"],
  "format": "PNG",
  "scale": 1
}
```

Untuk root sandbox:

```json
{"nodeIds": ["992:93"], "format": "PNG", "scale": 1}
```

`screenshot` mengembalikan base64 PNG di response.

`save_screenshots` memerlukan output path yang berada di dalam workspace. Path di luar workspace ditolak policy. Gunakan temporary file di root workspace hanya jika perlu, lalu hapus setelah verifikasi.

Temporary artifacts sesi sebelumnya:

- `.tmp-sandbox-hifi.png`
- `.tmp-original-hifi.png`

File tersebut adalah scratch output, bukan deliverable. Hapus sebelum commit atau submission.

## 11. Status dan langkah lanjutan

Status saat handoff:

- Sandbox creation: selesai.
- Root clone: selesai.
- Loading state: selesai secara struktural.
- Error state: selesai secara struktural.
- Booking Status Stepper: selesai secara struktural.
- Original Hi-Fi: tidak disentuh.
- Prototype reactions: belum ditambahkan.
- Re-bind seluruh Hi-Fi ke Figma Variables: belum dilakukan.
- Fresh persisted side-by-side screenshot setelah resize root: belum tersimpan; live node tree adalah evidence utama.

Langkah aman berikutnya:

1. Buka page `Hi-Fi — Booking Flow (Sandbox)` di Figma Desktop.
2. Zoom atau select frame individual `995:496`, `999:503`, dan `999:509`, bukan hanya melihat overview root.
3. Review visual dan copy secara manual.
4. Jika approved, buat perubahan terarah pada sandbox dahulu.
5. Jangan menerapkan ke original sampai ada approval eksplisit.
6. Jika akan menerapkan ke original, inspect original terbaru lagi sebelum clone/reparent/write.

## 12. Common failure modes

| Error | Penyebab kemungkinan | Tindakan |
|---|---|---|
| `plugin not connected` | Plugin Figma tidak running, stale bridge, atau file/tab tidak sesuai | Run plugin lagi; bila perlu restart Figma + Reasonix |
| `Can't call createPage in read-only mode` | Figma sedang Dev Mode | Beralih ke Design Mode |
| Schema bilang `number`, tetapi error type | Parameter dikirim sebagai string | Kirim native number, retry serial |
| Schema bilang array, tetapi error type | Wrapper menerima pseudo-array | Kirim native array langsung |
| Screenshot `No nodes to export` | Tidak ada selection atau nodeIds salah format | Kirim `nodeIds: ["id"]` native array |
| `outputPath must be inside working directory` | Save screenshot ke luar workspace | Gunakan temp path di workspace lalu cleanup |
| Sandbox terlihat sama dengan original | Experiment sibling berada di luar root bounds atau melihat page original | Cek page ID `992:92`, root size, dan select frame individual |

## 13. Prinsip keselamatan

- Sandbox adalah tempat eksperimen, tetapi operasi delete tetap destructive.
- Hindari `delete_nodes` kecuali ID sudah diverifikasi dan target memang disposable.
- Jangan mengubah original root `890:3` saat eksplorasi.
- Setelah setiap write, lakukan read-back dengan `get_node`.
- Jangan menyimpan secret/API key di dokumentasi.
- Jangan menyimpan base64 screenshot atau scratch output ke repository.
