# Plan A - Patch 3 WARN + Commit

Status: ready for Antigravity execution
Branch: `dev/hylmi`
Workspace: `grand-project-uiux-mobile-webframework-ai`
Planner/validator: Reasonix
Executor: Antigravity
PIC: Hylmi (PIC C - Backend Engineer)
Reviewer: Halimah (PIC D - QA)

## Tujuan

Menutup tiga warning konsistensi dari audit dokumentasi, menjalankan validation scan, lalu membuat commit lokal. Backend tetap freeze di M5 dan logbook pivot tetap `planned` sampai mendapat ACC tim.

## Important boundary

Reasonix sudah melakukan validation, tetapi belum melakukan patch atau commit. Antigravity harus membaca setiap target file dengan `intent=full` pada siklus baca-tulis yang sama sebelum mengeditnya.

Jangan mengubah kode backend, menambah endpoint, mengubah status pivot menjadi `done`, menulis OTP plaintext, atau menambahkan harga/rating/statistik fiktif.

## Files yang harus dikerjakan Antigravity

### 1. M4 logbook

File: `docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md`

Tambahkan pada frontmatter, setelah `cakupan_ai: code, docs`:

```yaml
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M4 tetap done sebagai fondasi M5 (database singleton + seed dipakai endpoint auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

### 2. M5 logbook

File: `docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md`

Tambahkan pada frontmatter, setelah `cakupan_ai: code, docs`:

```yaml
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M5 adalah milestone backend terakhir yang aktif (single source of truth API + auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

Di bagian `## 7. Catatan dan blocker`, ganti kalimat lama tentang melanjutkan ke M6 menjadi:

```markdown
- Milestone M5 selesai dengan status `done`.
- Per pivot tim 10/09/26, M6+ (Vehicle & availability API: `GET /api/v1/vehicles` dan detail armada) DITUNDA sampai hi-fi flow final disetujui. Selama freeze, PIC C tidak menambah endpoint baru. Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

### 3. Logbook pivot

File: `docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md`

Ubah frontmatter reviewer menjadi:

```yaml
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi
```

Status tetap:

```yaml
status: planned (menunggu ACC tim)
```

## Files yang sudah ada dan jangan diulang dari nol

Perubahan berikut sudah ada di working tree berdasarkan validation terakhir:

- `docs/PLANNING_TECH_STACK_DAN_ROADMAP.md`
- `docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md`
- `docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md`
- `docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md`
- `docs/logbook/README.md`
- `docs/logbook/2026-09-04_M5_sample-otp-request.json`
- `docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md`

Pertahankan perubahan yang sudah ada. Jangan menyentuh `docs/logbook/2026-09-07_M-ux_lofi-wireframe_Hylmi.md`; file tersebut bukan scope pekerjaan ini.

## Validation gates

Jalankan dari repository root:

```bash
python -m json.tool "docs/logbook/2026-09-04_M5_sample-otp-request.json"
git diff --check
```

Pastikan reviewer placeholder tidak muncul pada empat file scope ini:

```bash
rg -n "PIC A/B/D|PIC X/Y/Z|PIC A/B/C/D|belum ditugaskan" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"
```

Pastikan empat logbook memiliki reviewer Halimah dan M4/M5 memiliki `freeze_catatan`:

```bash
rg -n "^reviewer:|^freeze_catatan:|^status:" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"
```

Expected:

- M3/M4/M5 status tetap `done`.
- Pivot status tetap `planned (menunggu ACC tim)`.
- Reviewer adalah Halimah (PIC D), bukan Hylmi.
- JSON valid dan `phoneHash` tetap `<redacted>`.
- Tidak ada OTP plaintext.
- Tidak ada endpoint baru.

## Commit gate

Sebelum commit:

```bash
git status --short
git diff --stat
```

Review diff final dan pastikan hanya dokumentasi scope ini yang berubah. Commit lokal dengan pesan:

```text
docs: tighten logbook freeze metadata and reviewer consistency
```

Jangan push sebelum Halimah/tim memberikan ACC pivot. Placeholder `<isi setelah push>` pada M3/M4/M5 boleh tetap dipertahankan sampai ada commit hash final yang memang akan dicatat.

## Acceptance criteria

- [ ] Tiga warning konsistensi sudah diperbaiki.
- [ ] M3-M5 tetap `done`.
- [ ] Pivot tetap `planned` sampai ACC.
- [ ] M6+ tetap eksplisit ditunda sampai hi-fi flow final disetujui.
- [ ] JSON sample valid dan tidak mengandung OTP plaintext.
- [ ] Tidak ada data fiktif baru.
- [ ] `git diff --check` lulus.
- [ ] Diff final direview sebelum commit.
- [ ] Commit lokal berhasil.
- [ ] Push ditunda sampai ACC Halimah.
