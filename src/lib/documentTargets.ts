/**
 * Dokumen mana saja yang ditolak pada satu penolakan.
 *
 * Disimpan terpisah dari `rejectionReason` karena teks bebas tidak bisa dipakai
 * untuk menandai baris dokumen di aplikasi mobile: sebelumnya klien menebak dari
 * kata kunci ("ktp", "sim", "ttd") sehingga alasan seperti "foto buram" dianggap
 * menolak ketiga dokumen sekaligus.
 */
export const DOCUMENT_TARGETS = ['KTP', 'SIM', 'STATEMENT'] as const;

export type DocumentTarget = (typeof DOCUMENT_TARGETS)[number];

function isDocumentTarget(value: string): value is DocumentTarget {
  return (DOCUMENT_TARGETS as readonly string[]).includes(value);
}

/** Membaca kolom JSON dari database menjadi array yang sudah tervalidasi. */
export function parseDocumentTargets(raw: string | null | undefined): DocumentTarget[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item).toUpperCase())
      .filter((item): item is DocumentTarget => isDocumentTarget(item));
  } catch {
    return [];
  }
}

/**
 * Menyeragamkan masukan klien. Nilai yang tidak dikenal tidak diam-diam dibuang:
 * penolakan yang targetnya salah akan membuat pelanggan memperbaiki dokumen yang
 * keliru, jadi lebih baik ditolak di depan.
 */
export function requireDocumentTargets(input: unknown): DocumentTarget[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<DocumentTarget>();
  for (const item of input) {
    const normalized = String(item).toUpperCase();
    if (!isDocumentTarget(normalized)) {
      throw new Error(`TARGET_TIDAK_DIKENAL:${item}`);
    }
    unique.add(normalized);
  }

  // Urutan mengikuti urutan tampil di klien, bukan urutan kiriman.
  return DOCUMENT_TARGETS.filter((target) => unique.has(target));
}

export function serializeDocumentTargets(targets: DocumentTarget[]): string | null {
  return targets.length > 0 ? JSON.stringify(targets) : null;
}

/**
 * Menebak target dari catatan lama yang masih memakai awalan `[Foto SIM A]:`.
 * Hanya dipakai untuk mengisi data yang sudah tersimpan sebelum kolom ini ada.
 */
export function documentTargetsFromLegacyReason(reason: string | null | undefined): DocumentTarget[] {
  if (!reason) return [];
  const text = reason.toLowerCase();
  const targets = new Set<DocumentTarget>();

  if (text.includes('ktp') || text.includes('identitas')) targets.add('KTP');
  if (text.includes('sim')) targets.add('SIM');
  if (
    text.includes('pernyataan') ||
    text.includes('surat') ||
    text.includes('ttd') ||
    text.includes('tanda tangan') ||
    text.includes('meterai')
  ) {
    targets.add('STATEMENT');
  }

  return DOCUMENT_TARGETS.filter((target) => targets.has(target));
}
