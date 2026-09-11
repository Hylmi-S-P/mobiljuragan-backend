# Prompt untuk Antigravity (Agy) - Eksekusi Plan A

Kamu adalah **Antigravity (Agy), workhorse executor** untuk workspace:

```text
D:\tugas kuliah\semester 3\grand-project-uiux-mobile-webframework-ai
```

Reasonix sudah berperan sebagai supervisor/validator. Sekarang eksekusi perubahan dokumentasi berikut secara langsung dan evidence-based.

## Konteks

- Branch: `dev/hylmi`
- PIC/penulis entry: Hylmi (PIC C - Backend Engineer)
- Reviewer: Halimah (PIC D - QA)
- Keputusan tim: rollback ke lo-fi; backend freeze di M5; M3-M5 tetap menjadi fondasi; M6+ ditunda sampai hi-fi flow final disetujui.
- Tidak ada perubahan kode backend dan tidak ada endpoint baru pada task ini.

## Aturan wajib

1. Mulai dengan memeriksa state aktual, jangan mengasumsikan klaim sesi sebelumnya benar.
2. Sebelum mengedit setiap target file, baca isi file terbaru secara penuh pada siklus kerja yang sama. Jangan menimpa perubahan yang sudah ada.
3. Jangan menyentuh `docs/logbook/2026-09-07_M-ux_lofi-wireframe_Hylmi.md`; file itu bukan scope.
4. Jangan mengubah status M3/M4/M5 dari `done`.
5. Jangan mengubah status logbook pivot dari `planned (menunggu ACC tim)` menjadi `done`.
6. Jangan menambah endpoint, harga, rating, statistik, OTP plaintext, password, token, atau PII.
7. Jangan membuat data fiktif baru. Dataset kendaraan tetap hanya 9 armada resmi Merauke.
8. Reviewer harus tetap Halimah, bukan Hylmi. Ini wajib sesuai TEAM_POLICY §7.1.
9. Jangan push. Buat commit lokal saja setelah seluruh validation gate lulus.
10. Pertahankan perubahan dokumentasi yang sudah ada. Jangan reset, checkout, atau revert working tree.

## Langkah 0 - Inspect state

