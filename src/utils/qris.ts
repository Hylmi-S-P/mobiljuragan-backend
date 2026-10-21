import { crc16CcittFalse } from './crc16.js';

export const OFFICIAL_GOPAY_QRIS_STRING =
  '00020101021126610014COM.GO-JEK.WWW01189360091433744961360210G3744961360303UMI51440014ID.CO.QRIS.WWW0215ID10254456994790303UMI5204549953033605802ID5925HYLMI SHAFIY PRANAMA, Gro6010YOGYAKARTA61055517162070703A0163041261';

export interface EmvTag {
  tag: string;
  len: number;
  val: string;
}

/**
 * Parsing payload TLV (Tag-Length-Value) EMVCo QR Code.
 */
export function parseEmvTLV(data: string): EmvTag[] {
  let idx = 0;
  const tags: EmvTag[] = [];
  while (idx < data.length) {
    if (idx + 4 > data.length) {
      break;
    }
    const tag = data.substring(idx, idx + 2);
    const len = parseInt(data.substring(idx + 2, idx + 4), 10);
    if (isNaN(len) || idx + 4 + len > data.length) {
      break;
    }
    const val = data.substring(idx + 4, idx + 4 + len);
    tags.push({ tag, len, val });
    idx += 4 + len;
  }
  return tags;
}

/**
 * Menyusun kembali array EmvTag menjadi string TLV EMVCo.
 */
export function serializeEmvTLV(tags: EmvTag[]): string {
  let result = '';
  for (const t of tags) {
    const lenStr = t.len.toString().padStart(2, '0');
    result += `${t.tag}${lenStr}${t.val}`;
  }
  return result;
}

/**
 * Injeksi nominal dinamis (Tag 54) ke dalam string QRIS statis Gopay Merchant resmi.
 * - Mengubah Tag 01 dari '11' (statis) menjadi '12' (dinamis).
 * - Menyisipkan Tag 54 dengan format `54{len}{amount}` setelah Tag 53 dan sebelum Tag 58.
 * - Menghitung ulang checksum CRC-16 CCITT-FALSE (Tag 63).
 */
export function injectDynamicAmount(staticQris: string, amount: number): string {
  const roundedAmount = Math.round(amount);
  if (roundedAmount <= 0) {
    throw new Error('Nominal transaksi QRIS harus lebih besar dari 0.');
  }

  const tags = parseEmvTLV(staticQris);
  if (tags.length === 0) {
    throw new Error('Format string QRIS tidak valid atau kosong.');
  }

  // 1. Hapus Tag 63 lama (CRC)
  const cleanTags = tags.filter((t) => t.tag !== '63');

  // 2. Ubah Tag 01 menjadi '12' (Dinamis)
  const tag01 = cleanTags.find((t) => t.tag === '01');
  if (tag01) {
    tag01.val = '12';
    tag01.len = 2;
  } else {
    cleanTags.unshift({ tag: '01', len: 2, val: '12' });
  }

  // 3. Format Tag 54
  const amountStr = roundedAmount.toString();
  const tag54: EmvTag = {
    tag: '54',
    len: amountStr.length,
    val: amountStr,
  };

  // 4. Posisikan Tag 54: setelah Tag 53 (Currency) dan sebelum Tag 58 (Country Code)
  const existing54Idx = cleanTags.findIndex((t) => t.tag === '54');
  if (existing54Idx !== -1) {
    cleanTags[existing54Idx] = tag54;
  } else {
    const idx58 = cleanTags.findIndex((t) => t.tag === '58');
    if (idx58 !== -1) {
      cleanTags.splice(idx58, 0, tag54);
    } else {
      const idx53 = cleanTags.findIndex((t) => t.tag === '53');
      if (idx53 !== -1) {
        cleanTags.splice(idx53 + 1, 0, tag54);
      } else {
        cleanTags.push(tag54);
      }
    }
  }

  // 5. Serialize dan tambahkan header Tag 63 '6304'
  const payloadToSign = serializeEmvTLV(cleanTags) + '6304';

  // 6. Hitung Checksum CRC-16 CCITT-FALSE
  const checksum = crc16CcittFalse(payloadToSign);

  return payloadToSign + checksum;
}

/**
 * Generate string QRIS dinamis siap pakai dari template resmi Gopay Merchant.
 */
export function generateDynamicQris(amount: number, staticQris = OFFICIAL_GOPAY_QRIS_STRING): string {
  return injectDynamicAmount(staticQris, amount);
}

/**
 * Memverifikasi integritas checksum CRC-16 string QRIS.
 */
export function verifyQrisChecksum(qrisString: string): boolean {
  if (!qrisString || qrisString.length < 8) return false;
  const tag63Idx = qrisString.indexOf('6304');
  if (tag63Idx === -1 || tag63Idx + 8 !== qrisString.length) return false;

  const dataToVerify = qrisString.substring(0, tag63Idx + 4);
  const expectedCrc = qrisString.substring(tag63Idx + 4).toUpperCase();
  const calculatedCrc = crc16CcittFalse(dataToVerify);

  return calculatedCrc === expectedCrc;
}

/**
 * Ekstraksi nominal transaksi dari Tag 54 jika ada pada QRIS dinamis.
 */
export function extractQrisAmount(qrisString: string): number | null {
  const tags = parseEmvTLV(qrisString);
  const tag54 = tags.find((t) => t.tag === '54');
  if (!tag54) return null;
  const num = parseInt(tag54.val, 10);
  return isNaN(num) ? null : num;
}
