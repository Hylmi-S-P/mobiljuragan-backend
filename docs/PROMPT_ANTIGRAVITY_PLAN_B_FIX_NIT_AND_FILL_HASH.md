# Prompt untuk Antigravity (Agy) - Eksekusi Plan B

Kamu adalah **Antigravity (Agy), workhorse executor** untuk workspace:

```text
D:\tugas kuliah\semester 3\grand-project-uiux-mobile-webframework-ai
```

Reasonix sudah melakukan validasi terhadap commit `045ae9b` dan menghasilkan Plan B. Eksekusi Plan B secara langsung dan evidence-based.

## Konteks

- Branch: `dev/hylmi`
- Commit terakhir di lokal: `045ae9b` (Plan A, sudah diverifikasi)
- PIC/penulis entry: Hylmi (PIC C - Backend Engineer)
- Reviewer: Halimah (PIC D - QA)
- Pivot logbook tetap berstatus `planned (menunggu ACC tim)`
- Tidak ada perubahan kode backend dan tidak ada endpoint baru pada task ini

## Aturan wajib

1. Inspect state dulu. Jangan mengasumsikan klaim sesi sebelumnya benar.
2. Baca setiap target file dengan `intent=full` pada siklus baca-tulis yang sama sebelum mengeditnya.
3. Jangan mengubah status M3/M4/M5 dari `done` dan pivot dari `planned (menunggu ACC tim)`.
4. Jangan mengubah reviewer atau freeze_catatan.
5. Jangan push. Commit lokal saja setelah seluruh validation gate lulus.
6. Jangan ganti placeholder commit hash dengan full hash. Pakai short hash `045ae9b`.
7. Jangan menambahkan file atau kode backend baru.
8. Jangan menyentuh `docs/logbook/2026-09-07_M-ux_lofi-wireframe_Hylmi.md` atau file di luar scope.
9. Stage hanya file scope (jangan `git add .`).
10. Placeholder `<isi setelah push>` diganti dengan literal `045ae9b`. Teks yang diganti hanya baris tersebut.

## Langkah 0 - Inspect state

Dari repository root, jalankan:

```bash
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
```

Pastikan output: working tree bersih (kecuali file `docs/PLAN_B_FIX_NIT_AND_FILL_HASH.md` yang baru), branch `dev/hylmi`, HEAD short hash `045ae9b`.

Baca target file:

```text
docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md
docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md
docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md
```

## Langkah 1 - Fix M4 checklist glitch

File:

```text
docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md
```

Pada line 108, ubah dari:

```markdown
- [x] Tidak ada harga fiktif atau data rekaan yang melanggar batasan data integrity..
```

menjadi:

```markdown
- [x] Tidak ada harga fiktif atau data rekaan yang melanggar batasan data integrity.
```

Hapus satu titik di akhir baris saja. Karakter lain tidak boleh berubah.

## Langkah 2 - Renumber M5 sample subsection

File:

```text
docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md
```

Pada line 100, ubah heading dari:

```markdown
### 6.1 Sample response `POST /api/v1/auth/otp/request`
```

menjadi:

```markdown
### 5.1 Sample response `POST /api/v1/auth/otp/request`
```

Heading di bawahnya (baris commit placeholder) biarkan apa adanya.

## Langkah 3 - Replace commit hash placeholder di M3

File:

```text
docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md
```

Ganti:

```markdown
### 6.2 Commit hash

`<isi setelah push>`
```

menjadi:

```markdown
### 6.2 Commit hash

`045ae9b`
```

## Langkah 4 - Replace commit hash placeholder di M4

File:

```text
docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md
```

Ganti baris:

```markdown
- Commit hash pendek: `<isi setelah push>`
```

menjadi:

```markdown
- Commit hash pendek: `045ae9b`
```

## Langkah 5 - Replace commit hash placeholder di M5

File:

```text
docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md
```

Ganti baris:

```markdown
- Commit hash pendek: `<isi setelah push>`
```

menjadi:

```markdown
- Commit hash pendek: `045ae9b`
```

## Langkah 6 - Validation gates

Jalankan dari repository root setelah patch:

```bash
git status --short
git diff --check
```

Validasi placeholder sudah hilang:

```bash
if rg -n "<isi setelah push>" "docs/logbook/"; then
  echo "ERROR: placeholder <isi setelah push> masih ada"
  exit 1
else
  echo "PASS: placeholder commit hash sudah diganti"
fi
```

Validasi glitch M4:

```bash
if rg -n "data integrity\.\." "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md"; then
  echo "ERROR: double period masih ada di M4"
  exit 1
else
  echo "PASS: M4 checklist glitch sudah bersih"
fi
```

Validasi subsection M5:

```bash
rg -n "^### 5\.1 Sample response" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"
if rg -n "^### 6\.1 Sample response" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"; then
  echo "ERROR: subsection 6.1 masih ada di M5"
  exit 1
else
  echo "OK: subsection 6.1 sudah hilang di M5"
fi
```

Validasi hash sudah terisi:

```bash
rg -n "045ae9b" "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"
```

Expect: minimal 3 hit (satu per file).

Validasi metadata reviewer dan freeze_catatan tidak berubah:

```bash
rg -n "^reviewer:|^freeze_catatan:|^status:" \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" \
  "docs/logbook/2026-09-10_M-freeze-backend-at-M5_Hylmi.md"
```

Expect: reviewer semua Halimah (PIC D - QA), freeze_catatan ada di M3/M4/M5, status M3/M4/M5 `done`, pivot `planned`.

Validasi JSON masih valid:

```bash
python -m json.tool "docs/logbook/2026-09-04_M5_sample-otp-request.json"
```

## Langkah 7 - Commit lokal

Stage hanya file scope:

```bash
git add -- \
  "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" \
  "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" \
  "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"
```

Review staged diff:

```bash
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
```

Commit lokal dengan pesan:

```text
docs: fix M4 checklist glitch, renumber M5 sample subsection, fill commit hash
```

Perintah:

```bash
git commit -m "docs: fix M4 checklist glitch, renumber M5 sample subsection, fill commit hash"
```

## Langkah 8 - Post-commit report

Setelah commit berhasil, laporkan:

1. Commit hash pendek hasil commit baru (`git rev-parse --short HEAD`).
2. Daftar file yang ter-commit (seharusnya tepat 3 file).
3. Hasil setiap validation gate pada Langkah 6.
4. Konfirmasi tidak ada push (`git rev-parse --abbrev-ref --symbolic-full-name @{u}` lalu cek `local != upstream` atau bandingkan `HEAD` vs `upstream`).
5. Konfirmasi reviewer, freeze_catatan, dan status tidak berubah.

## Acceptance criteria

- [ ] M4 line 108 hanya punya satu titik di akhir.
- [ ] M5 line 100 subsection bernomor `### 5.1`.
- [ ] M3, M4, M5 commit hash sudah berisi `045ae9b`.
- [ ] JSON sample tetap valid.
- [ ] Tidak ada lagi `<isi setelah push>` di `docs/logbook/`.
- [ ] Reviewer, freeze_catatan, dan status tidak berubah.
- [ ] `git diff --check` lulus pada unstaged dan staged diff.
- [ ] Commit lokal baru berhasil dan tepat berisi 3 file scope.
- [ ] Tidak ada push.