Dari repository root, jalankan:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git diff --stat
```

Baca file-file berikut sebelum mengedit:

```text
docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md
docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md
docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md
```

Perubahan yang sudah ada pada file lain harus dipertahankan:

```text
docs/PLANNING_TECH_STACK_DAN_ROADMAP.md
docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md
docs/logbook/README.md
docs/logbook/2026-09-04_M5_sample-otp-request.json
docs/PLAN_A_PATCH_WARN_COMMIT.md
```

## Langkah 1 - Patch M4

File:

```text
docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md
```

Tambahkan pada YAML frontmatter setelah `cakupan_ai: code, docs`:

```yaml
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M4 tetap done sebagai fondasi M5 (database singleton + seed dipakai endpoint auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

Jangan mengubah evidence 9 tabel, daftar 9 armada resmi, status, atau checklist reviewer.

## Langkah 2 - Patch M5 metadata

File:

```text
docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md
```

Tambahkan pada YAML frontmatter setelah `cakupan_ai: code, docs`:

```yaml
freeze_catatan: Backend freeze di M5 per pivot tim 10/09/26. M5 adalah milestone backend terakhir yang aktif (single source of truth API + auth). Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

## Langkah 3 - Patch M5 blocker note

Pada bagian `## 7. Catatan dan blocker`, pertahankan bullet status M5 dan ganti catatan lama yang menyatakan siap melanjutkan ke M6 menjadi:

```markdown
- Milestone M5 selesai dengan status `done`.
- Per pivot tim 10/09/26, M6+ (Vehicle & availability API: `GET /api/v1/vehicles` dan detail armada) DITUNDA sampai hi-fi flow final disetujui. Selama freeze, PIC C tidak menambah endpoint baru. Lihat logbook 2026-09-10_M-freeze-backend-at-M5_Hylmi.md.
```

Jangan mengubah sample JSON, evidence 9 test auth, OpenAPI path, atau checklist reviewer.

## Langkah 4 - Patch reviewer pivot

File:

```text
docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md
```

Ubah hanya nilai reviewer menjadi:

```yaml
reviewer: Halimah (PIC D - QA) - reviewer utama per rotasi
```

Pertahankan:

```yaml
status: planned (menunggu ACC tim)
```

Jangan menandai checklist reviewer `[x]`. ACC adalah kewenangan Halimah/tim.

## Langkah 5 - Review diff dan validation gates

Setelah patch, cek diff secara manual. Pastikan tidak ada perubahan kode atau file di luar scope.

Jalankan:

```bash
python -m json.tool "docs/logbook/2026-09-04_M5_sample-otp-request.json"
git diff --check
```

Reviewer placeholder tidak boleh muncul pada empat entry scope:

```bash
if rg -n "PIC A/B/D|PIC X/Y/Z|PIC A/B/C/D|belum ditugaskan" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"; then
  echo "ERROR: reviewer placeholder ditemukan"
  exit 1
else
  echo "PASS: reviewer placeholder tidak ditemukan pada scope"
fi
```

Cek metadata:

```bash
rg -n "^reviewer:|^freeze_catatan:|^status:" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"
```

Pastikan hasilnya:

- M3, M4, M5 tetap `done`.
- Pivot tetap `planned (menunggu ACC tim)`.
- Semua reviewer adalah Halimah (PIC D), bukan Hylmi.
- M4 dan M5 memiliki `freeze_catatan`.
- Pivot tetap memakai bahasa usulan/menunggu ACC.
- `phoneHash` pada JSON tetap `<redacted>`.

Cek tidak ada OTP numerik plaintext di logbook:

```bash
if rg -n -P "\b\d{6}\b" "docs/logbook/"; then
  echo "ERROR: kandidat OTP numerik ditemukan; review manual wajib"
  exit 1
else
  echo "PASS: tidak ada kandidat OTP numerik 6 digit"
fi
```

## Langkah 6 - Commit lokal

Sebelum staging:

```bash
git status --short
git diff --stat
```

File audit trail berikut dibuat untuk dokumentasi planner dan boleh ikut dalam commit ini:

```text
docs/PLAN_A_PATCH_WARN_COMMIT.md
docs/PROMPT_ANTIGRAVITY_PLAN_A_PATCH_WARN_COMMIT.md
```

Stage hanya file scope berikut, bukan `git add .`:

```bash
git add -- \
  "docs/PLANNING_TECH_STACK_DAN_ROADMAP.md" \
  "docs/PLAN_A_PATCH_WARN_COMMIT.md" \
  "docs/PROMPT_ANTIGRAVITY_PLAN_A_PATCH_WARN_COMMIT.md" \
  "docs/logbook/README.md" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-04_M5_sample-otp-request.json" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"
```

Review staged diff:

```bash
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

Commit lokal dengan pesan:

```text
docs: tighten logbook freeze metadata and reviewer consistency
```

Perintah:

```bash
git commit -m "docs: tighten logbook freeze metadata and reviewer consistency"
```

## Langkah 7 - Post-commit report

Setelah commit berhasil, laporkan:

1. Commit hash pendek dari `git rev-parse --short HEAD`.
2. Daftar file yang berubah/ter-commit.
3. Hasil setiap validation gate.
4. Konfirmasi bahwa tidak ada push.
5. Konfirmasi bahwa status pivot tetap `planned` dan belum di-ACC.

Jangan mengganti placeholder `<isi setelah push>` pada M3/M4/M5 dalam task ini. Pengisian hash adalah follow-up terpisah karena akan membutuhkan commit tambahan.

## Acceptance criteria

- [ ] Tiga WARN konsistensi tertutup.
- [ ] M3/M4/M5 tetap `done`.
- [ ] Pivot tetap `planned` sampai ACC Halimah/tim.
- [ ] M6+ eksplisit ditunda sampai hi-fi flow final disetujui.
- [ ] JSON valid dan `phoneHash` redacted.
- [ ] Tidak ada OTP plaintext atau data fiktif baru.
- [ ] Tidak ada kode backend/endpoint baru.
- [ ] `git diff --check` dan staged diff check lulus.
- [ ] Commit lokal berhasil.
- [ ] Tidak ada push.
