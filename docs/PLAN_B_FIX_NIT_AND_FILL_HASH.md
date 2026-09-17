# Plan B - Fix Nit Format + Replace Commit Hash Placeholder

Status: ready for Antigravity execution
Branch: `dev/hylmi`
Workspace: `grand-project-uiux-mobile-webframework-ai`
Planner/validator: Reasonix
Executor: Antigravity
PIC: Hylmi (PIC C - Backend Engineer)
Reviewer: Halimah (PIC D - QA)

## Tujuan

Memperbaiki dua nit format hasil audit commit `045ae9b` dan mengganti placeholder commit hash dengan hash pendek `045ae9b`. Output akhir adalah satu commit lokal tambahan tanpa push.

## Latar belakang singkat

Commit `045ae9b` (`docs: tighten logbook freeze metadata and reviewer consistency`) sudah berisi 9 file, status pivot tetap `planned`, reviewer Halimah, freeze_catatan paralel, JSON valid, tidak ada OTP plaintext, dan tidak ada reviewer placeholder. Validator menemukan dua nit format yang bukan blocker:

1. `docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md` line 108: kalimat checklist reviewer memiliki dua titik literal di akhir (akhiran `..` setelah frasa `data integrity`).
2. `docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md` line 100: subsection bernomor `### 6.1` tetapi parent heading di sekitarnya adalah `## 5. Hasil dan evidence`. Penomoran menjadi inkonsisten dengan M3, sehingga lebih baik di-rename ke `### 5.1`.

Selain itu placeholder `<isi setelah push>` di M3/M4/M5 bisa diganti dengan hash `045ae9b` agar konsisten dengan aturan "claim done harus ada bukti" di TEAM_POLICY.

## Batasan

1. Jangan mengubah status M3/M4/M5 dari `done` dan pivot dari `planned (menunggu ACC tim)`.
2. Jangan mengubah reviewer, hanya boleh membersihkan teks checklist di M4 dan nomor subsection di M5.
3. Jangan menulis OTP plaintext, harga, rating, statistik, atau data fiktif lain.
4. Jangan push ke remote. Commit lokal saja.
5. Jangan menyentuh `docs/logbook/2026-09-07_M-ux_lofi-wireframe_Hylmi.md`, file di luar scope, atau file back-end.
6. Placeholder `<isi setelah push>` diganti dengan literal `045ae9b` (7 karakter short hash). Jangan ganti dengan full hash.

## Files yang harus dikerjakan Antigravity

### 1. M4 checklist glitch

File: `docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md`

Pada line 108, ubah:

```markdown
- [x] Tidak ada harga fiktif atau data rekaan yang melanggar batasan data integrity..
```

menjadi:

```markdown
- [x] Tidak ada harga fiktif atau data rekaan yang melanggar batasan data integrity.
```

Hapus satu titik di akhir baris. Tidak boleh ada karakter tambahan.

### 2. M5 subsection numbering

File: `docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md`

Pada line 100, ubah heading:

```markdown
### 6.1 Sample response `POST /api/v1/auth/otp/request`
```

menjadi:

```markdown
### 5.1 Sample response `POST /api/v1/auth/otp/request`
```

Heading di bawahnya (`### 6.2 Commit hash` atau baris commit placeholder) tetap apa adanya jika ada. Jika tidak ada subsection commit hash di M5, biarkan.

### 3. M3 commit hash placeholder

File: `docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md`

Ganti baris:

```markdown
### 6.2 Commit hash

`<isi setelah push>`
```

menjadi:

```markdown
### 6.2 Commit hash

`045ae9b`
```

### 4. M4 commit hash placeholder

File: `docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md`

Ganti baris:

```markdown
- Commit hash pendek: `<isi setelah push>`
```

menjadi:

```markdown
- Commit hash pendek: `045ae9b`
```

### 5. M5 commit hash placeholder

File: `docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md`

Ganti baris:

```markdown
- Commit hash pendek: `<isi setelah push>`
```

menjadi:

```markdown
- Commit hash pendek: `045ae9b`
```

## Validation gates

Jalankan dari repository root setelah patch:

```bash
git status --short
git diff --check
```

Pastikan tidak ada lagi `<isi setelah push>`:

```bash
if rg -n "<isi setelah push>" "docs/logbook/"; then
  echo "ERROR: placeholder <isi setelah push> masih ada"
  exit 1
else
  echo "PASS: placeholder commit hash sudah diganti"
fi
```

Pastikan tidak ada glitch double period di M4 line 108:

```bash
if rg -n "data integrity\.\." "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md"; then
  echo "ERROR: double period masih ada di M4"
  exit 1
else
  echo "PASS: M4 checklist glitch sudah bersih"
fi
```

Pastikan subsection M5 sudah berubah menjadi 5.1:

```bash
rg -n "^### 5\.1 Sample response" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"
rg -n "^### 6\.1 Sample response" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md" || echo "OK: 6.1 sudah tidak ada"
```

Pastikan substitusi commit hash berhasil:

```bash
rg -n "045ae9b" "docs/logbook/2026-09-03_M3-repository-foundation_Hylmi.md" "docs/logbook/2026-09-04_M4-database-foundation-fleet-seed_Hylmi.md" "docs/logbook/2026-09-04_M5-api-contract-dan-auth_Hylmi.md"
```

Expect: 3 hit.

JSON sample harus tetap valid:

```bash
python -m json.tool "docs/logbook/2026-09-04_M5_sample-otp-request.json"
```

## Commit gate

Stage hanya file scope berikut, bukan `git add .`:

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
```

Commit lokal dengan pesan:

```text
docs: fix M4 checklist glitch, renumber M5 sample subsection, fill commit hash
```

Perintah:

```bash
git commit -m "docs: fix M4 checklist glitch, renumber M5 sample subsection, fill commit hash"
```

## Post-commit report

Setelah commit berhasil, laporkan:

1. Commit hash pendek hasil commit baru.
2. Daftar file yang ter-commit (seharusnya tepat 3 file).
3. Hasil setiap validation gate di atas.
4. Konfirmasi tidak ada push dan tidak ada perubahan status pivot.
5. Konfirmasi reviewer tetap Halimah dan freeze_catatan tidak berubah.

## Acceptance criteria

- [ ] M4 line 108 hanya punya satu titik di akhir.
- [ ] M5 line 100 subsection bernomor `### 5.1`.
- [ ] M3, M4, M5 commit hash sudah berisi `045ae9b`.
- [ ] JSON sample tetap valid.
- [ ] Tidak ada lagi `<isi setelah push>`.
- [ ] Reviewer, freeze_catatan, dan status tidak berubah.
- [ ] `git diff --check` lulus.
- [ ] Commit lokal baru berhasil.
- [ ] Tidak ada push.
