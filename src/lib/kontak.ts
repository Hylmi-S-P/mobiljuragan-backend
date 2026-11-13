/**
 * Nomor kontak kantor yang dipakai di dalam pesan bantuan.
 *
 * Satu tempat saja: nomor ini muncul di pesan pembuka tiket pesanan, dan
 * menggantinya di beberapa berkas pernah membuat dua nomor berbeda beredar.
 * Nilainya masih nomor uji sampai kantor memberi nomor resmi.
 */
export const NOMOR_WHATSAPP_KANTOR = '0812-3456-7890';

/** Label jam yang dipakai di pesan bantuan, mis. "20 Nov 2026, 09.00 WIT". */
export function formatWaktuBantuan(waktu: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jayapura',
  }).format(waktu);
}
